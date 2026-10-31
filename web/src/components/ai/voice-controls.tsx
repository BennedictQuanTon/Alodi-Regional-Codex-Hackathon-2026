"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { apiUrl, type AiConfig, type IssuedCall } from "@/lib/ai/protocol";
import { VoiceController } from "@/lib/ai/voice-controller";
import "./voice.css";

/** Can be injected into BuyerPhone without coupling transport to the scripted engine. */
export function VoiceControls({ controller, trackingId, issuedCall }: { controller: VoiceController; trackingId: string; issuedCall?: IssuedCall }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const busy = ["connecting", "connected", "consent", "ending"].includes(state.status);
  return (
    <section className="ai-card" aria-label="Buyer voice call">
      <div className="ai-row"><h2>Buyer call</h2><span className="ai-pill">{state.status}</span></div>
      <p className="ai-muted">{controller.config.mode === "stub" ? "Stub captions · no microphone or generated speech" : "Vietnamese speech · cloud voice service"}</p>
      {!busy && <button className="ai-primary" onClick={() => void (issuedCall ? controller.prepareIssued(issuedCall) : controller.prepare(trackingId))} disabled={!controller.config.ready || (controller.config.bridge_mode === "part1" && !issuedCall)}>{issuedCall ? "Answer issued call" : controller.config.bridge_mode === "part1" ? "Waiting for a workflow-issued call" : "Start fixture call"}</button>}
      {state.status === "consent" && (
        <ConsentPrompt key={state.callId} controller={controller} />
      )}
      <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
      {state.notice && <p role="status">{state.notice}</p>}
      {["connecting", "ending"].includes(state.status) && <button onClick={() => void controller.end("cancelled")}>Close call</button>}
      {state.status === "connected" && (
        <>
          <div className="ai-row"><label htmlFor="voice-level">Microphone level</label><span>{state.seconds}s / {controller.config.limits.call_seconds}s</span></div>
          <meter id="voice-level" min={0} max={1} value={Math.min(1, state.level * 4)} aria-label="Live microphone level" />
          <p className="ai-muted">{controller.config.mode === "stub" ? "Microphone off in stub mode." : "Level shows actual microphone input."}</p>
          <div className="ai-actions"><button onClick={() => void controller.end()}>End call</button>{state.needsPlayback && <button onClick={() => void controller.playAudio()}>Enable call audio</button>}</div>
        </>
      )}
      <div className="ai-captions" role="log" aria-live="polite" aria-label="Backend call captions">
        {state.captions.length === 0 && <p className="ai-muted">Captions will appear here.</p>}
        {state.captions.map((caption) => <p key={`${caption.speaker}:${caption.turn_id}`} className={caption.final ? "" : "ai-muted"}><strong>{caption.speaker === "buyer" ? "Buyer" : "Alodi"}</strong> {caption.text}{!caption.final && " …"}</p>)}
      </div>
    </section>
  );
}

function ConsentPrompt({ controller }: { controller: VoiceController }) {
  const [complete, setComplete] = useState(false);
  return <div className="ai-consent">
    <h3>Before you answer</h3>
    <p>{controller.config.disclosure.text}</p>
    <DisclosureNotice disclosure={controller.config.disclosure} apiBase={controller.base} onComplete={() => setComplete(true)} />
    <div className="ai-actions">
      <button className="ai-primary" disabled={!complete} onClick={() => { if (complete) void controller.connect(); }}>Agree and continue</button>
      <button onClick={() => void controller.end("decline")}>Use chat</button>
    </div>
    <p className="ai-muted">Finish the disclosure before agreeing. Your microphone stays off until Alodi finishes speaking and invites your response. Declining closes this call. Part 1 chat integration is pending in this harness.</p>
  </div>;
}

export function DisclosureNotice({ disclosure, onComplete, apiBase }: { disclosure: AiConfig["disclosure"]; onComplete: () => void; apiBase?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [notice, setNotice] = useState("Playing the fixed disclosure. Please wait before agreeing.");
  const [fallback, setFallback] = useState(!disclosure.audio_url);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const element = audio.current;
    let active = true;
    if (element) void element.play().catch(() => { if (active) { setPlaying(false); setNotice("Autoplay is blocked. Choose Play notice to hear the full disclosure."); } });
    return () => { active = false; if (element) { element.pause(); element.currentTime = 0; } };
  }, [disclosure.audio_url, apiBase]);
  async function play() {
    try { await audio.current?.play(); }
    catch { setNotice("Playback is blocked. Allow audio in your browser, then choose Play notice again."); }
  }
  return <>
    {disclosure.audio_url && <audio ref={audio} preload="auto" src={apiUrl(disclosure.audio_url, apiBase)}
      onPlay={() => { setPlaying(true); setNotice("Playing the fixed disclosure. Please wait before agreeing."); }}
      onEnded={() => { setPlaying(false); setFinished(true); setNotice("Disclosure finished. You can agree and continue."); onComplete(); }}
      onError={() => { audio.current?.pause(); setPlaying(false); setFallback(true); setNotice("Disclosure audio is unavailable. Read the complete notice above, then confirm below."); }} />}
    {disclosure.audio_url && !finished && !fallback && <button disabled={playing} onClick={() => void play()}>Play notice</button>}
    {fallback && !finished && <button onClick={() => { setFinished(true); setNotice("Written disclosure acknowledged. You can agree and continue."); onComplete(); }}>I have read the full disclosure</button>}
    <p className="ai-muted" role="status">{!disclosure.audio_url && !finished ? "No disclosure clip is available. Read the complete notice above, then confirm below." : notice}</p>
  </>;
}
