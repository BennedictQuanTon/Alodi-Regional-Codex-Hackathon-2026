"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LiveOrderMonitor, DEMO_ORDER, resetWorkflow, type MonitorState } from "../ai/live-demo";
import { RouteAController, type RouteARole, type RouteAState } from "../ai/route-a-controller";
import { errorMessage } from "../ai/protocol";
import { liveApiBase } from "./session";

export type Outcome = "A" | "B" | "C";
export type StepStatus = "waiting" | "running" | "done" | "person";

export type LiveState = {
  connected: boolean;
  shipperOnline: boolean;
  order: { id: string; buyer: string; item: string; cod: string; address: string } | null;
  messages: { from: "agent" | "buyer"; text: string; kind?: "chat" | "voice" }[];
  callLog: { id: string; at: string; status: "missed" | "ringing" | "answered" | "ended"; text: string }[];
  started: boolean;
  finishing: boolean;
  call: { status: "idle" | "ringing" | "connected"; caption: string };
  steps: Record<string, { status: StepStatus; at?: string; detail?: string }>;
  card: { when: string; where: string; who: string; confidence: number } | null;
  role: RouteARole;
  connection: RouteAState;
  mode?: "live" | "stub" | "offline";
  generation?: string;
  dataSource?: string;
  phase: string;
  error?: string;
  message?: string;
  resetting: boolean;
  resetStage?: string;
  hasSavedOutcome: boolean;
  result?: Record<string, unknown>;
  proposal?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export const AGENT_STEPS = [
  { id: "tap", label: "Shipper tap", tool: "Shipper event" },
  { id: "policy", label: "Policy check", tool: "Hours, contact limits" },
  { id: "chat", label: "Chat to buyer", tool: "Workflow message" },
  { id: "call", label: "Call the buyer", tool: "GPT-Live-1" },
  { id: "memo", label: "Shipper memo", tool: "GPT Transcribe" },
  { id: "extract", label: "Extract fields", tool: "GPT-6.1 Terra" },
  { id: "decide", label: "Apply or hand to a person", tool: "Confidence ≥ 0.85" },
  { id: "card", label: "Context card to the next shipper", tool: "Order context" },
];

const emptyConnection = (role: RouteARole): RouteAState => ({ role, status: "disconnected", paired: false, soundReady: false, microphone: "off", canInitiate: false, canAnswer: false, timers: [] });
const emptyState = (role: RouteARole): LiveState => ({
  connected: false,
  shipperOnline: false,
  order: null,
  messages: [], callLog: [], started: false, finishing: false,
  call: { status: "idle", caption: "" },
  steps: {},
  card: null,
  role, connection: emptyConnection(role), phase: "idle", resetting: false, hasSavedOutcome: false,
});

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const time = (value?: string) => value ? value.slice(11, 16) : undefined;

/** Preserve observation order across polls without comparing business-clock chat
 * timestamps with wall-clock provider timestamps. Partial turns update in place. */
export class ConversationTimeline {
  private generation?: string;
  private entries = new Map<string, LiveState["messages"][number]>();
  merge(generation: string | undefined, incoming: [string, LiveState["messages"][number]][], clear: boolean, clearVoice: boolean) {
    if (generation !== this.generation || clear) { this.entries.clear(); this.generation = generation; }
    if (clearVoice) for (const key of this.entries.keys()) if (key.startsWith("voice:")) this.entries.delete(key);
    for (const [key, message] of incoming) this.entries.set(key, message);
    return [...this.entries.values()];
  }
}

/** Adapt observations only. A proposal or a successful-sounding transcript is never a saved card. */
export function deriveLiveState(monitor: MonitorState, connection: RouteAState, resetting = false, resetStage?: string, localError?: string, timeline = new ConversationTimeline()): LiveState {
  const detail = monitor.detail;
  const started = connection.started === true;
  const records = monitor.records;
  const latest = (kind: string) => [...records].reverse().find((record) => record.type === kind)?.payload;
  const proposal = latest("proposal"), result = latest("result");
  const context = detail?.context;
  const saved = detail?.context_card;
  const confidence = Object.values(object(context?.confidence)).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const rawOrder = object(detail?.order);
  const rescueMessages = (detail?.rescue_messages || []).map(object);
  // Morning availability belongs to the dashboard, never the initially blank customer phone.
  const keyedChats: (Record<string, unknown> & { key: string })[] = rescueMessages.map((message, index) => ({ ...message, key: `rescue:${message.id ?? index}` }));
  const chatMessages = keyedChats.filter((message) => message.status === "sent" && text(message.text)).sort((left, right) => (text(left.sent_at) || text(left.created_at)).localeCompare(text(right.sent_at) || text(right.created_at)));
  // The monitor preserves one complete utterance per call/speaker/turn, even after
  // partial word updates have left the bounded diagnostic event log.
  const transcripts = new Map<string, LiveState["messages"][number]>();
  for (const record of monitor.transcripts || records) {
    if (record.type !== "transcript" || !text(record.payload.text) || !["assistant", "buyer"].includes(text(record.payload.speaker))) continue;
    transcripts.set(String(record.payload.utterance_id || `${record.call_id || "call"}:${record.payload.speaker}:${record.payload.turn_id ?? record.seq}`), { from: record.payload.speaker === "buyer" ? "buyer" : "agent", text: text(record.payload.text), kind: "voice" });
  }
  const incoming: [string, LiveState["messages"][number]][] = chatMessages.map((message) => [message.key, { from: "agent", text: text(message.text), kind: "chat" }]);
  for (const [key, message] of transcripts) incoming.push([`voice:${key}`, message]);
  const noObservations = !records.length && !monitor.transcripts?.length;
  const messages = timeline.merge(monitor.generation, started ? incoming : [], !started || !detail && noObservations, noObservations);
  const steps: LiveState["steps"] = {};
  const events = detail?.events || [];
  const event = (type: string) => [...events].reverse().find((event) => event.type === type);
  const committed = event("event_committed");
  if (detail?.pending_event) steps.tap = { status: "running", detail: "Courier outcome is in its undo window." };
  if (committed) {
    steps.tap = { status: "done", at: time(committed.at), detail: `Recorded courier outcome ${text(committed.payload.button)}`.trim() };
    steps.policy = { status: "running", detail: "Waiting for the workflow contact decision." };
  }
  const policy = [...events].reverse().find((event) => event.type === "policy_block" || event.type === "call_reserved");
  if (policy) steps.policy = { status: policy.type === "call_reserved" ? "done" : "waiting", at: time(policy.at), detail: policy.type === "call_reserved" ? "Call permitted by the workflow policy." : `Workflow policy deferred contact: ${text(policy.payload.rule).replaceAll("_", " ")}` };
  const rescueChat = rescueMessages.find((message) => message.kind === "rescue_chat");
  if (rescueChat) steps.chat = { status: rescueChat.status === "sent" ? "done" : "running", at: time(text(rescueChat.sent_at) || text(rescueChat.created_at)), detail: text(rescueChat.status) };
  const call = detail?.calls.at(-1);
  if (call) steps.call = { status: ["answering", "connected", "ringing"].includes(connection.status) ? "running" : ["ended", "error"].includes(connection.status) || ["ended", "missed", "declined", "cancelled"].includes(call.status) ? "done" : "waiting", detail: call.runtime_status || call.status };
  steps.memo = { status: "waiting", detail: "Not used for Route A." };
  if (proposal) steps.extract = { status: "done", detail: `Observed extraction revision ${String(proposal.revision ?? "")}`.trim() };
  else if (connection.voice?.activity === "processing") steps.extract = { status: "running", detail: "Processing the buyer's actual response." };
  if (proposal) steps.decide = { status: "running", detail: "Waiting for verified confirmation and backend validation." };
  if (result) steps.decide = { status: saved ? "done" : ["needs_review", "needs_clarification", "with_cs"].includes(text(result.status)) ? "person" : "waiting", detail: text(result.status).replaceAll("_", " ") || "Backend result received." };
  if (saved) {
    steps.decide = { status: "done", detail: text(context?.decision).replaceAll("_", " ") || "Backend saved the delivery plan." };
    steps.card = { status: "done", at: time(event("card_pushed")?.at), detail: "Saved delivery context is available to the next courier." };
  } else if (detail?.order.status === "with_cs") steps.decide = { status: "person", detail: "Customer service owns this case." };
  const runtimeTerminal = ["ended", "error"].includes(connection.status);
  const callStatus = !runtimeTerminal && ["answering", "connected"].includes(connection.status) ? "connected" : connection.status === "ringing" ? "ringing" : "idle";
  return {
    connected: !!detail && !!monitor.config && !monitor.apiError,
    shipperOnline: connection.paired,
    order: detail ? { id: detail.order.tracking_id, buyer: detail.order.buyer_name, item: detail.order.item, address: text(rawOrder.address), cod: typeof rawOrder.cod_amount === "number" ? `${new Intl.NumberFormat("vi-VN").format(rawOrder.cod_amount)} VND` : "Not supplied" } : null,
    messages, callLog: started ? connection.callLog || [] : [], started, finishing: !!connection.end_requested,
    call: { status: started ? callStatus : "idle", caption: started ? [...transcripts.values()].at(-1)?.text || connection.voice?.message || connection.message || "" : "" }, steps,
    card: saved ? { when: text(saved.window), where: text(saved.drop), who: text(saved.alt) || "No alternate receiver saved", confidence: confidence.length ? Math.min(...confidence) : 0 } : null,
    role: connection.role, connection, mode: monitor.config?.mode, generation: monitor.generation,
    dataSource: detail?.data_source, phase: connection.serverPhase || connection.status,
    error: localError || monitor.apiError || connection.error, message: connection.message,
    resetting: resetting || monitor.clock?.reset_job?.status === "processing", resetStage: resetStage || monitor.clock?.reset_job?.stage,
    hasSavedOutcome: !!saved, result, proposal, context,
  };
}

/** One role owner per hook. The dashboard iframe uses its separate HTTP-only adapter. */
export class LiveSession {
  state: LiveState;
  private listeners = new Set<() => void>();
  private monitor?: LiveOrderMonitor;
  private controller?: RouteAController;
  private unsubscriptions: (() => void)[] = [];
  private resetAbort?: AbortController;
  private resetting = false;
  private resetStage?: string;
  private localError?: string;
  private conversation = new ConversationTimeline();
  private base = "";
  constructor(readonly role: RouteARole) { this.state = emptyState(role); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish = () => {
    this.state = deriveLiveState(this.monitor?.snapshot() || { records: [] }, this.controller?.snapshot() || emptyConnection(this.role), this.resetting, this.resetStage, this.localError, this.conversation);
    this.listeners.forEach((listener) => listener());
  };
  activate() {
    this.base = liveApiBase(window.location);
    this.monitor ||= new LiveOrderMonitor(this.base, DEMO_ORDER, true, this.role === "display");
    this.controller ||= new RouteAController(this.role, this.base);
    const monitor = this.monitor, controller = this.controller;
    controller.activate();
    const update = () => {
      controller.update(monitor.snapshot());
      this.publish();
    };
    this.unsubscriptions = [monitor.subscribe(update), controller.subscribe(this.publish)];
    update(); monitor.start();
  }
  suspend() {
    this.resetAbort?.abort(); this.resetAbort = undefined; this.resetting = false; this.resetStage = undefined;
    this.unsubscriptions.forEach((stop) => stop()); this.unsubscriptions = [];
    this.monitor?.stop(); this.controller?.suspend();
  }
  connect = async () => { this.localError = undefined; await this.controller?.connect(); this.publish(); };
  enableSound = async () => { this.localError = undefined; await this.controller?.enableSound(); this.publish(); };
  answer = async () => { this.localError = undefined; await this.controller?.answer(); this.publish(); };
  end = async () => { await this.controller?.end(); this.publish(); };
  setMuted = (muted: boolean) => { this.controller?.setMuted(muted); this.publish(); };
  setDashboardSound = async (on: boolean) => { await this.controller?.setDashboardSound(on); this.publish(); };
  sendOutcome = async (outcome: Outcome) => {
    this.localError = undefined;
    if (outcome !== "A" || this.role !== "phone") this.localError = "This live flow supports Route A from the connected shipper phone.";
    else await this.controller?.initiate();
    this.publish();
  };
  refresh = async () => { this.localError = undefined; await this.monitor?.pollOnce(); this.publish(); };
  reset = async () => {
    const generation = this.monitor?.state.generation;
    if (!generation || this.resetting) return;
    this.resetAbort = new AbortController();
    const abort = this.resetAbort;
    this.resetting = true; this.localError = undefined; this.resetStage = "starting";
    this.controller?.restarted("Session is restarting…"); this.monitor?.clear(); this.publish();
    try {
      await resetWorkflow(this.base, generation, (job) => { this.resetStage = job.stage; this.publish(); }, abort.signal);
      if (!abort.signal.aborted) await this.monitor?.pollOnce();
    } catch (error) { if (!abort.signal.aborted) this.localError = errorMessage(error); }
    finally { if (this.resetAbort === abort) { this.resetting = false; this.resetStage = undefined; this.publish(); } }
  };
}

export function useLiveState(role: RouteARole) {
  const [session] = useState(() => new LiveSession(role));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useEffect(() => { session.activate(); return () => session.suspend(); }, [session]);
  return { state, sendOutcome: session.sendOutcome, connect: session.connect, enableSound: session.enableSound, answer: session.answer, end: session.end, setMuted: session.setMuted, setDashboardSound: session.setDashboardSound, reset: session.reset, refresh: session.refresh };
}
