# Contract: Circles Content Schemas (delta on 001/003/005)

**Feature**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17
**Data model**: [../data-model.md](../data-model.md) |
**Base contracts**: [001 content-schema](../../../001-music-course-catalog/contracts/content-schema.md),
[003 content-schema](../../../003-ukulele-harmonic-circles/contracts/content-schema.md),
[005 content-schema](../../../005-ukulele-scales-topic/contracts/content-schema.md)

No REST/GraphQL API (content is static — R10). These Zod schema deltas +
`validateCollections()` rule additions, defined in the same pure modules
(`frontend/src/lib/content/schemas.ts`,
`frontend/src/lib/content/validate.ts`, lookups in
`frontend/src/lib/notes.ts`, zero Astro imports) and enforced by the same
`content.config.ts` + `frontend/scripts/check-content.ts` `prebuild` gate,
ARE the contract. Base 001/003/005 schemas and rules 2, 3, 6, 15, 18, 23–26
are unchanged except where noted.

## `chords` (extended type enum)

```ts
chordSchema = z
  .object({
    name: z.string().min(1), // e.g. "Bb / A# diminished" (flat-first combined)
    type: z.enum(["major", "minor", "diminished"]), // + "diminished" (FR-012)
    root: z.enum(NOTE_ROOTS),
    rootAlias: z.enum(NOTE_ALIASES).optional(),
    rootPitch: z.number().int().min(0).max(11),
    topicSlug: z.string().min(1), // "chords" (rule 4)
    diagram: chordDiagramSchema, // unchanged shape; pitch-gated by rule 28
  })
  .refine((c) => ROOT_PITCH[c.root] === c.rootPitch, {
    message: "rootPitch must match lookup(root)",
    path: ["rootPitch"],
  })
  .refine((c) => !c.rootAlias || ENHARMONIC_PAIR[c.root] === c.rootAlias, {
    message: "rootAlias must be the enharmonic partner of root",
    path: ["rootAlias"],
  });
```

Seed (this feature): 12 files `frontend/src/content/chords/*-diminished.json`
(one per pitch, same naming stem convention as major/minor, e.g.
`bb-diminished.json` → `"Bb / A# diminished"`), each with a curated diagram
(R2).

## Progressions (extended with defaulted key type)

```ts
progressionSchema = z
  .object({
    name: z.string().min(1).max(80),
    key: z.enum(NOTE_SPELLINGS),
    type: z.enum(["major", "minor"]).default("major"), // NEW (R3); existing entries parse as-is
    degrees: z.array(z.string().min(1)).min(3),
    chords: z.array(z.string().min(1)).min(3),
  })
  .refine((p) => p.degrees.length === p.chords.length, {
    message: "degrees and chords must have equal lengths", // unchanged
  });
```

Seed (this feature): 12 minor progressions (`"type": "minor"`,
`degrees: ["i","VI","III","VII"]`, canonical i–VI–III–VII chords) in three
new grouped sections of `frontend/src/content/topics/harmonic-circles.json`
(R8). The 12 existing major progressions are byte-unchanged.

## `notes.ts` (count constant + display lookup)

```ts
export const CHORD_COUNT = 36; // renamed from CHORD_COUNT_V1 = 24 (R7)
// Reverse enharmonic lookup for key display (FR-005): sharp alias → flat root,
// e.g. "F#" → "Gb", so keys display combined ("Gb / F#") like chord names.
```

## Collection-level validation (pure, unit-tested additions)

```ts
// validateCollections({ courses, topics, games, chords, scales }): string[] — amend + add:
Rule 4 (amended): every chord topicSlug MUST resolve to a topic; chords.length MUST be
  CHORD_COUNT (36); no duplicate chord name; no duplicate (rootPitch,type) pair.
  Errors: `chords/<name>: topicSlug "<slug>" does not resolve to a topic`,
  `chords: expected exactly 36 entries, found <n>`,
  `chords/<name>: duplicate chord name`,
  `chords: duplicate (rootPitch,type) pair <key>`.
Rule 28 (new): every chord diagram's pitch classes (open GCEA + frets, mod 12) MUST
  include its type triad above rootPitch — major {0,4,7}, minor {0,3,7},
  diminished {0,3,6} — and no other pitch class.
  Error: `chords/<name>: diagram pitch classes [<pcs>] do not match <type> triad above pitch <p>`.
Rule 29 (new): every lesson progression chord MUST be diatonic to (key pitch, type):
  resolve name → catalog entry, require (rootPitch,type) ∈ derived diatonic set (R1).
  Errors: `topics/<slug> [<circle>]: chord "<name>" is not diatonic to <key> <type>`
  (Rule 15's unresolvable-name error still fires first for unknown names).

Content-integrity test rules (like 003 rules 16–17): the `chords` topic holds exactly
36 entries (FR-012/SC-003); the course holds exactly 24 circles, 12 per type (FR-016).
```

## Circles + chords helpers (pure functions, unit-tested)

```ts
// frontend/src/lib/circles.ts (imports notes/scales pure modules only; zero Astro imports)
export interface DiatonicChord {
  degree: string; // "I".."vii°" (major) or "i".."VII" (minor), position-fixed
  note: string; // scale spelling, e.g. "Cb" (FR-009 label)
  quality: "major" | "minor" | "diminished"; // position-fixed vector per key type
  chord: Chord | null; // catalog hit by (SPELLING_PITCH[note], quality); null pre-gate only
  inCircle: boolean; // resolved name ∈ circle.chords
}
export function diatonicChords(circle: Progression, chords: readonly Chord[]): DiatonicChord[];
// Exactly 7 rows, scale order (R1). Never throws on content gaps (null-contract).

export type CircleFilter = "all" | "major" | "minor" | string; // extended (R4)
export const CIRCLE_FILTER_GROUPS: readonly FilterGroup[]; // All circles / By type / By note
export function filterCircles(circles: readonly Progression[], option: CircleFilter): Progression[];
// "all" → identity; "major"|"minor" → circle.type match; spelling → ROOT_PITCH equality.
export function sortCircles(circles: readonly Progression[]): Progression[];
// Key pitch, then type major-first, then name (R4).

// frontend/src/lib/chords.ts (extended, R6)
export type FilterOption = "all" | "major" | "minor" | "diminished" | string;
export function filterChords(chords: readonly Chord[], option: FilterOption): Chord[];
export function sortChords(chords: readonly Chord[]): Chord[];
// Alphabetical by display name; major → minor → diminished per pitch.
```

Contract tests MUST cover: one valid diminished entry + invalid fixtures
(bad type word, `rootPitch` mismatch, bad `rootAlias`) asserting Zod throws;
progression fixtures (`type` default major when absent, explicit minor
accepted, invalid type rejected); derivation tests (all 24 keys → 7 rows
with exact degrees/qualities; Gb-major row 4 = note "Cb" + catalog "B
major"; `inCircle` marks exactly progression chords; null-chord rows don't
throw); referential invalid (count ≠ 36, Rule 28 pitch failure naming the
entry, Rule 29 non-diatonic chord naming circle + chord) asserting
`validateCollections()` returns the naming error; filter/sort tests
(grouped options incl. "diminished", enharmonic pitch equivalence for all 17
spellings, major→minor→diminished tier); island tests per
[circles-view.md](./circles-view.md).
