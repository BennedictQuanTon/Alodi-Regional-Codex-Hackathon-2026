/* Native AudioWorklet: device-rate mono -> 16 kHz, PCM16 LE, exactly 20 ms/frame.
 * Fractional area integration preserves time across 128-sample render quanta.
 * Uses the worklet's actual sampleRate; getUserMedia constraints are advisory.
 */
class AlodiPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.remaining = this.ratio;
    this.integral = 0;
    this.frame = new ArrayBuffer(640);
    this.view = new DataView(this.frame);
    this.index = 0;
    this.energy = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] / channels.length;
      let width = 1;
      while (width > 1e-9) {
        const take = Math.min(width, this.remaining);
        this.integral += value * take;
        this.remaining -= take;
        width -= take;
        if (this.remaining < 1e-9) {
          const out = Math.max(-1, Math.min(1, this.integral / this.ratio));
          this.view.setInt16(this.index * 2, Math.round(out * (out < 0 ? 32768 : 32767)), true);
          this.energy += out * out;
          this.index++;
          this.remaining = this.ratio;
          this.integral = 0;
          if (this.index === 320) {
            this.port.postMessage({ pcm: this.frame, level: Math.sqrt(this.energy / 320) }, [this.frame]);
            this.frame = new ArrayBuffer(640);
            this.view = new DataView(this.frame);
            this.index = 0;
            this.energy = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("alodi-pcm", AlodiPcmProcessor);
