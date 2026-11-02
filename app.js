"use strict";

const byId = (id) => document.getElementById(id);
const ui = {
  status: byId("status"), meterBar: byId("meterBar"), meterValue: byId("meterValue"),
  sourceHint: byId("sourceHint"), micButton: byId("micButton"),
  startButton: byId("startButton"), stopButton: byId("stopButton"),
  audioFile: byId("audioFile"), audioPlayer: byId("audioPlayer"),
  presets: Array.from(document.querySelectorAll(".preset")),
  pitch: byId("pitch"), echo: byId("echo"), reverb: byId("reverb"),
  distortion: byId("distortion"), pitchValue: byId("pitchValue"),
  echoValue: byId("echoValue"), reverbValue: byId("reverbValue"),
  distortionValue: byId("distortionValue"), resetButton: byId("resetButton"),
  recordButton: byId("recordButton"), downloadButton: byId("downloadButton"),
  recordTime: byId("recordTime"), toast: byId("toast"), engineLabel: byId("engineLabel")
};

let audioContext = null;
let inputBus = null;
let pitchNode = null;
let highpass = null;
let toneFilter = null;
let shaper = null;
let tremoloGain = null;
let delayNode = null;
let delayFeedback = null;
let delayWet = null;
let convolver = null;
let reverbWet = null;
let masterGain = null;
let recordDestination = null;
let analyser = null;
let micStream = null;
let micSource = null;
let mediaSource = null;
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
  alien:  { pitch: 5, echo: 24, reverb: 28, distortion: 14 }
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

  inputBus = audioContext.createGain();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  inputBus.connect(analyser);

  try {
    await audioContext.audioWorklet.addModule("pitch-shifter.js");
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
  masterGain.gain.value = 0.92;
  recordDestination = audioContext.createMediaStreamDestination();

  inputBus.connect(pitchNode);
  pitchNode.connect(highpass);
  highpass.connect(toneFilter);
  toneFilter.connect(shaper);
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

  masterGain.connect(audioContext.destination);
  masterGain.connect(recordDestination);

  startMeter();
  applyPreset("normal");
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
}

function updateEffects() {
  updateSliderLabels();
  if (!audioContext) return;
  const pitch = Number(ui.pitch.value);
  if (pitchNode && pitchNode.port) {
    pitchNode.port.postMessage({ ratio: Math.pow(2, pitch / 12) });
  }
  delayWet.gain.setTargetAtTime(Number(ui.echo.value) / 100 * 0.72, audioContext.currentTime, 0.025);
  delayFeedback.gain.setTargetAtTime(Number(ui.echo.value) / 100 * 0.48, audioContext.currentTime, 0.025);
  reverbWet.gain.setTargetAtTime(Number(ui.reverb.value) / 100 * 0.72, audioContext.currentTime, 0.025);
  shaper.curve = makeDistortionCurve(Number(ui.distortion.value) / 100);
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
  selectPresetButton(name);

  if (audioContext) {
    highpass.frequency.setTargetAtTime(config.radio ? 430 : 35, audioContext.currentTime, 0.04);
    toneFilter.type = config.radio ? "highshelf" : "lowshelf";
    toneFilter.frequency.setTargetAtTime(config.radio ? 2600 : 180, audioContext.currentTime, 0.04);
    toneFilter.gain.setTargetAtTime(config.radio ? -13 : (config.deep ? 9 : 0), audioContext.currentTime, 0.04);
    tremoloGain.gain.setTargetAtTime(config.robot ? 0.9 : 1, audioContext.currentTime, 0.04);
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
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false
  });
  micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(inputBus);
  currentInput = "mic";
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
  currentInput = null;
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
  mediaSource.connect(inputBus);
  currentInput = "file";
  setStatus(true, "ARCHIVO LISTO");
  ui.sourceHint.textContent = "Archivo cargado. Pulsa reproducir en el control de audio.";
  ui.micButton.classList.remove("active");
  ui.startButton.disabled = false;
  ui.stopButton.disabled = false;
  showToast("Audio listo para aplicar efectos.");
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
    if (currentInput === "file") {
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

ui.audioFile.addEventListener("change", async (event) => {
  try {
    await loadAudioFile(event.target.files && event.target.files[0]);
  } catch (error) {
    showToast(error.message || "No se pudo cargar ese audio.");
  }
});

ui.presets.forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

[ui.pitch, ui.echo, ui.reverb, ui.distortion].forEach((slider) => {
  slider.addEventListener("input", markCustom);
});

ui.resetButton.addEventListener("click", () => applyPreset("normal"));
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
