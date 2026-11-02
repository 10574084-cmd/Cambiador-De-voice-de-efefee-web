class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 16384;
    this.buffers = [new Float32Array(this.size), new Float32Array(this.size)];
    this.writeIndex = 0;
    this.ratio = 1;
    this.minDelay = 0.025;
    this.maxDelay = 0.115;
    this.span = this.maxDelay - this.minDelay;
    this.phase = 0;
    this.noiseGate = true;
    this.noiseThreshold = 0.003;
    this.envelope = 0;
    this.gateGain = 1;
    this.attack = Math.exp(-1 / (sampleRate * 0.008));
    this.release = Math.exp(-1 / (sampleRate * 0.32));
    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (Number.isFinite(data.ratio)) {
        this.ratio = Math.max(0.5, Math.min(2, data.ratio));
      }
      if (typeof data.noiseGate === "boolean") {
        this.noiseGate = data.noiseGate;
      }
      if (Number.isFinite(data.noiseThreshold)) {
        this.noiseThreshold = Math.max(0.0005, Math.min(0.03, data.noiseThreshold));
      }
    };
  }

  read(buffer, delaySamples) {
    let position = this.writeIndex - delaySamples;
    while (position < 0) position += this.size;
    const indexA = Math.floor(position) % this.size;
    const indexB = (indexA + 1) % this.size;
    const fraction = position - Math.floor(position);
    return buffer[indexA] * (1 - fraction) + buffer[indexB] * fraction;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channels = output.length;
    const frames = output[0].length;
    const inputChannels = input || [];

    for (let i = 0; i < frames; i++) {
      const leftIn = inputChannels[0] ? inputChannels[0][i] : 0;
      const rightIn = inputChannels[1] ? inputChannels[1][i] : leftIn;
      this.buffers[0][this.writeIndex] = leftIn;
      this.buffers[1][this.writeIndex] = rightIn;

      const level = Math.max(Math.abs(leftIn), Math.abs(rightIn));
      const smoothing = level > this.envelope ? this.attack : this.release;
      this.envelope = smoothing * this.envelope + (1 - smoothing) * level;
      const gateTarget = !this.noiseGate || this.envelope >= this.noiseThreshold ? 1 : 0.62;
      const gateSmoothing = gateTarget > this.gateGain ? this.attack : this.release;
      this.gateGain = gateSmoothing * this.gateGain + (1 - gateSmoothing) * gateTarget;

      let leftOut;
      let rightOut;
      if (Math.abs(this.ratio - 1) < 0.002) {
        leftOut = leftIn;
        rightOut = rightIn;
      } else {
        const direction = 1 - this.ratio;
        this.phase += direction / (this.span * sampleRate);
        this.phase -= Math.floor(this.phase);
        const phaseB = (this.phase + 0.5) % 1;
        const windowA = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
        const windowB = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseB);
        const delayA = (this.minDelay + this.phase * this.span) * sampleRate;
        const delayB = (this.minDelay + phaseB * this.span) * sampleRate;
        leftOut = this.read(this.buffers[0], delayA) * windowA +
                  this.read(this.buffers[0], delayB) * windowB;
        rightOut = this.read(this.buffers[1], delayA) * windowA +
                   this.read(this.buffers[1], delayB) * windowB;
      }

      const finalGain = this.noiseGate ? this.gateGain : 1;
      output[0][i] = leftOut * finalGain;
      if (channels > 1) output[1][i] = rightOut * finalGain;
      this.writeIndex = (this.writeIndex + 1) % this.size;
    }
    return true;
  }
}
registerProcessor("pitch-shifter", PitchShifterProcessor);
