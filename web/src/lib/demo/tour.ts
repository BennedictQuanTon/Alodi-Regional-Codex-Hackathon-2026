"use client";

import { useEffect, useRef } from "react";
import type { StepDirector } from "./engine";
import { getLiveAnswer, stepsFor } from "./scenarios";
import script from "./tour-script.json";
import type { DemoState, Step } from "./types";

const CLIPS = script as Record<string, { voice: string; text: string }>;

export const TOUR_STEPS = stepsFor("A_main");

// Lines that change once a visitor has answered for themselves.
const LIVE_CLIP: Record<string, string> = { c_confirm: "c_live_confirm", a_nextday: "a_live_nextday", l_bye: "l_live_bye", l_extract: "l_live_review" };
const LIVE_SILENT = new Set(["c_reply", "c_ok", "l_reply"]);
const clipFor = (id: string) => {
  if (!getLiveAnswer()) return CLIPS[id] ? id : null;
  if (LIVE_SILENT.has(id)) return null;
  const clip = LIVE_CLIP[id] ?? id;
  return CLIPS[clip] ? clip : null;
};

export const CHAPTERS = [
  { label: "Morning", from: "p_fetch" },
  { label: "Missed delivery", from: "p_arrive" },
  { label: "Rescue chat", from: "a_press" },
  { label: "AI call", from: "a_wait60" },
  { label: "Context card", from: "a_extract" },
  { label: "Second drop", from: "a_nextday" },
].map((chapter) => ({ ...chapter, step: TOUR_STEPS.findIndex((step) => step.id === chapter.from) }));

export function currentChapter(step: number) {
  return CHAPTERS.reduce((current, chapter, index) => (step >= chapter.step ? index : current), 0);
}

/** Which screen the viewer should be watching, so a narrow window can follow the story. */
export function focusOf(s: DemoState): "shipper" | "buyer" | "ops" {
  if (s.stage === "extract" || s.stage === "review") return "ops";
  if (s.stage === "chat" || s.stage === "call1" || s.stage === "call2") return "buyer";
  if (s.stage === "pre" && s.chat.length > 0 && s.shipper.screen === "route") return "buyer";
  return "shipper";
}

/** Plays one voice clip at a time and holds the story until it has finished. */
export class TourAudio implements StepDirector {
  private voice?: HTMLAudioElement;
  private ringing?: HTMLAudioElement;
  private ack?: HTMLAudioElement;
  private finish?: () => void;
  private paused = false;
  muted = false;
  private onSubtitle?: (text: string, voice: string) => void;
  /** Set for a live run: resolves with "auto" if the scripted answer should play instead. */
  private turn?: () => Promise<"live" | "auto">;
  setTurn(turn?: () => Promise<"live" | "auto">) {
    this.turn = turn;
  }

  /** Receives the words being spoken, for subtitles. */
  listen(onSubtitle: (text: string, voice: string) => void) {
    this.onSubtitle = onSubtitle;
  }

  /** Call inside the Start tap, so the browser allows every later clip on this element. */
  unlock() {
    this.voice ||= new Audio();
    this.ringing ||= Object.assign(new Audio("/tour/sfx-ring.mp3"), { loop: true, volume: 0.15 });
    this.setMuted(this.muted);
    this.ack ||= new Audio("/tour/c_live_ack.mp3");
    // Fetch every clip up front, so a slow network doesn't leave gaps in the story.
    for (const id of Object.keys(CLIPS)) new Audio(`/tour/${id}.mp3`).preload = "auto";
  }

  setMuted(muted: boolean) {
    // Muted clips keep playing silently, so the story keeps its timing.
    this.muted = muted;
    if (this.voice) this.voice.muted = muted;
    if (this.ringing) this.ringing.muted = muted;
  }

  // Dialogue appears as it starts, then the clip sets the pace.
  pace = (step: Step) => {
    const clip = clipFor(step.id);
    return clip && CLIPS[clip].voice !== "narrator" ? 150 : undefined;
  };

  /** Plays at once when the visitor stops talking, so the wait never feels like silence. */
  acknowledge = () => {
    if (this.muted || !this.ack) return;
    this.ack.currentTime = 0;
    this.ack.playbackRate = 1.12;
    void this.ack.play().catch(() => {});
    this.onSubtitle?.(CLIPS.c_live_ack.text, "agent");
  };

  gate = (step: Step): Promise<void> | undefined => {
    if (!this.turn || step.id !== "c_reply") return undefined;
    return this.turn().then(() => undefined);
  };

  begin = (step: Step): Promise<void> | undefined => {
    const clip = clipFor(step.id);
    return clip ? this.play(clip) : undefined;
  };

  private play(clip: string) {
    const voice = this.voice;
    if (!voice) return undefined;
    this.settle();
    this.onSubtitle?.(CLIPS[clip].text, CLIPS[clip].voice);
    return new Promise<void>((resolve) => {
      this.finish = resolve;
      voice.onended = voice.onerror = () => this.settle();
      voice.src = `/tour/${clip}.mp3`;
      voice.playbackRate = 1.12;
      voice.play().catch(() => this.settle());
    });
  }

  private settle() {
    const finish = this.finish;
    this.finish = undefined;
    finish?.();
  }

  pause = () => {
    this.paused = true;
    this.voice?.pause();
    this.ringing?.pause();
  };

  resume = () => {
    this.paused = false;
    if (this.finish) void this.voice?.play().catch(() => this.settle());
    if (this.wantsRing) void this.ringing?.play().catch(() => {});
  };

  stop = () => {
    this.voice?.pause();
    this.settle();
  };

  private wantsRing = false;
  ring(on: boolean) {
    this.wantsRing = on;
    if (on && !this.paused) void this.ringing?.play().catch(() => {});
    if (!on && this.ringing) { this.ringing.pause(); this.ringing.currentTime = 0; }
  }

  effect(name: "tap" | "pop" | "chime") {
    if (this.muted || this.paused || !this.voice) return;
    const sound = new Audio(`/tour/sfx-${name}.mp3`);
    sound.volume = 0.5;
    void sound.play().catch(() => {});
  }

  dispose() {
    this.stop();
    this.ring(false);
  }
}

/** Sound effects follow what the story has just done, including after a chapter jump. */
export function useTourEffects(s: DemoState, audio: TourAudio) {
  const seen = useRef({ chat: 0, screen: s.shipper.screen, card: false });
  useEffect(() => {
    audio.ring(s.playing && s.call.status === "ringing");
  }, [audio, s.playing, s.call.status]);
  useEffect(() => {
    const before = seen.current;
    if (s.chat.length === before.chat + 1) audio.effect("pop");
    if (s.shipper.screen !== before.screen && s.shipper.screen === "waiting") audio.effect("tap");
    if ((s.card && !before.card) || (s.shipper.screen !== before.screen && s.shipper.screen === "delivered")) audio.effect("chime");
    seen.current = { chat: s.chat.length, screen: s.shipper.screen, card: !!s.card };
  }, [audio, s.chat.length, s.shipper.screen, s.card]);
}
