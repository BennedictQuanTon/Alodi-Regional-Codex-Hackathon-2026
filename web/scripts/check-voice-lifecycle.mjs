// Native transport doubles exercise cancellation races; these are not live-provider tests.
// Run: node scripts/check-voice-lifecycle.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(fileURLToPath(new URL("../src/lib/ai/voice-controller.ts", import.meta.url)), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const flush = async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const config = { mode: "live", ready: true, transport: "webrtc", voice_provider: "gpt_live", limits: { call_seconds: 90 } };

function fixture(overrides = {}) {
  const posts = [], sockets = [], peers = [], tracks = [], audioElements = [], contexts = [], sent = [];
  const frames = new Map();
  let frameId = 0, now = 1000, remoteLevel = 0;
  let microphoneRequests = 0;
  const track = { enabled: false, stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  tracks.push(track);
  class Socket {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    constructor() { sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.(); this.message({ type: "status", status: "connected" }); }); }
    message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    send(message) {
      const data = JSON.parse(message);
      sent.push(data);
      if (overrides.echoBlocked && data.type === "playback_state" && data.state === "blocked") {
        if (sent.filter((event) => event.state === "blocked").length > 4) throw new Error("Blocked playback echo loop");
        this.message({ ...data, type: "turn_state", phase: "greeting", input_allowed: false });
      }
    }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Peer {
    connectionState = "new";
    iceGatheringState = "complete";
    constructor() { peers.push(this); }
    createDataChannel() { return this.channel = { readyState: "connecting", close() { this.readyState = "closed"; this.onclose?.(); } }; }
    addTrack() {}
    createOffer() { return Promise.resolve({ type: "offer", sdp: "synthetic-sdp" }); }
    setLocalDescription(offer) { this.localDescription = offer; return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    close() { this.connectionState = "closed"; }
  }
  class Context {
    sampleRate = 44100;
    state = "running";
    destination = {};
    constructor() { contexts.push(this); }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.closed = true; this.state = "closed"; return Promise.resolve(); }
    createMediaStreamSource(stream) { return { connect(analyser) { analyser.remote = !!stream.remote; }, disconnect() {} }; }
    createAnalyser() { return { fftSize: 256, getFloatTimeDomainData(values) { values.fill(this.remote ? remoteLevel : 0); } }; }
    audioWorklet = { addModule: () => Promise.resolve() };
  }
  class Audio {
    paused = true;
    constructor() { audioElements.push(this); }
    play() { if (overrides.blockAudio) return Promise.reject(new Error("blocked")); this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const protocol = {
    API_URL: "http://localhost:8001",
    errorMessage: (error) => error.message,
    socketUrl: (path, base = "http://localhost:8001") => new URL(path.replace(/^\//, ""), `${base}/`).toString().replace(/^http/, "ws"),
    post: async (path, body) => {
      posts.push({ path, body });
      if (path === "/ai/dev/calls") return overrides.reservation ? overrides.reservation.promise : { call_id: "synthetic", ws_path: "/ws/call" };
      if (path.endsWith("/connect")) return { transport: overrides.transport || "webrtc", sdp: "synthetic-answer" };
      return {};
    },
    request: async () => ({ usage: [] }),
  };
  const output = {};
  const liveOutput = {};
  const liveSource = fs.readFileSync(fileURLToPath(new URL("../src/lib/ai/live-playback.ts", import.meta.url)), "utf8");
  vm.runInNewContext(ts.transpileModule(liveSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: liveOutput });
  vm.runInNewContext(compiled, {
    exports: output,
    require: (path) => path === "./protocol" ? protocol : path === "./live-playback" ? liveOutput : { waitForIce: async () => {} },
    window: { isSecureContext: true, addEventListener() {}, removeEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: () => { microphoneRequests++; return overrides.permission ? overrides.permission.promise : Promise.resolve(stream); } } },
    AudioContext: Context, Audio, WebSocket: Socket, RTCPeerConnection: Peer,
    URL,
    AbortController, DOMException, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: (id) => frames.delete(id),
    Date: class extends Date { static now() { return now; } },
    AudioWorkletNode: class { port = {}; connect() {} disconnect() {} },
  });
  return { Controller: output.VoiceController, posts, sockets, peers, track, stream, audioElements, contexts, sent, frames,
    microphoneRequests: () => microphoneRequests,
    frame: (time, level = 0) => { now = time; remoteLevel = level; const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(time)); },
    remote: { remote: true },
  };
}

{
  const reservation = deferred();
  const env = fixture({ reservation });
  const controller = new env.Controller(config);
  const preparing = controller.prepare("fixture");
  await flush();
  assert.equal(env.microphoneRequests(), 0, "prepare never requests microphone");
  await controller.end("cancelled");
  reservation.resolve({ call_id: "late-reservation" });
  await preparing; await flush();
  assert.ok(env.posts.some((post) => post.path.includes("late-reservation/end")), "late reservation closes even after cancellation");
  assert.equal(controller.state.status, "ended");
  controller.dispose();
}
{
  const permission = deferred();
  const env = fixture({ permission });
  const controller = new env.Controller(config);
  await controller.prepare("fixture");
  assert.equal(env.microphoneRequests(), 0, "consent screen has no microphone access");
  const connecting = controller.connect();
  await flush();
  assert.equal(env.microphoneRequests(), 1);
  await controller.end("cancelled");
  permission.resolve(env.stream);
  await connecting;
  assert.equal(env.track.stopped, true, "late permission stream is stopped");
  assert.equal(env.sockets[0].readyState, 3, "cancel closes application socket");
  assert.equal(controller.state.diagnostics.microphone, "off");
  controller.dispose();
}
{
  const env = fixture({ transport: "webrtc" });
  const controller = new env.Controller({ ...config, voice_provider: "gpt_live", transport: "webrtc" });
  await controller.prepare("fixture"); await controller.connect();
  assert.equal(env.track.enabled, false, "SDP answer alone does not enable microphone");
  const peer = env.peers[0];
  peer.connectionState = "connected"; peer.onconnectionstatechange();
  assert.equal(env.track.enabled, false, "peer connection alone does not enable microphone");
  peer.channel.readyState = "open"; peer.channel.onopen();
  assert.equal(env.track.enabled, false, "transport readiness never opens mic before greeting playback");
  assert.equal(controller.state.status, "connected");
  const socket = env.sockets[0];
  const turn = { type: "turn_state", generation_id: "generation-A", turn_id: 1, phase: "greeting", input_allowed: false };
  socket.message(turn);
  peer.ontrack({ streams: [env.remote] }); await flush();
  env.frame(1200); env.frame(4000);
  assert.equal(env.track.enabled, false, "initial silence does not stand in for a heard greeting");
  env.frame(4100, 0.1);
  assert.equal(env.sent.at(-1).state, "playing");
  assert.equal(env.track.enabled, false, "actual AI speech keeps mic disabled");
  env.frame(5500);
  assert.equal(env.sent.at(-1).state, "playing", "short audio pause cannot drain");
  socket.message({ type: "transcript", speaker: "assistant", text: "Greeting", final: false, turn_id: 1 });
  env.frame(6000);
  assert.equal(env.sent.at(-1).state, "playing", "transcript activity extends quiet window");
  env.frame(7500);
  assert.equal(env.sent.at(-1).state, "drained");
  assert.equal(env.track.enabled, false, "browser drain must wait for provider unmute acknowledgement via server");
  socket.message({ ...turn, input_allowed: true, playback_revision: 1 });
  assert.equal(env.track.enabled, true, "matching server permission after drain enables listening");
  controller.suppressInputUntilAllowed();
  assert.equal(env.track.enabled, false, "a Route A closed-gate request disables the actual provider input track");
  socket.message({ ...turn, input_allowed: true, playback_revision: 1 });
  assert.equal(env.track.enabled, false, "a stale grant on the separate voice socket cannot release the Route A hold");
  controller.releaseInputSuppression();
  assert.equal(env.track.enabled, true, "a correlated route release still requires the existing measured playback gate");
  env.frame(7600, 0.1);
  assert.equal(env.track.enabled, false, "late resumed speech immediately re-mutes mic");
  socket.message({ ...turn, input_allowed: true, playback_revision: 1 });
  env.frame(9500);
  assert.equal(env.track.enabled, false, "stale earlier unmute ACK cannot reopen after renewed output");
  socket.message({ ...turn, input_allowed: true, playback_revision: 2 });
  assert.equal(env.track.enabled, true, "renewed playback requires fresh matching permission");
  socket.message({ ...turn, turn_id: 0, input_allowed: false });
  assert.equal(env.track.enabled, true, "stale turn state is ignored");
  await controller.typedTurn("injected live text");
  assert.equal(env.posts.some((item) => item.path === "/ai/dev/turn"), false, "live calls cannot inject typed input");
  const staleFrames = [...env.frames.values()];
  env.sockets[0].message({ type: "media_stop", reason: "opt_out" });
  assert.equal(env.track.stopped, true, "server stop immediately stops microphone");
  assert.equal(env.audioElements[0].paused, true, "server stop immediately pauses remote audio");
  assert.equal(peer.connectionState, "closed", "server stop closes media peer");
  assert.equal(controller.state.status, "ending");
  assert.equal(env.sockets[0].readyState, 1, "app socket retained for final usage");
  env.sockets[0].message({ type: "usage", audio_duration_seconds: 2 });
  env.sockets[0].message({ type: "status", status: "ended" });
  assert.equal(controller.state.usage.audio_duration_seconds, 2);
  assert.equal(env.sockets[0].readyState, 3, "ended closes final socket");
  staleFrames.forEach((callback) => callback(20000));
  assert.equal(env.frames.size, 0, "stale meter callback cannot restart after media cleanup");
  assert.equal(env.contexts.every((context) => context.closed), true, "every audio context closes");
  controller.dispose();
}
{
  const options = { blockAudio: true, echoBlocked: true };
  const env = fixture(options);
  const controller = new env.Controller(config);
  await controller.prepare("fixture"); await controller.connect();
  const peer = env.peers[0], socket = env.sockets[0];
  peer.connectionState = "connected"; peer.channel.readyState = "open"; peer.onconnectionstatechange(); peer.channel.onopen();
  const turn = { type: "turn_state", generation_id: "autoplay", turn_id: 1, phase: "greeting", input_allowed: false };
  socket.message(turn); peer.ontrack({ streams: [env.remote] }); await flush();
  assert.equal(controller.state.needsPlayback, true, "autoplay rejection offers retry");
  assert.equal(controller.state.status, "connected", "backend blocked-state echo must not fail the call");
  assert.equal(env.sent.filter((event) => event.state === "blocked").length, 1, "initial autoplay block is reported once despite server echo");
  socket.message(turn); socket.message(turn);
  assert.equal(env.sent.filter((event) => event.state === "blocked").length, 1, "repeated server state never re-reports the same block");
  socket.message({ ...turn, turn_id: 2 });
  assert.equal(env.sent.filter((event) => event.state === "blocked").length, 2, "new turn receives one blocked notification while autoplay remains blocked");
  env.frame(2000, 0.2); env.frame(10000);
  assert.equal(env.track.enabled, false, "blocked audio never accepts customer information");
  assert.equal(env.sent.some((event) => event.state === "drained"), false, "unheard/blocked output cannot drain");
  options.blockAudio = false;
  await controller.playAudio();
  assert.equal(env.sent.at(-1).state, "ready", "retry asks server to repeat complete prompt, not play a lost stream tail");
  env.frame(11000, 0.2); env.frame(14000);
  assert.equal(env.track.enabled, false, "old stream tail after retry cannot unlock listening");
  socket.message({ ...turn, turn_id: 3 });
  env.frame(15000, 0.2); env.frame(17000);
  assert.equal(env.sent.at(-1).state, "drained");
  socket.message({ ...turn, turn_id: 3, input_allowed: true, playback_revision: 1 });
  assert.equal(env.track.enabled, true, "full repeated prompt plus fresh ACK restores listening");
  await controller.end();
  assert.equal(env.track.stopped, true);
  assert.equal(env.audioElements[0].paused, true);
  assert.equal(env.audioElements[0].srcObject, null);
  assert.equal(env.frames.size, 0);
  controller.dispose();
}
{
  const env = fixture();
  const controller = new env.Controller(config);
  await controller.prepare("fixture"); await controller.connect();
  const peer = env.peers[0], socket = env.sockets[0];
  peer.connectionState = "connected"; peer.channel.readyState = "open"; peer.onconnectionstatechange(); peer.channel.onopen();
  const turn = { type: "turn_state", generation_id: "notice-session", turn_id: 1, phase: "collecting", input_allowed: false };
  socket.message(turn); peer.ontrack({ streams: [env.remote] }); await flush();
  socket.message({ type: "notice", code: "voice_processing_failed", message: "Could not verify this turn. Please repeat when invited.", error_type: "InternalClass" });
  assert.equal(controller.state.notice, "Could not verify this turn. Please repeat when invited.", "recoverable notice is retained for display");
  assert.equal(controller.state.status, "connected", "recoverable notice keeps the call connected");
  assert.equal(env.track.stopped, false, "recoverable notice does not stop microphone media");
  assert.equal(env.track.enabled, false, "notice preserves the existing muted gate");
  assert.equal(socket.readyState, 1);
  assert.equal(peer.connectionState, "connected");
  env.frame(1100, 0.1); env.frame(3100);
  assert.ok(controller.state.notice, "animation-frame status updates do not erase the explanation");
  socket.message({ ...turn, input_allowed: true, playback_revision: 1 });
  assert.equal(controller.state.notice, undefined, "successful listening clears the prior recoverable notice");
  assert.equal(env.track.enabled, true);
  socket.message({ type: "notice", code: "readback_verification_failed", message: "Please confirm the repeated details." });
  env.frame(3200);
  assert.equal(controller.state.notice, "Please confirm the repeated details.");
  assert.equal(env.track.enabled, true, "notice itself does not change an already open microphone gate");
  assert.equal(env.track.stopped, false);
  socket.message({ type: "error", message: "Provider connection lost." });
  assert.equal(controller.state.status, "error", "fatal provider errors remain fatal");
  assert.equal(controller.state.message, "Provider connection lost.");
  assert.equal(env.track.stopped, true);
  assert.equal(socket.readyState, 3);
  assert.equal(peer.connectionState, "closed");
  assert.equal(env.audioElements[0].paused, true);
  assert.equal(env.frames.size, 0);
  await controller.prepare("fixture");
  assert.equal(controller.state.notice, undefined, "a new call clears recoverable notices");
  controller.dispose();
}
{
  const env = fixture();
  const controller = new env.Controller({ ...config, bridge_mode: "part1" }, "https://integrated.test/api");
  await controller.prepareIssued({ call_id: "issued-session", tracking_id: "order", status: "ringing", ws_path: "/ws/call?session=issued-session", voice_provider: "gpt_live" });
  assert.equal(controller.state.status, "consent", "an issued workflow call enters the same disclosure/consent flow");
  assert.equal(controller.state.callId, "issued-session");
  assert.equal(env.microphoneRequests(), 0, "attaching an issued call never requests microphone before agreement");
  assert.equal(env.posts.length, 0, "attaching never creates a separate fixture/provider reservation");
  await controller.connect();
  assert.ok(env.posts.some((item) => item.path === "/ai/calls/issued-session/connect"), "consent connects the workflow-issued session");
  assert.equal(env.track.enabled, false, "issued call uses the existing AI-speech input gate");
  await controller.end(); controller.dispose();
  const invalid = new env.Controller({ ...config, bridge_mode: "part1" });
  await invalid.prepareIssued({ call_id: "mismatch", tracking_id: "order", status: "ringing", ws_path: "/ws/call?session=other", voice_provider: "gpt_live" });
  assert.equal(invalid.state.status, "error", "mismatched session/socket binding cannot connect");
  await invalid.prepare("order");
  assert.equal(invalid.state.status, "error", "durable API cannot use the standalone fixture reservation endpoint");
  assert.equal(env.posts.some((item) => item.path === "/ai/dev/calls"), false);
  invalid.dispose();
  const cancelled = new env.Controller({ ...config, bridge_mode: "part1" });
  const attaching = cancelled.prepareIssued({ call_id: "late-issued", tracking_id: "order", status: "ringing", ws_path: "/ws/call?session=late-issued", voice_provider: "gpt_live" });
  await cancelled.end("cancelled"); await attaching;
  assert.equal(cancelled.state.status, "ended", "cancelled issued-call attachment cannot reopen consent after cleanup");
  assert.equal(cancelled.state.callId, undefined);
  cancelled.dispose();
}
console.log("PASS: consent/privacy, cancellation races, speech/quiet gating, fresh unmute permissions, autoplay repeat, notices/fatal errors, issued-call attachment, stale callbacks, cleanup and final usage (transport doubles).");
