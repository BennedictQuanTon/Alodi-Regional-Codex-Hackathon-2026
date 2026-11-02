"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveAnswer } from "@/lib/demo/scenarios";

// The visitor's own turn on the call: they answer as the buyer, Alodi hears it and fills the real card.

export type TrialState = "loading" | "ready" | "day" | "ip" | "ended" | "off";
export type Trial = { state: TrialState; left: number; token: string | null };

export const SORRY: Partial<Record<TrialState, string>> = {
  day: "Sorry, today’s live trials are used up. Please come back tomorrow, or watch it on auto.",
  ip: "You’ve used your live tries for today. Please come back tomorrow, or watch it on auto.",
  ended: "Live trials have ended. From now on, this demo runs on auto.",
};

export function useTrial() {
  const [trial, setTrial] = useState<Trial>({ state: "loading", left: 0, token: null });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/try", { cache: "no-store" });
      setTrial((await response.json()) as Trial);
    } catch {
      setTrial({ state: "off", left: 0, token: null });
    }
  }, []);
  useEffect(() => {
    let alive = true;
    void fetch("/api/try", { cache: "no-store" })
      .then((response) => response.json() as Promise<Trial>)
      .catch((): Trial => ({ state: "off", left: 0, token: null }))
      .then((next) => { if (alive) setTrial(next); });
    return () => { alive = false; };
  }, []);
  return { trial, setTrial, refresh };
}

const TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
type TurnstileApi = { render: (el: HTMLElement, options: object) => string };

function turnstileToken(host: HTMLElement) {
  return new Promise<string>((resolve) => {
    const render = () => (window as unknown as { turnstile: TurnstileApi }).turnstile.render(host, {
      sitekey: TURNSTILE,
      appearance: "interaction-only",
      callback: resolve,
      "error-callback": () => resolve(""),
    });
    if ("turnstile" in window) return void render();
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload = render;
    script.onerror = () => resolve("");
    document.head.appendChild(script);
  });
}

const MAX_MS = 10_000;
const QUIET_STOP_MS = 1_200;
const NO_VOICE_MS = 6_000;
const VOICE_LEVEL = 0.012;
const MIN_VOICE_MS = 350;
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type Phase = "ready" | "listening" | "thinking" | "sorry";

/** Records one answer in the browser, sends it only if someone actually spoke. */
export function LiveTurn({ stream, trial, onTrial, onAck, onDone }: {
  stream: MediaStream;
  trial: Trial;
  onTrial: (next: Trial) => void;
  onAck: () => void;
  onDone: (answer: LiveAnswer | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [note, setNote] = useState("");
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const token = useRef(trial.token);
  const verifier = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const bot = useRef<Promise<string>>(Promise.resolve(""));

  useEffect(() => {
    if (TURNSTILE && verifier.current) bot.current = turnstileToken(verifier.current);
  }, []);

  const leave = useCallback((message: string, answer: LiveAnswer | null = null) => {
    setPhase("sorry");
    setNote(message);
    window.setTimeout(() => onDone(answer), 2_800);
  }, [onDone]);

  const send = useCallback(async (blob: Blob) => {
    setPhase("thinking");
    onAck();
    const form = new FormData();
    form.set("audio", blob);
    form.set("token", token.current ?? "");
    form.set("turnstile", await bot.current);
    try {
      const response = await fetch("/api/try", { method: "POST", body: form, signal: AbortSignal.timeout(14_000) });
      const body = await response.json();
      token.current = body.token ?? token.current;
      if (body.left !== undefined) onTrial({ state: body.left > 0 ? "ready" : "ip", left: body.left, token: token.current });
      if (body.state === "done") {
        setHeard(body.answer.transcript);
        return onDone(body.answer as LiveAnswer);
      }
      if (body.state === "retry") {
        setNote("Alodi couldn’t hear that. Please try again.");
        return setPhase("ready");
      }
      if (body.state === "day" || body.state === "ip" || body.state === "ended") {
        onTrial({ state: body.state, left: 0, token: null });
        return leave(SORRY[body.state as TrialState] ?? "");
      }
      leave("Live mode isn’t available right now, so the demo carries on with the scripted answer.");
    } catch {
      leave("That took too long, so the demo carries on with the scripted answer.");
    }
  }, [leave, onAck, onDone, onTrial]);

  const listen = useCallback(() => {
    setNote("");
    setPhase("listening");
    setSeconds(10);
    const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
    const chunks: Blob[] = [];
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const began = performance.now();
    let last = began;
    let voiced = 0;
    let quiet = 0;
    let frame = 0;
    let ended = false;
    const stop = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(frame);
      if (recorder.state !== "inactive") recorder.stop();
    };
    stopRef.current = stop;
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      void context.close();
      setLevel(0);
      if (voiced < MIN_VOICE_MS) { // nothing said: no request, no try used
        setNote("Alodi didn’t hear anything. Check your microphone and try again.");
        return setPhase("ready");
      }
      void send(new Blob(chunks, { type: recorder.mimeType }));
    };
    const tick = () => {
      const now = performance.now();
      const step = now - last;
      last = now;
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
      setLevel(Math.min(1, rms * 9));
      if (rms > VOICE_LEVEL) { voiced += step; quiet = 0; } else quiet += step;
      setSeconds(Math.max(0, Math.ceil((MAX_MS - (now - began)) / 1000)));
      if (now - began > MAX_MS || (voiced > MIN_VOICE_MS && quiet > QUIET_STOP_MS) || (voiced === 0 && now - began > NO_VOICE_MS)) return stop();
      frame = requestAnimationFrame(tick);
    };
    recorder.start();
    frame = requestAnimationFrame(tick);
  }, [send, stream]);

  useEffect(() => () => stopRef.current(), []);

  const active = phase === "listening";
  return (
    <div className="tl" role="dialog" aria-label="Answer the call">
      <div ref={verifier} className="tl-verify" />
      <div className="tl-head">
        <b>{phase === "thinking" ? "Alodi is working on it" : phase === "sorry" ? "Back to auto" : active ? "Alodi is listening" : "Your turn. You’re the buyer."}</b>
        {phase === "ready" && <span>{note || "Tell Alodi when, where and who. Try: “Tomorrow after five, leave it at Tower B security.”"}</span>}
        {active && <span>Stops by itself when you finish · {seconds}s left</span>}
        {phase === "thinking" && <span>{heard || "Turning your answer into a delivery card…"}</span>}
        {phase === "sorry" && <span>{note}</span>}
      </div>
      {(phase === "ready" || active) && (
        <button className={`tl-mic ${active ? "on" : ""}`} onClick={active ? () => stopRef.current() : listen} aria-label={active ? "Stop" : "Start speaking"}>
          <i style={{ transform: `scale(${1 + level * 0.7})` }} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {active ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
          </svg>
        </button>
      )}
      {phase === "thinking" && <span className="tl-wait" aria-hidden><i /><i /><i /></span>}
      {phase === "ready" && <button className="tl-skip" onClick={() => onDone(null)}>Use the scripted answer</button>}
    </div>
  );
}
