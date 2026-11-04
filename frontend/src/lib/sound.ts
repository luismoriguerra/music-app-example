/**
 * Pure Web Audio tone generator (Option A): synthesizes musical pitches and
 * chord voicings in the browser using the native Web Audio API. Zero npm
 * dependencies, instant playback, warm acoustic envelope.
 */

const SEMITONES_FROM_C: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Extracts pitch class (0..11, C = 0) from any Western note name.
 * Handles sharps (#), flats (b), and double accidentals (##, bb).
 */
export function noteToPitchClass(name: string): number | null {
  const match = /^([A-G])(#{1,2}|b{1,2})?$/i.exec(name.trim());
  if (!match) return null;
  const [, letterRaw, acc] = match;
  const letter = letterRaw.toUpperCase();
  let pc = SEMITONES_FROM_C[letter];
  if (pc === undefined) return null;
  if (acc) {
    for (const ch of acc) {
      pc += ch === "#" ? 1 : -1;
    }
  }
  return ((pc % 12) + 12) % 12;
}

/**
 * Converts note name + octave to standard MIDI note number (60 = C4, 69 = A4).
 */
export function noteToMidi(name: string, octave = 4): number | null {
  const pc = noteToPitchClass(name);
  if (pc === null) return null;
  return (octave + 1) * 12 + pc;
}

/**
 * Converts MIDI note number to frequency in Hertz (A4 = 440 Hz standard).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts a note name + octave to frequency in Hertz.
 * Returns null when the name is unparseable — callers stay silent rather
 * than sounding a wrong reference pitch.
 */
export function noteToFrequency(name: string, octave = 4): number | null {
  const midi = noteToMidi(name, octave);
  if (midi === null) return null;
  return midiToFrequency(midi);
}

/** Open-string MIDI notes for standard re-entrant GCEA tuning (G4 C4 E4 A4). */
export const UKULELE_OPEN_MIDI = [67, 60, 64, 69] as const;

/**
 * Pure: chord-symbol tones → an ascending MIDI line. Bumps the octave
 * whenever the next pitch class is at or below the previous, so B7 spells
 * B4 D#5 F#5 A5 instead of dipping below the root. Unparseable names are
 * skipped (silence, never a wrong pitch).
 */
export function arpeggioMidis(
  notes: readonly string[],
  baseOctave = 4,
): number[] {
  const midis: number[] = [];
  let octave = baseOctave;
  let prevPc = -1;
  for (const note of notes) {
    const pc = noteToPitchClass(note);
    if (pc === null) continue;
    if (prevPc !== -1 && pc <= prevPc) octave += 1;
    prevPc = pc;
    midis.push((octave + 1) * 12 + pc);
  }
  return midis;
}

export interface UkeDiagramLike {
  frets: readonly number[];
}

/**
 * Pure: ukulele diagram → the MIDI notes the learner actually strums.
 * Frets are ABSOLUTE in this codebase (chord-diagrams.ts voices pitch as
 * OPEN+fret; baseFret only anchors the 5-fret display window), so baseFret
 * is deliberately ignored. −1 (muted) strings are skipped. String order
 * (G C E A) is preserved with the re-entrant high G — no pitch sorting,
 * so a strum ripples across the strings exactly as fretted.
 */
export function diagramToMidis(diagram: UkeDiagramLike): number[] {
  const midis: number[] = [];
  const frets = diagram.frets;
  for (let i = 0; i < frets.length && i < UKULELE_OPEN_MIDI.length; i += 1) {
    const fret = frets[i];
    if (!Number.isFinite(fret) || fret < 0) continue;
    midis.push(UKULELE_OPEN_MIDI[i] + fret);
  }
  return midis;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  if ("AudioContext" in window && typeof window.AudioContext === "function") {
    return window.AudioContext;
  }
  if ("webkitAudioContext" in window) {
    const candidate = Reflect.get(window, "webkitAudioContext");
    if (typeof candidate === "function") {
      return candidate as typeof AudioContext;
    }
  }
  return null;
}

export function getAudioContext(): AudioContext | null {
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) return null;

  try {
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export interface PlayNoteOptions {
  octave?: number;
  duration?: number;
  gain?: number;
}

/**
 * Plays a single pitch with a warm acoustic triangle-wave envelope.
 * Safe to call in SSR or non-browser test environments (graceful no-op).
 * Unparseable names stay silent.
 */
export function playNote(name: string, options: PlayNoteOptions = {}): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const midi = noteToMidi(name, options.octave ?? 4);
  if (midi === null) return;

  const duration = options.duration ?? 1.1;
  const maxGain = options.gain ?? 0.25;

  const freq = midiToFrequency(midi);
  const now = ctx.currentTime;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Triangle wave provides soft, pleasant odd harmonics (tuning-fork / electric piano warmth)
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    // Smooth AD envelope to prevent clicks and pops
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(maxGain, now + 0.03); // Quick, soft attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // Gentle natural decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Browser audio policy or disposal safety
  }
}

export type ChordPlaybackMode = "strum" | "block";

export interface PlayChordOptions {
  /** "strum" (default 25ms natural brush) or "block" (0ms simultaneous strike). */
  mode?: ChordPlaybackMode;
  baseOctave?: number;
  duration?: number;
}

export interface PlayMidiChordOptions {
  /** "strum" (default 25ms natural brush) or "block" (0ms simultaneous strike). */
  mode?: ChordPlaybackMode;
  duration?: number;
}

/**
 * Core chord player: schedules MIDI notes as a natural acoustic strum
 * (default, 25ms micro-stagger in the given order) or a simultaneous block
 * chord (0ms, all voices at the exact same instant). Gain is normalized by
 * voice count so stacked oscillators never clip.
 */
export function playMidiChord(
  midis: readonly number[],
  options: PlayMidiChordOptions = {},
): void {
  const ctx = getAudioContext();
  if (!ctx || midis.length === 0) return;

  const mode = options.mode ?? "strum";
  const duration = options.duration ?? 1.4;
  const stepSeconds = mode === "strum" ? 0.025 : 0.0;

  // Scale gain per voice to prevent digital clipping when 3-4 oscillators sum
  const perVoiceGain = 0.28 / Math.sqrt(Math.max(1, midis.length));

  midis.forEach((midi, index) => {
    if (!Number.isFinite(midi)) return;
    const delay = index * stepSeconds;
    const now = ctx.currentTime + delay;
    const freq = midiToFrequency(midi);

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(perVoiceGain, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio safety
    }
  });
}

/**
 * Plays note-name tones through the shared MIDI player, spelling them as an
 * ascending line from baseOctave (see arpeggioMidis).
 */
export function playChord(
  notes: string[],
  options: PlayChordOptions = {},
): void {
  playMidiChord(arpeggioMidis(notes, options.baseOctave ?? 4), {
    mode: options.mode,
    duration: options.duration,
  });
}
