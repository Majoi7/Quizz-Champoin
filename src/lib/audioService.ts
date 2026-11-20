import type { ScoreEvent, ScoreReason } from '../types/quiz';

export type SoundCue = 'NONE' | 'CORRECT_APPLAUSE' | 'BONUS_APPLAUSE' | 'LEADER_FANFARE' | 'BUZZER' | 'UNDO';

const STORAGE_KEY = 'qcl_sound_enabled';

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let soundEnabledState = readInitialSoundPreference();
const playedEventIds = new Set<string>();

function readInitialSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 1.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

export function classifyScoreSoundCue(
  delta: number,
  reason: ScoreReason,
  isNewLeader = false
): SoundCue {
  if (reason === 'UNDO') return 'UNDO';
  if (reason === 'RESET' || delta === 0) return 'NONE';
  if (delta < 0) return 'BUZZER';
  if (isNewLeader) return 'LEADER_FANFARE';
  if (reason === 'BONUS') return 'BONUS_APPLAUSE';
  return 'CORRECT_APPLAUSE';
}

export function isSoundEnabled(): boolean {
  return soundEnabledState;
}

export function setSoundEnabledPref(enabled: boolean): void {
  soundEnabledState = enabled;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore storage failure
    }
  }
  if (enabled) {
    unlockAudio();
  }
}

export function unlockAudio(): void {
  getAudioContext();
}

export function playCorrectChime(isBonus = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = isBonus ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = now + idx * 0.06;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

export function playApplause(intensity = 0.7): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const buffer = getNoiseBuffer(ctx);
  const clamped = Math.max(0.3, Math.min(1, intensity));

  // Layered crowd noise + rapid handclap modulation
  const bursts = Math.round(6 + clamped * 4);
  for (let i = 0; i < bursts; i += 1) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100 + (i % 3) * 420, now);
    filter.Q.setValueAtTime(0.9, now);

    const gain = ctx.createGain();
    const offset = i * 0.075;
    const peak = (0.055 + (i % 2) * 0.02) * clamped;
    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.exponentialRampToValueAtTime(peak, now + offset + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.42);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(now + offset, (i * 0.11) % 0.4, 0.45);
  }
}

export function playBuzzer(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Classic twin-oscillator TV game-show buzzer
  const freqs = [150, 158];
  freqs.forEach((f) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f - 28, now + 0.34);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.setValueAtTime(0.1, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  });
}

export function playLeaderFanfare(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chord = [587.33, 739.99, 880, 1174.66];
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = now + idx * 0.075;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.52);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

export function playUndoTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

export function playCue(cue: SoundCue): void {
  switch (cue) {
    case 'CORRECT_APPLAUSE':
      playCorrectChime(false);
      playApplause(0.6);
      break;
    case 'BONUS_APPLAUSE':
      playCorrectChime(true);
      playApplause(0.9);
      break;
    case 'LEADER_FANFARE':
      playLeaderFanfare();
      playApplause(1.0);
      break;
    case 'BUZZER':
      playBuzzer();
      break;
    case 'UNDO':
      playUndoTone();
      break;
    case 'NONE':
      break;
  }
}

export function triggerScoreSound(
  event: Pick<ScoreEvent, 'id' | 'delta' | 'reason'>,
  isNewLeader = false
): SoundCue {
  if (playedEventIds.has(event.id)) {
    return 'NONE';
  }
  playedEventIds.add(event.id);
  if (playedEventIds.size > 40) {
    const first = playedEventIds.values().next().value;
    if (first) playedEventIds.delete(first);
  }

  if (!soundEnabledState) {
    return 'NONE';
  }

  const cue = classifyScoreSoundCue(event.delta, event.reason, isNewLeader);
  playCue(cue);
  return cue;
}

export const audioService = {
  unlock: unlockAudio,
  isEnabled: isSoundEnabled,
  setEnabled: setSoundEnabledPref,
  playBuzzer,
  playApplause,
  playCorrectChime,
  playLeaderFanfare,
  playUndoTone,
  playCue,
  triggerScoreSound,
};
