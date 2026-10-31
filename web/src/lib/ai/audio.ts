/** Scheduled PCM output with actual completion acknowledgements and interrupt fencing. */
export class PcmPlayback {
  private nodes = new Set<AudioBufferSourceNode>();
  private utterance?: { id: string; rate: number; generation: number; ended: boolean; pending: number };
  private next = 0;
  private generation = 0;
  constructor(private context: AudioContext, private finished: (id: string) => void) {}

  start(id: string, rate: number) {
    if (rate < 8000 || rate > 96000) throw new Error("Unsupported playback sample rate.");
    // An explicit clear cancels; a normal next utterance may follow queued audio.
    this.utterance = { id, rate, generation: this.generation, ended: false, pending: 0 };
  }
  push(pcm: ArrayBuffer) {
    const utterance = this.utterance;
    if (!utterance || pcm.byteLength % 2) throw new Error("Unexpected call audio frame.");
    const now = this.context.currentTime;
    if (this.next - now > 12) throw new Error("Call audio is arriving too quickly. Please reconnect.");
    const count = pcm.byteLength / 2;
    if (!count) return;
    const buffer = this.context.createBuffer(1, count, utterance.rate);
    const values = buffer.getChannelData(0);
    const view = new DataView(pcm);
    for (let i = 0; i < count; i++) values[i] = view.getInt16(i * 2, true) / 32768;
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.connect(this.context.destination);
    this.nodes.add(node);
    utterance.pending++;
    node.onended = () => {
      this.nodes.delete(node);
      node.disconnect();
      utterance.pending--;
      if (utterance.generation === this.generation && utterance.ended && utterance.pending === 0) this.finished(utterance.id);
    };
    const at = Math.max(now + 0.015, this.next);
    this.next = at + buffer.duration;
    node.start(at);
  }
  end(id: string) {
    const utterance = this.utterance;
    if (!utterance || utterance.id !== id) return;
    utterance.ended = true;
    if (!utterance.pending && utterance.generation === this.generation) this.finished(id);
    this.utterance = undefined;
  }
  clear() {
    this.generation++;
    this.utterance = undefined;
    this.next = 0;
    for (const node of this.nodes) {
      node.onended = null;
      node.stop();
      node.disconnect();
    }
    this.nodes.clear();
  }
}

export async function waitForIce(pc: RTCPeerConnection, signal: AbortSignal) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", changed);
      signal.removeEventListener("abort", aborted);
    };
    const changed = () => { if (pc.iceGatheringState === "complete") { cleanup(); resolve(); } };
    const aborted = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Voice connection timed out while preparing the network.")); }, 8000);
    pc.addEventListener("icegatheringstatechange", changed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
