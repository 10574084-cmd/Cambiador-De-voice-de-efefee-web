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
    this.port.onmessage = (event) => {
      if (event.data && Number.isFinite(event.data.ratio)) {
        this.ratio = Math.max(0.5, Math.min(2, event.data.ratio));
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

      if (Math.abs(this.ratio - 1) < 0.002) {
        output[0][i] = leftIn;
        if (channels > 1) output[1][i] = rightIn;
      } else {
        const direction = 1 - this.ratio;
        this.phase += direction / (this.span * sampleRate);
        this.phase -= Math.floor(this.phase);
        const phaseB = (this.phase + 0.5) % 1;
        const windowA = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
        const windowB = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseB);
        const delayA = (this.minDelay + this.phase * this.span) * sampleRate;
        const delayB = (this.minDelay + phaseB * this.span) * sampleRate;
        const left = this.read(this.buffers[0], delayA) * windowA +
                     this.read(this.buffers[0], delayB) * windowB;
        const right = this.read(this.buffers[1], delayA) * windowA +
                      this.read(this.buffers[1], delayB) * windowB;
        output[0][i] = left;
        if (channels > 1) output[1][i] = right;
      }
      this.writeIndex = (this.writeIndex + 1) % this.size;
    }
    return true;
  }
}
registerProcessor("pitch-shifter", PitchShifterProcessor);
