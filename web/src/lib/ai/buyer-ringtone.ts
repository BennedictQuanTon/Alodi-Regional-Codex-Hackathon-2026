/** Local audible cue only. Enabling is an explicit user gesture; no microphone. */
export class BuyerRingtone {
  private context?: AudioContext;
  private interval?: ReturnType<typeof setInterval>;
  private expiry?: ReturnType<typeof setTimeout>;
  private nodes = new Map<OscillatorNode, GainNode>();
  private desired?: { id: string; generation: string; deadline?: number };
  private ringing?: string;
  private suppressed = new Set<string>();
  enabled = false;
  private epoch = 0;
  constructor(private createContext = () => new AudioContext(), private now = () => Date.now()) {}
  async enable() {
    this.context ||= this.createContext();
    const context = this.context, epoch = this.epoch;
    await context.resume();
    if (epoch !== this.epoch || this.context !== context) throw new Error("Ring sound setup was cancelled.");
    if (context.state !== "running") throw new Error("Allow sound in this browser, then enable ring sound again.");
    this.enabled = true; this.sync();
  }
  update(id?: string, generation = "", deadline?: number) {
    if (this.desired?.generation !== generation) { this.stop(); this.suppressed.clear(); }
    this.desired = id ? { id, generation, deadline } : undefined;
    this.sync();
  }
  private sync() {
    const call = this.desired;
    const key = call && `${call.generation}:${call.id}`;
    if (!this.enabled || !call || !key || this.suppressed.has(key) || (call.deadline && call.deadline <= this.now())) { this.stop(); return; }
    if (this.ringing === key) return;
    this.stop(); this.ringing = key;
    this.beep(); this.interval = setInterval(() => this.beep(), 2000);
    this.expiry = setTimeout(() => this.stop(true), Math.max(0, (call.deadline || this.now() + 30000) - this.now()));
  }
  private beep() {
    const context = this.context;
    if (!context || context.state !== "running") return;
    // Small phone speakers are weak below about 800 Hz, so ring an octave above the classic tone.
    for (const frequency of [880, 960]) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.45, context.currentTime);
      gain.gain.setValueAtTime(0.45, context.currentTime + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.85);
      oscillator.connect(gain); gain.connect(context.destination);
      this.nodes.set(oscillator, gain);
      oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(); oscillator.stop(context.currentTime + 0.85);
    }
  }
  stop(suppress = false) {
    if (suppress && this.desired) this.suppressed.add(`${this.desired.generation}:${this.desired.id}`);
    clearInterval(this.interval); clearTimeout(this.expiry); this.ringing = undefined;
    for (const [node, gain] of this.nodes) { node.onended = null; try { node.stop(); } catch {} node.disconnect(); gain.disconnect(); }
    this.nodes.clear();
  }
  dispose() { this.epoch++; this.stop(); this.enabled = false; this.desired = undefined; void this.context?.close().catch(() => {}); this.context = undefined; }
}
