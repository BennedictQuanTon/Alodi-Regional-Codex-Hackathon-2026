// Deterministic browser-transport doubles. These do not establish real device/provider audio.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/ai/route-a-controller.ts", import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const flush = async () => { for (let index = 0; index < 40; index++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const config = { mode: "live", ready: true, bridge_mode: "part1", transport: "webrtc", voice_provider: "gpt_live", limits: { call_seconds: 90 } };
const issued = { call_id: "call-1", status: "ringing", ws_path: "/ws/call?session=call-1", tracking_id: "SPXVN0123456789" };
const monitor = (generation = "g1", extra = {}) => ({ generation, config, detail: { issued, calls: [] }, clock: { generation_id: generation, now: "2099-01-01T00:00:00Z", speed: 1000 }, ...extra });
const server = (phase = "idle", extra = {}) => ({ type: "state", generation_id: "g1", phase, call_id: phase === "idle" ? null : "call-1", phone: { connected: true, ready: true }, can_start: phase === "idle", timers: [], error: null, ...extra });

function fixture(options = {}) {
  const senders = [], speakers = [], ringtones = [], sockets = [], voices = [], contexts = [], audios = [], rings = [], callbacks = new Map(), listeners = new Set(), storage = new Map();
  let nextTimer = 0;
  const timerDelays = new Map();
  class Socket {
    static OPEN = 1; readyState = 0; sent = [];
    constructor(url) { this.url = url; sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
    send(data) { this.sent.push(JSON.parse(data)); }
    message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Context { state = "running"; constructor() { contexts.push(this); } resume() { return Promise.resolve(); } close() { this.state = "closed"; return Promise.resolve(); } }
  class Audio { constructor() { audios.push(this); } play() { this.played = (this.played || 0) + 1; return options.playPromise?.() || Promise.resolve(); } pause() {} load() {} removeAttribute() {} }
  class Ringtone { constructor() { ringtones.push(this); } async enable() { this.enabled = true; } update(...args) { rings.push(args); } stop() {} dispose() { this.enabled = false; } }
  class Sender { constructor() { senders.push(this); } setEnabled(value) { this.enabledState = value; } attach(stream, context, url) { this.attached = { stream, context, url }; } stop() { this.stopped = true; } }
  class Speaker { constructor() { speakers.push(this); } enable(url) { this.url = url; return options.speakerPromise || Promise.resolve(); } disable() { this.url = undefined; } }
  class Voice {
    state = { status: "idle", diagnostics: { microphone: "off" }, captions: [], activity: "waiting", needsPlayback: false };
    constructor(config, base, options) { this.config = config; this.base = base; this.options = options; voices.push(this); }
    subscribe(fn) { this.listener = fn; return () => { this.listener = undefined; }; }
    async prepareIssued(call) { this.call = call; this.set({ status: "consent" }); }
    async connect() { this.set({ status: "connected", diagnostics: { microphone: "on" } }); }
    set(patch) { this.state = { ...this.state, ...patch }; this.listener?.(); }
    async playAudio() { this.recovered = true; }
    suppressInputUntilAllowed() { this.suppressed = true; }
    setMuted(muted) { this.set({ muted }); }
    releaseInputSuppression() { this.released = true; }
    dispose() { this.disposed = true; }
  }
  const exports = {};
  vm.runInNewContext(compile(source), {
    exports,
    require: (name) => ({ "./call-audio": { CallAudioSender: Sender, CallAudioSpeaker: Speaker }, "./buyer-ringtone": { BuyerRingtone: Ringtone }, "./integrated": { currentIssuedCall: (detail) => detail.issued }, "./voice-controller": { VoiceController: Voice }, "./protocol": { errorMessage: (error) => error.message, socketUrl: (path, base) => `${base.replace(/^http/, "ws")}${path}` } })[name],
    window: { isSecureContext: options.secure !== false, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) },
    navigator: { mediaDevices: { getUserMedia() {} } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    AudioContext: Context, Audio, WebSocket: Socket,
    URLSearchParams, Date: options.Date || Date, Math, JSON, Error, Array, Promise, btoa, String, Uint8Array, DataView,
    setTimeout: (fn, ms) => { callbacks.set(++nextTimer, fn); timerDelays.set(nextTimer, ms); return nextTimer; }, clearTimeout: (id) => { callbacks.delete(id); timerDelays.delete(id); },
    setInterval: (fn, ms) => { callbacks.set(++nextTimer, fn); timerDelays.set(nextTimer, ms); return nextTimer; }, clearInterval: (id) => { callbacks.delete(id); timerDelays.delete(id); },
  });
  return { Controller: exports.RouteAController, senders, speakers, ringtones, sockets, voices, contexts, audios, rings, listeners, callbacks, expire(ms) { for (const [id, fn] of [...callbacks]) if (timerDelays.get(id) === ms) fn(); } };
}
const base = "https://demo.example/api/s/judge-a";

{
  const env = fixture();
  const display = new env.Controller("display", base); display.activate();
  assert.equal(env.listeners.size, 0, "the display registers nothing that could tear down a call");
  display.update(monitor("g1", { room: server("idle", { phone: { connected: false, ready: false }, can_start: false }) }));
  assert.equal(display.state.paired, false, "dashboard shows no phone until the room reports one");
  await display.connect();
  assert.equal(env.sockets.length, 0, "the display never opens a socket, so any number of dashboards cannot conflict");
  display.update(monitor("g1", { room: server("ringing") }));
  assert.equal(display.state.paired, true, "dashboard reflects the phone from observed room state");
  assert.equal(display.state.status, "ringing"); assert.equal(display.state.canAnswer, false);
  await display.enableSound();
  assert.equal(env.contexts.length + env.audios.length + env.voices.length, 0, "the display owns no sound and no provider call");
  display.update(monitor("g1", { room: server("idle", { generation_id: "stale" }) }));
  assert.equal(display.state.status, "ringing", "a room observed for another generation is ignored");
  display.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor());
  await phone.connect(); await flush();
  assert.match(env.sockets[0].url, /^wss:\/\/demo\.example\/api\/s\/judge-a\/demo\/route-a\/ws\?role=phone/, "pairing stays on this session's API");
  assert.equal(env.audios[0].played, 1, "CONNECT unlocks this phone's own output in the gesture");
  assert.equal(env.sockets[0].sent.at(-1).ready, true);
  assert.equal(env.voices.length, 0, "pairing cannot create a provider call");
  assert.equal(env.sockets[0].sent.every((message) => message.type === "ready"), true, "CONNECT cannot initiate workflow");
  env.sockets[0].message(server());
  assert.equal(phone.state.paired, true); assert.equal(phone.state.canInitiate, true);
  await phone.initiate();
  assert.equal(env.sockets[0].sent.at(-1).type, "initiate");
  env.sockets[0].message(server("ringing"));
  assert.equal(phone.state.canAnswer, true);
  await phone.answer(); await flush();
  assert.ok(env.sockets[0].sent.some((message) => message.type === "answer"));
  assert.equal(env.voices.length, 1, "answering starts the provider call on this phone");
  assert.equal(env.voices[0].base, base, "the call stays on this session's API");
  assert.equal(env.voices[0].options.inputStream, undefined, "the provider call uses this phone's own microphone");
  assert.equal(env.voices[0].options.playback.audio, env.audios[0], "the provider call plays on the gesture-unlocked element of this phone");
  assert.equal(env.voices[0].options.playback.context, env.contexts[0]);
  assert.equal(phone.state.microphone, "on");
  phone.update(monitor()); await flush();
  assert.equal(env.voices.length, 1, "repeated polls cannot create a second provider call");
  env.sockets[0].message({ type: "control", action: "input_gate", generation_id: "g1", call_id: "call-1", gate_id: "gate-1", enabled: false });
  assert.equal(env.voices[0].suppressed, true, "gate disables the microphone before acknowledging");
  assert.deepEqual(JSON.parse(JSON.stringify(env.sockets[0].sent.at(-1))), { type: "input_gate_ack", call_id: "call-1", gate_id: "gate-1", enabled: false, generation_id: "g1" });
  env.sockets[0].message({ type: "control", action: "input_gate_release", generation_id: "g1", call_id: "call-1", gate_id: "stale" });
  assert.equal(env.voices[0].released, undefined, "an unrelated release cannot reopen a held gate");
  env.sockets[0].message({ type: "control", action: "input_gate_release", generation_id: "g1", call_id: "call-1", gate_id: "gate-1" });
  assert.equal(env.voices[0].released, true);
  await phone.end();
  assert.equal(env.sockets[0].sent.at(-1).type, "end"); assert.equal(phone.state.end_requested, true);
  assert.equal(env.voices[0].disposed, undefined, "graceful finish keeps the call for the backend result");
  env.sockets[0].message(server("ended", { end_requested: true }));
  assert.equal(env.voices[0].disposed, true, "terminal backend state releases the call");
  phone.dispose();
  assert.equal(env.callbacks.size, 0, "cleanup releases timers");
}
{
  const env = fixture();
  const first = new env.Controller("phone", base); first.update(monitor()); await first.connect();
  const reloaded = new env.Controller("phone", base); reloaded.update(monitor()); await reloaded.connect();
  const id = (socket) => new URL(socket.url.replace(/^wss/, "https")).searchParams.get("client_id");
  assert.equal(id(env.sockets[0]), id(env.sockets[1]), "a reload presents the same client so it can reclaim its own slot");
  const other = new env.Controller("phone", "https://demo.example/api/s/judge-b"); other.update(monitor()); await other.connect();
  assert.notEqual(id(env.sockets[2]), id(env.sockets[0]), "client identity is per session link");
  first.dispose(); reloaded.dispose(); other.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message({ type: "error", code: "role_conflict", detail: "Another phone is already using this session link" });
  assert.equal(phone.state.status, "error", "a second phone sees why it was refused and can retry");
  assert.match(phone.state.error, /Another phone/);
  phone.dispose();
}
{
  let now = 1000;
  class Clock extends Date { static now() { return now; } }
  const env = fixture({ Date: Clock });
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server());
  env.expire(10000);
  assert.equal(env.sockets[0].sent.at(-1).type, "ping");
  env.sockets[0].message({ type: "pong" });
  now += 26000; env.expire(10000);
  assert.equal(phone.state.status, "disconnected", "a socket that went silent stops claiming to be synced");
  assert.equal(phone.state.paired, false); assert.match(phone.state.message, /Connection lost/);
  phone.dispose();
}
{
  const audio = deferred(), env = fixture({ playPromise: () => audio.promise });
  const phone = new env.Controller("phone", base); phone.update(monitor());
  await phone.connect();
  assert.equal(env.sockets.length, 1, "a never-resolving audio unlock cannot prevent the session socket");
  assert.equal(env.sockets[0].sent[0].ready, false, "pending audio never claims readiness");
  env.sockets[0].message(server("idle", { phone: { connected: true, ready: false }, can_start: true }));
  assert.equal(phone.state.canInitiate, true, "an unfinished audio unlock never blocks Initiate");
  env.expire(3000); await flush();
  assert.notEqual(phone.state.status, "error", "a stuck clip is not an error for the demo");
  const report = env.sockets[0].sent.find((message) => message.type === "audio_report");
  assert.deepEqual(JSON.parse(JSON.stringify(report.failed)), ["clip"], "the stuck step identifies itself");
  assert.equal(phone.state.soundReady, false);
  await phone.initiate();
  assert.equal(env.sockets[0].sent.at(-1).type, "initiate");
  env.sockets[0].message(server("ringing"));
  await phone.answer(); await flush();
  assert.equal(env.voices.length, 1, "the call still starts, and its own audio path can recover");
  phone.dispose();
}
{
  const audio = deferred(), env = fixture({ playPromise: () => audio.promise });
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect();
  phone.update(monitor("g2")); audio.resolve(); await flush();
  assert.equal(phone.state.generation, "g2");
  assert.equal(env.sockets[0].sent.some((message) => message.ready === true), false, "reset cancels an older sound unlock before readiness is reported");
  assert.equal(env.sockets.length, 2, "a phone that was connected rejoins the new generation");
  phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing"));
  const answering = phone.answer();
  phone.update(monitor("g2")); await answering; await flush();
  assert.ok(env.voices.every((voice) => voice.disposed), "reset during answer leaves no stale provider call");
  phone.dispose();
}
{
  const env = fixture({ secure: false });
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing"));
  await phone.answer(); await flush();
  assert.equal(phone.state.status, "error"); assert.match(phone.state.error, /HTTPS/);
  assert.equal(env.voices.length, 0); phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing", { generation_id: "stale" }));
  assert.equal(phone.state.status, "disconnected", "stale server generation disconnects before controls are enabled");
  assert.equal(phone.state.canAnswer, false); phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing", { phone: null }));
  assert.equal(phone.state.status, "error", "invalid session payload fails closed"); phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update({ ...monitor(), config: { ...config, mode: "stub" } }); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing"));
  assert.equal(phone.state.canAnswer, false, "integrated stub cannot pretend to attach a provider call");
  await phone.answer();
  assert.equal(env.voices.length, 0); phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing")); await phone.answer(); await flush();
  env.voices[0].set({ status: "connected", needsPlayback: true });
  await phone.enableSound();
  assert.equal(env.voices[0].recovered, true, "a blocked call recovers from a tap on this phone");
  env.voices[0].set({ status: "error", message: "Provider timeout" });
  assert.equal(phone.state.status, "error"); assert.equal(phone.state.error, "Provider timeout", "provider failure is surfaced on the phone");
  phone.dispose();
}

{
  // Exercise real VoiceController ownership separately from the orchestration double.
  let localRequests = 0;
  const sent = [], peers = [];
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const context = {
    state: "running", sampleRate: 48000, closed: false,
    resume: async () => {}, close() { this.closed = true; return Promise.resolve(); },
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => ({ fftSize: 256, getFloatTimeDomainData() {} }),
  };
  const audio = { autoplay: true, pause() {}, play: async () => {} };
  class Socket {
    static OPEN = 1; readyState = 0;
    constructor() { queueMicrotask(() => { this.readyState = 1; this.onopen?.(); this.onmessage?.({ data: JSON.stringify({ type: "status", status: "connected" }) }); }); }
    send(value) { sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
  }
  class Peer {
    connectionState = "connected";
    constructor() { peers.push(this); }
    createDataChannel() { return { readyState: "open", close() {} }; }
    addTrack(track, stream) { this.track = track; this.stream = stream; }
    createOffer() { return Promise.resolve({ type: "offer", sdp: "synthetic-offer" }); }
    async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription() {}
    close() { this.connectionState = "closed"; }
  }
  const live = {}, exports = {};
  vm.runInNewContext(compile(fs.readFileSync(new URL("../src/lib/ai/live-playback.ts", import.meta.url), "utf8")), { exports: live });
  vm.runInNewContext(compile(fs.readFileSync(new URL("../src/lib/ai/voice-controller.ts", import.meta.url), "utf8")), {
    exports,
    require: (name) => name === "./live-playback" ? live : name === "./audio" ? { waitForIce: async () => {} } : {
      API_URL: "https://demo.example/api", errorMessage: (error) => error.message,
      socketUrl: (path) => `wss://demo.example${path}`,
      post: async () => ({ transport: "webrtc", sdp: "synthetic-answer" }), request: async () => ({}),
    },
    window: { isSecureContext: true, addEventListener() {}, removeEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: async () => { localRequests++; return stream; } } },
    WebSocket: Socket, RTCPeerConnection: Peer, URL, AbortController, DOMException,
    AudioContext: class { constructor() { throw new Error("Must reuse output context"); } },
    Audio: class { constructor() { throw new Error("Must reuse output element"); } },
    setTimeout, clearTimeout, setInterval, clearInterval, Date,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  const voice = new exports.VoiceController(config, "https://demo.example/api", { playback: { context, audio } });
  await voice.prepareIssued(issued); await voice.connect();
  assert.equal(voice.state.status, "connected");
  assert.equal(localRequests, 1, "real VoiceController captures this device's microphone once");
  assert.equal(peers[0].stream, stream);
  assert.equal(track.enabled, false, "real playback gate keeps input muted until measured drain/permission");
  voice.setMuted(true);
  assert.equal(voice.state.muted, true); assert.equal(track.enabled, false);
  assert.match(voice.state.message, /Muted/, "the caller is told the microphone is off by their choice");
  voice.setMuted(false);
  assert.equal(voice.state.muted, false); assert.doesNotMatch(voice.state.message, /Muted/);
  assert.equal(sent.some((event) => event.type === "playback_state"), false, "connecting never fabricates playback acknowledgements");
  await voice.end();
  assert.equal(track.stopped, true, "the phone's own microphone is released with the call");
  assert.equal(context.closed, false, "borrowed output context remains caller-owned");
  voice.dispose();
}

{
  // Restart: a connected phone returns by itself without a gesture or a fresh sound unlock.
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  const plays = env.audios[0].played;
  env.sockets[0].message(server());
  env.sockets[0].message({ type: "error", code: "rejected_stale", detail: "Workflow reset. Connect to the new generation." });
  assert.equal(phone.state.status, "disconnected"); assert.equal(phone.state.error, undefined, "a restart is not reported as a failure");
  phone.update(monitor("g2")); await flush();
  assert.equal(env.sockets.length, 2, "the phone rejoined by itself");
  assert.match(env.sockets[1].url, /generation_id=g2/);
  assert.equal(env.sockets[1].sent[0].ready, true, "its existing sound unlock still counts");
  assert.equal(env.audios[0].played, plays, "rejoining plays nothing outside a gesture");
  env.sockets[1].message(server("idle", { generation_id: "g2" }));
  assert.equal(phone.state.canInitiate, true, "the demo can start again immediately");
  phone.dispose();
}
{
  // Restart during a call releases that call, then rejoins.
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing")); await phone.answer(); await flush();
  phone.update(monitor("g1", { clock: { generation_id: "g1", reset_job: { status: "processing" } } }));
  assert.equal(env.voices[0].disposed, true, "the old call is released as soon as the restart is seen");
  assert.equal(env.sockets.length, 1, "no rejoin while the restart is still running");
  phone.update(monitor("g2")); await flush();
  assert.equal(env.sockets.length, 2);
  phone.dispose();
}
{
  // Never rejoin a device that was not connected, or that left deliberately.
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor());
  phone.update(monitor("g2")); await flush();
  assert.equal(env.sockets.length, 0, "a phone that never tapped CONNECT stays untouched");
  await phone.connect(); await flush();
  phone.disconnect("left"); phone.update(monitor("g3")); await flush();
  assert.equal(env.sockets.length, 1, "a device that left is not pulled back");
  phone.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor());
  phone.setMuted(true);
  await phone.connect(); await flush();
  env.sockets[0].message(server("ringing")); await phone.answer(); await flush();
  assert.notEqual(env.voices[0].state.muted, true, "mute before a call exists does nothing");
  phone.setMuted(true);
  assert.equal(phone.state.voice.muted, true, "mute reaches the call");
  phone.setMuted(false);
  assert.equal(phone.state.voice.muted, false);
  phone.dispose();
}

{
  const env = fixture();
  const display = new env.Controller("display", base);
  display.update(monitor("g1", { room: server("ringing") }));
  assert.equal(env.ringtones[0].enabled, undefined, "dashboard sound starts off, so it does not ring");
  assert.equal(env.speakers[0].url, undefined);
  await display.setDashboardSound(true);
  assert.equal(display.state.dashboardSound, true);
  assert.equal(env.speakers[0].url, "wss://demo.example/api/s/judge-a/demo/route-a/audio?role=listener", "it listens on this session only");
  assert.equal(env.ringtones[0].enabled, true);
  assert.equal(env.voices.length, 0, "the dashboard still owns no call");
  await display.setDashboardSound(false);
  assert.equal(display.state.dashboardSound, false); assert.equal(env.speakers[0].url, undefined); assert.equal(env.ringtones[0].enabled, false);
  display.dispose();
}
{
  const env = fixture({ speakerPromise: new Promise(() => {}) });
  const display = new env.Controller("display", base);
  const switching = display.setDashboardSound(true); await flush(); env.expire(3000); await switching;
  assert.equal(display.state.dashboardSound, false, "a browser refusal puts the switch back");
  assert.match(display.state.error, /did not allow/); display.dispose();
}
{
  const env = fixture();
  const phone = new env.Controller("phone", base); phone.update(monitor()); await phone.connect(); await flush();
  env.sockets[0].message(server("ringing", { audio_listeners: 0 }));
  assert.equal(env.senders[0].enabledState, false, "the phone uploads nothing with no dashboard listening");
  env.sockets[0].message(server("ringing", { audio_listeners: 1 }));
  assert.equal(env.senders[0].enabledState, true);
  await phone.answer(); await flush();
  env.voices[0].options.onOutputStream("provider-stream");
  assert.equal(env.senders[0].attached.stream, "provider-stream", "only Alodi's output is relayed, never the microphone");
  assert.match(env.senders[0].attached.url, /\/api\/s\/judge-a\/demo\/route-a\/audio\?role=phone&client_id=route-/);
  phone.dispose();
  assert.equal(env.senders[0].stopped, true, "the relay ends with the call");
}

console.log("PASS: Route A phone-owned call and sound, observer-only display, session-scoped API, reload reclaim, silent-socket detection, mic gate, stale/reset cancellation and reusable teardown (browser doubles).");
