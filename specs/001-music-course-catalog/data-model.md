# Data Model: Music Course Catalog (Ukulele + Chords)

**Feature**: `001-music-course-catalog` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage: Astro 7 Content Layer collections (typed JSON,
Zod-validated at build). No database tables in v1 — see R1/R5. Field
contracts: [contracts/content-schema.md](./contracts/content-schema.md).

## Collections & entities

### Course (`courses`)

Curated music course. Ships with one entry: Ukulele (FR-005).

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | 1–80 chars, e.g. `"Ukulele"` |
| `slug` | string | yes | `slugify(title)`, unique across `courses` (FR-015) |
| `description` | string | yes | 1–280 chars (FR-001 card text) |
| `cover` | string | no | asset path or emoji/initial fallback; card MUST render without it |
| `order` | number | no | sort key for Home page, default 0 |

Relationships: has many Topics, has many Games (via `courseSlug`).

### Topic (`topics`)

Instructional unit. Ships with one entry: Chords under Ukulele (FR-006).

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | 1–80 chars, e.g. `"Chords"` |
| `slug` | string | yes | unique within parent course's topics (FR-015) |
| `kind` | literal | yes | MUST be `"topic"` — explicitly declared, never inferred |
| `courseSlug` | string | yes | MUST reference an existing `courses.slug` |
| `description` | string | yes | 1–280 chars (FR-003 card text) |
| `order` | number | no | sort key on course page, default 0 |

### Game (`games`)

Interactive activity. No entries ship in v1; collection + route reserved
(FR-003/FR-004/FR-012).

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | 1–80 chars |
| `slug` | string | yes | unique within parent course's games (FR-015) |
| `kind` | literal | yes | MUST be `"game"` |
| `courseSlug` | string | yes | MUST reference an existing `courses.slug` |
| `description` | string | yes | 1–280 chars |
| `rules` | string | no | scoring/rules text — required before any game ships |
| `order` | number | no | sort key on course page, default 0 |

### Chord (`chords`)

Ukulele chord entry, scoped to the Chords topic. Ships with 24 entries:
major + minor for all 12 chromatic pitches (SC-005); each enharmonic pitch
shares one entry per type with a combined flat-first display name.

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | yes | display name `"{root} major"` / `"{root} minor"` (e.g. `"C major"`, `"Bb / A# minor"`); unique within topic |
| `type` | enum | yes | `"major"` \| `"minor"` only in v1 (FR-007) |
| `root` | enum | yes | one of 12 primary spellings: naturals `A`–`G` + flats `Bb`, `Db`, `Eb`, `Gb`, `Ab` (flat-first enharmonics); anything else (e.g. `"Hb"`) fails the build |
| `rootAlias` | enum | no | one of 5 sharps `A#`, `C#`, `D#`, `F#`, `G#`; allowed only as the enharmonic partner of `root` (`Bb`↔`A#`, `Db`↔`C#`, `Eb`↔`D#`, `Gb`↔`F#`, `Ab`↔`G#`); filter matches `root` OR `rootAlias` (FR-008) |
| `rootPitch` | int | yes | pitch class 0–11 (C=0); MUST equal `ROOT_PITCH[root]` lookup — enforced by schema `.refine`, never hand-checked; exactly one entry per (`rootPitch`, `type`) |
| `topicSlug` | string | yes | MUST reference an existing `topics.slug` (`"chords"`) |
| `diagram` | ChordDiagram | yes | see below; invalid → placeholder path (edge case) |

### ChordDiagram (embedded in Chord)

| Field | Type | Required | Validation |
|---|---|---|---|
| `strings` | literal | yes | `"GCEA"` (standard ukulele tuning, high-G) |
| `frets` | int[4] | yes | per-string fret, `-1` muted, `0` open, `>0` fretted; order G,C,E,A |
| `fingers` | int[4] | yes | per-string finger 0–4 (`0` = unspecified) |
| `baseFret` | int | no | default 1; `>1` shows fret-position label instead of nut |
| `barres` | array | no | `{fret: int ≥1, fromString: 0–3, toString: 0–3}` entries |

## Derived / UI state (not persisted)

- **FilterOption**: `"all"` \| `"major"` \| `"minor"` \| note spelling string.
  Note options = naturals A–G + flats + sharps for applicable notes (FR-008).
- **Filter behavior** (FR-009): pure function
  `filterChords(chords, option) → chords`; `"all"` is identity; type options
  match `type`; note options match `root` OR `rootAlias` (selecting `Bb` or
  `A#` shows the same combined entry).
- **View states** per view (FR-016): `loading` → `ready` \| `empty` \| `error`;
  error state MUST offer retry; empty states per FR-013.

## Validation rules (build + test)

1. Every `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤64 chars.
2. Slug uniqueness: courses globally; topics/games per parent course.
3. Every `topic.courseSlug` / `game.courseSlug` resolves to a course.
4. Every `chord.topicSlug` resolves to a topic; the `chords` topic has exactly
   24 entries (12 pitches × 2 types) with unique names.
5. `frets`/`fingers` arrays have length 4; `frets[i] ≥ -1`; barre indices in range.
6. Every FilterOption note spelling (17 total: 7 naturals + 5 flats + 5 sharps)
   matches at least one chord via `root` or `rootAlias` — 17 spellings map onto
   24 entries through alias sharing, so this is consistent with rule 4 (no
   34-entry implication).
7. Combined display names use flat-first order (`"Bb / A# minor"`, never
   `"A# / Bb minor"`); default list order is alphabetical by display name,
   major before minor per pitch (FR-017).
8. `rootPitch` MUST equal the `ROOT_PITCH` lookup of `root`, and `rootAlias`
   MUST be the enharmonic partner of `root` — both enforced by schema
   `.refine` rules so authored data cannot drift (see contracts/content-schema.md).
   Schemas live in `frontend/src/lib/content/schemas.ts`, lookups in
   `frontend/src/lib/notes.ts` (both pure, zero Astro imports).
9. Enforcement split: per-entry rules (1, 5, 7, 8) are enforced by Zod schemas
   + `.refine` (via `defineCollection` in `content.config.ts`, checked at
   `astro sync`/build); cross-collection rules (2, 3, 4, 6) are enforced by pure
   `validateCollections()` in `frontend/src/lib/content/validate.ts` (returns
   errors naming the broken entry), executed by `frontend/scripts/check-content.ts`
   over `src/content/**/*.json` and wired as `prebuild` so the build fails.
   T007 targets `validateCollections()` for rules 2/3/4/6 — never asserts "the build"
   from a pure-module test — plus a content-integrity test over the real JSON.

## State transitions

Content is static — no lifecycle transitions. Client filter state machine:
`all → {major|minor|note} → all` (Story 3, acceptance #4). No backend state
machine in v1 (scaffold only).
