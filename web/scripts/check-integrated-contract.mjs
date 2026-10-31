// Deterministic contract tests. No running backend or paid provider calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compile(name) {
  return ts.transpileModule(fs.readFileSync(new URL(`../src/lib/ai/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}
const sent = [];
const exports = {};
vm.runInNewContext(compile("integrated"), { exports, require: () => ({ post: async (path, body, signal, base) => { sent.push({ path, body, signal, base }); return { status: "pending" }; } }) });
const order = { tracking_id: "order / 1", generation_id: "generation-current", context_version: 7 };
const active = { id: 3, shipper_event_id: 9, generation_id: "generation-current", trigger: "RESCHEDULE", state: "memo", closed_at: null };
const detail = { order, context: { rescue_case_id: 3 }, pending_event: null, rescue_cases: [active], calls: [], events: [] };
assert.deepEqual(JSON.parse(JSON.stringify(exports.currentMemoBinding(detail))), { generation_id: "generation-current", context_version: 7, shipper_event_id: 9 });
for (const variant of [
  { ...detail, pending_event: { id: 9, button: "B" } },
  { ...detail, rescue_cases: [{ ...active, state: "rescheduled" }] },
  { ...detail, rescue_cases: [{ ...active, generation_id: "old" }] },
  { ...detail, rescue_cases: [{ ...active, closed_at: "ended" }] },
  { ...detail, rescue_cases: [{ ...active, trigger: "NO_ANSWER" }] },
  { ...detail, rescue_cases: [{ ...active, shipper_event_id: undefined }] },
  { ...detail, context: { rescue_case_id: 4 } },
]) assert.equal(exports.currentMemoBinding(variant), undefined, "pending/undone/closed/stale/unowned cases cannot bind a memo");

const call = { id: "durable-call", case_id: 3, status: "requested", provider_session_id: "durable-call", ws_path: "/ws/call?session=durable-call", runtime_status: "ringing" };
const issued = exports.currentIssuedCall({ ...detail, calls: [call] });
assert.equal(issued.call_id, "durable-call");
assert.equal(issued.ws_path, call.ws_path);
for (const variant of [
  { ...call, provider_session_id: null }, { ...call, runtime_status: "ended" },
  { ...call, status: "declined" }, { ...call, case_id: 99 }, { ...call, ws_path: null },
]) assert.equal(exports.currentIssuedCall({ ...detail, calls: [variant] }), undefined, "only a current workflow-issued ringing session is answerable");

const signal = new AbortController().signal;
await exports.tapOrder(order, "B", "tap-once", signal, "https://part1.test/api");
assert.equal(sent[0].path, "/orders/order%20%2F%201/events");
assert.deepEqual(JSON.parse(JSON.stringify(sent[0].body)), { generation_id: "generation-current", context_version: 7, idempotency_key: "tap-once", button: "B" });
assert.equal(sent[0].base, "https://part1.test/api", "order mutations use the selected integrated API, not fixture default");
assert.equal(sent[0].signal, signal);
await exports.undoOrder({ ...detail, pending_event: { id: 9 } }, "undo-once", signal, "https://part1.test/api");
assert.equal(sent[1].path, "/events/9/undo");
assert.equal(sent[1].body.context_version, 7);
assert.equal(sent[1].base, "https://part1.test/api");
assert.throws(() => exports.undoOrder(detail, "invalid"), /No pending/);
assert.equal(sent.length, 2, "invalid undo performs no API mutation");

const protocol = {};
vm.runInNewContext(compile("protocol"), { exports: protocol, process: { env: {} }, URL, FormData, Blob });
const blob = new Blob(["synthetic audio"], { type: "audio/webm" });
assert.throws(() => protocol.memoForm(blob, "memo.webm", undefined, true), /committed reschedule/);
assert.throws(() => protocol.memoForm(blob, "memo.webm", { generation_id: "g", context_version: 1, shipper_event_id: 0 }, true), /incomplete/);
const form = protocol.memoForm(blob, "memo.webm", exports.currentMemoBinding(detail), true);
assert.equal(form.get("generation_id"), "generation-current");
assert.equal(form.get("context_version"), "7");
assert.equal(form.get("shipper_event_id"), "9");
assert.equal(form.get("audio").name, "memo.webm");
assert.equal(form.get("audio").size, blob.size);
assert.equal(protocol.memoForm(blob, "memo.webm").has("shipper_event_id"), false, "standalone fixture memo remains supported without a durable owner");
console.log("PASS: durable A/B + undo commands, explicit API base, issued-call eligibility, committed B memo ownership and multipart revision/generation binding (mock contracts).");
