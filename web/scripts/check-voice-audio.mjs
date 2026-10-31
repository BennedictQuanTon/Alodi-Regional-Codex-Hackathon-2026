// Bounded native-audio checks. Run: node scripts/check-voice-audio.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workletSource = fs.readFileSync(path.join(root, "public/ai/pcm-worklet.js"), "utf8");

for (const rate of [16000, 22050, 32000, 44100, 48000, 96000]) {
  const frames = [];
  let Processor;
  vm.runInNewContext(workletSource, {
    sampleRate: rate,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (frame) => frames.push(frame) }; } },
    registerProcessor: (_name, processor) => { Processor = processor; },
  });
  const processor = new Processor();
  // Cross render-quantum boundaries and fractional sample-rate boundaries for one second.
  for (let offset = 0; offset < rate; offset += 128) {
    const input = new Float32Array(Math.min(128, rate - offset)).fill(0.5);
    processor.process([[input]]);
  }
  assert.equal(frames.length, 50, `${rate}Hz -> 50 frames/second`);
  for (const frame of frames) {
    assert.equal(frame.pcm.byteLength, 640, "20ms PCM16 frame size");
    assert.ok(Math.abs(frame.level - 0.5) < 1e-6, "level comes from audio samples");
    const view = new DataView(frame.pcm);
    for (let i = 0; i < 320; i++) assert.ok(Math.abs(view.getInt16(i * 2, true) - 16384) <= 1, "PCM little-endian amplitude within one quantization unit");
  }
}

const audioSource = fs.readFileSync(path.join(root, "src/lib/ai/audio.ts"), "utf8");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(audioSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const nodes = [];
const fakeContext = {
  currentTime: 0, destination: {},
  createBuffer: (_channels, count, rate) => ({ duration: count / rate, getChannelData: () => new Float32Array(count) }),
  createBufferSource: () => { const node = { connect() {}, disconnect() {}, stop() {}, start() {} }; nodes.push(node); return node; },
};
const acknowledgements = [];
const player = new exportsObject.PcmPlayback(fakeContext, (id) => acknowledgements.push(id));
player.start("first", 24000); player.push(new ArrayBuffer(480)); player.end("first");
assert.deepEqual(acknowledgements, [], "network audio_end is not playback completion");
nodes[0].onended();
assert.deepEqual(acknowledgements, ["first"], "ack only after actual source completion");
player.start("interrupted", 24000); player.push(new ArrayBuffer(480)); player.end("interrupted");
const staleCompletion = nodes[1].onended;
player.clear(); staleCompletion();
assert.deepEqual(acknowledgements, ["first"], "interrupted generation never acknowledged");
player.start("new", 24000); player.push(new ArrayBuffer(480)); player.end("new"); nodes[2].onended();
assert.deepEqual(acknowledgements, ["first", "new"], "fresh playback survives clear");
player.start("bounded", 24000); player.push(new ArrayBuffer(24_000 * 2 * 13));
assert.throws(() => player.push(new ArrayBuffer(480)), /too quickly/, "pending playback is bounded");
player.clear();
const protocol = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/ai/protocol.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: protocol, process: { env: {} }, URL });
assert.equal(protocol.apiUrl("/ai/config", "http://localhost:8001"), "http://localhost:8001/ai/config");
assert.equal(protocol.apiUrl("/ai/config", "https://pc.local/api"), "https://pc.local/api/ai/config");
assert.equal(protocol.apiUrl("/ai/disclosure.mp3", "https://pc.local/api/"), "https://pc.local/api/ai/disclosure.mp3");
assert.equal(protocol.socketUrl("/ws/call?session=fixture", "https://pc.local/api"), "wss://pc.local/api/ws/call?session=fixture");
assert.throws(() => protocol.socketUrl("https://other.local/ws/call", "https://pc.local/api"), /Unexpected/);
console.log("PASS: six device sample rates -> 16kHz / 20ms PCM; playback completion, interrupt fencing and queue bound.");
console.log("PASS: localhost and HTTPS /api-prefixed HTTP, disclosure and socket addresses.");

const live = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/ai/live-playback.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: live });
const gate = new live.LivePlaybackGate();
const turn = { generation_id: "current", turn_id: 1, phase: "greeting", input_allowed: false };
gate.begin(turn, 0);
assert.equal(gate.sample(0, true, 10000), undefined, "silence without measured audio cannot finish speech");
assert.equal(gate.expired(25000), true, "missing or inaudible output has a bounded failure deadline");
gate.setBlocked(true, 25000);
assert.equal(gate.expired(90000), false, "autoplay blockage waits for explicit user retry");
assert.equal(gate.sample(0.2, true, 90000), undefined, "blocked/unheard samples cannot count as playback");
gate.setBlocked(false, 90000);
assert.equal(gate.expired(90001), false, "retry receives a fresh output deadline");
assert.equal(gate.sample(0.2, true, 90100), "playing");
assert.equal(gate.sample(0, false, 95000), undefined, "paused output cannot drain");
gate.transcript(95000);
assert.equal(gate.sample(0, true, 96000), undefined, "quiet window includes transcript activity");
assert.equal(gate.sample(0, true, 96800), "drained");
assert.equal(gate.inputAllowed, false, "actual audio drain alone cannot authorize mic");
gate.begin({ ...turn, input_allowed: true, playback_revision: gate.revision }, 96800);
assert.equal(gate.inputAllowed, true);
const previousRevision = gate.revision;
gate.sample(0.2, true, 97000);
assert.equal(gate.inputAllowed, false, "renewed audio revokes prior provider acknowledgement");
gate.begin({ ...turn, input_allowed: true, playback_revision: previousRevision }, 97001);
gate.sample(0, true, 99000);
assert.equal(gate.inputAllowed, false, "delayed prior ACK stays invalid after renewed audio drains");
gate.begin({ ...turn, input_allowed: true, playback_revision: gate.revision }, 99000);
assert.equal(gate.inputAllowed, true);
assert.equal(gate.transcript(99100), true, "late transcript also closes the input gate and requests a new drain");
assert.equal(gate.inputAllowed, false);
assert.equal(gate.begin({ ...turn, generation_id: "stale", turn_id: 99 }, 99101), false, "another generation cannot replace the active call");
gate.begin({ ...turn, turn_id: 2, phase: "notes" }, 100000);
assert.equal(gate.heard, false, "new prompt needs its own actual audio playback");
assert.equal(gate.begin(turn, 100001), false, "stale earlier prompt cannot change state");
console.log("PASS: GPT Live measured playback, conservative quiet, unread/blocked output, timeout, late transcript and stale permission/generation fencing.");
