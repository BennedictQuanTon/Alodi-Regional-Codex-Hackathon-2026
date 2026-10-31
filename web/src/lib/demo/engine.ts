"use client";

import { VOICE } from "./voice";
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_FOR_KEY, SCENARIOS, initialState, stepsFor } from "./scenarios";
import type { ActionKey, ChoiceKey, DemoState, ScenarioId, Step } from "./types";

/** Lets a presentation pace steps around media: the next step waits for what `begin` returns. */
export type StepDirector = {
  pace?: (step: Step) => number | undefined;
  begin?: (step: Step) => Promise<void> | undefined;
  pause?: () => void;
  resume?: () => void;
  stop?: () => void;
};

/**
 * Demo scenario player.
 *
 * - Each scenario is a list of steps; a step with `wait` pauses for an action
 *   (shipper taps, buyer answers, CS approves). With Auto-tap on, the engine performs it
 *   after a few seconds so the trailer can be recorded hands-free.
 * - Fast-forward clock: steps with `dt`/`to` interpolate the time over `ms` of real time.
 * - Multi-tab sync over BroadcastChannel: the tab that last acted is the "driver" and broadcasts
 *   state, so /demo/shipper, /demo/buyer and /demo/console can be recorded in three windows.
 */

type Msg =
  | { type: "hello"; from: string }
  | { type: "takeover"; from: string }
  | { type: "state"; from: string; state: DemoState };

const CHANNEL = "alodi-demo";
const TICK_MS = 80;

class DemoEngine {
  state: DemoState = initialState();
  private listeners = new Set<() => void>();
  private driver = false;
  private chan: BroadcastChannel | null = null;
  private tabId = Math.random().toString(36).slice(2);
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private connections = 0;
  private director: StepDirector | null = null;
  private hold: Promise<void> | null = null;
  private begun: string | null = null;

  setDirector = (director: StepDirector | null) => {
    this.director = director;
  };

  private endMedia() {
    this.hold = null;
    this.begun = null;
    this.director?.stop?.();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.state;

  connect() {
    this.connections += 1;
    if (this.chan || typeof BroadcastChannel === "undefined") return;
    this.chan = new BroadcastChannel(CHANNEL);
    this.chan.onmessage = (e: MessageEvent<Msg>) => this.onMessage(e.data);
    this.post({ type: "hello", from: this.tabId });
  }

  disconnect() {
    this.connections -= 1;
  }

  private post(m: Msg) {
    this.chan?.postMessage(m);
  }

  private onMessage(m: Msg) {
    if (m.from === this.tabId) return;
    if (m.type === "hello" && this.driver) this.post({ type: "state", from: this.tabId, state: this.state });
    if (m.type === "takeover") {
      this.driver = false;
      this.clearTimers();
    }
    if (m.type === "state") {
      this.driver = false;
      this.clearTimers();
      this.state = m.state;
      this.emit();
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private set(next: DemoState) {
    this.state = next;
    this.emit();
    if (this.driver) this.post({ type: "state", from: this.tabId, state: next });
  }

  private takeover() {
    if (this.driver) return;
    this.driver = true;
    this.post({ type: "takeover", from: this.tabId });
  }

  private lastSaid: string | null = null;

  private clearTimers() {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    if (this.autoTimer) clearTimeout(this.autoTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.stepTimer = this.autoTimer = this.clockTimer = null;
  }

  // ---- controls ------------------------------------------------------------

  play = () => {
    this.takeover();
    if (this.state.done && !stepsFor(this.state.scenario)[this.state.step]) {
      this.endMedia();
      this.state = { ...this.resetState(this.state.scenario), playing: true };
    }
    this.director?.resume?.();
    this.set({ ...this.state, playing: true });
    this.schedule();
  };

  pause = () => {
    this.takeover();
    this.clearTimers();
    this.director?.pause?.();
    this.set({ ...this.state, playing: false });
  };

  toggle = () => (this.state.playing ? this.pause() : this.play());

  private resetState(scenario: ScenarioId): DemoState {
    return { ...initialState(scenario), auto: this.state.auto, speed: this.state.speed };
  }

  reset = (scenario?: ScenarioId) => {
    this.takeover();
    this.clearTimers();
    this.endMedia();
    this.set(this.resetState(scenario ?? this.state.scenario));
  };

  /** Jump straight to a step by replaying the pure step functions, keeping play or pause. */
  seek = (index: number) => {
    this.takeover();
    this.clearTimers();
    this.endMedia();
    const { scenario, playing } = this.state;
    const steps = stepsFor(scenario);
    const key = SCENARIOS.find((x) => x.id === scenario)?.key;
    let s = this.resetState(scenario);
    for (const [i, step] of steps.slice(0, index).entries()) {
      s = { ...s, clock: step.to ?? s.clock + (step.dt ?? 0) };
      if (step.apply) s = step.apply(s, step.wait?.action === "shipper:choose" ? key : undefined);
      s = { ...s, step: i + 1, caption: step.caption ?? s.caption };
    }
    this.set({ ...s, playing });
    this.schedule();
  };

  setAuto = (auto: boolean) => {
    this.takeover();
    this.set({ ...this.state, auto });
    if (auto && this.state.playing && this.state.waitingFor) this.scheduleAuto();
    if (!auto && this.autoTimer) clearTimeout(this.autoTimer);
  };

  setSpeed = (speed: number) => {
    this.takeover();
    this.set({ ...this.state, speed });
  };

  /** Skip the wait: run the current step now (or perform the pending action). */
  next = () => {
    this.takeover();
    this.endMedia();
    const s = this.state;
    if (s.waitingFor) return this.dispatch(s.waitingFor.action, this.autoPayload());
    const steps = stepsFor(s.scenario);
    const step = steps[s.step];
    if (!step) return;
    this.clearTimers();
    const to = s.animTo ?? step.to ?? s.clock + (step.dt ?? 0);
    this.finishStep({ ...s, clock: to, animTo: null, caption: step.caption ?? s.caption });
  };

  dispatch = (action: ActionKey, payload?: string) => {
    this.takeover();
    let s = this.state;
    if (!s.waitingFor || s.waitingFor.action !== action) return;
    this.clearTimers();
    if (action === "shipper:choose" && payload) {
      const key = payload as ChoiceKey;
      const current = SCENARIOS.find((x) => x.id === s.scenario);
      if (current?.key !== key) s = { ...s, scenario: DEFAULT_FOR_KEY[key] };
    }
    const step = stepsFor(s.scenario)[s.step];
    if (step?.apply) s = step.apply(s, payload);
    s = { ...s, waitingFor: null, step: s.step + 1, playing: true };
    this.set(s);
    this.schedule();
  };

  // ---- loop ----------------------------------------------------------------

  private autoPayload() {
    const s = this.state;
    if (s.waitingFor?.action === "shipper:choose") return SCENARIOS.find((x) => x.id === s.scenario)?.key;
    return undefined;
  }

  private scheduleAuto() {
    const s = this.state;
    const step = stepsFor(s.scenario)[s.step];
    if (!step?.wait) return;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(
      () => this.dispatch(step.wait!.action, this.autoPayload()),
      (step.wait.autoMs ?? 2400) / s.speed,
    );
  }

  private schedule() {
    this.clearTimers();
    const s = this.state;
    if (!s.playing || s.waitingFor) return;
    if (this.hold) {
      const hold = this.hold;
      void hold.then(() => {
        if (this.hold !== hold) return;
        this.hold = null;
        this.schedule();
      });
      return;
    }
    const steps = stepsFor(s.scenario);
    const step = steps[s.step];
    if (!step) {
      this.set({ ...s, playing: false });
      return;
    }

    const started = `${s.scenario}:${s.step}`;
    if (this.begun !== started) {
      this.begun = started;
      this.hold = this.director?.begin?.(step) ?? null;
    }

    const from = s.clock;
    const to = s.animTo ?? step.to ?? from + (step.dt ?? 0);
    // let a recorded call line finish before the next step moves on
    const said = s.call.lines[s.call.lines.length - 1];
    const fresh = said && said.id !== this.lastSaid;
    if (said) this.lastSaid = said.id;
    const hold = fresh ? (VOICE[said.text]?.ms ?? 0) + 350 : 0;
    // A director paces around its own clips, so it replaces the recorded-line hold.
    const paced = this.director ? (this.director.pace?.(step) ?? step.ms ?? 1400) : Math.max(step.ms ?? 1400, hold);
    const dur = Math.max(60, paced / s.speed);
    const start = performance.now();
    this.set({ ...s, animTo: to !== from ? to : null, caption: step.caption ?? s.caption });

    if (to !== from) {
      this.clockTimer = setInterval(() => {
        const p = Math.min(1, (performance.now() - start) / dur);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.set({ ...this.state, clock: from + (to - from) * eased });
      }, TICK_MS);
    }

    this.stepTimer = setTimeout(() => {
      if (this.clockTimer) clearInterval(this.clockTimer);
      this.finishStep({ ...this.state, clock: to, animTo: null });
    }, dur);
  }

  private finishStep(s: DemoState) {
    const step = stepsFor(s.scenario)[s.step];
    if (!step) return;
    if (step.wait) {
      this.set({ ...s, waitingFor: { action: step.wait.action, hint: step.wait.hint } });
      if (s.auto && s.playing) this.scheduleAuto();
      return;
    }
    let n = step.apply ? step.apply(s) : s;
    n = { ...n, step: n.step + 1 };
    this.set(n);
    if (n.playing) this.schedule();
  }
}

let engine: DemoEngine | null = null;
const SERVER_STATE = initialState();

export function getEngine() {
  if (!engine) engine = new DemoEngine();
  return engine;
}

export function useDemo() {
  const e = getEngine();
  const state = useSyncExternalStore(e.subscribe, e.get, () => SERVER_STATE);
  useEffect(() => {
    e.connect();
    return () => e.disconnect();
  }, [e]);
  return { state, engine: e };
}

export type { DemoEngine };
