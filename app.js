"use strict";

const byId = (id) => document.getElementById(id);
const ui = {
  status: byId("status"), meterBar: byId("meterBar"), meterValue: byId("meterValue"),
  sourceHint: byId("sourceHint"), micButton: byId("micButton"),
  startButton: byId("startButton"), stopButton: byId("stopButton"),
  audioFile: byId("audioFile"), audioPlayer: byId("audioPlayer"), videoFile: byId("videoFile"), videoPlayer: byId("videoPlayer"), videoFilter: byId("videoFilter"), videoIntensity: byId("videoIntensity"), videoHue: byId("videoHue"),
  presets: Array.from(document.querySelectorAll(".preset")),
  pitch: byId("pitch"), echo: byId("echo"), reverb: byId("reverb"),
  distortion: byId("distortion"), lowCut: byId("lowCut"), highCut: byId("highCut"), toneAmount: byId("toneAmount"), modSpeed: byId("modSpeed"), modDepth: byId("modDepth"), delayTime: byId("delayTime"), outputVolume: byId("outputVolume"), pitchValue: byId("pitchValue"),
  echoValue: byId("echoValue"), reverbValue: byId("reverbValue"),
  distortionValue: byId("distortionValue"), lowCutValue: byId("lowCutValue"), highCutValue: byId("highCutValue"), toneAmountValue: byId("toneAmountValue"), modSpeedValue: byId("modSpeedValue"), modDepthValue: byId("modDepthValue"), delayTimeValue: byId("delayTimeValue"), outputVolumeValue: byId("outputVolumeValue"), resetButton: byId("resetButton"),
  recordButton: byId("recordButton"), downloadButton: byId("downloadButton"),
  recordTime: byId("recordTime"), toast: byId("toast"), engineLabel: byId("engineLabel"),
  noiseReduction: byId("noiseReduction"), softGate: byId("softGate"), autoLevel: byId("autoLevel"),
  liveMonitor: byId("liveMonitor"), inputLevel: byId("inputLevel"),
  inputLevelValue: byId("inputLevelValue"), monitorVolume: byId("monitorVolume"),
  monitorVolumeValue: byId("monitorVolumeValue"), noiseThreshold: byId("noiseThreshold"),
  noiseThresholdValue: byId("noiseThresholdValue"),
megabass: {"pitch":-1,"echo":0,"reverb":4,"distortion":12,"filterType":"lowshelf","filterFrequency":140,"filterGain":12},
whisper: {"pitch":2,"echo":8,"reverb":20,"distortion":0,"highpass":250,"lowpass":9000,"filterGain":-4},
underwater_radio: {"pitch":-2,"echo":28,"reverb":35,"distortion":8,"highpass":100,"lowpass":1300,"robotHz":7,"robotDepth":0.08},
cartoon: {"pitch":7,"echo":4,"reverb":8,"distortion":4,"highpass":130,"lowpass":12000},
telephone_clean: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"highpass":350,"lowpass":3400,"filterType":"peaking","filterFrequency":1700,"filterGain":3},
distorted_radio: {"pitch":-1,"echo":12,"reverb":8,"distortion":58,"highpass":400,"lowpass":4200},
dream_voice: {"pitch":2,"echo":38,"reverb":72,"distortion":0,"highpass":100,"lowpass":14000,"filterGain":4},
echo_chamber: {"pitch":0,"echo":90,"reverb":55,"distortion":0,"delayTime":0.62},
dark_robot: {"pitch":-6,"echo":15,"reverb":20,"distortion":50,"robotHz":14,"robotDepth":0.3,"lowpass":4200},
hollow_voice: {"pitch":-2,"echo":18,"reverb":45,"distortion":4,"highpass":180,"lowpass":5000,"filterGain":8},
tiny_robot: {"pitch":9,"echo":5,"reverb":10,"distortion":34,"robotHz":28,"robotDepth":0.22},
giant_echo: {"pitch":-10,"echo":72,"reverb":65,"distortion":8,"lowpass":5000},
underwater_abyss: {"pitch":-5,"echo":32,"reverb":40,"distortion":0,"highpass":50,"lowpass":550},
bright_room: {"pitch":0,"echo":15,"reverb":25,"distortion":0,"highpass":120,"lowpass":15000,"filterGain":5},
lofi_radio: {"pitch":0,"echo":5,"reverb":8,"distortion":35,"highpass":250,"lowpass":5000}
};

let audioContext = null;
let inputBus = null;
let inputGain = null;
let inputCompressor = null;
let pitchNode = null;
let highpass = null;
let lowpass = null;
let toneFilter = null;
let shaper = null;
let tremoloGain = null;
let delayNode = null;
let delayFeedback = null;
let delayWet = null;
let convolver = null;
let reverbWet = null;
let masterGain = null;
let limiter = null;
let monitorGain = null;
let robotLfo = null;
let robotDepth = null;
let recordDestination = null;
let analyser = null;
let micStream = null;
let micSource = null;
let mediaSource = null;
let videoSource = null;
let currentInput = null;
let mediaRecorder = null;
let recordedChunks = [];
let lastRecording = null;
let recordingStartedAt = 0;
let recordingTimer = null;
let meterFrame = 0;
let objectUrl = null;
let currentPreset = "normal";
let toastTimer = null;

const presets = {
  normal: { pitch: 0, echo: 0, reverb: 0, distortion: 0 },
  robot:  { pitch: -1, echo: 8, reverb: 0, distortion: 76, robot: true },
  radio:  { pitch: 0, echo: 0, reverb: 5, distortion: 20, radio: true },
  echo:   { pitch: 0, echo: 76, reverb: 10, distortion: 0 },
  cave:   { pitch: 0, echo: 34, reverb: 84, distortion: 0 },
  helium: { pitch: 8, echo: 0, reverb: 4, distortion: 0 },
  deep:   { pitch: -7, echo: 4, reverb: 7, distortion: 0, deep: true },
  alien:      { pitch: 5, echo: 24, reverb: 28, distortion: 14, robotHz: 6, robotDepth: 0.12, lowpass: 9000 },
  chipmunk:   { pitch: 12, echo: 0, reverb: 3, distortion: 0, highpass: 100, lowpass: 12000 },
  monster:    { pitch: -10, echo: 8, reverb: 22, distortion: 18, deep: true, highpass: 65, lowpass: 5200 },
  telephone:  { pitch: 0, echo: 0, reverb: 0, distortion: 8, highpass: 420, lowpass: 3200, filterType: "peaking", filterFrequency: 1600, filterGain: 5 },
  underwater: { pitch: -2, echo: 14, reverb: 22, distortion: 0, highpass: 70, lowpass: 780, filterType: "peaking", filterFrequency: 420, filterGain: -5 },
  ghost:      { pitch: -5, echo: 45, reverb: 66, distortion: 0, highpass: 60, lowpass: 8200 },
  megaphone:  { pitch: 0, echo: 0, reverb: 0, distortion: 28, highpass: 500, lowpass: 4300, filterType: "peaking", filterFrequency: 1300, filterGain: 6 },
  chorus:     { pitch: 0, echo: 22, reverb: 42, distortion: 0, delayTime: 0.045, highpass: 70, lowpass: 11000 },
  cyborg:     { pitch: 2, echo: 15, reverb: 8, distortion: 48, robotHz: 34, robotDepth: 0.16, highpass: 140, lowpass: 6500 },
  radio_old: {"pitch":0,"echo":5,"reverb":0,"distortion":8,"highpass":300,"lowpass":3600},
  radio_fm: {"pitch":0,"echo":0,"reverb":0,"distortion":5,"highpass":180,"lowpass":8500},
  walkie_talkie: {"pitch":-1,"echo":8,"reverb":0,"distortion":24,"highpass":450,"lowpass":3000},
  underwater_deep: {"pitch":-3,"echo":20,"reverb":30,"distortion":0,"lowpass":650},
  underwater_bubbles: {"pitch":-1,"echo":42,"reverb":25,"distortion":0,"lowpass":1200},
  space: {"pitch":2,"echo":55,"reverb":72,"distortion":0,"lowpass":12000},
  outer_space: {"pitch":-2,"echo":65,"reverb":60,"distortion":0,"lowpass":7000},
  demon: {"pitch":-12,"echo":15,"reverb":35,"distortion":25,"deep":true,"lowpass":4200},
  giant: {"pitch":-12,"echo":5,"reverb":18,"distortion":8,"deep":true,"lowpass":5000},
  tiny: {"pitch":10,"echo":0,"reverb":10,"distortion":0,"highpass":150},
  child: {"pitch":7,"echo":0,"reverb":8,"distortion":0},
  old_person: {"pitch":-4,"echo":10,"reverb":20,"distortion":0,"deep":true},
  opera: {"pitch":1,"echo":10,"reverb":85,"distortion":0,"lowpass":11000},
  stadium: {"pitch":0,"echo":60,"reverb":55,"distortion":0},
  bathroom: {"pitch":0,"echo":10,"reverb":30,"distortion":0},
  tunnel: {"pitch":0,"echo":72,"reverb":35,"distortion":0},
  cathedral: {"pitch":0,"echo":30,"reverb":95,"distortion":0},
  hall: {"pitch":0,"echo":35,"reverb":65,"distortion":0},
  phone_old: {"pitch":0,"echo":0,"reverb":0,"distortion":12,"highpass":500,"lowpass":2800},
  phone_bad: {"pitch":0,"echo":5,"reverb":0,"distortion":55,"highpass":600,"lowpass":2600},
  vocoder: {"pitch":0,"echo":5,"reverb":5,"distortion":32,"robotHz":18,"robotDepth":0.12},
  robot_slow: {"pitch":-2,"echo":5,"reverb":0,"distortion":45,"robotHz":3,"robotDepth":0.2},
  robot_fast: {"pitch":1,"echo":5,"reverb":0,"distortion":45,"robotHz":48,"robotDepth":0.15},
  droid: {"pitch":0,"echo":10,"reverb":5,"distortion":38,"robotHz":24,"robotDepth":0.18},
  computer: {"pitch":0,"echo":0,"reverb":0,"distortion":28,"robotHz":32,"robotDepth":0.1},
  glitch: {"pitch":0,"echo":5,"reverb":5,"distortion":65,"robotHz":12,"robotDepth":0.22},
  alien_low: {"pitch":-5,"echo":30,"reverb":35,"distortion":20,"robotHz":7,"robotDepth":0.14},
  alien_high: {"pitch":8,"echo":25,"reverb":25,"distortion":12,"robotHz":9,"robotDepth":0.12},
  space_radio: {"pitch":0,"echo":35,"reverb":45,"distortion":20,"highpass":350,"lowpass":5000},
  horror: {"pitch":-7,"echo":48,"reverb":55,"distortion":28,"deep":true,"lowpass":4500},
  zombie: {"pitch":-8,"echo":12,"reverb":20,"distortion":25,"deep":true,"lowpass":3000},
  vampire: {"pitch":-6,"echo":18,"reverb":30,"distortion":10,"deep":true},
  fairy: {"pitch":5,"echo":15,"reverb":45,"distortion":0,"highpass":250},
  elf: {"pitch":3,"echo":12,"reverb":35,"distortion":0},
  squirrel: {"pitch":11,"echo":0,"reverb":5,"distortion":0},
  mouse: {"pitch":9,"echo":0,"reverb":0,"distortion":0},
  giant_monster: {"pitch":-11,"echo":15,"reverb":40,"distortion":20,"deep":true},
  distant: {"pitch":0,"echo":80,"reverb":25,"distortion":0,"lowpass":7000},
  near: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"highpass":100,"lowpass":15000},
  canyon: {"pitch":0,"echo":65,"reverb":30,"distortion":0},
  mountain: {"pitch":0,"echo":25,"reverb":60,"distortion":0},
  wind: {"pitch":0,"echo":10,"reverb":15,"distortion":0,"highpass":220,"lowpass":9000},
  underwater_muffled: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"highpass":80,"lowpass":900},
  muffled: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"highpass":100,"lowpass":1800},
  bright: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"highpass":100,"lowpass":14000,"filterType":"highshelf","filterFrequency":3500,"filterGain":5},
  dark: {"pitch":0,"echo":0,"reverb":0,"distortion":0,"filterType":"lowshelf","filterFrequency":180,"filterGain":8},
  bass_boost: {"pitch":-1,"echo":0,"reverb":0,"distortion":0,"filterType":"highshelf","filterFrequency":4000,"filterGain":7},
  treble: {"pitch":0,"echo":0,"reverb":0,"distortion":35},
  distorted: {"pitch":0,"echo":0,"reverb":0,"distortion":72},
  overdrive: {"pitch":0,"echo":0,"reverb":12,"distortion":18,"lowpass":9000},
  lofi: {"pitch":0,"echo":5,"reverb":15,"distortion":12,"lowpass":8000},
  vinyl: {"pitch":0,"echo":0,"reverb":0,"distortion":18,"highpass":120,"lowpass":6000},
  megaphone_far: {"pitch":0,"echo":0,"reverb":0,"distortion":35,"highpass":100,"lowpass":7000},
  announcer: {"pitch":0,"echo":5,"reverb":0,"distortion":28,"highpass":500,"lowpass":4000},
  news: {"pitch":0,"echo":0,"reverb":0,"distortion":10,"highpass":250,"lowpass":5000},
  broadcast: {"pitch":0,"echo":0,"reverb":0,"distortion":15,"highpass":300,"lowpass":4500},
  double: {"pitch":0,"echo":5,"reverb":0,"distortion":12,"highpass":250,"lowpass":5500},
  triple_echo: {"pitch":0,"echo":20,"reverb":0,"distortion":0,"delayTime":0.12},
  slapback: {"pitch":0,"echo":62,"reverb":8,"distortion":0,"delayTime":0.42},
  dream: {"pitch":0,"echo":28,"reverb":0,"distortion":0,"delayTime":0.09},
  dreamy: {"pitch":0,"echo":12,"reverb":72,"distortion":0},
  haunted: {"pitch":1,"echo":35,"reverb":75,"distortion":0},
  underworld: {"pitch":-5,"echo":55,"reverb":85,"distortion":8,"deep":true},
  hollow: {"pitch":-9,"echo":60,"reverb":70,"distortion":20,"deep":true},
  metallic: {"pitch":0,"echo":20,"reverb":50,"distortion":0,"lowpass":4500},
  synthetic: {"pitch":0,"echo":5,"reverb":5,"distortion":45,"robotHz":40,"robotDepth":0.12},
  laser: {"pitch":0,"echo":0,"reverb":0,"distortion":18,"robotHz":55,"robotDepth":0.18},
  telephone_booth: {"pitch":0,"echo":0,"reverb":0,"distortion":14,"highpass":500,"lowpass":2800},
  small_room: {"pitch":0,"echo":5,"reverb":18,"distortion":0},
  concert: undefined
};

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3200);
}

function setStatus(active, label) {
  ui.status.textContent = label || (active ? "ACTIVO" : "INACTIVO");
  ui.status.classList.toggle("active", Boolean(active));
  ui.recordButton.disabled = !active || !window.MediaRecorder;
  ui.startButton.disabled = Boolean(active) && currentInput === "mic";
  ui.stopButton.disabled = !active;
}

function makeDistortionCurve(amount) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const k = Math.max(0, amount) * 2.2;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = k === 0 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) /
      (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeImpulse(context, seconds, decay) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const fade = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * fade;
    }
  }
  return impulse;
}

async function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") await audioContext.resume();
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Este navegador no admite Web Audio.");
  audioContext = new AudioContextClass();

  inputGain = audioContext.createGain();
  inputGain.gain.value = Number(ui.inputLevel.value) / 100;
  inputCompressor = audioContext.createDynamicsCompressor();
  inputCompressor.threshold.value = -22;
  inputCompressor.knee.value = 12;
  inputCompressor.ratio.value = 3;
  inputCompressor.attack.value = 0.006;
  inputCompressor.release.value = 0.16;
  inputBus = audioContext.createGain();
  inputGain.connect(inputCompressor);
  inputCompressor.connect(inputBus);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  inputBus.connect(analyser);

  try {
    await audioContext.audioWorklet.addModule("pitch-shifter.js?v=1.4.0");
    pitchNode = new AudioWorkletNode(audioContext, "pitch-shifter", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    ui.engineLabel.textContent = "Motor Web Audio · tono activo";
  } catch (error) {
    pitchNode = audioContext.createGain();
    ui.engineLabel.textContent = "Motor Web Audio · tono limitado";
    showToast("El cambio de tono avanzado no está disponible en este navegador.");
  }

  highpass = audioContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 35;

  toneFilter = audioContext.createBiquadFilter();
  toneFilter.type = "lowshelf";
  toneFilter.frequency.value = 180;
  toneFilter.gain.value = 0;
  toneFilter.Q.value = 0.8;

  lowpass = audioContext.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 18000;
  lowpass.Q.value = 0.7;

  shaper = audioContext.createWaveShaper();
  shaper.oversample = "4x";
  shaper.curve = makeDistortionCurve(0);

  tremoloGain = audioContext.createGain();
  tremoloGain.gain.value = 1;

  delayNode = audioContext.createDelay(1.5);
  delayNode.delayTime.value = 0.28;
  delayFeedback = audioContext.createGain();
  delayFeedback.gain.value = 0;
  delayWet = audioContext.createGain();
  delayWet.gain.value = 0;

  convolver = audioContext.createConvolver();
  convolver.buffer = makeImpulse(audioContext, 2.4, 2.5);
  reverbWet = audioContext.createGain();
  reverbWet.gain.value = 0;

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.78;
  limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -7;
  limiter.knee.value = 3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  monitorGain = audioContext.createGain();
  monitorGain.gain.value = 0;
  recordDestination = audioContext.createMediaStreamDestination();
  robotLfo = audioContext.createOscillator();
  robotLfo.type = "sine";
  robotLfo.frequency.value = 26;
  robotDepth = audioContext.createGain();
  robotDepth.gain.value = 0;
  robotLfo.connect(robotDepth);
  robotDepth.connect(tremoloGain.gain);
  robotLfo.start();

  inputBus.connect(pitchNode);
  pitchNode.connect(highpass);
  highpass.connect(toneFilter);
  toneFilter.connect(lowpass);
  lowpass.connect(shaper);
  shaper.connect(tremoloGain);

  tremoloGain.connect(masterGain);
  tremoloGain.connect(delayNode);
  delayNode.connect(delayWet);
  delayWet.connect(masterGain);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);

  tremoloGain.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(masterGain);

  masterGain.connect(limiter);
  limiter.connect(recordDestination);
  limiter.connect(monitorGain);
  monitorGain.connect(audioContext.destination);

  startMeter();
  applyPreset(currentPreset);
}

function startMeter() {
  cancelAnimationFrame(meterFrame);
  const values = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(values);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      const sample = (values[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / values.length);
    const percent = Math.min(100, Math.round(rms * 240));
    ui.meterBar.style.width = percent + "%";
    ui.meterValue.textContent = percent + "%";
    meterFrame = requestAnimationFrame(tick);
  };
  tick();
}

function updateSliderLabels() {
  const pitch = Number(ui.pitch.value);
  ui.pitchValue.textContent = (pitch > 0 ? "+" : "") + pitch + " semitonos";
  ui.echoValue.textContent = ui.echo.value + "%";
  ui.reverbValue.textContent = ui.reverb.value + "%";
  ui.distortionValue.textContent = ui.distortion.value + "%";
  ui.lowCutValue.textContent = ui.lowCut.value + " Hz";
  ui.highCutValue.textContent = Number(ui.highCut.value) >= 18000 ? "Máximo" : ui.highCut.value + " Hz";
  ui.toneAmountValue.textContent = ui.toneAmount.value + " dB";
  ui.modSpeedValue.textContent = ui.modSpeed.value + " Hz";
  ui.modDepthValue.textContent = ui.modDepth.value + "%";
  ui.delayTimeValue.textContent = ui.delayTime.value + " ms";
  ui.outputVolumeValue.textContent = ui.outputVolume.value + "%";
}

function updateEffects() {
  updateSliderLabels();
ui.inputLevelValue.textContent = ui.inputLevel.value + "%";
ui.monitorVolumeValue.textContent = ui.monitorVolume.value + "%";
  if (!audioContext) return;
  const pitch = Number(ui.pitch.value);
  if (pitchNode && pitchNode.port) {
    pitchNode.port.postMessage({ ratio: Math.pow(2, pitch / 12) });
  }
  if (pitchNode && pitchNode.port) pitchNode.port.postMessage({
    noiseGate: ui.softGate.checked,
    noiseThreshold: 0.0015 + (Number(ui.noiseThreshold.value) / 100) * 0.014
  });
  delayWet.gain.setTargetAtTime(Number(ui.echo.value) / 100 * 0.55, audioContext.currentTime, 0.025);
  delayFeedback.gain.setTargetAtTime(Number(ui.echo.value) / 100 * 0.34, audioContext.currentTime, 0.025);
  reverbWet.gain.setTargetAtTime(Number(ui.reverb.value) / 100 * 0.72, audioContext.currentTime, 0.025);
  shaper.curve = makeDistortionCurve(Number(ui.distortion.value) / 100);
  highpass.frequency.setTargetAtTime(Number(ui.lowCut.value), audioContext.currentTime, 0.03);
  lowpass.frequency.setTargetAtTime(Number(ui.highCut.value), audioContext.currentTime, 0.03);
  toneFilter.gain.setTargetAtTime(Number(ui.toneAmount.value), audioContext.currentTime, 0.03);
  robotLfo.frequency.setTargetAtTime(Number(ui.modSpeed.value), audioContext.currentTime, 0.03);
  robotDepth.gain.setTargetAtTime(Number(ui.modDepth.value) / 100 * 0.45, audioContext.currentTime, 0.03);
  delayNode.delayTime.setTargetAtTime(Number(ui.delayTime.value) / 1000, audioContext.currentTime, 0.03);
  masterGain.gain.setTargetAtTime(Number(ui.outputVolume.value) / 100, audioContext.currentTime, 0.03);
  applyLevelSettings();
  applyMonitorSettings();
}

function selectPresetButton(name) {
  ui.presets.forEach((button) => {
    button.classList.toggle("selected", button.dataset.preset === name);
  });
}

function applyPreset(name) {
  const config = presets[name] || presets.normal;
  currentPreset = name;
  ui.pitch.value = String(config.pitch);
  ui.echo.value = String(config.echo);
  ui.reverb.value = String(config.reverb);
  ui.distortion.value = String(config.distortion);
  ui.lowCut.value = String(config.highpass ?? 80);
  ui.highCut.value = String(config.lowpass ?? 18000);
  ui.toneAmount.value = String(config.filterGain ?? (config.deep ? 6 : config.radio ? -13 : 0));
  ui.modSpeed.value = String(config.robotHz ?? 26);
  ui.modDepth.value = String(Math.round((config.robotDepth ?? 0) / 0.45 * 100));
  ui.delayTime.value = String(Math.round((config.delayTime ?? 0.28) * 1000));
  selectPresetButton(name);

  if (audioContext) {
    highpass.frequency.setTargetAtTime(config.highpass || (config.radio ? 430 : 80), audioContext.currentTime, 0.04);
    lowpass.frequency.setTargetAtTime(config.lowpass || 18000, audioContext.currentTime, 0.04);
    toneFilter.type = config.filterType || (config.radio ? "highshelf" : "lowshelf");
    toneFilter.frequency.setTargetAtTime(config.filterFrequency || (config.radio ? 2600 : 180), audioContext.currentTime, 0.04);
    toneFilter.gain.setTargetAtTime(config.filterGain !== undefined ? config.filterGain :
      (config.radio ? -13 : (config.deep ? 6 : 0)), audioContext.currentTime, 0.04);
    toneFilter.Q.setTargetAtTime(config.filterType === "peaking" ? 1.1 : 0.8, audioContext.currentTime, 0.04);
    delayNode.delayTime.setTargetAtTime(config.delayTime || 0.28, audioContext.currentTime, 0.04);
    robotLfo.frequency.setTargetAtTime(config.robotHz || 26, audioContext.currentTime, 0.04);
    robotDepth.gain.setTargetAtTime(config.robotDepth || 0, audioContext.currentTime, 0.04);
  }
  updateEffects();
}

function markCustom() {
  currentPreset = "custom";
  ui.presets.forEach((button) => button.classList.remove("selected"));
  updateEffects();
}

async function switchToMic() {
  await ensureAudio();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("El micrófono requiere una página HTTPS o localhost y un navegador compatible.");
  }
  stopCurrentInput();
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: ui.noiseReduction.checked, autoGainControl: false, channelCount: 1 },
    video: false
  });
  micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(inputGain);
  currentInput = "mic";
  applyMonitorSettings();
  setStatus(true, "MICRÓFONO ACTIVO");
  ui.sourceHint.textContent = "Micrófono activo. Usa audífonos para evitar acoples.";
  ui.micButton.classList.add("active");
  ui.startButton.disabled = true;
  ui.stopButton.disabled = false;
}

function stopCurrentInput() {
  if (micSource) {
    try { micSource.disconnect(); } catch (_) {}
    micSource = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (mediaSource) {
    try { mediaSource.disconnect(); } catch (_) {}
  }
  if (ui.audioPlayer) ui.audioPlayer.pause();
  if (ui.videoPlayer) ui.videoPlayer.pause();
  if (videoSource) { try { videoSource.disconnect(); } catch (_) {} }
  if (mediaRecorder && mediaRecorder.state === "recording") stopRecording();
  currentInput = null;
  applyMonitorSettings();
  setStatus(false, "INACTIVO");
  ui.micButton.classList.remove("active");
  ui.meterBar.style.width = "0%";
  ui.meterValue.textContent = "0%";
}

async function loadAudioFile(file) {
  if (!file || !file.type.startsWith("audio/")) {
    showToast("Selecciona un archivo de audio válido.");
    return;
  }
  await ensureAudio();
  stopCurrentInput();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  ui.audioPlayer.src = objectUrl;
  ui.audioPlayer.hidden = false;
  if (!mediaSource) mediaSource = audioContext.createMediaElementSource(ui.audioPlayer);
  mediaSource.connect(inputGain);
  currentInput = "file";
  applyMonitorSettings();
  setStatus(true, "ARCHIVO LISTO");
  ui.sourceHint.textContent = "Archivo cargado. Pulsa reproducir en el control de audio.";
  ui.micButton.classList.remove("active");
  ui.startButton.disabled = false;
  ui.stopButton.disabled = false;
  showToast("Audio listo para aplicar efectos.");
}

async function loadVideoFile(file) {
  if (!file || !(file.type.startsWith("video/") || /\\.(mp4|webm|mov|m4v)$/i.test(file.name))) {
    showToast("Selecciona un video MP4, WebM o MOV.");
    return;
  }
  await ensureAudio();
  stopCurrentInput();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  ui.videoPlayer.src = objectUrl;
  ui.videoPlayer.hidden = false;
  ui.audioPlayer.hidden = true;
  if (!videoSource) videoSource = audioContext.createMediaElementSource(ui.videoPlayer);
  videoSource.connect(inputGain);
  currentInput = "video";
  applyMonitorSettings();
  setStatus(true, "VIDEO LISTO");
  ui.sourceHint.textContent = "Video cargado. Reprodúcelo: el audio y los efectos se procesan en vivo.";
  ui.startButton.disabled = false;
  ui.stopButton.disabled = false;
  showToast("Video listo con efectos de audio y video.");
}

function applyLevelSettings() {
  if (!audioContext) return;
  inputGain.gain.setTargetAtTime(Number(ui.inputLevel.value) / 100, audioContext.currentTime, 0.04);
  inputCompressor.threshold.setTargetAtTime(ui.autoLevel.checked ? -22 : -8, audioContext.currentTime, 0.05);
  inputCompressor.ratio.setTargetAtTime(ui.autoLevel.checked ? 3 : 1.5, audioContext.currentTime, 0.05);
  ui.inputLevelValue.textContent = ui.inputLevel.value + "%";
  if (ui.autoLevel.checked) {
    limiter.threshold.setTargetAtTime(-7, audioContext.currentTime, 0.05);
    limiter.ratio.setTargetAtTime(12, audioContext.currentTime, 0.05);
  } else {
    limiter.threshold.setTargetAtTime(-3, audioContext.currentTime, 0.05);
    limiter.ratio.setTargetAtTime(4, audioContext.currentTime, 0.05);
  }
}

function applyMonitorSettings() {
  const isFile = currentInput === "file" || currentInput === "video";
  const enabled = isFile || ui.liveMonitor.checked;
  const volume = isFile ? 0.8 : Number(ui.monitorVolume.value) / 100;
  ui.monitorVolume.disabled = !enabled;
  ui.monitorVolumeValue.textContent = ui.monitorVolume.value + "%";
  ui.noiseThresholdValue.textContent = ui.noiseThreshold.value + "%";
  if (monitorGain && audioContext) {
    monitorGain.gain.setTargetAtTime(enabled ? Math.min(isFile ? 0.8 : 0.12, volume) : 0, audioContext.currentTime, 0.04);
  }
  if (enabled && !isFile) ui.sourceHint.textContent = "Monitoreo de micrófono activo a volumen bajo. Usa audífonos; los parlantes pueden producir pitido.";
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

function updateRecordingTime() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  ui.recordTime.textContent = formatTime((Date.now() - recordingStartedAt) / 1000);
}

function startRecording() {
  if (!recordDestination || !window.MediaRecorder) {
    showToast("La grabación no está disponible en este navegador.");
    return;
  }
  try {
    recordedChunks = [];
    lastRecording = null;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "";
    mediaRecorder = mimeType
      ? new MediaRecorder(recordDestination.stream, { mimeType })
      : new MediaRecorder(recordDestination.stream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const type = mediaRecorder.mimeType || "audio/webm";
      lastRecording = new Blob(recordedChunks, { type });
      ui.downloadButton.disabled = lastRecording.size === 0;
      showToast("¡Grabación lista! Ya puedes descargarla.");
    };
    mediaRecorder.start(250);
    recordingStartedAt = Date.now();
    ui.recordButton.textContent = "■ Detener grabación";
    ui.recordButton.classList.add("recording");
    ui.recordTime.textContent = "00:00";
    recordingTimer = setInterval(updateRecordingTime, 500);
  } catch (error) {
    showToast("No se pudo iniciar la grabación: " + error.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  clearInterval(recordingTimer);
  ui.recordButton.innerHTML = '<span class="record-dot"></span> Iniciar grabación';
  ui.recordButton.classList.remove("recording");
}

function downloadRecording() {
  if (!lastRecording) return;
  const url = URL.createObjectURL(lastRecording);
  const link = document.createElement("a");
  link.href = url;
  link.download = "voice-lab-recording.webm";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

ui.startButton.addEventListener("click", async () => {
  try {
    if (currentInput === "file" || currentInput === "video") {
      await ui.audioPlayer.play();
      return;
    }
    await switchToMic();
    showToast("¡Micrófono activado!");
  } catch (error) {
    const message = error.name === "NotAllowedError"
      ? "Permiso de micrófono denegado. Revisa los permisos del sitio."
      : error.message || "No se pudo activar el micrófono.";
    ui.sourceHint.textContent = message;
    showToast(message);
  }
});

ui.micButton.addEventListener("click", async () => {
  try {
    await switchToMic();
    showToast("Micrófono activo.");
  } catch (error) {
    showToast(error.message || "No se pudo activar el micrófono.");
  }
});

ui.stopButton.addEventListener("click", () => {
  stopCurrentInput();
  ui.sourceHint.textContent = "Entrada detenida.";
  if (ui.audioPlayer) ui.audioPlayer.hidden = true;
  ui.audioFile.value = "";
});

ui.videoFile.addEventListener("change", async (event) => {\n  try { await loadVideoFile(event.target.files && event.target.files[0]); }\n  catch (error) { showToast(error.message || "No se pudo cargar el video."); }\n});\n\n[ui.videoFilter, ui.videoIntensity, ui.videoHue].forEach((control) => control.addEventListener("input", applyVideoFilter));\nfunction applyVideoFilter() {\n  if (!ui.videoPlayer) return;\n  const amount = Number(ui.videoIntensity.value) / 100;\n  const filters = { none:"", cinematic:"contrast(1.25) saturate(1.25)", vintage:"sepia(.8) contrast(1.15)", mono:"grayscale(1)", invert:"invert(1)", dream:"blur(1.2px) saturate(1.5) brightness(1.12)", night:"hue-rotate(190deg) saturate(1.5) brightness(.75)", sketch:"grayscale(1) contrast(2.2)", warm:"sepia(.35) saturate(1.5)", cool:"hue-rotate(165deg) saturate(1.25)" };\n  const base = filters[ui.videoFilter.value] || "";\n  ui.videoPlayer.style.filter = base + " hue-rotate(" + (Number(ui.videoHue.value) - 50) * 3.6 + "deg)";\n  ui.videoPlayer.style.opacity = String(.45 + amount * .55);\n}\n\nui.audioFile.addEventListener("change", async (event) => {
  try {
    await loadAudioFile(event.target.files && event.target.files[0]);
  } catch (error) {
    showToast(error.message || "No se pudo cargar ese audio.");
  }
});

ui.presets.forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

[ui.pitch, ui.echo, ui.reverb, ui.distortion, ui.lowCut, ui.highCut, ui.toneAmount, ui.modSpeed, ui.modDepth, ui.delayTime, ui.outputVolume].forEach((slider) => {
  slider.addEventListener("input", markCustom);
});

ui.noiseReduction.addEventListener("change", async () => {
  if (currentInput === "mic") {
    try { await switchToMic(); }
    catch (error) { showToast("No se pudo reiniciar el micrófono: " + error.message); }
  }
  showToast(ui.noiseReduction.checked ? "Supresión del navegador activada." : "Supresión del navegador desactivada.");
});
ui.softGate.addEventListener("change", () => {
  if (pitchNode && pitchNode.port) pitchNode.port.postMessage({ noiseGate: ui.softGate.checked });
  showToast(ui.softGate.checked ? "Puerta de ruido suave activada." : "Puerta de ruido desactivada para conservar la voz.");
});
ui.autoLevel.addEventListener("change", applyLevelSettings);
ui.inputLevel.addEventListener("input", applyLevelSettings);
ui.noiseThreshold.addEventListener("input", () => {
  ui.noiseThresholdValue.textContent = ui.noiseThreshold.value + "%";
  if (pitchNode && pitchNode.port) pitchNode.port.postMessage({
    noiseThreshold: 0.0015 + (Number(ui.noiseThreshold.value) / 100) * 0.014
  });
});
ui.liveMonitor.addEventListener("change", applyMonitorSettings);
ui.monitorVolume.addEventListener("input", applyMonitorSettings);
ui.resetButton.addEventListener("click", () => { ui.outputVolume.value = "78"; applyPreset("normal"); updateEffects(); });
ui.recordButton.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") stopRecording();
  else startRecording();
});
ui.downloadButton.addEventListener("click", downloadRecording);

ui.audioPlayer.addEventListener("play", () => {
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
  ui.sourceHint.textContent = "Procesando el archivo con los efectos seleccionados.";
});
ui.audioPlayer.addEventListener("ended", () => {
  ui.sourceHint.textContent = "Reproducción terminada. Puedes volver a escuchar o grabar otra toma.";
});

window.addEventListener("beforeunload", () => {
  stopCurrentInput();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (audioContext) audioContext.close();
});

updateSliderLabels();

const settingsShortcut = document.getElementById("settingsShortcut");
const settingsPanel = document.getElementById("settingsPanel");
const saveShortcut = document.getElementById("saveShortcut");
if (settingsShortcut && settingsPanel) {
  settingsShortcut.addEventListener("click", () => {
    settingsPanel.classList.toggle("open");
    if (settingsPanel.classList.contains("open")) settingsPanel.scrollIntoView({behavior:"smooth",block:"start"});
  });
}
if (saveShortcut) {
  saveShortcut.addEventListener("click", () => {
    const panel = document.querySelector(".record-panel");
    if (panel) panel.scrollIntoView({behavior:"smooth",block:"center"});
  });
}
