"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { API_URL, errorMessage, post, request, type AiConfig, type Fixture } from "@/lib/ai/protocol";
import { VoiceController } from "@/lib/ai/voice-controller";
import { MemoRecorder } from "./memo-recorder";
import { VoiceControls } from "./voice-controls";
import Link from "next/link";
import "./voice.css";

function CallEvidence({ controller, refresh }: { controller: VoiceController; refresh: () => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { if (state.result) refresh(); }, [state.result, refresh]);
  return <>
    {controller.config.mode === "stub" && <section className="ai-card">
      <h2>Typed transport test</h2>
      <p className="ai-muted">Development injection into the backend turn service. This is typed input, not microphone recognition. Stub responses are deterministic fixtures.</p>
      <form onSubmit={async (event) => { event.preventDefault(); if (!text.trim() || sending) return; setSending(true); await controller.typedTurn(text.trim()); setText(""); setSending(false); }}>
        <label htmlFor="typed-turn">Buyer message</label>
        <textarea id="typed-turn" value={text} onChange={(event) => setText(event.target.value)} placeholder="Mai giao sau 5 giờ, gửi bảo vệ giúp tôi." rows={3} maxLength={2000} disabled={state.status !== "connected"} />
        <button type="submit" disabled={state.status !== "connected" || sending || !text.trim()}>{sending ? "Sending…" : "Send typed turn"}</button>
      </form>
    </section>}
    <section className="ai-card">
      <h2>Backend decision evidence</h2>
      <p className="ai-muted">A proposal is pending until the server returns a result. The fixture card shows the latest server-held state.</p>
      <h3>Pending proposal</h3><pre>{state.proposal ? JSON.stringify(state.proposal, null, 2) : "No proposal received."}</pre>
      <h3>Applied result / review outcome</h3><pre>{state.result ? JSON.stringify(state.result, null, 2) : "No result received."}</pre>
      <details open><summary>Browser transport diagnostics</summary><pre>{JSON.stringify({ call_id: state.callId, ...state.diagnostics }, null, 2)}</pre></details>
      <details><summary>Provider usage / comparison metrics, when available</summary><pre>{state.usage ? JSON.stringify(state.usage, null, 2) : "No measured usage received."}</pre></details>
    </section>
  </>;
}

export function DevAiHarness() {
  const [config, setConfig] = useState<AiConfig>();
  const [fixture, setFixture] = useState<Fixture>();
  const [controller, setController] = useState<VoiceController>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const owner = useRef<VoiceController | undefined>(undefined);
  const load = useRef<AbortController | undefined>(undefined);
  const refresh = useCallback(() => {
    const signal = load.current?.signal;
    void request<Fixture>("/ai/dev/fixture", { signal }).then((fixture) => { if (!signal?.aborted) setFixture(fixture); }).catch((error) => { if (!signal?.aborted) setError(errorMessage(error)); });
  }, []);

  useEffect(() => {
    const abort = new AbortController(); load.current = abort;
    request<AiConfig>("/ai/config", { signal: abort.signal })
      .then(async (config) => {
        if (abort.signal.aborted) return;
        setConfig(config);
        if (config.bridge_mode !== "fixture") { setLoading(false); return; }
        const fixture = await request<Fixture>("/ai/dev/fixture", { signal: abort.signal });
        if (abort.signal.aborted) return;
        const next = new VoiceController(config); owner.current = next;
        setConfig(config); setFixture(fixture); setController(next); setError(""); setLoading(false);
      }).catch((error) => { if (!abort.signal.aborted) { setError(errorMessage(error)); setLoading(false); } });
    return () => { abort.abort(); owner.current?.dispose(); owner.current = undefined; };
  }, [epoch]);

  async function reset() {
    setLoading(true); setError("");
    // Cancel client resources before resetting server jobs and sessions.
    owner.current?.dispose(); owner.current = undefined;
    setController(undefined);
    load.current?.abort();
    try { await post("/ai/dev/reset", {}); setEpoch((value) => value + 1); }
    catch (error) { setError(errorMessage(error)); setLoading(false); }
  }

  return <main className="ai-harness">
    <header className="ai-header"><div><p className="ai-eyebrow">Alodi · development only</p><h1>Voice & memo lab</h1><p className="ai-muted">Standalone Part 2 fixture harness. Use the <Link href="/dev/integrated">integrated order workspace</Link> for durable backend orders. The main demo remains scripted.</p></div><button onClick={() => void reset()} disabled={loading || config?.bridge_mode !== "fixture"}>Reset fixture & sessions</button></header>
    <section className="ai-card">
      <div className="ai-row"><h2>Service readiness</h2><span className="ai-pill">{config ? `${config.mode === "live" ? "Live AI" : config.mode === "stub" ? "Stub simulation" : "Offline"} · ${config.bridge_mode === "fixture" ? "fixture order state" : "Part 1 bridge"}` : "Service unavailable"}</span></div>
      {loading && <p role="status">Loading backend readiness…</p>}
      {error && <p role="alert">{error} Verify that the independent backend is running at {API_URL}.</p>}
      {config?.bridge_mode === "part1" && <p role="status">This API serves durable Part 1 orders. Open the <Link href="/dev/integrated">integrated workspace</Link>; fixture creation and reset are unavailable here.</p>}
      {config && <><p>{config.ready ? "Ready" : "Not ready"} · GPT Live · gpt-live-1 · {config.transport} · default language: {config.language}</p><p className="ai-muted">Voice calls use GPT Live over WebRTC. No provider credentials are sent to this page.</p><details><summary>Development configuration</summary><pre>{JSON.stringify(config, null, 2)}</pre></details></>}
      {!loading && !controller && config?.bridge_mode !== "part1" && <button onClick={() => { setLoading(true); setEpoch((value) => value + 1); }}>Retry service</button>}
    </section>
    {fixture && <section className="ai-card"><div className="ai-row"><h2>Fixture order · {fixture.tracking_id}</h2><span className="ai-pill">Server version {fixture.context_version}</span></div><p className="ai-muted">Fictional server-held fixture. State is kept in memory and resets when the backend restarts.</p><pre>{JSON.stringify(fixture.context, null, 2)}</pre><button onClick={refresh} disabled={loading}>Refresh fixture state</button><details><summary>Fixture epoch & events</summary><pre>{JSON.stringify({ demo_epoch: fixture.demo_epoch, events: fixture.events }, null, 2)}</pre></details></section>}
    {!loading && controller && fixture && config && <CallWorkspace key={epoch} controller={controller} fixture={fixture} config={config} refresh={refresh} />}
  </main>;
}

function CallWorkspace({ controller, fixture, config, refresh }: { controller: VoiceController; fixture: Fixture; config: AiConfig; refresh: () => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  return <div className="ai-grid">
    <div className="ai-column"><VoiceControls controller={controller} trackingId={fixture.tracking_id} /><MemoRecorder trackingId={fixture.tracking_id} maxSeconds={config.limits.memo_seconds} maxBytes={config.limits.memo_bytes} disabled={!config.ready || ["consent", "connected", "connecting", "ending"].includes(state.status)} onCompleted={refresh} /></div>
    <div className="ai-column"><CallEvidence controller={controller} refresh={refresh} /></div>
  </div>;
}
