/**
 * Cancellable Play-all sequencer for the 1st-voice trainer (008, FR-005).
 * Thin orchestration over `sound.ts`: every note is scheduled upfront
 * against `AudioContext.currentTime` at `stepSeconds = 60 / bpm`, immune to
 * background-tab timer throttling. SSR/test safe: without audio the handle
 * is a no-op with an already-resolved `finished`.
 */
import { getAudioContext, midiToFrequency } from "./sound";

export interface StartSequenceOptions {
  bpm: number;
  noteDurationScale?: number;
}

export interface SequenceHandle {
  stop: () => void;
  finished: Promise<void>;
}

const DEFAULT_BPM = 84;
const MIN_BPM = 40;
const MAX_BPM = 240;
const NOTE_DURATION_SECONDS = 1.1;
/** Notes ring at most this many steps so fast runs (melismas) stay distinct. */
const MAX_NOTE_STEPS = 2;
const NOTE_GAIN = 0.25;
const ATTACK_SECONDS = 0.03;

/** Detects Web Audio support without instantiating a context. */
export function trainerAudioAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const candidates = window as unknown as Record<string, unknown>;
  return (
    typeof candidates.AudioContext === "function" ||
    typeof candidates.webkitAudioContext === "function"
  );
}

function sanitizeBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  startAt: number;
}

export function startSequence(
  midis: readonly number[],
  opts: StartSequenceOptions,
): SequenceHandle {
  return startStepSequence(
    midis.map((midi) => [midi]),
    opts,
  );
}

/**
 * Cancellable upfront scheduler for beats that may carry several pitches
 * (013 2nd-voice steps: both voices sound on the same beat). Every pitch of
 * beat `i` starts at `t0 + i * stepSeconds`; an empty beat stays silent but
 * keeps its place in time.
 */
export function startStepSequence(
  steps: readonly (readonly number[])[],
  opts: StartSequenceOptions,
): SequenceHandle {
  const snapshot = steps.map((beat) => [...beat]);
  let resolveFinished: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const ctx = getAudioContext();
  if (!ctx || snapshot.length === 0) {
    resolveFinished();
    return { stop: () => {}, finished };
  }
  // Non-nullable alias: narrowing of `ctx` does not persist into the
  // `stop()` closure below, so bind it once for both scopes.
  const audioCtx: AudioContext = ctx;

  const bpm = sanitizeBpm(opts.bpm);
  const stepSeconds = 60 / bpm;
  const duration = Math.min(
    NOTE_DURATION_SECONDS * (opts.noteDurationScale ?? 1),
    MAX_NOTE_STEPS * stepSeconds,
  );
  const voices: Voice[] = [];
  const t0 = ctx.currentTime;
  try {
    snapshot.forEach((beat, index) => {
      const startAt = t0 + index * stepSeconds;
      beat.forEach((midi) => {
        if (!Number.isFinite(midi)) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(midiToFrequency(midi), startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(
          NOTE_GAIN,
          startAt + ATTACK_SECONDS,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration);
        voices.push({ osc, gain, startAt });
      });
    });
  } catch {
    // Scheduling is best-effort; the stop handle below stays safe.
  }

  let settled = false;
  const timer = setTimeout(
    () => {
      settled = true;
      resolveFinished();
    },
    snapshot.length * stepSeconds * 1000,
  );

  function stop(): void {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const now = audioCtx.currentTime;
    for (const voice of voices) {
      // Already-ringing notes decay naturally; only future notes cancel.
      if (voice.startAt <= now) continue;
      try {
        voice.osc.stop();
      } catch {
        // Already stopped or never started: the disconnect below silences it.
      }
      try {
        voice.gain.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    resolveFinished();
  }

  return { stop, finished };
}

/**
 * Pure highlight index for a run: which note sounds at the current clock.
 * Returns -1 for an empty run; clamps past-the-end to the last index.
 */
export function sequenceProgress(
  total: number,
  startedAtMs: number,
  stepMs: number,
): number {
  if (total <= 0) return -1;
  if (!(stepMs > 0)) return 0;
  const elapsed = Date.now() - startedAtMs;
  if (elapsed <= 0) return 0;
  return Math.min(total - 1, Math.floor(elapsed / stepMs));
}
