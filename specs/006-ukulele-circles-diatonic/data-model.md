# Data Model: Ukulele Circles — Diatonic Harmony Focus View

**Feature**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage: Astro Content Layer collections (typed JSON,
Zod-validated at build) — extends the 001/003/005 model. No new
collections. Field contracts:
[contracts/content-schema.md](./contracts/content-schema.md); view contract:
[contracts/circles-view.md](./contracts/circles-view.md).

## Collections & entities

### Chord (`chords`) — EXTENDED

One ukulele chord entry (FR-012/FR-013). Unchanged shape except the `type`
enum gains `"diminished"`.

| Field       | Type        | Required | Validation                                                                                                       |
| ----------- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`      | string      | yes      | 1+ chars, e.g. `"C major"`, `"Bb / A# diminished"` (flat-first combined per 001 convention)                      |
| `type`      | enum        | yes      | `"major"` \| `"minor"` \| `"diminished"` (new value this feature)                                                |
| `root`      | enum        | yes      | MUST be a `NOTE_ROOTS` spelling (flat-side canonical)                                                            |
| `rootAlias` | enum        | no       | MUST be the `ENHARMONIC_PAIR` partner of `root` when present                                                     |
| `rootPitch` | int         | yes      | 0–11; MUST equal `ROOT_PITCH[root]`                                                                              |
| `topicSlug` | string      | yes      | MUST resolve to an existing topic (`"chords"`, rule 4)                                                           |
| `diagram`   | ChordDiagram| yes      | GCEA fingering; pitch classes MUST include the type triad and nothing else (rule 28)                             |

Ships with 36 entries: 12 pitches × major/minor/diminished (FR-012/SC-003).

### Progression (embedded in lesson sections) — EXTENDED

One taught circle (FR-001, FR-016). Unchanged shape except the new defaulted
`type` field (R3).

| Field     | Type         | Required | Validation                                                                                  |
| --------- | ------------ | -------- | ------------------------------------------------------------------------------------------- |
| `name`    | string       | yes      | 1–80 chars, unique per course (rule 18), e.g. `"Circle in C — the 50s progression"`          |
| `key`     | enum         | yes      | MUST be a `NOTE_SPELLINGS` spelling (17 values; minor keys use conventional tonic, R8)      |
| `type`    | enum         | no       | `"major"` \| `"minor"`, default `"major"` (new this feature; existing entries parse as-is)  |
| `degrees` | string[≥3]   | yes      | e.g. `["I","vi","IV","V"]` / `["i","VI","III","VII"]`; length MUST equal `chords` length    |
| `chords`  | string[≥3]   | yes      | Chord names; each MUST resolve to a catalog entry (rule 15) AND be diatonic to key+type (rule 29) |

Ships with 24 progressions: the 12 existing major circles (unchanged) + 12
new minor circles in three grouped lesson sections (FR-016).

### Circle (derived, not stored) — EXTENDED

One progression surfaced in the explorer (FR-004–FR-011): `name`, `key`,
`type`, progression `degrees` + `chords`, resolved progression chords (via
existing `resolveCircleChords`), scale notes (spelling row for key pitch +
type), the seven `DiatonicChord` rows (R1), and the neck tones derived from
the notes. Missing diagrams render the diagram-unavailable placeholder —
never a crash.

### DiatonicChord (derived, not stored) — NEW

One of the seven triads native to a circle's key (FR-007–FR-010, R1):

| Field      | Type                     | Validation                                                                                          |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `degree`   | enum                     | Major: `I ii iii IV V vi vii°`; minor: `i ii° III iv v VI VII` (position-fixed)                     |
| `note`     | string                   | Scale spelling from the oracle row (e.g. `"Cb"`); display label per FR-009                          |
| `quality`  | enum                     | `"major"` \| `"minor"` \| `"diminished"` (position-fixed vector per key type)                        |
| `chord`    | Chord \| null            | Catalog entry with (`rootPitch` = `SPELLING_PITCH[note]`, `type` = quality); null only pre-gate     |
| `inCircle` | boolean                  | True iff the resolved catalog name ∈ the circle's progression chords (exact match)                   |

Seven rows per circle, scale order, positions 1–7 fixed. The row's diagram
is `chord.diagram` (curated, from the Chords topic).

### Scale spelling (derived oracle, not stored per-entry) — REUSED

`SPELLING_TABLE` in pure `lib/scales.ts` (005, unchanged): `(rootPitch,
type)` → `{ displaySpelling, notes[8] }`. Circles read rows 1–7 as the note
source; the table itself is not modified by this feature.

### Topic / Scale / Course / Game — UNCHANGED

No new topic is added (spec Key Entities); the Scales collection, course,
and game schemas are untouched. The `harmonic-circles` lesson topic gains
sections + progressions (content only, same schema).

## Derived / UI state (not persisted)

- **Circle filter**: `"all"` | `"major"` | `"minor"` | note spelling (17
  options); type matches `circle.type`, note matches key pitch
  (`ROOT_PITCH` equality — enharmonic equivalent). Preserved across
  focus open/close.
- **Detail state**: single selection (`string | null` circle name)
  rendering the full-width focus view; Back button or Escape returns to
  the list (005 skeleton, FR-004).
- **View states** (FR-015): `loading` → `ready` | `empty` | `error`;
  error MUST offer retry; empty when the course has no circles or the
  filter matches nothing (with reset path).
- **Key display**: both spellings where the pitch has two (flat root +
  sharp alias via `ENHARMONIC_PAIR` and its inverse), e.g. "Gb / F#".

## Validation rules (build + test)

Per-entry rules (Zod schemas via `defineCollection`, checked at
`astro sync`/build):

- Chord identity: `type` is major|minor|**diminished** (extended);
  `root`/`rootAlias`/`rootPitch`/`topicSlug` rules unchanged.
- Progression: `name` (1–80), `key` in `NOTE_SPELLINGS`, **`type`
  major|minor default major** (new), `degrees`/`chords` ≥3 with equal
  lengths (unchanged).

Cross-collection rules (`validateCollections()`, executed by
`frontend/scripts/check-content.ts` as the `prebuild` gate):

- 4 (amended). Every chord's `topicSlug` resolves to an existing topic;
  exactly `CHORD_COUNT` (36) chords; no duplicate chord `name`; no
  duplicate (`rootPitch`,`type`) pair — which now implies full 12×3
  coverage.
- 28 (new). Every chord diagram's pitch classes (open GCEA + frets, mod
  12) MUST include its type triad above `rootPitch` — major {0,4,7},
  minor {0,3,7}, diminished {0,3,6} — and MUST include no other pitch
  class; failures name the entry.
- 29 (new). Every lesson progression chord MUST be diatonic to its
  circle's (key pitch, `type`): the resolved catalog entry's
  (`rootPitch`,`type`) MUST belong to the R1 derived set; failures name
  the circle + chord.

Rules 2, 3, 6, 15, 18, 23–26 from 001/003/005 are unchanged and still
hold. Content-integrity test rules (like 003 rules 16–17): the Chords
topic holds exactly 36 entries; the course holds exactly 24 circles
(12 major + 12 minor).
