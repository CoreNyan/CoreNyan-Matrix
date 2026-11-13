import {createFrameBudget,visualActive,observeVisualActivity} from './render-budget.js';
import {RENDER_BUDGET} from './constants.js';
'use strict';
import { WAVE, TELEMETRY, VIEW, WAVE_HEALTH } from './constants.js';

// Seeded 1D gradient Perlin noise with quintic interpolation. Deterministic
// sampling makes animation continuous and visual regression reproducible.
export function perlin(x, seed = WAVE.seed) {
  const lattice = Math.floor(x);
  const fraction = x - lattice;
  const gradient = n => {
    let hash = Math.imul(n ^ seed, 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    return ((hash ^ (hash >>> 16)) & 1) ? 1 : -1;
  };
  const fade = fraction ** 3 * (fraction * (fraction * 6 - 15) + 10);
  const a = gradient(lattice) * fraction;
  const b = gradient(lattice + 1) * (fraction - 1);
  return a + fade * (b - a);
}

export function waveProfile(payload = {}) {
  const host = payload.host || {}, life = payload.vitals || {};
  const clamp = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback / 100;
  const pressure = clamp(host.cpuPercent, 0) * WAVE_HEALTH.pressureWeights.cpu
    + clamp(host.memPercent, 0) * WAVE_HEALTH.pressureWeights.memory
    + clamp(host.diskPercent, 0) * WAVE_HEALTH.pressureWeights.disk;
  const energy = clamp(life.energy, TELEMETRY.energy), agitation = 1 - clamp(life.mood, TELEMETRY.mood);
  const rate = WAVE_HEALTH.modeRate[life.mode] || 1;
  return {
    bpm: Math.max(WAVE.bpmMin, Math.min(WAVE.bpmMax, ((life.bpm || TELEMETRY.bpm) + pressure * WAVE_HEALTH.pressureBpm + agitation * WAVE_HEALTH.moodBpm) * rate)),
    amplitude: WAVE_HEALTH.amplitudeBase + energy * WAVE_HEALTH.energyAmplitude,
    intervalVariation: WAVE_HEALTH.intervalBase + pressure * WAVE_HEALTH.pressureVariation + agitation * WAVE_HEALTH.moodVariation,
    respirationHz: (WAVE_HEALTH.respirationBase + pressure * WAVE_HEALTH.pressureRespiration + energy * WAVE_HEALTH.energyRespiration) * rate,
    noise: WAVE.noiseAmplitude * (1 + pressure + agitation), activity: pressure * 100
  };
}

// A bounded acquisition buffer: existing samples are never recalculated.
// This is a simulated P-QRS-T signal, not a medical sensor measurement.
export class SignalHistory {
  constructor(seed = WAVE.seed, initial = waveProfile()) {
    this.profile = { ...initial };
    this.respirationPhase = 0;
    this.randomState = seed || WAVE.seed;
    this.capacity = WAVE.sampleRate * WAVE.historySeconds;
    this.channels = { ecg: new Float64Array(this.capacity), respiration: new Float64Array(this.capacity) };
    this.count = 0;
    this.remainder = 0;
    this.phase = 0;
    this.nextBeat();
    this.append(this.capacity, initial);
  }

  random() {
    let x = this.randomState;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.randomState = x >>> 0;
    return this.randomState / 4294967296;
  }

  nextBeat() {
    const variation = amount => 1 + (this.random() * 2 - 1) * amount;
    this.beatInterval = variation(this.profile.intervalVariation);
    this.beatAmplitude = variation(WAVE.amplitudeVariation);
    this.beatWidth = variation(WAVE.widthVariation);
    this.beatShape = WAVE.pulseShape.map(() => variation(WAVE.shapeVariation));
  }

  append(count, input = {}) {
    let { bpm = TELEMETRY.bpm, activity = 0 } = input;
    bpm = Number.isFinite(bpm) ? Math.max(WAVE.bpmMin, Math.min(WAVE.bpmMax, bpm)) : TELEMETRY.bpm;
    activity = Number.isFinite(activity) ? Math.max(0, Math.min(100, activity)) : 0;
    const target = { ...waveProfile(), ...input, bpm, activity };
    const smoothing = 1 - Math.exp(-1 / (WAVE.sampleRate * WAVE_HEALTH.smoothingSeconds));
    for (let n = 0; n < count; n++) {
      for (const key of Object.keys(this.profile)) {
        if (Number.isFinite(target[key])) this.profile[key] += (target[key] - this.profile[key]) * smoothing;
      }
      const time = this.count / WAVE.sampleRate;
      this.phase += this.profile.bpm / (60 * WAVE.sampleRate * this.beatInterval);
      if (this.phase >= 1) { this.phase %= 1; this.nextBeat(); }
      const pulse = WAVE.pulseShape.reduce((sum, p, i) => sum + p.amplitude * this.beatShape[i] * Math.exp(-0.5 * ((this.phase - p.center) / (p.width * this.beatWidth)) ** 2), 0);
      const slot = this.count % this.capacity;
      this.channels.ecg[slot] = pulse * WAVE.ecgAmplitude * this.beatAmplitude * this.profile.amplitude
        + perlin(time * 8) * this.profile.noise + perlin(time * 0.6) * WAVE.baselineDrift;
      this.respirationPhase += Math.PI * 2 * this.profile.respirationHz / WAVE.sampleRate;
      this.channels.respiration[slot] = Math.sin(this.respirationPhase) * WAVE.respirationAmplitude
        + perlin(time * 0.7) * 3;
      this.count++;
    }
  }

  advance(seconds, input) {
    this.remainder += Math.max(0, seconds) * WAVE.sampleRate;
    const count = Math.floor(this.remainder);
    this.remainder -= count;
    this.append(count, input);
  }

  get(index, channel) {
    if (index < Math.max(0, this.count - this.capacity) || index >= this.count) return undefined;
    return this.channels[channel][index % this.capacity];
  }
}

export function mountWaveform(canvas, registry) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const seed = registry.state.motionEnabled ? crypto.getRandomValues(new Uint32Array(1))[0] : WAVE.seed;
  let history = null;
  let width = 0, height = 0, last = 0, frame = 0, dirty = true;
  const budget=createFrameBudget(RENDER_BUDGET.waveFps);
  const visible = () => visualActive() && registry.state.activeView === VIEW.VITALS;
  const draw = time => {
    frame = 0;
    if (!visible()) { last = 0; return; }
    if (dirty) {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, WAVE.maxDpr);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = false;
    }
    if (!history && registry.state.lastVitalsPayload) history = new SignalHistory(seed, waveProfile(registry.state.lastVitalsPayload));
    if (history && registry.state.motionEnabled && last) {
      history.advance(Math.min(time - last, WAVE.maxDeltaMs) / 1000, waveProfile(registry.state.lastVitalsPayload));
    }
    last = registry.state.motionEnabled ? time : 0;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = WAVE.gridColor; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < width; x += WAVE.gridStep) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += WAVE.gridStep) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    if (!history) return;
    const head = width - WAVE.headInset;
    const step = WAVE.pixelsPerSecond / WAVE.sampleRate;
    const first = Math.max(history.count - history.capacity, history.count - 1 - Math.ceil(head / step));
    for (const trace of WAVE.traces) {
      ctx.beginPath(); ctx.strokeStyle = trace.color; ctx.lineWidth = trace.width;
      for (let i = first; i < history.count; i++) {
        const x = head - (history.count - 1 - i) * step;
        const y = height * trace.baseline - history.get(i, trace.channel);
        if (i === first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = trace.color;
      ctx.arc(head, height * trace.baseline - history.get(history.count - 1, trace.channel), trace.width * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (registry.state.motionEnabled) frame = budget.request(draw);
  };
  const wake = () => {
    if (!visible()) { budget.cancel(frame); frame = 0; last = 0; return; }
    if (!frame) frame = budget.request(draw);
  };
  const observer = new ResizeObserver(() => { dirty = true; wake(); });
  observer.observe(canvas.parentElement);
  const unsubscribe = registry.subscribe(['motionEnabled', 'activeView', 'lastVitalsPayload'], wake);
  const offActivity=observeVisualActivity(wake);
  return () => { budget.cancel(frame); observer.disconnect(); unsubscribe(); offActivity(); };
}
