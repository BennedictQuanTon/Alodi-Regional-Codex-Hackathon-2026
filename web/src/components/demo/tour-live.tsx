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
const VOICE_LEVEL = 0.008;
const MIN_VOICE_MS = 300;
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type Recognizer = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null };

/** Words on screen as they are spoken, from the browser's own speech service: free, and only for display. */
function liveCaptions(onText: (text: string) => void) {
  const scope = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const Speech = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  // On iPhones a second listener can silence the recording, and the recording is what counts.
  if (!Speech || /iPhone|iPad|iPod/.test(navigator.userAgent)) return () => {};
  try {
    const recognizer = new Speech();
    recognizer.lang = "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.onresult = (event) => onText(Array.from(event.results, (result) => result[0].transcript).join(" ").trim());
    recognizer.onerror = () => {};
    recognizer.start();
    return () => { try { recognizer.stop(); } catch {} };
  } catch {
    return () => {};
  }
}

const FAILED: Record<string, string> = {
  blocked: "This page has been open a while. Please try once more.",
  bad_audio: "That recording didn’t come through. Please try again.",
};

type Phase = "ready" | "listening" | "thinking" | "heard" | "sorry";

/** Listens as soon as Alodi has asked, and sends the answer only if someone actually spoke. */
export function LiveTurn({ stream, trial, onTrial, onAck, onCaption, onDone }: {
  stream: MediaStream;
  trial: Trial;
  onTrial: (next: Trial) => void;
  onAck: () => void;
  onCaption: (text: string) => void;
  onDone: (answer: LiveAnswer | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [note, setNote] = useState("");
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const token = useRef(trial.token);
  const verifier = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const gone = useRef(false);
  const bot = useRef<Promise<string>>(Promise.resolve(""));

  useEffect(() => {
    if (TURNSTILE && verifier.current) bot.current = turnstileToken(verifier.current);
  }, []);

  const leave = useCallback((message: string) => {
    setPhase("sorry");
    setNote(message);
    window.setTimeout(() => onDone(null), 3_200);
  }, [onDone]);

  const retry = useCallback(async (message: string) => {
    setNote(message);
    setPhase("ready");
    try {
      const response = await fetch("/api/try", { cache: "no-store" });
      token.current = ((await response.json()) as Trial).token ?? token.current;
    } catch {}
  }, []);

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
        setPhase("heard");
        onCaption(body.answer.transcript);
        window.setTimeout(() => onDone(body.answer as LiveAnswer), 1_400);
        return;
      }
      if (body.state === "retry") return void retry("Alodi couldn’t make that out. Please try again.");
      if (body.state === "day" || body.state === "ip" || body.state === "ended") {
        onTrial({ state: body.state, left: 0, token: null });
        return leave(SORRY[body.state as TrialState] ?? "");
      }
      void retry(FAILED[body.state] ?? `Alodi couldn’t process that (${body.reason ?? body.state}). Your try wasn’t used if it never reached the model. Please try again.`);
    } catch {
      void retry("That took too long. Please check your connection and try again.");
    }
  }, [leave, onAck, onCaption, onDone, onTrial, retry]);

  const listen = useCallback(() => {
    setNote("");
    setHeard("");
    setPhase("listening");
    setSeconds(10);
    const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
    const chunks: Blob[] = [];
    const context = new AudioContext();
    void context.resume().catch(() => {});
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const began = performance.now();
    let last = began;
    let voiced = 0;
    let quiet = 0;
    let frame = 0;
    let peak = 0;
    let ended = false;
    const stopCaptions = liveCaptions((text) => { setHeard(text); onCaption(text); });
    const stop = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(frame);
      stopCaptions();
      if (recorder.state !== "inactive") recorder.stop();
    };
    stopRef.current = stop;
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      void context.close();
      if (gone.current) return; // the visitor restarted or left: nothing to send
      setLevel(0);
      // A meter that never moved is a meter that doesn't work here, not proof of silence: let the model decide.
      if (peak > 0 && voiced < MIN_VOICE_MS) {
        setNote("Alodi didn’t hear anything. Check your microphone and tap to try again.");
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
      peak = Math.max(peak, rms);
      setLevel(Math.min(1, rms * 12));
      if (rms > VOICE_LEVEL) { voiced += step; quiet = 0; } else quiet += step;
      setSeconds(Math.max(0, Math.ceil((MAX_MS - (now - began)) / 1000)));
      if (now - began > MAX_MS || (voiced > MIN_VOICE_MS && quiet > QUIET_STOP_MS) || (peak > 0 && voiced === 0 && now - began > NO_VOICE_MS)) return stop();
      frame = requestAnimationFrame(tick);
    };
    recorder.start();
    frame = requestAnimationFrame(tick);
  }, [onCaption, send, stream]);

  // Starts once, whatever the parent redraws: a restart here would be a second recording and a second try.
  const start = useRef(listen);
  useEffect(() => {
    start.current = listen;
  }, [listen]);
  useEffect(() => {
    gone.current = false;
    const opening = window.setTimeout(() => start.current(), 0); // Alodi has just finished asking
    return () => {
      window.clearTimeout(opening);
      gone.current = true;
      stopRef.current();
    };
  }, []);

  const active = phase === "listening";
  return (
    <div className="tl" role="dialog" aria-label="Answer the call">
      <div ref={verifier} className="tl-verify" />
      <div className="tl-head">
        <b>{phase === "thinking" ? "Alodi is working on it" : phase === "heard" ? "Alodi heard you" : phase === "sorry" ? "Back to auto" : active ? "Speak now. Alodi is listening." : "Tap to answer"}</b>
        {(active || phase === "thinking" || phase === "heard") && heard ? (
          <p className="tl-words">“{heard}”</p>
        ) : (
          <span>
            {phase === "ready" && (note || "Tell Alodi when, where and who.")}
            {active && "Tell Alodi when, where and who. Try: “Tomorrow after five, leave it at Tower B security.”"}
            {phase === "thinking" && "Turning your answer into a delivery card…"}
            {phase === "sorry" && note}
          </span>
        )}
        {active && <small>Stops by itself when you finish · {seconds}s left</small>}
      </div>
      {(phase === "ready" || active) && (
        <button className={`tl-mic ${active ? "on" : ""}`} onClick={active ? () => stopRef.current() : listen} aria-label={active ? "Done speaking" : "Start speaking"}>
          <i style={{ transform: `scale(${1 + level * 0.8})` }} />
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
