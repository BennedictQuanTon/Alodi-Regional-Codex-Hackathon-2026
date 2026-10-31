"use client";

import { useEffect, useRef } from "react";
import type { DemoState } from "./types";
import { VOICE } from "./voice";

const sfx = (name: "tap" | "pop" | "chime", volume: number) => {
  const a = new Audio(`/audio/sfx/${name}.mp3`);
  a.volume = volume;
  a.play().catch(() => {});
};

/**
 * Judges' demo sound: recorded call lines, a ringtone via WebAudio and three short effects.
 * Browsers only allow sound after a click, so it starts with the Play button.
 */
export function useCallAudio(state: DemoState, enabled: boolean) {
  const spoken = useRef(new Set<string>());
  const current = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled) return;
    for (const v of Object.values(VOICE)) new Audio(v.src).preload = "auto";
  }, [enabled]);

  // Turning sound on mid-call must not replay earlier lines
  const linesRef = useRef(state.call.lines);
  useEffect(() => {
    linesRef.current = state.call.lines;
  });
  useEffect(() => {
    if (enabled) linesRef.current.forEach((l) => spoken.current.add(l.id));
  }, [enabled]);

  // Dialogue
  useEffect(() => {
    if (state.call.lines.length === 0) {
      spoken.current.clear();
      current.current?.pause();
    }
    if (!enabled) return;
    for (const l of state.call.lines) {
      if (spoken.current.has(l.id)) continue;
      spoken.current.add(l.id);
      const v = VOICE[l.text];
      if (!v) continue;
      current.current?.pause();
      const a = new Audio(v.src);
      a.playbackRate = state.speed;
      current.current = a;
      a.play().catch(() => {});
    }
  }, [state.call.lines, enabled, state.speed]);

  // Effects: the shipper's tap, a chat message arriving, the context card and the delivery
  const screen = state.shipper.screen;
  const agentChats = state.chat.filter((m) => m.from === "agent").length;
  const prev = useRef({ screen, agentChats });
  useEffect(() => {
    const p = prev.current;
    prev.current = { screen, agentChats };
    if (!enabled) return;
    if (screen !== p.screen) {
      if (screen === "waiting" || screen === "memo") sfx("tap", 0.8);
      if (screen === "context" || screen === "delivered") sfx("chime", 0.7);
    }
    if (agentChats > p.agentChats) sfx("pop", 0.7);
  }, [screen, agentChats, enabled]);

  // Ringtone while ringing
  useEffect(() => {
    if (!enabled || state.call.status !== "ringing") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    let stopped = false;
    const beep = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      for (const [i, f] of [440, 480].entries()) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06, now + 0.05);
        g.gain.setValueAtTime(0.06, now + 0.9);
        g.gain.linearRampToValueAtTime(0, now + 1);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.001);
        o.stop(now + 1.05);
      }
    };
    beep();
    const iv = setInterval(beep, 2000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [state.call.status, enabled]);

  useEffect(() => {
    if (!enabled) current.current?.pause();
  }, [enabled]);
}
