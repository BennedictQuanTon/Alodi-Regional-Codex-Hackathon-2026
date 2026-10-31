import { waitForIce } from "./audio";
import { LivePlaybackGate, type LiveTurn } from "./live-playback";
import { API_URL, errorMessage, post, request, socketUrl, type AiConfig, type Caption, type Connection, type IssuedCall } from "./protocol";

export type VoiceState = {
  status: "idle" | "consent" | "connecting" | "connected" | "ending" | "ended" | "error";
  callId?: string;
  message?: string;
  notice?: string;
  captions: Caption[];
  proposal?: unknown;
  result?: unknown;
  usage?: unknown;
  level: number;
  seconds: number;
  needsPlayback: boolean;
  activity: "waiting" | "speaking" | "listening" | "processing" | "notes";
  diagnostics: { microphone: "off" | "permission" | "on"; socket: string; peer: string; dataChannel: string; sampleRate?: number; framesSent: number };
};

const initialState = (): VoiceState => ({ status: "idle", captions: [], level: 0, seconds: 0, needsPlayback: false, activity: "waiting", diagnostics: { microphone: "off", socket: "closed", peer: "closed", dataChannel: "closed", framesSent: 0 } });

/** Browser transport only. The backend owns transcripts, decisions, and persistence. */
export class VoiceController {
  state = initialState();
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private remoteSource?: MediaStreamAudioSourceNode;
  private remoteFrame?: number;
  private playback = new LivePlaybackGate();
  private lastPlaybackReport?: string;
  private userActive = false;
  private userLastSound = 0;
  private awaitingReplay = false;
  private meterFrame?: number;
  private tick?: ReturnType<typeof setInterval>;
  private ping?: ReturnType<typeof setInterval>;
  private connectDeadline?: ReturnType<typeof setTimeout>;
  private drainDeadline?: ReturnType<typeof setTimeout>;
  private outputDeadline?: ReturnType<typeof setInterval>;
  private replayDeadline?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private ready = false;
  private serverReady = false;
  private issuedSocketPath?: string;
  private pagehide = () => { void this.end("navigation"); };

  constructor(readonly config: AiConfig, readonly base = API_URL) {
    window.addEventListener("pagehide", this.pagehide);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private patch(patch: Partial<VoiceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private diagnostic(patch: Partial<VoiceState["diagnostics"]>) { this.patch({ diagnostics: { ...this.state.diagnostics, ...patch } }); }
  private send(value: unknown) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value)); }
  private current(generation: number) { return generation === this.generation && !this.abort?.signal.aborted; }

  async prepare(trackingId: string) {
    await this.end("replaced", false);
    this.state = initialState();
    this.patch({ status: "connecting", message: "Preparing the call…" });
    const generation = ++this.generation;
    this.abort = new AbortController();
    try {
      if (this.config.bridge_mode === "part1") throw new Error("This backend requires a call issued by the order workflow. Open the integrated workspace.");
      // Keep the reservation response on local cancellation so a late ID can be closed.
      // Backend reservation expiry covers a response lost at the network boundary.
      const call = await post<IssuedCall>("/ai/dev/calls", { tracking_id: trackingId }, undefined, this.base);
      if (!this.current(generation)) {
        void post(`/ai/calls/${encodeURIComponent(call.call_id)}/end`, { reason: "cancelled_before_consent" }, undefined, this.base).catch(() => {});
        return;
      }
      this.patch({ status: "consent", callId: call.call_id, message: undefined });
    } catch (error) { if (this.current(generation)) this.fail(error); }
  }

  /** Attach a policy-issued Part 1 call without creating another reservation. */
  async prepareIssued(call: IssuedCall) {
    const closing = this.end("replaced", false);
    const generation = this.generation;
    await closing;
    if (generation !== this.generation) return;
    this.state = initialState();
    this.abort = new AbortController();
    try {
      const address = new URL(socketUrl(call.ws_path, this.base));
      if (address.searchParams.get("session") !== call.call_id || !address.pathname.endsWith("/ws/call") || call.status !== "ringing") throw new Error("This issued call is unavailable. Refresh the order.");
      this.issuedSocketPath = call.ws_path;
      this.patch({ status: "consent", callId: call.call_id });
    } catch (error) { this.fail(error); }
  }

  /** Invoke directly from the consent button so playback can unlock in that gesture. */
  async connect() {
    if (this.state.status !== "consent" || !this.state.callId) return;
    if (!this.config.ready || this.config.mode === "offline") { this.fail(new Error("Voice service is not ready. Check the development diagnostics.")); return; }
    const generation = this.generation;
    const callId = this.state.callId;
    const signal = this.abort!.signal;
    this.patch({ status: "connecting", message: "Connecting…" });
    this.connectDeadline = setTimeout(() => { if (this.current(generation) && this.state.status === "connecting") this.fail(new Error("Voice connection timed out. Try again.")); }, 30000);
    try {
      if (this.config.mode === "live") {
        if (this.config.voice_provider !== "gpt_live" || this.config.transport !== "webrtc") throw new Error("This voice lab requires GPT Live over WebRTC.");
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS or localhost and a supported browser.");
        this.context = new AudioContext();
        await this.context.resume();
        if (!this.current(generation)) return;
        this.audio = new Audio();
        this.audio.autoplay = true;
        this.audio.onerror = () => { if (this.current(generation)) this.fail(new Error("Call audio failed. End the call and try again.")); };
        this.outputDeadline = setInterval(() => {
          if (this.current(generation) && this.playback.expired(Date.now())) {
            this.reportPlayback("failed");
            this.fail(new Error("No audible response arrived from GPT Live. Please try again."));
          }
        }, 250);
      }
      await this.openSocket(callId, signal);
      if (!this.current(generation)) return;
      let offer: string | undefined;
      if (this.config.mode === "live" && this.config.transport === "webrtc") offer = await this.createOffer(generation, signal);
      if (!this.current(generation)) return;
      const connection = await post<Connection>(`/ai/calls/${encodeURIComponent(callId)}/connect`, { consent: true, ...(offer ? { sdp: offer } : {}) }, signal, this.base);
      if (!this.current(generation)) return;
      if (this.config.mode === "live" && connection.transport === "webrtc") {
        if (!connection.sdp || !this.peer) throw new Error("The voice service did not return a connection answer.");
        await this.peer.setRemoteDescription({ type: "answer", sdp: connection.sdp });
      }
      if (!this.current(generation)) return;
      this.ready = true;
      this.maybeConnected();
      const started = Date.now();
      this.tick = setInterval(() => {
        if (!this.current(generation)) return;
        const seconds = Math.floor((Date.now() - started) / 1000);
        this.patch({ seconds });
        if (seconds >= this.config.limits.call_seconds) void this.end("time_limit");
      }, 250);
    } catch (error) { if (this.current(generation)) this.fail(error); }
  }

  private maybeConnected() {
    if (!this.ready || !this.serverReady) return;
    if (this.config.mode === "live" && this.config.transport === "webrtc" && (this.peer?.connectionState !== "connected" || this.channel?.readyState !== "open")) return;
    clearTimeout(this.connectDeadline);
    if (this.state.status !== "connected") this.patch({ status: "connected" });
    this.updateInput();
  }

  private reportPlayback(state: "playing" | "drained" | "blocked" | "failed" | "ready") {
    const turn = this.playback.turn;
    if (!turn || this.socket?.readyState !== WebSocket.OPEN) return;
    const key = JSON.stringify([turn.generation_id, turn.turn_id, this.playback.revision, state]);
    if (key === this.lastPlaybackReport) return;
    // Record before sending: an echoed server state must not re-report the same
    // transition. Fresh turns/revisions and ready recovery still get their report.
    this.lastPlaybackReport = key;
    this.send({ type: "playback_state", generation_id: turn.generation_id, turn_id: turn.turn_id, playback_revision: this.playback.revision, state });
  }

  private updateInput() {
    const allowed = this.config.mode === "live" && this.state.status === "connected" && this.ready && this.serverReady && this.playback.inputAllowed && !this.state.needsPlayback && this.context?.state === "running";
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = allowed; });
    if (!allowed && this.userActive) this.reportUserActivity(false);
    const activity = allowed ? this.playback.turn?.phase === "notes" ? "notes" : "listening" : this.playback.heard && !this.playback.drained ? "speaking" : this.playback.drained ? "processing" : "waiting";
    const message = this.config.mode === "stub" ? "Stub simulation · typed turns, no microphone or provider traffic" : this.state.needsPlayback ? "Audio is blocked. Enable call audio to continue; your microphone is off." : activity === "notes" ? "Listening for optional notes. Say no more, or stay silent for 8 seconds to finish." : activity === "listening" ? "Listening · you can speak now." : activity === "speaking" ? "Alodi is speaking. Please wait; your microphone is off." : activity === "processing" ? "Processing your response. Please wait; your microphone is off." : "Waiting for Alodi's audio. Your microphone is off.";
    const startedListening = allowed && this.state.diagnostics.microphone !== "on";
    if (this.state.activity !== activity || this.state.message !== message || this.state.diagnostics.microphone !== (allowed ? "on" : "off")) this.patch({ activity, message, ...(startedListening ? { notice: undefined } : {}), diagnostics: { ...this.state.diagnostics, microphone: allowed ? "on" : "off" } });
  }

  private reportUserActivity(active: boolean) {
    this.userActive = active;
    const turn = this.playback.turn;
    if (turn) this.send({ type: "user_activity", generation_id: turn.generation_id, turn_id: turn.turn_id, active });
  }

  private openSocket(callId: string, signal: AbortSignal) {
    const generation = this.generation;
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(socketUrl(this.issuedSocketPath || `/ws/call?session=${encodeURIComponent(callId)}`, this.base));
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      this.diagnostic({ socket: "connecting" });
      const aborted = () => { socket.close(); reject(new DOMException("Cancelled", "AbortError")); };
      const timer = setTimeout(() => { socket.close(); reject(new Error("Cannot reach the call socket.")); }, 10000);
      signal.addEventListener("abort", aborted, { once: true });
      socket.onopen = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        if (this.socket !== socket || !this.current(generation)) { socket.close(); reject(new DOMException("Cancelled", "AbortError")); return; }
        this.diagnostic({ socket: "open" });
        this.ping = setInterval(() => this.send({ type: "ping" }), 15000);
        resolve();
      };
      socket.onerror = () => { clearTimeout(timer); signal.removeEventListener("abort", aborted); reject(new Error("The call socket could not connect.")); };
      socket.onclose = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        reject(new Error("The call socket closed before it connected."));
        if (this.socket === socket && ["connecting", "connected"].includes(this.state.status)) this.fail(new Error("Call connection lost. Please try again."));
        else if (this.socket === socket && this.state.status === "ending") { this.release(); this.patch({ status: "ended", message: "Call ended. Usage may be incomplete because the socket closed." }); }
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket) return;
        try {
          if (event.data instanceof ArrayBuffer) throw new Error("Unexpected PCM audio: GPT Live requires WebRTC.");
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "status":
              if (data.status === "connected") { this.serverReady = true; this.maybeConnected(); }
              else if (data.status === "ended") { this.release(); this.patch({ status: "ended", message: data.message || data.reason || "Call ended." }); }
              else if (data.status === "error") this.fail(new Error(data.message || "Call failed."));
              break;
            case "transcript": {
              if (data.speaker === "assistant" && String(data.turn_id) === String(this.playback.turn?.turn_id) && this.playback.transcript(Date.now())) { this.updateInput(); this.reportPlayback("playing"); }
              const caption: Caption = { speaker: data.speaker, text: data.text, final: data.final, turn_id: String(data.turn_id) };
              const captions = [...this.state.captions];
              const index = captions.findIndex((item) => item.turn_id === caption.turn_id && item.speaker === caption.speaker);
              if (index < 0) captions.push(caption); else captions[index] = caption;
              this.patch({ captions: captions.slice(-80) });
              break;
            }
            case "proposal": this.patch({ proposal: { revision: data.revision, context: data.context } }); break;
            case "result": this.patch({ result: data }); break;
            case "usage": this.patch({ usage: data }); break;
            case "turn_state":
              if (typeof data.generation_id !== "string" || !Number.isInteger(data.turn_id) || typeof data.input_allowed !== "boolean") throw new Error("Invalid voice turn state.");
              { const previousTurn = this.playback.turn?.turn_id;
                if (this.playback.begin(data as LiveTurn, Date.now())) {
                  if (this.awaitingReplay && previousTurn !== data.turn_id) { clearTimeout(this.replayDeadline); this.awaitingReplay = false; this.playback.setBlocked(false, Date.now()); }
                  if (this.state.needsPlayback) { this.playback.setBlocked(true, Date.now()); this.reportPlayback("blocked"); }
                  this.updateInput();
                }
              }
              break;
            case "media_stop":
              this.generation++;
              this.abort?.abort();
              this.ready = false;
              clearInterval(this.tick);
              clearTimeout(this.connectDeadline);
              this.stopMedia();
              this.patch({ status: "ending", message: "Audio stopped. Closing the provider session…" });
              clearTimeout(this.drainDeadline);
              this.drainDeadline = setTimeout(() => { this.release(); this.patch({ status: "ended", message: "Audio stopped. Provider usage did not finish in time." }); }, 20000);
              break;
            case "notice":
              this.patch({ notice: typeof data.message === "string" ? data.message : "This turn could not be verified. Please repeat when invited." });
              break;
            case "error": this.fail(new Error(data.message || "The voice service reported an error.")); break;
          }
        } catch (error) { this.fail(error); }
      };
    });
  }

  private async microphone(generation: number) {
    this.diagnostic({ microphone: "permission" });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
    stream.getAudioTracks().forEach((track) => { track.enabled = false; });
    if (!this.current(generation)) { stream.getTracks().forEach((track) => track.stop()); throw new DOMException("Cancelled", "AbortError"); }
    this.stream = stream;
    return stream;
  }

  private async createOffer(generation: number, signal: AbortSignal) {
    const stream = await this.microphone(generation);
    const peer = new RTCPeerConnection();
    this.peer = peer;
    // Register the event channel and every lifecycle handler BEFORE making the offer.
    const channel = peer.createDataChannel("oai-events");
    this.channel = channel;
    channel.onopen = () => { if (!this.current(generation) || this.peer !== peer) return; this.diagnostic({ dataChannel: "open" }); this.maybeConnected(); };
    channel.onclose = () => { if (this.peer !== peer) return; this.diagnostic({ dataChannel: "closed" }); if (this.state.status === "connected") this.fail(new Error("The voice event connection closed.")); };
    channel.onerror = () => { if (this.peer === peer) this.fail(new Error("The voice event connection failed.")); };
    // Provider events are intentionally not used for captions/tool execution.
    channel.onmessage = () => {};
    peer.onconnectionstatechange = () => {
      if (this.peer !== peer) return;
      this.diagnostic({ peer: peer.connectionState });
      this.maybeConnected();
      if (["failed", "disconnected"].includes(peer.connectionState)) this.fail(new Error("The voice media connection was interrupted. Please reconnect."));
    };
    peer.ontrack = (event) => {
      if (!this.current(generation) || this.peer !== peer || !this.audio) return;
      const remote = event.streams[0] || new MediaStream([event.track]);
      this.audio.srcObject = remote;
      this.startRemoteMeter(remote, generation);
      void this.playAudio();
    };
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
    this.startMeter(stream, generation);
    await peer.setLocalDescription(await peer.createOffer());
    await waitForIce(peer, signal);
    if (!this.current(generation)) throw new DOMException("Cancelled", "AbortError");
    return peer.localDescription!.sdp;
  }

  private startMeter(stream: MediaStream, generation: number) {
    const context = this.context!;
    this.source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    this.source.connect(analyser);
    const values = new Float32Array(analyser.fftSize);
    let previous = 0;
    const measure = (now: number) => {
      if (!this.current(generation)) return;
      if (now - previous > 100) {
        analyser.getFloatTimeDomainData(values);
        const level = Math.sqrt(values.reduce((total, value) => total + value * value, 0) / values.length);
        this.patch({ level });
        if (this.state.diagnostics.microphone === "on") {
          if (level > 0.018) { this.userLastSound = Date.now(); if (!this.userActive) this.reportUserActivity(true); }
          else if (this.userActive && Date.now() - this.userLastSound > 500) this.reportUserActivity(false);
        }
        previous = now;
      }
      this.meterFrame = requestAnimationFrame(measure);
    };
    this.meterFrame = requestAnimationFrame(measure);
    this.diagnostic({ sampleRate: context.sampleRate });
  }

  private startRemoteMeter(stream: MediaStream, generation: number) {
    if (this.remoteFrame !== undefined) cancelAnimationFrame(this.remoteFrame);
    this.remoteSource?.disconnect();
    const context = this.context!;
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    this.remoteSource = context.createMediaStreamSource(stream);
    this.remoteSource.connect(analyser);
    // The audio element plays the stream; the analyser must not duplicate it to speakers.
    const values = new Float32Array(analyser.fftSize);
    const measure = () => {
      if (!this.current(generation)) return;
      analyser.getFloatTimeDomainData(values);
      const level = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
      const playable = context.state === "running" && !!this.audio && !this.audio.paused && !this.state.needsPlayback && !this.awaitingReplay;
      const event = this.playback.sample(level, playable, Date.now());
      if (event) {
        // Disable tracks before notifying the server about renewed output activity.
        this.updateInput();
        this.reportPlayback(event);
        if (event === "failed") { this.fail(new Error("No audible response arrived from GPT Live. Please end the call and try again.")); return; }
      }
      this.updateInput();
      this.remoteFrame = requestAnimationFrame(measure);
    };
    this.remoteFrame = requestAnimationFrame(measure);
  }

  async playAudio() {
    if (this.awaitingReplay) return;
    const generation = this.generation;
    const audio = this.audio;
    const context = this.context;
    const wasBlocked = this.state.needsPlayback;
    try {
      await context?.resume();
      if (audio?.srcObject) await audio.play();
      if (!this.current(generation) || audio !== this.audio) return;
      // A live stream cannot rewind lost speech. The server repeats the entire prompt
      // under a fresh turn before the local input gate can open.
      this.awaitingReplay = wasBlocked;
      this.playback.setBlocked(wasBlocked, Date.now());
      this.patch({ needsPlayback: false });
      this.updateInput();
      if (wasBlocked) {
        this.reportPlayback("ready");
        clearTimeout(this.replayDeadline);
        this.replayDeadline = setTimeout(() => { if (this.current(generation) && this.awaitingReplay) this.fail(new Error("The voice prompt could not restart after enabling audio. Please try again.")); }, 25000);
      }
    } catch {
      if (!this.current(generation) || audio !== this.audio) return;
      this.playback.setBlocked(true, Date.now());
      this.patch({ needsPlayback: true });
      this.updateInput();
      this.reportPlayback("blocked");
    }
  }

  async typedTurn(text: string) {
    if (this.config.mode !== "stub" || !this.state.callId || this.state.status !== "connected") return;
    try { await post("/ai/dev/turn", { call_id: this.state.callId, text }, this.abort?.signal, this.base); }
    catch (error) { if (!this.abort?.signal.aborted) this.patch({ message: errorMessage(error) }); }
  }

  async end(reason = "hangup", showEnded = true) {
    const callId = this.state.callId;
    this.send({ type: reason === "decline" ? "decline" : "hangup" });
    this.release();
    if (showEnded) this.patch({ status: "ended", message: reason === "decline" ? "Voice declined. Part 1 chat integration is pending in this harness." : "Call ended." });
    if (callId) {
      try {
        await post(`/ai/calls/${encodeURIComponent(callId)}/end`, { reason }, undefined, this.base);
        // Manual hangup closes the socket immediately; retrieve final server usage.
        const summary = await request<{ usage?: unknown }>(`/ai/calls/${encodeURIComponent(callId)}`, {}, this.base);
        if (this.state.callId === callId && summary.usage) this.patch({ usage: summary.usage });
      }
      catch { if (showEnded) this.patch({ message: "Audio stopped locally. The server could not confirm call closure." }); }
    }
  }
  private fail(error: unknown) {
    const callId = this.state.callId;
    this.release();
    this.patch({ status: "error", message: errorMessage(error) });
    if (callId) void post(`/ai/calls/${encodeURIComponent(callId)}/end`, { reason: "client_error" }, undefined, this.base).catch(() => {});
  }
  private release() {
    this.generation++;
    this.abort?.abort();
    this.ready = false;
    this.serverReady = false;
    this.issuedSocketPath = undefined;
    clearInterval(this.tick);
    clearInterval(this.ping);
    clearTimeout(this.connectDeadline);
    clearTimeout(this.drainDeadline);
    this.stopMedia();
    const socket = this.socket;
    this.socket = undefined;
    if (socket) { socket.onclose = null; socket.onmessage = null; socket.close(); }
    this.patch({ diagnostics: { ...this.state.diagnostics, socket: "closed" } });
  }
  private stopMedia() {
    clearInterval(this.outputDeadline);
    clearTimeout(this.replayDeadline);
    if (this.meterFrame !== undefined) cancelAnimationFrame(this.meterFrame);
    if (this.remoteFrame !== undefined) cancelAnimationFrame(this.remoteFrame);
    this.meterFrame = this.remoteFrame = undefined;
    this.stream?.getTracks().forEach((track) => { track.enabled = false; track.stop(); });
    this.stream = undefined;
    this.source?.disconnect();
    this.source = undefined;
    this.remoteSource?.disconnect();
    this.remoteSource = undefined;
    this.playback = new LivePlaybackGate();
    this.lastPlaybackReport = undefined;
    this.awaitingReplay = false;
    this.userActive = false;
    if (this.audio) { this.audio.onerror = null; this.audio.pause(); this.audio.srcObject = null; }
    this.audio = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
    const peer = this.peer;
    this.peer = undefined;
    this.channel?.close();
    this.channel = undefined;
    if (peer) { peer.ontrack = null; peer.onconnectionstatechange = null; peer.close(); }
    this.patch({ level: 0, needsPlayback: false, diagnostics: { ...this.state.diagnostics, microphone: "off", peer: "closed", dataChannel: "closed" } });
  }
  dispose() { window.removeEventListener("pagehide", this.pagehide); void this.end("unmount", false); this.listeners.clear(); }
}
