import {
  FLAT_NOTES,
  NATURAL_NOTES,
  SHARP_NOTES,
  type NoteAlias,
  type NoteRoot,
} from "./notes";
import type { Chord } from "./content/schemas";

export type { Chord };

export type FilterOption = "all" | "major" | "minor" | "diminished" | string;

export interface FilterGroup {
  label: string;
  options: Array<{ value: FilterOption; label: string }>;
}

export const FILTER_ALL: FilterOption = "all";

/** Grouped dropdown options (FR-008): all / by type / by note. */
export const FILTER_GROUPS: readonly FilterGroup[] = [
  { label: "All", options: [{ value: "all", label: "All chords" }] },
  {
    label: "By type",
    options: [
      { value: "major", label: "Major" },
      { value: "minor", label: "Minor" },
      { value: "diminished", label: "Diminished" },
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

/** Combined flat-first display name, e.g. "Bb / A# major". */
export function chordDisplayName(
  root: NoteRoot,
  type: Chord["type"],
  alias?: NoteAlias,
): string {
  const spelled = alias ? `${root} / ${alias}` : root;
  return `${spelled} ${type}`;
}

/** Pure filter (FR-009): all → identity; type → match; spelling → root OR rootAlias. */
export function filterChords(
  chords: readonly Chord[],
  option: FilterOption,
): Chord[] {
  if (option === "all") return [...chords];
  if (option === "major" || option === "minor" || option === "diminished") {
    return chords.filter((c) => c.type === option);
  }
  return chords.filter((c) => c.root === option || c.rootAlias === option);
}

/** Default order (FR-017): alphabetical by display name; major → minor → diminished per pitch. */
export function sortChords(chords: readonly Chord[]): Chord[] {
  return [...chords].sort((a, b) => {
    if (a.rootPitch === b.rootPitch && a.type !== b.type) {
      return TYPE_TIER[a.type] - TYPE_TIER[b.type];
    }
    return a.name.localeCompare(b.name, "en");
  });
}

const TYPE_TIER: Record<Chord["type"], number> = {
  major: 0,
  minor: 1,
  diminished: 2,
};
