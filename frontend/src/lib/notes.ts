/**
 * Zero-import leaf module: canonical note spellings + pitch lookups.
 * Both content schemas and the chord filter import from here.
 */

export const NOTE_ROOTS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "Bb",
  "Db",
  "Eb",
  "Gb",
  "Ab",
] as const;

export const NOTE_ALIASES = ["A#", "C#", "D#", "F#", "G#"] as const;

export type NoteRoot = (typeof NOTE_ROOTS)[number];
export type NoteAlias = (typeof NOTE_ALIASES)[number];
export type NoteSpelling = NoteRoot | NoteAlias;

/** Pitch class 0–11 (C = 0) for every accepted spelling. */
export const ROOT_PITCH: Readonly<Record<NoteSpelling, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/** Pitch class for every spelling the scales gate validates.

ROOT_PITCH covers the 17 filter/root spellings; Cb (pitch 11 = B) appears in
the normative spelling table (Gb major 4th, Eb minor 6th) without being a
canonical root or alias, so it lives here rather than in the enums. */
export const SPELLING_PITCH: Readonly<Record<string, number>> = {
  ...ROOT_PITCH,
  Cb: 11,
};

/** Flat root → its sharp enharmonic partner. */
export const ENHARMONIC_PAIR: Readonly<Partial<Record<NoteRoot, NoteAlias>>> = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
};

/** Sharp alias → its flat enharmonic root (inverse of ENHARMONIC_PAIR). */
export const ENHARMONIC_ROOT: Readonly<Record<NoteAlias, NoteRoot>> = {
  "A#": "Bb",
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
};

export const NATURAL_NOTES = ["A", "B", "C", "D", "E", "F", "G"] as const;
export const FLAT_NOTES = ["Bb", "Db", "Eb", "Gb", "Ab"] as const;
export const SHARP_NOTES = NOTE_ALIASES;

export const CHORD_COUNT = 36;
export const SCALE_COUNT_V1 = 24;
