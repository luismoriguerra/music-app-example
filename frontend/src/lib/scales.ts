import {
  FLAT_NOTES,
  NATURAL_NOTES,
  SHARP_NOTES,
  SPELLING_PITCH,
} from "./notes";
import type { Scale } from "./content/schemas";

export type { Scale };

export const MAJOR_INTERVALS = "W-W-H-W-W-W-H";
export const MINOR_INTERVALS = "W-H-W-W-H-W-W";

export interface SpellingRow {
  displaySpelling: string;
  notes: readonly string[];
}

/**
 * Normative conventional spelling table (spec Appendix, validated in
 * research R2). Key: `${rootPitch}/${type}`. Combined entries whose flat
 * root would be theoretical (Db/Gb/Ab minor) spell from the sharp tonic.
 */
export const SPELLING_TABLE: Readonly<Record<string, SpellingRow>> = {
  "0/major": {
    displaySpelling: "C",
    notes: ["C", "D", "E", "F", "G", "A", "B", "C"],
  },
  "1/major": {
    displaySpelling: "Db",
    notes: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C", "Db"],
  },
  "2/major": {
    displaySpelling: "D",
    notes: ["D", "E", "F#", "G", "A", "B", "C#", "D"],
  },
  "3/major": {
    displaySpelling: "Eb",
    notes: ["Eb", "F", "G", "Ab", "Bb", "C", "D", "Eb"],
  },
  "4/major": {
    displaySpelling: "E",
    notes: ["E", "F#", "G#", "A", "B", "C#", "D#", "E"],
  },
  "5/major": {
    displaySpelling: "F",
    notes: ["F", "G", "A", "Bb", "C", "D", "E", "F"],
  },
  "6/major": {
    displaySpelling: "Gb",
    notes: ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F", "Gb"],
  },
  "7/major": {
    displaySpelling: "G",
    notes: ["G", "A", "B", "C", "D", "E", "F#", "G"],
  },
  "8/major": {
    displaySpelling: "Ab",
    notes: ["Ab", "Bb", "C", "Db", "Eb", "F", "G", "Ab"],
  },
  "9/major": {
    displaySpelling: "A",
    notes: ["A", "B", "C#", "D", "E", "F#", "G#", "A"],
  },
  "10/major": {
    displaySpelling: "Bb",
    notes: ["Bb", "C", "D", "Eb", "F", "G", "A", "Bb"],
  },
  "11/major": {
    displaySpelling: "B",
    notes: ["B", "C#", "D#", "E", "F#", "G#", "A#", "B"],
  },
  "0/minor": {
    displaySpelling: "C",
    notes: ["C", "D", "Eb", "F", "G", "Ab", "Bb", "C"],
  },
  "1/minor": {
    displaySpelling: "C#",
    notes: ["C#", "D#", "E", "F#", "G#", "A", "B", "C#"],
  },
  "2/minor": {
    displaySpelling: "D",
    notes: ["D", "E", "F", "G", "A", "Bb", "C", "D"],
  },
  "3/minor": {
    displaySpelling: "Eb",
    notes: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db", "Eb"],
  },
  "4/minor": {
    displaySpelling: "E",
    notes: ["E", "F#", "G", "A", "B", "C", "D", "E"],
  },
  "5/minor": {
    displaySpelling: "F",
    notes: ["F", "G", "Ab", "Bb", "C", "Db", "Eb", "F"],
  },
  "6/minor": {
    displaySpelling: "F#",
    notes: ["F#", "G#", "A", "B", "C#", "D", "E", "F#"],
  },
  "7/minor": {
    displaySpelling: "G",
    notes: ["G", "A", "Bb", "C", "D", "Eb", "F", "G"],
  },
  "8/minor": {
    displaySpelling: "G#",
    notes: ["G#", "A#", "B", "C#", "D#", "E", "F#", "G#"],
  },
  "9/minor": {
    displaySpelling: "A",
    notes: ["A", "B", "C", "D", "E", "F", "G", "A"],
  },
  "10/minor": {
    displaySpelling: "Bb",
    notes: ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab", "Bb"],
  },
  "11/minor": {
    displaySpelling: "B",
    notes: ["B", "C#", "D", "E", "F#", "G", "A", "B"],
  },
};

/** Look up the conventional spelling row for a pitch + type. */
export function scaleSpelling(
  rootPitch: number,
  type: Scale["type"],
): SpellingRow {
  const row = SPELLING_TABLE[`${rootPitch}/${type}`];
  if (!row) {
    throw new Error(
      `no spelling row for rootPitch ${rootPitch} type "${type}"`,
    );
  }
  return row;
}

export type ScaleFilterOption = "all" | "major" | "minor" | string;

export interface ScaleFilterGroup {
  label: string;
  options: Array<{ value: ScaleFilterOption; label: string }>;
}

export const SCALE_FILTER_ALL: ScaleFilterOption = "all";

/** Grouped dropdown options (FR-004): all / by type / by note. */
export const SCALE_FILTER_GROUPS: readonly ScaleFilterGroup[] = [
  { label: "All", options: [{ value: "all", label: "All scales" }] },
  {
    label: "By type",
    options: [
      { value: "major", label: "Major" },
      { value: "minor", label: "Minor" },
    ],
  },
  {
    label: "By note",
    options: [
      ...NATURAL_NOTES.map((n) => ({ value: n, label: n })),
      ...FLAT_NOTES.map((n) => ({ value: n, label: n })),
      ...SHARP_NOTES.map((n) => ({ value: n, label: n })),
    ],
  },
];

/** Pure filter (FR-005): all → identity; type → match; spelling → root OR rootAlias. */
export function filterScales(
  scales: readonly Scale[],
  option: ScaleFilterOption,
): Scale[] {
  if (option === "all") return [...scales];
  if (option === "major" || option === "minor") {
    return scales.filter((s) => s.type === option);
  }
  return scales.filter((s) => s.root === option || s.rootAlias === option);
}

/** Default order (FR-010): alphabetical by display name; major before minor per pitch. */
export function sortScales(scales: readonly Scale[]): Scale[] {
  return [...scales].sort((a, b) => {
    if (a.rootPitch === b.rootPitch && a.type !== b.type) {
      return a.type === "major" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "en");
  });
}

/** Landscape neck reference: uke strings top-to-bottom G C E A + open pitches. */
export const NECK_STRING_NAMES = ["G", "C", "E", "A"] as const;
export const NECK_OPEN_PITCHES = [7, 0, 4, 9] as const; // G C E A, C = 0
export const NECK_FRETS = 12;

export interface NeckTone {
  string: number; // 0=G 1=C 2=E 3=A
  fret: number; // 0 = open, 1..12
  pitch: number; // 0-11, C = 0
  spelling: string; // scale's conventional spelling for this pitch
  isTonic: boolean;
  /** Playing order 1-8 when this tone is part of the 1st-position sequence. */
  order?: number;
}

/**
 * Pure model for the landscape 12-fret reference neck: every fret 0..12 on
 * all 4 strings whose pitch belongs to the scale (7 pitch classes from the
 * first 7 notes; the 8th is the octave duplicate). Spelling comes from the
 * scale's conventional note names so e.g. C# minor never shows Db.
 */
export function scaleNeckTones(
  notes: readonly string[],
  rootPitch: number,
  firstPositions?: ReadonlyArray<{
    string: number;
    fret: number;
    order: number;
  }>,
): NeckTone[] {
  const pitchToSpelling = new Map<number, string>();
  for (const note of notes.slice(0, 7)) {
    const pitch = SPELLING_PITCH[note];
    if (pitch === undefined) continue;
    if (!pitchToSpelling.has(pitch)) pitchToSpelling.set(pitch, note);
  }
  const orderByFret = new Map<string, number>();
  for (const p of firstPositions ?? []) {
    orderByFret.set(`${p.string}:${p.fret}`, p.order);
  }
  const tones: NeckTone[] = [];
  for (let s = 0; s < NECK_OPEN_PITCHES.length; s += 1) {
    for (let fret = 0; fret <= NECK_FRETS; fret += 1) {
      const pitch = (NECK_OPEN_PITCHES[s] + fret) % 12;
      const spelling = pitchToSpelling.get(pitch);
      if (spelling === undefined) continue;
      tones.push({
        string: s,
        fret,
        pitch,
        spelling,
        isTonic: pitch === rootPitch,
        order: orderByFret.get(`${s}:${fret}`),
      });
    }
  }
  return tones;
}
