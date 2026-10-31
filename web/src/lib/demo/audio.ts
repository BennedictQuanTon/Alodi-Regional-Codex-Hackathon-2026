"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoState } from "./types";

/**
 * Demo audio mock: ringtone via WebAudio, dialogue via the browser's speechSynthesis (English voice).
 * Production uses pre-recorded phrases + commercial TTS + streaming ASR.
 */
export function useCallAudio(state: DemoState, enabled: boolean) {
  const spoken = useRef(new Set<string>());
  const ctxRef = useRef<AudioContext | null>(null);
  const [hasEnVoice, setHasEnVoice] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setHasEnVoice(speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("en")));
    check();
    speechSynthesis.addEventListener("voiceschanged", check);
    return () => speechSynthesis.removeEventListener("voiceschanged", check);
  }, []);

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
    if (!enabled || !("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    for (const l of state.call.lines) {
      if (spoken.current.has(l.id)) continue;
      spoken.current.add(l.id);
      const u = new SpeechSynthesisUtterance(l.text);
      u.lang = "en-US";
      if (en) u.voice = en;
      u.rate = 1.08 * state.speed;
      u.pitch = l.who === "ai" ? 1.05 : 0.85;
      speechSynthesis.speak(u);
    }
    if (state.call.lines.length === 0) spoken.current.clear();
  }, [state.call.lines, enabled, state.speed]);

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
    if (!enabled && typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }, [enabled]);

  return { hasEnVoice };
}
