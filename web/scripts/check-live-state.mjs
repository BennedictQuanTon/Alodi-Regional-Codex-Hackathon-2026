// Verifies the selected frontend's adapter; native media/provider checks are separate.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const fixtures = { monitors: [], controllers: [], resets: 0 };
const generation = "generation-1";
const detail = {
  order: { tracking_id: "ORDER-ACTUAL", buyer_name: "Fixture Buyer", item: "Fixture Item", address: "Fixture Address", cod_amount: 153000, status: "out_for_delivery", generation_id: generation },
  data_source: "synthetic", context: {}, context_card: null, pending_event: null, calls: [], rescue_cases: [], provider_requests: [], events: [],
  messages: [{ text: "Real morning message", status: "sent", sent_at: "2026-10-31T06:30:00+07:00" }, { text: "Unsent draft", status: "queued" }],
  rescue_messages: [{ kind: "rescue_chat", text: "Real rescue message", status: "sent", sent_at: "2026-10-31T10:02:00+07:00" }],
};
const monitorState = () => ({ config: { mode: "live", ready: true }, generation, detail, clock: { generation_id: generation }, records: [] });
const connection = (role = "display") => ({ role, status: "disconnected", paired: false, soundReady: false, microphone: "off", canInitiate: false, canAnswer: false, timers: [], started: true });
class Monitor {
  state = monitorState(); listeners = new Set();
  constructor(_base, _order, _observe, room) { this.room = room; fixtures.monitors.push(this); }
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  snapshot = () => this.state;
  emit() { this.listeners.forEach((fn) => fn()); }
  start() { this.started = true; }
  stop() { this.started = false; }
  clear() { this.state = { ...this.state, detail: undefined, records: [], transcripts: [] }; this.emit(); }
  async pollOnce() { this.emit(); }
}
class Controller {
  listeners = new Set(); connects = 0; initiations = 0; suspends = 0;
  constructor(role, base) { this.state = connection(role); this.base = base; fixtures.controllers.push(this); }
  snapshot = () => this.state;
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  update(state) { this.lastUpdate = state; }
  activate() {}
  suspend() { this.suspends++; }
  async connect() { this.connects++; }
  async initiate() { this.initiations++; }
  async answer() { this.answered = true; }
  async end() { this.ended = true; }
  setMuted(muted) { this.muted = muted; }
  restarted() { this.restartedCalled = true; }
  async enableSound() { this.enabledSound = true; }
  disconnect() { this.disconnected = true; }
}
const exported = {};
const source = fs.readFileSync(new URL("../src/lib/live/state.ts", import.meta.url), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  exports: exported, window: { location: { origin: "https://selected-frontend.example", search: "?session=judge-a" } }, Intl,
  AbortController,
  require: (name) => name === "react" ? {} : name === "../ai/live-demo" ? { LiveOrderMonitor: Monitor, DEMO_ORDER: "SPXVN0123456789", resetWorkflow: async (_base, _generation, progress) => { fixtures.resets++; progress({ stage: "completed" }); } } : name === "../ai/route-a-controller" ? { RouteAController: Controller } : name === "./session" ? { liveApiBase: (location) => `${location.origin}/api/s/${new URLSearchParams(location.search).get("session")}` } : { errorMessage: (error) => error.message },
});

{
  const state = exported.deriveLiveState(monitorState(), connection());
  assert.equal(state.order.id, "ORDER-ACTUAL", "display order comes from actual backend detail");
  assert.equal(state.order.address, "Fixture Address");
  assert.equal(state.messages.length, 1, "only the actual rescue chat enters the customer phone; morning messages remain hidden");
  assert.equal(state.messages[0].text, "Real rescue message");
  assert.equal(state.hasSavedOutcome, false); assert.equal(state.card, null);
  assert.equal(state.steps.tap, undefined, "loading an order cannot invent a courier tap");
  assert.equal(exported.AGENT_STEPS.length, 8, "preserves the selected frontend's original eight-row agent run");
  assert.equal(state.steps.memo.status, "waiting", "Route A does not pretend to transcribe a courier memo");
  assert.equal(state.steps.memo.detail, "Not used for Route A.");
}
{
  const state = exported.deriveLiveState(monitorState(), { ...connection(), started: false, callLog: [{ id: "missed", at: "2026-10-31T10:00:00Z", status: "missed", text: "Missed call" }] });
  assert.equal(state.messages.length, 0, "CONNECT/backend load cannot populate the initially white message area");
  assert.equal(state.callLog.length, 0); assert.equal(state.call.status, "idle"); assert.equal(state.call.caption, "");
  const finishing = exported.deriveLiveState(monitorState(), { ...connection("phone"), end_requested: true });
  assert.equal(finishing.finishing, true); assert.equal(finishing.hasSavedOutcome, false, "finishing cannot fabricate a saved result");
}
{
  const state = exported.deriveLiveState({ ...monitorState(), records: [{ seq: 900, type: "result", payload: { status: "confirmed", context: { proposed: true } } }], transcripts: [{ seq: 3, call_id: "call-1", type: "transcript", payload: { speaker: "buyer", text: "Complete earlier utterance", turn_id: 1 } }, { seq: 9, call_id: "call-1", type: "transcript", payload: { speaker: "assistant", text: "Complete readback", turn_id: 2 } }] }, { ...connection("phone"), status: "ended", serverPhase: "ended" });
  assert.equal(state.messages.at(-2).text, "Complete earlier utterance", "word updates cannot evict earlier utterances from the conversation");
  assert.equal(state.messages.at(-1).text, "Complete readback");
  assert.equal(state.hasSavedOutcome, false, "even a confirmed result cannot fabricate a persisted card");
  assert.equal(state.steps.decide.status, "waiting"); assert.equal(state.call.status, "idle");
  assert.equal(state.call.caption, "Complete readback", "call caption uses actual observed transcript");
}
{
  const committed = { type: "event_committed", at: "2026-10-31T10:02:00+07:00", payload: { button: "A" } };
  const pending = exported.deriveLiveState({ ...monitorState(), detail: { ...detail, events: [committed] } }, connection());
  assert.equal(pending.steps.policy.status, "running", "courier tap alone cannot claim a completed call policy check");
  const allowed = exported.deriveLiveState({ ...monitorState(), detail: { ...detail, events: [committed, { type: "call_reserved", at: "2026-10-31T11:02:00+07:00", payload: {} }] } }, connection());
  assert.equal(allowed.steps.policy.status, "done", "actual policy-issued reservation proves call permitted");
}
{
  const state = exported.deriveLiveState({ ...monitorState(), detail: { ...detail, context_card: { window: "2026-11-01, 17:00–20:00", drop: "Security desk", alt: null }, context: { confidence: { time_window: 0.92, drop_location: 0.88 }, decision: "auto_applied" }, events: [{ type: "card_pushed", at: "2026-10-31T11:02:00+07:00", payload: {} }] } }, connection());
  assert.equal(state.hasSavedOutcome, true); assert.equal(state.card.confidence, 0.88);
  assert.equal(state.card.where, "Security desk"); assert.equal(state.steps.card.status, "done");
}
{
  const timeline = new exported.ConversationTimeline();
  const voice = { seq: 20, type: "transcript", call_id: "call-1", payload: { speaker: "assistant", turn_id: 2, text: "Please confirm" } };
  const initial = { ...monitorState(), records: [voice], transcripts: [voice] };
  const before = exported.deriveLiveState(initial, connection(), false, undefined, undefined, timeline);
  assert.equal(before.messages.at(-1).text, "Please confirm");
  const updatedVoice = { ...voice, payload: { ...voice.payload, text: "Please confirm the proposed plan." } };
  const fallback = { id: "post-call-chat", kind: "clarification", text: "Please confirm in chat after the interrupted call.", status: "sent", sent_at: "2026-10-31T11:02:00+07:00" };
  const after = exported.deriveLiveState({ ...initial, detail: { ...detail, rescue_messages: [...detail.rescue_messages, fallback] }, records: [updatedVoice], transcripts: [updatedVoice] }, connection(), false, undefined, undefined, timeline);
  assert.equal(after.messages.at(-2).text, "Please confirm the proposed plan.", "partial transcript updates stay in their original observed position");
  assert.equal(after.messages.at(-1).text, fallback.text, "a newly sent post-call chat stays after the conversation that triggered it despite its business timestamp");
  assert.equal(after.messages.length, before.messages.length + 1, "polling does not duplicate keyed messages");
  const reset = exported.deriveLiveState({ records: [], generation: "generation-2" }, connection(), false, undefined, undefined, timeline);
  assert.equal(reset.messages.length, 0, "new generation cannot retain the preceding conversation");
}
{
  const display = new exported.LiveSession("display");
  display.activate();
  const controller = fixtures.controllers.at(-1), monitor = fixtures.monitors.at(-1);
  assert.equal(controller.base, "https://selected-frontend.example/api/s/judge-a", "uses this link's session on the same-origin gateway");
  assert.equal(monitor.room, true, "the display observes the room over HTTP");
  monitor.emit(); monitor.emit(); assert.equal(controller.connects, 0, "the display never pairs, so dashboards cannot conflict");
  let notifications = 0; display.subscribe(() => notifications++);
  display.suspend(); display.activate(); const before = notifications; monitor.emit();
  assert.ok(notifications > before, "StrictMode cleanup/activation preserves hook subscriptions");
  assert.equal(controller.initiations, 0, "display activation cannot initiate a workflow");
  display.suspend();
}
{
  const phone = new exported.LiveSession("phone"); phone.activate();
  const controller = fixtures.controllers.at(-1);
  assert.equal(controller.connects, 0, "phone never pairs before explicit CONNECT");
  await phone.connect(); assert.equal(controller.connects, 1);
  await phone.sendOutcome("B"); await phone.sendOutcome("C"); assert.equal(controller.initiations, 0, "other outcomes cannot mutate this Route A demo");
  await phone.sendOutcome("A"); assert.equal(controller.initiations, 1);
  phone.setMuted(true); assert.equal(controller.muted, true, "mute reaches this phone's call");
  await phone.reset(); assert.equal(fixtures.resets, 1, "the judge can restart from the phone"); assert.equal(controller.restartedCalled, true, "a restart remembers that this phone should rejoin");
  phone.suspend();
}
console.log("PASS: selected frontend actual chat/transcript/order/card mapping, no invented saved outcome, same-origin role ownership, explicit phone controls and StrictMode lifecycle (adapter doubles).");
