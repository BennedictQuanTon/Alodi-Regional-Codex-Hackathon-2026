"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { API_URL, errorMessage, post, request, type AiConfig, type Job } from "@/lib/ai/protocol";
import { currentIssuedCall, currentMemoBinding, tapOrder, undoOrder, type BusinessClock, type OrderDetail, type OrderPage } from "@/lib/ai/integrated";
import { VoiceController } from "@/lib/ai/voice-controller";
import { VoiceControls } from "./voice-controls";
import { MemoRecorder } from "./memo-recorder";
import "./voice.css";

export function IntegratedHarness() {
  const [config, setConfig] = useState<AiConfig>();
  const [apiInput, setApiInput] = useState(API_URL);
  const [apiBase, setApiBase] = useState(API_URL);
  const [connection, setConnection] = useState(0);
  const [orders, setOrders] = useState<OrderPage>();
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<OrderDetail>();
  const [controller, setController] = useState<VoiceController>();
  const [clock, setClock] = useState<BusinessClock>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false);
  const loadingOrder = useRef<AbortController | undefined>(undefined);
  const action = useRef<AbortController | undefined>(undefined);
  const alive = useRef(true);
  const owner = useRef<{ key: string; controller: VoiceController } | undefined>(undefined);


  const loadOrder = useCallback(async (trackingId: string, apiConfig: AiConfig) => {
    if (!trackingId) return;
    loadingOrder.current?.abort();
    const abort = new AbortController(); loadingOrder.current = abort;
    try {
      const [next, time] = await Promise.all([
        request<OrderDetail>(`/orders/${encodeURIComponent(trackingId)}`, { signal: abort.signal }, apiBase),
        request<BusinessClock>("/demo/clock", { signal: abort.signal }, apiBase),
      ]);
      if (!abort.signal.aborted) {
        const key = `${next.order.tracking_id}:${next.order.generation_id}`;
        if (owner.current?.key !== key) {
          owner.current?.controller.dispose();
          const nextController = new VoiceController(apiConfig, apiBase);
          owner.current = { key, controller: nextController }; setController(nextController);
        }
        setDetail(next); setClock(time); setError("");
      }
    } catch (error) { if (!abort.signal.aborted) setError(errorMessage(error)); }
  }, [apiBase]);

  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    async function load() {
      try {
        const next = await request<AiConfig>("/ai/config", { signal: abort.signal }, apiBase);
        if (abort.signal.aborted) return;
        setConfig(next);
        if (next.bridge_mode !== "part1") return;
        const page = await request<OrderPage>("/orders", { signal: abort.signal }, apiBase);
        if (!abort.signal.aborted) {
          const trackingId = page.items[0]?.tracking_id || "";
          setOrders(page); setSelected(trackingId);
          await loadOrder(trackingId, next);
        }
      } catch (error) { if (!abort.signal.aborted) setError(errorMessage(error)); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }
    void load();
    return () => { alive.current = false; abort.abort(); loadingOrder.current?.abort(); action.current?.abort(); owner.current?.controller.dispose(); owner.current = undefined; };
  }, [apiBase, connection, loadOrder]);

  const refresh = useCallback(async () => { if (selected && config) await loadOrder(selected, config); }, [selected, config, loadOrder]);

  async function command(run: (signal: AbortSignal) => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const abort = new AbortController(); action.current = abort;
    try { await run(abort.signal); await refresh(); }
    catch (error) { await refresh(); if (!abort.signal.aborted) setError(errorMessage(error)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }

  return <main className="ai-harness">
    <header className="ai-header"><div><p className="ai-eyebrow">Alodi · development only</p><h1>Integrated order workspace</h1><p className="ai-muted">Durable Part 1 workflow with Part 2 voice and memo processing. The main demo remains scripted.</p><p><Link href="/dev/ai">Standalone fixture lab</Link> · <Link href="/demo">Scripted demo</Link></p></div></header>
    <section className="ai-card">
      <div className="ai-row"><h2>API readiness</h2><span className="ai-pill">{config ? `${config.bridge_mode === "part1" ? "Durable order API" : "Standalone fixture API"} · ${config.mode}` : "Unavailable"}</span></div>
      <form onSubmit={(event) => {
        event.preventDefault();
        try {
          const address = new URL(apiInput);
          if (!["http:", "https:"].includes(address.protocol) || address.username || address.password || address.search || address.hash) throw new Error("Enter an HTTP or HTTPS API base without credentials or query parameters.");
          owner.current?.controller.dispose(); owner.current = undefined;
          setController(undefined); setDetail(undefined); setOrders(undefined); setSelected(""); setClock(undefined); setConfig(undefined); setError(""); setLoading(true);
          setApiBase(address.toString().replace(/\/$/, "")); setConnection((value) => value + 1);
        } catch (error) { setError(errorMessage(error)); }
      }}><label htmlFor="integrated-api">Integrated API address</label><input id="integrated-api" type="url" required value={apiInput} onChange={(event) => setApiInput(event.target.value)} placeholder="http://localhost:8000" disabled={busy} /><button type="submit" disabled={busy || loading}>Connect API</button></form>
      {loading && <p role="status">Loading service configuration…</p>}
      {config?.bridge_mode === "fixture" && <p role="status">This address serves the standalone fixture API. Connect this frontend to the integrated backend to use durable orders.</p>}
      {config?.bridge_mode === "part1" && <p>{config.ready ? "Voice and memo service ready" : "Voice and memo service unavailable"}. {config.mode === "stub" ? "Stub mode uses deterministic responses without provider traffic." : config.mode === "live" ? "Live mode uses GPT Live calls and GPT Transcribe memos." : "Offline mode blocks voice and memo processing."}</p>}
      <p className="ai-muted">API: {apiBase}. Loading or refreshing this workspace does not reserve a call.</p>
      <p className="ai-muted">For a local integrated backend, enter http://localhost:8000. An HTTPS page needs an HTTPS API address. This selection applies only to this workspace; the fixture lab keeps its configured API.</p>
      {error && <p role="alert">{error}</p>}
    </section>
    {config?.bridge_mode === "part1" && <section className="ai-card">
      <div className="ai-row"><h2>Order</h2><button disabled={!selected || busy} onClick={() => void refresh()}>Refresh order and clock</button></div>
      <label htmlFor="integrated-order">Select an order</label>
      <select id="integrated-order" value={selected} disabled={busy} onChange={(event) => { owner.current?.controller.dispose(); owner.current = undefined; setController(undefined); setDetail(undefined); setSelected(event.target.value); if (config) void loadOrder(event.target.value, config); }}>
        {!orders?.items.length && <option value="">No orders available</option>}
        {orders?.items.map((order) => <option key={order.tracking_id} value={order.tracking_id}>{order.tracking_id} · {order.item}</option>)}
      </select>
      <p className="ai-muted">{orders?.total ?? 0} orders · source: {detail?.data_source || orders?.data_source || "unavailable"}</p>
      {selected && !detail && <p role="status">Loading current order…</p>}
    </section>}
    {config && detail && <>
      <section className="ai-card">
        <div className="ai-row"><h2>{detail.order.tracking_id}</h2><span className="ai-pill">{detail.order.status} · version {detail.order.context_version}</span></div>
        <p>{detail.order.item} · {detail.order.buyer_name} · route {detail.order.route_id}</p>
        <div className="ai-actions"><button disabled={busy || !!detail.pending_event} onClick={() => void command((signal) => tapOrder(detail.order, "A", crypto.randomUUID(), signal, apiBase))}>A · No answer</button><button disabled={busy || !!detail.pending_event} onClick={() => void command((signal) => tapOrder(detail.order, "B", crypto.randomUUID(), signal, apiBase))}>B · Rescheduled</button>{detail.pending_event && <button disabled={busy} onClick={() => void command((signal) => undoOrder(detail, crypto.randomUUID(), signal, apiBase))}>Undo pending {detail.pending_event.button}</button>}</div>
        <p className="ai-muted">{detail.pending_event ? `Pending ${detail.pending_event.button} event ${detail.pending_event.id}. Undo is available until ${detail.pending_event.commit_at}. Memo upload waits for commitment.` : "The backend checks the route, current state and contact limits for every action."}</p>
        <h3>Business clock</h3><p>{clock ? `${clock.now} · ${clock.paused ? "paused" : `${clock.speed}× speed`} · automatic buyer ${clock.auto_buyer ? "on" : "off"}` : "Clock unavailable"}</p>
        <div className="ai-actions"><button disabled={busy || !clock || clock.generation_id !== detail.order.generation_id} onClick={() => void command((signal) => post("/demo/clock", { generation_id: detail.order.generation_id, jump: "next_timer" }, signal, apiBase))}>Jump to next business timer</button><button disabled={busy || !clock || clock.generation_id !== detail.order.generation_id} onClick={() => void command((signal) => post("/jobs/run-due", { generation_id: detail.order.generation_id }, signal, apiBase))}>Run due workflow jobs</button></div>
        <p className="ai-muted">These explicit demo controls advance all orders. Running due jobs can issue calls when policy permits in the configured API mode.</p>
      </section>
      {controller && <IntegratedMedia key={`${detail.order.tracking_id}:${detail.order.generation_id}`} controller={controller} config={config} detail={detail} disabled={busy} refresh={refresh} />}
      <section className="ai-card"><h2>Durable order evidence</h2><h3>Current context card</h3><pre>{JSON.stringify(detail.context_card || detail.context, null, 2)}</pre><h3>Rescue cases</h3><pre>{JSON.stringify(detail.rescue_cases, null, 2)}</pre><details><summary>Issued calls and provider jobs</summary><pre>{JSON.stringify({ calls: detail.calls, jobs: detail.provider_requests }, null, 2)}</pre></details><details><summary>Messages and event history</summary><pre>{JSON.stringify({ messages: detail.rescue_messages, events: detail.events }, null, 2)}</pre></details></section>
    </>}
  </main>;
}

function IntegratedMedia({ controller, config, detail, disabled, refresh }: { controller: VoiceController; config: AiConfig; detail: OrderDetail; disabled: boolean; refresh: () => Promise<void> }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const [memoJob, setMemoJob] = useState<Job>();
  const binding = currentMemoBinding(detail);
  const issued = currentIssuedCall(detail);
  const callBusy = ["consent", "connecting", "connected", "ending"].includes(state.status);
  useEffect(() => { if (state.result || state.status === "ended" || state.status === "error") void refresh(); }, [state.result, state.status, refresh]);
  return <div className="ai-grid"><div className="ai-column"><VoiceControls controller={controller} trackingId={detail.order.tracking_id} issuedCall={issued} />{!issued && !callBusy && <p className="ai-muted">No browser call is currently issued for this case. Normal workflow timers and policy determine eligibility.</p>}{!!state.result && <section className="ai-card"><h2>Call result</h2><pre>{JSON.stringify(state.result, null, 2)}</pre></section>}</div><div className="ai-column"><section className="ai-card"><h2>Reschedule memo attachment</h2><p>{binding ? `Committed B event ${binding.shipper_event_id} is ready for a memo.` : "Choose B, keep or undo the pending event, then commit it through the normal business timer. Only an active committed reschedule case accepts a memo."}</p>{memoJob && <><h3>Last completed memo job</h3><pre>{JSON.stringify(memoJob, null, 2)}</pre></>}</section><MemoRecorder key={`${binding?.shipper_event_id ?? "unavailable"}`} trackingId={detail.order.tracking_id} apiBase={controller.base} binding={binding} requireBinding maxSeconds={config.limits.memo_seconds} maxBytes={config.limits.memo_bytes} disabled={disabled || callBusy || !config.ready || !binding} onCompleted={setMemoJob} onSettled={() => void refresh()} /></div></div>;
}
