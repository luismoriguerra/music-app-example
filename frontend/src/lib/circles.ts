import {
  FLAT_NOTES,
  NATURAL_NOTES,
  ROOT_PITCH,
  SHARP_NOTES,
  SPELLING_PITCH,
} from "./notes";
import type { NoteSpelling } from "./notes";
import { SPELLING_TABLE } from "./scales";
import type { Chord, Progression, Topic } from "./content/schemas";

/**
 * Pure circles-explorer helpers (R9, contracts/content-schema.md). Zero Astro
 * imports: the topic route collects at frontmatter time; the CircleList
 * island resolves, filters, and sorts from props.
 */

export interface ResolvedCircleChord {
  name: string;
  degree: string;
  chord: Chord | null;
}

export interface DiatonicChord {
  degree: string;
  note: string;
  quality: "major" | "minor" | "diminished";
  chord: Chord | null;
  inCircle: boolean;
}

const MAJOR_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const;
const MINOR_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"] as const;
const MAJOR_QUALITIES = [
  "major",
  "minor",
  "minor",
  "major",
  "major",
  "minor",
  "diminished",
] as const;
const MINOR_QUALITIES = [
  "minor",
  "diminished",
  "major",
  "minor",
  "minor",
  "major",
  "major",
] as const;

export type CircleFilter = "all" | "major" | "minor" | string;

export interface CircleFilterGroup {
  label: string;
  options: Array<{ value: CircleFilter; label: string }>;
}

export const CIRCLE_FILTER_ALL: CircleFilter = "all";

/** Grouped dropdown options (FR-002): all / by type / by note. */
export const CIRCLE_FILTER_GROUPS: readonly CircleFilterGroup[] = [
  { label: "All", options: [{ value: "all", label: "All circles" }] },
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

/**
 * Every progression from every lesson topic, lesson reading order
 * preserved. Topics without lesson content are skipped.
 */
export function collectLessonCircles(topics: readonly Topic[]): Progression[] {
  const out: Progression[] = [];
  for (const topic of topics) {
    if (topic.format !== "lesson" || !topic.lesson) continue;
    for (const section of topic.lesson.sections) {
      out.push(...section.progressions);
    }
  }
  return out;
}

/**
 * Pair each chord name with its scale degree and Chords reference entry
 * by exact `name` match. Unresolvable names map to null — a content
 * error per validateCollections rule 15; callers must handle null
 * without crashing.
 */
export function resolveCircleChords(
  circle: Progression,
  chords: readonly Chord[],
): ResolvedCircleChord[] {
  const byName = new Map(chords.map((c) => [c.name, c]));
  return circle.chords.map((name, i) => ({
    name,
    degree: circle.degrees[i],
    chord: byName.get(name) ?? null,
  }));
}

/**
 * Derive the seven diatonic triads of a circle's key (R1): scale notes
 * from the SPELLING_TABLE oracle, fixed quality/degree vectors per key
 * type, catalog resolution by pitch class (never by name, so Gb-major
 * "Cb" resolves to "B major"), and in-circle marking by exact catalog
 * name. Unresolvable rows map to null chords without throwing — a
 * content error per validateCollections rule 29; callers render the
 * diagram-unavailable placeholder.
 */
export function diatonicChords(
  circle: Progression,
  chords: readonly Chord[],
): DiatonicChord[] {
  const minor = circle.type === "minor";
  const degrees = minor ? MINOR_DEGREES : MAJOR_DEGREES;
  const qualities = minor ? MINOR_QUALITIES : MAJOR_QUALITIES;
  const blank = (): DiatonicChord[] =>
    degrees.map((degree, i) => ({
      degree,
      note: "",
      quality: qualities[i],
      chord: null,
      inCircle: false,
    }));
  const row = SPELLING_TABLE[`${ROOT_PITCH[circle.key]}/${circle.type}`];
  if (!row) return blank();
  const byPitchQuality = new Map(
    chords.map((c) => [`${c.rootPitch}/${c.type}`, c]),
  );
  const progressionNames = new Set(circle.chords);
  return row.notes.slice(0, 7).map((note, i) => {
    const chord =
      byPitchQuality.get(`${SPELLING_PITCH[note]}/${qualities[i]}`) ?? null;
    return {
      degree: degrees[i],
      note,
      quality: qualities[i],
      chord,
      inCircle: chord ? progressionNames.has(chord.name) : false,
    };
  });
}

/** Pure filter (FR-002): all → identity; type → match; spelling → key pitch equality. */
export function filterCircles(
  circles: readonly Progression[],
  option: CircleFilter,
): Progression[] {
  if (option === "all") return [...circles];
  if (option === "major" || option === "minor") {
    return circles.filter((c) => c.type === option);
  }
  const pitch = ROOT_PITCH[option as NoteSpelling];
  return circles.filter((c) => ROOT_PITCH[c.key] === pitch);
}

/** By key pitch, then type major-first, then by name. */
export function sortCircles(circles: readonly Progression[]): Progression[] {
  return [...circles].sort((a, b) => {
    const pitch = ROOT_PITCH[a.key] - ROOT_PITCH[b.key];
    if (pitch !== 0) return pitch;
    if (a.type !== b.type) return a.type === "major" ? -1 : 1;
    return a.name.localeCompare(b.name, "en");
  });
}
