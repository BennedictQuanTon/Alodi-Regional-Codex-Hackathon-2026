/** Optional copy of Alodi's voice for a dashboard. It travels through the session API, so it
 * works across networks, and failing here must never affect the call on the phone. */
const RELAY_RATE = 16000;

function encode(input: Float32Array, rate: number) {
  const ratio = rate / RELAY_RATE;
  const output = new Int16Array(Math.floor(input.length / ratio));
  for (let index = 0; index < output.length; index++) {
    const from = Math.floor(index * ratio), to = Math.max(from + 1, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let at = from; at < to; at++) total += input[at];
    output[index] = Math.max(-1, Math.min(1, total / (to - from))) * 32767;
  }
  return output.buffer;
}

/** Runs on the phone. Sends nothing unless a dashboard has its sound on. */
export class CallAudioSender {
  private socket?: WebSocket;
  private nodes: AudioNode[] = [];
  private enabled = false;
  setEnabled(enabled: boolean) { this.enabled = enabled; }
  attach(stream: MediaStream, context: AudioContext, url: string) {
    this.stop();
    try {
      const socket = new WebSocket(url);
      this.socket = socket;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (this.enabled && socket.readyState === WebSocket.OPEN) socket.send(encode(event.inputBuffer.getChannelData(0), context.sampleRate));
      };
      // A processor only runs when connected; the zero gain keeps this path inaudible.
      source.connect(processor); processor.connect(silent); silent.connect(context.destination);
      this.nodes = [source, processor, silent];
    } catch { this.stop(); }
  }
  stop() {
    this.nodes.forEach((node) => { try { node.disconnect(); } catch {} });
    this.nodes = [];
    try { this.socket?.close(); } catch {}
    this.socket = undefined;
  }
}

/** Runs on the dashboard, only while its sound is switched on. */
export class CallAudioSpeaker {
  private context?: AudioContext;
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private next = 0;
  private url?: string;
  /** Call inside the tap that switches sound on, so the browser allows playback. */
  enable(url: string) {
    this.url = url;
    this.context ||= new AudioContext();
    const resumed = this.context.resume();
    this.open();
    return resumed;
  }
  private open() {
    if (!this.url || this.socket) return;
    const socket = new WebSocket(this.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onmessage = (event) => { if (event.data instanceof ArrayBuffer) this.play(event.data); };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (this.url) this.retry = setTimeout(() => this.open(), 1000);
    };
  }
  private play(data: ArrayBuffer) {
    const context = this.context;
    if (!context) return;
    const samples = new Int16Array(data);
    if (!samples.length) return;
    const buffer = context.createBuffer(1, samples.length, RELAY_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) channel[index] = samples[index] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    // Hold a little audio back to absorb network jitter; catch up rather than fall behind.
    if (this.next < context.currentTime || this.next > context.currentTime + 1) this.next = context.currentTime + 0.25;
    source.start(this.next);
    this.next += buffer.duration;
  }
  disable() {
    this.url = undefined;
    clearTimeout(this.retry);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) { socket.onclose = null; socket.onmessage = null; socket.close(); }
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.next = 0;
  }
}
