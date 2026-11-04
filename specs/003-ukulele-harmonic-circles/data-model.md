# Data Model: Ukulele Harmonic Circles Topic

**Feature**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage: Astro Content Layer collections (typed JSON,
Zod-validated at build) — extends the 001 model. Field contracts:
[contracts/content-schema.md](./contracts/content-schema.md).

## Collections & entities

### Topic (`topics`) — EXTENDED

Adds a `format` discriminator and optional `lesson` chapter content.
Existing entries stay valid (`format` defaults to `"reference"`).

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | 1–80 chars, e.g. `"Harmonic Circles"` |
| `slug` | string | yes | `slugify(title)`, unique within parent course's topics (FR-015 of catalog) |
| `kind` | literal | yes | MUST be `"topic"` — explicitly declared, never inferred |
| `courseSlug` | string | yes | MUST reference an existing `courses.slug` (`"ukulele"`) |
| `description` | string | yes | 1–280 chars (course-page card text, FR-001) |
| `format` | enum | no | `"reference"` \| `"lesson"` \| `"circles"`, default `"reference"` |
| `lesson` | Lesson | conditional | REQUIRED when `format` is `"lesson"`; MUST be absent otherwise |
| `order` | number | no | sort key on course page, default 0 (`1` for the lesson, `2` for the explorer: after Chords) |

Ships with two new entries under Ukulele: Harmonic Circles
(`format: "lesson"`, `order: 1`) and Circles (`format: "circles"`,
`order: 2`).

### Lesson (embedded in Topic)

The book chapter (FR-003, FR-006). An introduction plus an ordered
sequence of sections and a closing summary.

| Field | Type | Required | Validation |
|---|---|---|---|
| `intro` | string[] | yes | ≥1 Markdown paragraphs, no raw HTML (R2) |
| `sections` | LessonSection[] | yes | ≥4 sections in reading order (FR-003) |
| `summary` | string[] | yes | ≥1 Markdown paragraphs closing the chapter |

### LessonSection (embedded in Lesson)

| Field | Type | Required | Validation |
|---|---|---|---|
| `heading` | string | yes | 1–80 chars, rendered as the section heading |
| `paragraphs` | string[] | yes | ≥1 Markdown paragraphs, no raw HTML |
| `progressions` | Progression[] | no | 0+ progression blocks shown after the prose |

### Progression (embedded in LessonSection)

One harmonic circle (FR-004, FR-005): ordered chords with scale-degree
context, each chord resolving to the Chords reference.

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | yes | 1–80 chars, e.g. `"Circle in C — the 50s progression"` |
| `key` | string | yes | MUST be a valid note spelling (naturals A–G, flats, sharps) |
| `degrees` | string[] | yes | ≥3 entries, e.g. `["I","vi","IV","V"]`; length MUST equal `chords` length |
| `chords` | string[] | yes | ≥3 entries; each MUST exactly equal a `chords[].name` from the Chords reference (FR-008) |

The lesson ships with twelve progressions: Circle in C (C–Am–F–G),
Circle in G (G–Em–C–D), Circle in F (F–Dm–Bb–C), Circle in Bb
(Bb–Gm–Eb–F), Circle in D (D–Bm–G–A), Circle in A (A–F#m–D–E), Circle
in Eb (Eb–Cm–Ab–Bb), Circle in Ab (Ab–Fm–Db–Eb), Circle in E
(E–C#m–A–B), Circle in B (B–G#m–E–F#), Circle in Db (Db–Bbm–Gb–Ab),
Circle in F# (F#–D#m–B–C#), all I–vi–IV–V.

### ChordReference (derived, not stored)

A `progression.chords[]` string resolved through the pure lookup
`resolveLessonChords(lesson, chords)` to its `Chord` entry (name +
diagram) for inline rendering. Unresolvable names are a content error
naming topic + progression + chord — never rendered.

### ExplorerCircle (derived, not stored)

One lesson progression surfaced in the circles explorer (FR-012,
FR-013): `name`, `key`, `degrees`, and `chords[]` names collected from
every `format: "lesson"` topic in the course via pure
`collectLessonCircles(topics)` (lesson reading order preserved), each
name resolved to its `Chord` entry via `resolveCircleChords()` for
inline diagrams. Unresolvable names are already content errors under
rule 15 — never rendered.

### Section anchor ids (derived, not stored)

Each section heading derives one anchor id via `slugifyHeading()`
(lowercase, NFKD diacritics stripped, runs of non-alphanumerics
collapsed to single dashes, leading/trailing dashes trimmed; an empty
result falls back to `"section"`). `sectionSlugs()` assigns one id per
heading in section order, deduplicating repeats (`overview`,
`overview-2`, …). The chapter index (FR-011) links `#introduction`,
every section id in order, and `#summary`; all anchors MUST resolve in
the rendered article.

## Lesson chapter outline (authored content)

1. Intro — the same four chords behind hundreds of songs; what the
   chapter teaches and what the reader needs (ukulele, standard tuning).
2. "What Is a Harmonic Circle?" — loops vs lines, tension and release,
   scale degrees and Roman numerals, why circles stick in memory.
3. "Circle in C — the 50s Progression" — C–Am–F–G as I–vi–IV–V with
   inline diagrams; why it is the first circle to learn.
4. "Circle in G" — G–Em–C–D with inline diagrams; capo-free singing keys.
5. "Circle in F" — F–Dm–Bb–C with inline diagrams; meeting the first
   barre-friendly flat chord (Bb).
6. "Circle in Bb — Flat-Key Fluency" — Bb–Gm–Eb–F; the newcomer chord
   becomes home, flat-key fluency, jazz doorway.
7. "Circle in D — Your First Barre" — D–Bm–G–A; the busker's key and
   the first full barre (B minor).
8. "Circle in A — Stand by Me's Home Key" — A–F#m–D–E; playing the
   original recording in its original key, E-major stretch goal.
9. "Circle in Eb — Motown Soul" — Eb–Cm–Ab–Bb; soul keys, Cm stack,
   Ab stretch-barre.
10. "Circle in Ab — Four-Flat Territory" — Ab–Fm–Db–Eb; Fm
   stretch, Db pinky-reach barre.
11. "Circle in E — Rock's Home Key" — E–C#m–A–B; C#m stretch, B
   compact barre.
12. "Circle in B — Five-Sharp Summit" — B–G#m–E–F#; all-four-finger
   G#m, F# stretch-barre.
13. "Circle in Db — Five-Flat Summit" — Db–Bbm–Gb–Ab; full Bbm barre,
   near-static hand.
14. "Circle in F# — The Final Frontier" — F#–D#m–B–C#; three-finger
   anchor, the twelfth key.
15. "Practicing Circles Cleanly" — pivot fingers, slow-change drill,
   metronome ladder, one-minute changes, island-strum pattern.
16. "Hearing Circles in Songs" — recognizing I–vi–IV–V by ear in any key,
   playing along, progression families beyond I–vi–IV–V.
17. Summary — recap + a 5-minute daily loop plan + pointer to the Chords
   reference for every diagram in the chapter.

## Derived / UI state (not persisted)

- **Topic format dispatch**: `reference` → chord-explorer island
  (unchanged 001 behavior); `lesson` → static lesson reader;
  `circles` → circles-explorer island (this feature, FR-012/FR-013).
  Dispatch is data-driven; no slug conditionals in views.
- **View states** (FR-009): `loading` → `ready` | `empty` | `error`;
  error MUST offer retry; empty when the chapter has no sections.
- **Markdown → HTML**: build-time only (`marked`, sync); raw HTML in
  prose fails the build (R2).
- **Chapter index** (FR-011): aside-first DOM (nav before article for
  keyboard/screen-reader order), sticky side block at or above the large
  breakpoint, stacked above the article below it; zero client JS.

## Validation rules (build + test)

Per-entry rules (Zod schemas via `defineCollection`, checked at
`astro sync`/build):

10. `format` is `"reference"`, `"lesson"`, or `"circles"` (default
    `"reference"`).
11. `lesson` is present iff `format` is `"lesson"`.
12. Lesson has `intro` (≥1), `sections` (≥4), `summary` (≥1); every
    section has `heading` (1–80 chars) and `paragraphs` (≥1).
13. Every prose string contains no tag-like `<...>` sequences.
14. Every progression has `name` (1–80), `key` (valid note spelling),
    `degrees` (≥3) and `chords` (≥3) with equal lengths.

Cross-collection rules (`validateCollections()`, executed by
`frontend/scripts/check-content.ts` as the `prebuild` gate):

15. Every `progression.chords[]` name exactly matches a `chords[].name`;
    failures name topic + progression + chord (FR-008).
16. The `harmonic-circles` topic exists under `ukulele` with
    `format: "lesson"` and ≥3 progressions across its sections
    (FR-004; enforced by the content-integrity test over real JSON).
17. The `circles` topic exists under `ukulele` with `format: "circles"`
    and no `lesson`; the explorer entry count equals the lesson
    progression count (FR-012/SC-007; enforced by the content-integrity
    test over real JSON).
18. Progression names are unique within each course's lessons; failures
    name every topic carrying the duplicate
    (`topics/<slug>: duplicate progression name "<name>"`). Guards the
    explorer's identity assumption — CircleList keys React key,
    expanded state, and aria-controls ids on `circle.name` (FR-013).

Rules 1–9 from 001 (`data-model.md` there) are unchanged and still hold.
