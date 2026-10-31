"use client";

import { useEffect, useRef } from "react";
import type { StepDirector } from "./engine";
import { stepsFor } from "./scenarios";
import script from "./tour-script.json";
import type { DemoState, Step } from "./types";

const CLIPS = script as Record<string, { voice: string; text: string }>;

export const TOUR_STEPS = stepsFor("A_main");

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
  private finish?: () => void;
  private paused = false;
  muted = false;
  private onSubtitle?: (text: string) => void;

  /** Receives the words being spoken, for subtitles. */
  listen(onSubtitle: (text: string) => void) {
    this.onSubtitle = onSubtitle;
  }

  /** Call inside the Start tap, so the browser allows every later clip on this element. */
  unlock() {
    this.voice ||= new Audio();
    this.ringing ||= Object.assign(new Audio("/tour/sfx-ring.mp3"), { loop: true, volume: 0.4 });
    this.setMuted(this.muted);
  }

  setMuted(muted: boolean) {
    // Muted clips keep playing silently, so the story keeps its timing.
    this.muted = muted;
    if (this.voice) this.voice.muted = muted;
    if (this.ringing) this.ringing.muted = muted;
  }

  // Dialogue appears as it starts, then the clip sets the pace.
  pace = (step: Step) => (CLIPS[step.id]?.voice && CLIPS[step.id].voice !== "narrator" ? 150 : undefined);

  begin = (step: Step) => {
    const voice = this.voice;
    if (!voice || !CLIPS[step.id]) return undefined;
    this.settle();
    this.onSubtitle?.(CLIPS[step.id].text);
    return new Promise<void>((resolve) => {
      this.finish = resolve;
      voice.onended = voice.onerror = () => this.settle();
      voice.src = `/tour/${step.id}.mp3`;
      voice.play().catch(() => this.settle());
    });
  };

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
    if (s.card && !before.card) audio.effect("chime");
    seen.current = { chat: s.chat.length, screen: s.shipper.screen, card: !!s.card };
  }, [audio, s.chat.length, s.shipper.screen, s.card]);
}
