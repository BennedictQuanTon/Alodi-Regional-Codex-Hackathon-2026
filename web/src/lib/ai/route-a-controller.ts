import { BuyerRingtone } from "./buyer-ringtone";
import { CallAudioSender, CallAudioSpeaker } from "./call-audio";
import { currentIssuedCall } from "./integrated";
import { type MonitorState } from "./live-demo";
import { errorMessage, socketUrl, type IssuedCall } from "./protocol";
import { VoiceController, type VoiceState } from "./voice-controller";

export type RouteARole = "phone" | "display";
type Timer = { label: string; from: string; to: string; business_seconds: number; compressed: true };
export type RouteACallLog = { id: string; at: string; status: "missed" | "ringing" | "answered" | "ended"; text: string };
export type RouteARoomState = {
  generation_id: string; phase: string; can_start: boolean; call_id: string | null;
  phone: { connected: boolean; ready: boolean };
  audio_listeners?: number;
  timers: Timer[]; error: { code: string; detail: string } | null;
  started?: boolean; end_requested?: boolean; call_log?: RouteACallLog[];
  presentation?: { step: string; callback_wait_seconds: number; callback_due_at: string | null };
};
export type RouteAState = {
  role: RouteARole;
  status: "disconnected" | "connecting" | "waiting" | "paired" | "starting" | "ringing" | "answering" | "connected" | "ended" | "error";
  message?: string; error?: string; generation?: string; serverPhase?: string;
  paired: boolean; soundReady: boolean; microphone: "off" | "permission" | "on";
  voice?: VoiceState; canInitiate: boolean; canAnswer: boolean; timers: Timer[];
  started?: boolean; end_requested?: boolean; callLog?: RouteACallLog[];
  dashboardSound?: boolean;
};

const UNLOCK_TIMEOUT_MS = 3000;
const HEARTBEAT_MS = 10000;
const SILENT_SOCKET_MS = 25000;

/** A quarter second of silence. Safari may never finish a clip of only a few samples. */
function silentClip() {
  const samples = 2000, bytes = new Uint8Array(44 + samples).fill(128), view = new DataView(bytes.buffer);
  const write = (at: number, text: string) => { for (let index = 0; index < text.length; index++) bytes[at + index] = text.charCodeAt(index); };
  write(0, "RIFF"); view.setUint32(4, 36 + samples, true); write(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); write(36, "data"); view.setUint32(40, samples, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}
/** Where supported, "playback" lets the ring sound through an iPhone's silent switch. A call needs "auto" for its microphone. */
function audioSession(type: "playback" | "auto") {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  try { if (session) session.type = type; } catch {}
}

/** Stable per browser and session link, so a reload can reclaim this phone's own slot. */
function browserClientId(base: string) {
  const fresh = () => `route-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  try {
    const key = `alodi-route-a-client:${base}`;
    const known = localStorage.getItem(key);
    if (known) return known;
    const id = fresh();
    localStorage.setItem(key, id);
    return id;
  } catch { return fresh(); }
}

/** The phone owns its pairing, microphone, sound and provider call. The display only observes the room over HTTP. */
export class RouteAController {
  state: RouteAState;
  private listeners = new Set<() => void>();
  private monitor?: MonitorState;
  private server?: RouteARoomState;
  private socket?: WebSocket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private lastHeard = 0;
  private voice?: VoiceController;
  private unsubscribeVoice?: () => void;
  private ringtone?: BuyerRingtone;
  private playback?: { context: AudioContext; audio: HTMLAudioElement };
  private sender = new CallAudioSender();
  private speaker = new CallAudioSpeaker();
  private answeredCall?: string;
  private heldGate?: { id: string; callId: string };
  private epoch = 0;
  private callEpoch = 0;
  private audioWaits = new Set<{ timer: ReturnType<typeof setTimeout>; cancel: () => void }>();
  private clientId?: string;
  /** This phone was connected when the session restarted, so it rejoins by itself. */
  private rejoin = false;
  private pagehide = () => { this.disconnect("Device left the page."); };

  constructor(readonly role: RouteARole, readonly base: string) {
    this.state = { role, status: "disconnected", paired: false, soundReady: false, microphone: "off", canInitiate: false, canAnswer: false, timers: [], started: false, end_requested: false, callLog: [] };
    // The phone rings through its one call context: Safari can stall when two compete.
    this.ringtone = role === "phone" ? new BuyerRingtone(() => this.playbackDevices().context) : new BuyerRingtone();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  activate() { if (this.role === "phone") window.addEventListener("pagehide", this.pagehide); }
  private patch(patch: Partial<RouteAState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private send(data: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("Connect this device before continuing.");
    this.socket.send(JSON.stringify({ ...data, generation_id: this.state.generation }));
  }
  private fail(error: unknown) {
    const message = errorMessage(error);
    this.disconnect();
    this.patch({ status: "error", error: message, message, canAnswer: false, canInitiate: false });
  }
  private boundedAudio(promise: Promise<unknown>, message: string) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true; clearTimeout(entry.timer); this.audioWaits.delete(entry);
        if (error) reject(error); else resolve();
      };
      const entry = { timer: setTimeout(() => finish(new Error(message)), UNLOCK_TIMEOUT_MS), cancel: () => finish(new Error("Audio setup was cancelled.")) };
      this.audioWaits.add(entry);
      promise.then(() => finish(), (error) => finish(error));
    });
  }
  /** Starts playback synchronously inside the tap; mobile browsers only unlock audio from a gesture. */
  private playbackDevices() { return this.playback ||= { context: new AudioContext(), audio: new Audio() }; }
  /** Each step settles alone, so one a browser refuses or never finishes cannot hold up the others.
   * Resolves to the names of the steps that did not complete. */
  private async unlockPlayback(): Promise<string[]> {
    const steps: [string, Promise<unknown>][] = [];
    try {
      const { context, audio } = this.playbackDevices();
      steps.push(["context", context.resume()], ["ringtone", this.ringtone!.enable()]);
      if (this.voice) steps.push(["voice", this.voice.playAudio()]);
      else if (!audio.srcObject) {
        audio.autoplay = true;
        audio.src = silentClip();
        steps.push(["clip", audio.play().then(() => { if (!audio.srcObject) { audio.pause(); audio.removeAttribute("src"); audio.load(); } })]);
      }
    } catch { return ["setup"]; }
    const failed = await Promise.all(steps.map(([name, step]) => this.boundedAudio(step, name).then(() => "", () => name)));
    return failed.filter(Boolean);
  }
  /** Sound never blocks the demo. The outcome is recorded so a failing device identifies itself. */
  private reportUnlock(failed: string[]) {
    this.patch({ soundReady: !failed.length });
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.send({ type: "ready", ready: !failed.length });
    if (failed.length) this.send({ type: "audio_report", failed, context: this.playback?.context.state || "none" });
  }

  update(monitor: MonitorState) {
    this.monitor = monitor;
    const generation = monitor.generation || monitor.clock?.generation_id;
    if (generation && this.state.generation && generation !== this.state.generation) this.restarted("Session restarted.");
    if (generation && generation !== this.state.generation) this.patch({ generation });
    if (monitor.clock?.reset_job?.status === "processing") {
      this.restarted("Session is restarting…");
      return;
    }
    if (this.role === "display" && monitor.room?.phone && monitor.room.generation_id === generation) this.server = monitor.room;
    if (monitor.apiError) this.patch({ canInitiate: false, canAnswer: false });
    else if (this.server) this.applyServer(this.server);
    this.ring();
    void this.startVoice().catch((error) => this.fail(error));
    if (this.rejoin && !monitor.apiError) { this.rejoin = false; void this.connect(); }
  }
  /** Ends this device's part in the old generation, remembering that a connected phone should return. */
  restarted(message: string) {
    this.rejoin ||= !!this.socket;
    this.disconnect(message);
  }

  async connect() {
    if (this.role !== "phone" || this.socket) return;
    window.addEventListener("pagehide", this.pagehide);
    audioSession("playback");
    const generation = this.state.generation;
    if (!generation || !this.monitor?.config) { this.fail(new Error("Wait for the current backend session, then connect.")); return; }
    this.patch({ status: "connecting", error: undefined, message: "Connecting this device…" });
    const epoch = ++this.epoch;
    try {
      this.clientId ||= browserClientId(this.base);
      const url = socketUrl(`/demo/route-a/ws?${new URLSearchParams({ role: this.role, client_id: this.clientId, generation_id: generation })}`, this.base);
      const socket = new WebSocket(url);
      this.socket = socket;
      await new Promise<void>((resolve, reject) => {
        // A phone rejoining after a restart has no gesture to unlock with, and still holds its unlock.
        const audioReady = this.state.soundReady && this.playback?.context.state === "running";
        this.deadline = setTimeout(() => reject(new Error("Connecting timed out. Check this phone's network, then tap CONNECT again.")), 12000);
        // The unlock starts in CONNECT's gesture; pairing never awaits browser audio.
        let unlockResult: string[] | undefined = audioReady ? [] : undefined;
        if (!audioReady) void this.unlockPlayback().then((failed) => {
          if (epoch !== this.epoch || this.socket !== socket) return;
          unlockResult = failed;
          this.reportUnlock(failed);
        });
        socket.onopen = () => {
          if (this.socket !== socket || epoch !== this.epoch) { reject(new Error("Pairing was cancelled.")); return; }
          clearTimeout(this.deadline);
          this.patch({ status: "waiting", message: "Connected." });
          if (unlockResult) this.reportUnlock(unlockResult);
          else this.send({ type: "ready", ready: false });
          this.lastHeard = Date.now();
          // A browser can keep a dead socket "open" indefinitely, so silence is what counts as lost.
          this.heartbeat = setInterval(() => {
            if (Date.now() - this.lastHeard > SILENT_SOCKET_MS) { this.disconnect("Connection lost. Tap CONNECT again."); return; }
            try { this.send({ type: "ping" }); } catch {}
          }, HEARTBEAT_MS);
          resolve();
        };
        socket.onerror = () => reject(new Error("Cannot reach the demo session. Check this phone's network."));
        socket.onclose = () => {
          reject(new Error("The session connection closed."));
          if (this.socket === socket) this.disconnect("Connection lost. Tap CONNECT again.");
        };
        socket.onmessage = (event) => {
          if (this.socket !== socket || epoch !== this.epoch) return;
          this.lastHeard = Date.now();
          try {
            const data = JSON.parse(event.data);
            if (data.type === "error" && data.code === "rejected_stale") { this.restarted("Session restarted."); return; }
            if (data.type === "error") { this.fail(new Error(typeof data.detail === "string" ? data.detail : "This session rejected the phone.")); return; }
            if (data.type === "pong") return;
            if (data.generation_id !== this.state.generation) { this.disconnect("Session changed. Tap CONNECT again."); return; }
            if (data.type === "state") { this.validateState(data); this.applyServer(data); }
            else if (data.type === "control" && data.action === "input_gate") this.closeInputGate(data);
            else if (data.type === "control" && data.action === "input_gate_release") {
              const held = this.heldGate;
              if (held && held.id === data.gate_id && held.callId === data.call_id && !this.state.end_requested) {
                this.heldGate = undefined;
                this.voice?.releaseInputSuppression();
              }
            }
          } catch (error) { this.fail(error); }
        };
      });
    } catch (error) {
      if (epoch === this.epoch) { this.disconnect(); this.fail(error); }
    }
  }

  /** Recover this phone's sound after the browser blocked playback. */
  async enableSound() {
    if (this.role !== "phone") return;
    const epoch = this.epoch;
    try {
      const failed = await this.unlockPlayback();
      if (epoch !== this.epoch) return;
      this.reportUnlock(failed);
      this.ring();
    } catch (error) {
      if (epoch === this.epoch) this.patch({ soundReady: false, error: errorMessage(error) });
    }
  }

  /** Dashboard only: also play the ring and Alodi's voice here. The phone is unaffected. */
  async setDashboardSound(on: boolean) {
    if (this.role !== "display") return;
    if (!on) {
      this.speaker.disable(); this.ringtone?.dispose();
      this.patch({ dashboardSound: false });
      return;
    }
    this.patch({ dashboardSound: true, error: undefined });
    try {
      const url = socketUrl("/demo/route-a/audio?role=listener", this.base);
      await this.boundedAudio(Promise.all([this.speaker.enable(url), this.ringtone!.enable()]), "This browser did not allow dashboard sound. Try the switch again.");
      this.ring();
    } catch (error) {
      this.speaker.disable(); this.ringtone?.dispose();
      this.patch({ dashboardSound: false, error: errorMessage(error) });
    }
  }

  async initiate() {
    if (this.role !== "phone" || !this.state.canInitiate) return;
    try { this.send({ type: "initiate", idempotency_key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` }); this.patch({ status: "starting", canInitiate: false, error: undefined, message: "Starting Route A through the order workflow…" }); }
    catch (error) { this.fail(error); }
  }

  async answer() {
    if (this.role !== "phone" || !this.state.canAnswer || !this.server?.call_id) return;
    const epoch = this.epoch, callEpoch = this.callEpoch, callId = this.server.call_id;
    this.answeredCall = callId;
    this.ringtone?.stop(true);
    this.patch({ status: "answering", canAnswer: false, error: undefined, microphone: "permission", message: "Allow this phone's microphone to answer as the customer." });
    try {
      if (this.monitor?.config?.mode !== "live") throw new Error("Integrated stub mode cannot attach a voice session. Use live mode for the customer call.");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Phone microphone access requires HTTPS. Open the session link again.");
      audioSession("auto");
      // Answer is a fresh gesture, which re-unlocks sound that an idle phone may have suspended.
      // The call does not wait for it: blocked sound offers "Enable call audio" instead.
      void this.unlockPlayback().then((failed) => { if (epoch === this.epoch && callEpoch === this.callEpoch) this.reportUnlock(failed); });
      this.send({ type: "answer", call_id: callId });
      await this.startVoice();
    } catch (error) { if (epoch === this.epoch) this.fail(error); }
  }

  setMuted(muted: boolean) { this.voice?.setMuted(muted); }

  private validateState(data: RouteARoomState) {
    if (!data.phone || typeof data.phone.connected !== "boolean" || typeof data.can_start !== "boolean" || !["idle", "starting", "advancing", "ringing", "connected", "ended", "error"].includes(data.phase) || !(data.call_id === null || typeof data.call_id === "string")) throw new Error("Invalid Route A session state.");
  }
  private applyServer(data: RouteARoomState) {
    const wasPaired = this.state.paired;
    this.server = data;
    const paired = data.phone.connected;
    if (wasPaired && !paired) this.stopCall();
    let status: RouteAState["status"] = paired ? "paired" : "waiting";
    if (data.phase === "starting" || data.phase === "advancing") status = "starting";
    else if (data.phase === "ringing") status = this.answeredCall ? "answering" : "ringing";
    else if (["connected", "ended", "error"].includes(data.phase)) status = data.phase as RouteAState["status"];
    const voice = this.voice?.state || this.state.voice;
    if (data.phase === "connected" && voice && ["ending", "ended", "error"].includes(voice.status)) status = voice.status === "error" ? "error" : "ended";
    if (data.phase === "ended" || data.phase === "error") this.stopCall();
    const message = !paired ? "Waiting for the phone to connect." : data.phase === "idle" ? data.can_start ? "Phone connected. It can initiate Route A." : "Phone connected. Getting ready…" : data.phase === "ringing" ? this.monitor?.config?.mode !== "live" ? "Stub workflow reached ringing. Customer audio and typed turns require a live backend; no model call has started." : "Incoming customer call. Answer on the phone." : data.phase === "advancing" ? "Advancing the real workflow with compressed demo timers…" : data.phase === "ended" ? "The backend call has ended. Review the observed result." : this.state.message;
    const ending = data.end_requested === true || this.state.end_requested === true && data.phase !== "idle";
    this.sender.setEnabled((data.audio_listeners || 0) > 0);
    this.patch({ status, serverPhase: data.phase, paired, started: data.started === true, end_requested: ending && !["ended", "error"].includes(status), callLog: Array.isArray(data.call_log) ? data.call_log : [], timers: Array.isArray(data.timers) ? data.timers : [], canInitiate: this.role === "phone" && data.can_start && !ending && !this.monitor?.apiError, canAnswer: this.role === "phone" && this.monitor?.config?.mode === "live" && paired && data.phase === "ringing" && !ending && !this.answeredCall && !this.monitor?.apiError, ...(data.error ? { error: data.error.detail } : {}), message: ending && !["ended", "error"].includes(status) ? "Finishing the conversation and checking the actual outcome…" : message });
    this.ring();
  }
  private ring() {
    if (!this.ringtone) return;
    const call = this.monitor?.detail && currentIssuedCall(this.monitor.detail);
    const ringing = this.server?.phase === "ringing" && !this.answeredCall && !this.state.end_requested && call?.call_id === this.server.call_id;
    const deadline = this.monitor?.detail?.calls.find((item) => item.provider_session_id === call?.call_id)?.answer_deadline_at;
    // Issued-call answer deadlines use real wall time, independently of the business clock.
    this.ringtone.update(ringing ? call?.call_id : undefined, this.state.generation, deadline ? Date.parse(deadline) : Date.now() + 30000);
  }

  private closeInputGate(data: { call_id: string; gate_id: string; enabled: boolean }) {
    if (data.enabled !== false || typeof data.gate_id !== "string" || data.call_id !== this.server?.call_id) throw new Error("The phone input gate is unavailable.");
    // Disables the live track synchronously, so the acknowledgement below is truthful.
    this.voice?.suppressInputUntilAllowed();
    this.heldGate = { id: data.gate_id, callId: data.call_id };
    this.send({ type: "input_gate_ack", call_id: data.call_id, gate_id: data.gate_id, enabled: false });
  }

  private async startVoice() {
    if (this.role !== "phone" || this.voice || !this.answeredCall || this.state.end_requested || this.monitor?.config?.mode !== "live" || !this.monitor.detail || !this.playback) return;
    const call: IssuedCall | undefined = currentIssuedCall(this.monitor.detail);
    if (!call || call.call_id !== this.answeredCall) return;
    const epoch = this.epoch;
    const context = this.playback.context;
    const relay = socketUrl(`/demo/route-a/audio?${new URLSearchParams({ role: "phone", client_id: this.clientId || "" })}`, this.base);
    const { audio } = this.playback;
    const voice = new VoiceController(this.monitor.config, this.base, { playback: this.playback, onOutputStream: (stream) => {
      // A clip the browser never finished must not stay attached to the call's output.
      audio.removeAttribute("src");
      this.sender.attach(stream, context, relay);
    } });
    this.voice = voice;
    this.unsubscribeVoice = voice.subscribe(() => {
      if (this.voice !== voice) return;
      const { status, message, diagnostics } = voice.state;
      this.patch({ voice: voice.state, microphone: diagnostics.microphone, ...(message ? { message } : {}), ...(["ending", "ended"].includes(status) ? { status: "ended" as const, canAnswer: false } : {}), ...(status === "error" ? { status: "error" as const, canAnswer: false, error: message } : {}) });
    });
    try {
      await voice.prepareIssued(call);
      if (epoch !== this.epoch || this.voice !== voice) return;
      await voice.connect();
    } catch (error) { if (epoch === this.epoch && this.voice === voice) this.fail(error); }
  }

  async end() {
    if (this.role !== "phone" || !this.server?.call_id || this.state.end_requested) return;
    this.callEpoch++;
    this.ringtone?.stop(true);
    this.voice?.suppressInputUntilAllowed();
    this.patch({ end_requested: true, microphone: "off", canAnswer: false, canInitiate: false, message: "Finishing the conversation and checking the actual outcome…" });
    try { this.send({ type: "end", call_id: this.server.call_id }); } catch {}
  }
  private stopCall() {
    this.callEpoch++;
    this.ringtone?.stop(true);
    this.unsubscribeVoice?.(); this.unsubscribeVoice = undefined;
    const voice = this.voice; this.voice = undefined;
    voice?.dispose();
    this.sender.stop();
    this.heldGate = undefined;
    this.answeredCall = undefined;
    if (this.state.microphone !== "off") this.patch({ microphone: "off" });
  }
  disconnect(message?: string) {
    this.epoch++;
    for (const wait of [...this.audioWaits]) wait.cancel();
    window.removeEventListener("pagehide", this.pagehide);
    clearTimeout(this.deadline); clearInterval(this.heartbeat);
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; socket.close(); }
    this.stopCall();
    this.server = undefined;
    this.patch({ status: "disconnected", paired: false, canInitiate: false, canAnswer: false, message, error: undefined, voice: undefined, serverPhase: undefined, timers: [], started: false, end_requested: false, callLog: [] });
  }
  suspend() {
    window.removeEventListener("pagehide", this.pagehide);
    this.disconnect(); this.ringtone?.dispose(); this.speaker.disable();
    this.playback?.audio.pause();
    void this.playback?.context.close().catch(() => {}); this.playback = undefined;
    this.patch({ soundReady: false, dashboardSound: false });
  }
  dispose() {
    this.suspend();
    this.listeners.clear();
  }
}
