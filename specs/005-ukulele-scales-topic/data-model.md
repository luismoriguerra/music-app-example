# Data Model: Ukulele Scales Topic

**Feature**: `005-ukulele-scales-topic` | **Date**: 2026-09-16
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage: Astro Content Layer collections (typed JSON,
Zod-validated at build) — extends the 001/003 model. Field contracts:
[contracts/content-schema.md](./contracts/content-schema.md).

## Collections & entities

### Topic (`topics`) — EXTENDED

Adds `"scales"` to the `format` discriminator. Existing entries stay valid.

| Field         | Type    | Required    | Validation                                                                                   |
| ------------- | ------- | ----------- | -------------------------------------------------------------------------------------------- |
| `title`       | string  | yes         | 1–80 chars, e.g. `"Scales"`                                                                  |
| `slug`        | string  | yes         | `slugify(title)`, unique within parent course's topics                                       |
| `kind`        | literal | yes         | MUST be `"topic"` — explicitly declared, never inferred                                      |
| `courseSlug`  | string  | yes         | MUST reference an existing `courses.slug` (`"ukulele"`)                                      |
| `description` | string  | yes         | 1–280 chars (course-page card text, FR-001)                                                  |
| `format`      | enum    | no          | `"reference"` \| `"lesson"` \| `"circles"` \| `"scales"`, default `"reference"`              |
| `lesson`      | Lesson  | conditional | REQUIRED when `format` is `"lesson"`; MUST be absent otherwise (unchanged)                   |
| `order`       | number  | no          | sort key on course page, default 0 (`3` for Scales: after Chords, Harmonic Circles, Circles) |

Ships with one new entry under Ukulele: Scales (`format: "scales"`,
`order: 3`).

### Scale (`scales`) — NEW COLLECTION

One scale entry (FR-003, FR-006–FR-011). Identity fields mirror `chordSchema`
(DR-003); content fields carry the taught sequence (DR-001/DR-002/DR-005).

| Field             | Type         | Required | Validation                                                                                                                                                                                    |
| ----------------- | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | string       | yes      | 1–80 chars, e.g. `"C major"`, `"Bb / A# minor"` (flat-first combined per DR-003)                                                                                                              |
| `type`            | enum         | yes      | `"major"` \| `"minor"` (natural minor only, DR-004)                                                                                                                                           |
| `root`            | enum         | yes      | MUST be a `NOTE_ROOTS` spelling (flat-side canonical)                                                                                                                                         |
| `rootAlias`       | enum         | no       | MUST be the `ENHARMONIC_PAIR` partner of `root` when present (e.g. `C#` for `Db`)                                                                                                             |
| `rootPitch`       | int          | yes      | 0–11; MUST equal `ROOT_PITCH[root]`                                                                                                                                                           |
| `topicSlug`       | string       | yes      | MUST resolve to the `scales` topic (rule 23)                                                                                                                                                  |
| `notes`           | string[8]    | yes      | Note sequence in playing order incl. octave, spelled from `displaySpelling`; MUST exactly match the `SPELLING_TABLE` row for (`rootPitch`, `type`) (rule 25); no double-flats/sharps (FR-008) |
| `degrees`         | string[8]    | yes      | Scale-degree labels, e.g. `["1","2","3","4","5","6","7","8"]`; length MUST equal `notes` length                                                                                               |
| `intervals`       | string       | yes      | Pattern string: `"W-W-H-W-W-W-H"` for major, `"W-H-W-W-H-W-W"` for minor (MUST match `type`)                                                                                                  |
| `displaySpelling` | string       | yes      | Tonic the notes are spelled from (DR-005), e.g. `"C#"` for the `"Db / C# minor"` entry; MUST be `root` or `rootAlias`                                                                         |
| `diagram`         | ScaleDiagram | yes      | Fretboard-chart fingering (FR-011); see below                                                                                                                                                 |

Ships with 24 entries: 12 pitches × major/natural-minor (FR-007/SC-004).

### ScaleDiagram (embedded in Scale)

One-octave first-position fingering (FR-011, DR-002): ordered positions over
four strings plus a position label.

| Field           | Type        | Required | Validation                                                                       |
| --------------- | ----------- | -------- | -------------------------------------------------------------------------------- |
| `strings`       | literal     | yes      | MUST be `"GCEA"` (string index 0=G, 1=C, 2=E, 3=A)                               |
| `positions`     | Position[8] | yes      | Exactly 8 positions (one per note); `order` values MUST be exactly 1–8 each once |
| `baseFret`      | int         | no       | ≥1, default 1                                                                    |
| `positionLabel` | string      | yes      | 1–40 chars, e.g. `"1st position"`                                                |

Position: `{ string: 0–3, fret: int 0–12 (0 = open), order: 1–8 unique,
finger: 0–4 (0 = open/no finger) }`. Pitch agreement: open-string pitch
(G=7, C=0, E=4, A=9) + fret, mod 12, MUST equal the pitch-class of the
corresponding `notes[order-1]` (rule 26) — enharmonic comparison (spelling
agnostic), so conventional spellings pass.

### Spelling table (derived oracle, not stored per-entry)

`SPELLING_TABLE` in pure `lib/scales.ts`: `(rootPitch, type)` →
`{ displaySpelling, notes[8] }`, transcribed 1:1 from the spec Appendix
(validated in research R2). The content gate (rule 25) compares each entry's
`notes[]` against its row exactly — spelling-correct by construction, not by
reviewer eyeball.

### Scale detail (derived, not stored)

One scale entry surfaced in the explorer's expanded detail (FR-006): `name`,
`type`, `root` (+ alias), `notes` with `degrees`, `intervals`, and the
`diagram` rendered by `ScaleDiagram`. Missing diagrams render the
FR-015 placeholder — never a crash.

## Derived / UI state (not persisted)

- **Topic format dispatch**: `reference` → chord-explorer island (unchanged
  001 behavior); `lesson` → static lesson reader (unchanged 003); `circles`
  → circles-explorer island (unchanged 003); `scales` → scales-explorer
  island (this feature). Dispatch is data-driven; no slug conditionals.
- **View states** (FR-014): `loading` → `ready` | `empty` | `error`;
  error MUST offer retry; empty when the topic has no scales or the filter
  matches nothing (with reset path).
- **Detail state**: single selection (`string | null` scale name) rendering
  a full-width focus view; Back button or Escape returns to the list;
  filter state persists across Back/Esc (unlike ChordList's inline toggle).

## Validation rules (build + test)

Per-entry rules (Zod schemas via `defineCollection`, checked at
`astro sync`/build):

19. `format` is `"reference"`, `"lesson"`, `"circles"`, or `"scales"`
    (default `"reference"`).
20. Scale identity: `name` (1–80), `type` (major|minor), `root` in
    `NOTE_ROOTS`, `rootAlias` (when present) is the `ENHARMONIC_PAIR`
    partner of `root`, `rootPitch` equals `ROOT_PITCH[root]`, `topicSlug`
    non-empty.
21. Scale content: `notes` and `degrees` are arrays of exactly 8 non-empty
    strings; `intervals` matches the `type`-expected pattern string;
    `displaySpelling` is `root` or `rootAlias`; `positionLabel` 1–40 chars.
22. Scale diagram: `strings` is `"GCEA"`; `positions` has exactly 8 entries
    with `string` 0–3, `fret` 0–12, `finger` 0–4, and `order` exactly
    1–8 each once; `baseFret` ≥ 1.

Cross-collection rules (`validateCollections()`, executed by
`frontend/scripts/check-content.ts` as the `prebuild` gate):

23. Every scale's `topicSlug` resolves to an existing topic; exactly 24
    scales; no duplicate scale `name`; no duplicate (`rootPitch`,`type`)
    pair (mirrors Rule 4 for chords).
24. Every filter spelling (`NOTE_ROOTS` + `NOTE_ALIASES`) matches at least
    one scale via `root` or `rootAlias` (mirrors Rule 6).
25. Every scale's `notes[]` exactly matches the `SPELLING_TABLE` row for
    its (`rootPitch`,`type`); failures name the entry and the first
    diverging degree (FR-008/SC-005). No note may contain a double
    accidental (`bb`, `x`, `##`).
26. Every diagram position's pitch (open-string pitch + fret, mod 12)
    equals the pitch-class of `notes[order-1]`; failures name the entry +
    order + expected pitch-class (fingering pitch agreement, R8).

Content-integrity test rules (like 003 rules 16–17, enforced over real JSON):

27. The `scales` topic exists under `ukulele` with `format: "scales"` and
    no `lesson`; the scales collection holds exactly the 24 entries
    (FR-001/SC-004).

Rules 1–18 from 001/003 are unchanged and still hold.
