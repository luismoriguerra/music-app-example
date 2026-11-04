# Data Model: Ukulele Lyrics + Chords Generator

**Feature**: `004-lyrics-chords-generator` | **Date**: 2026-09-16
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage is split by kind: Postgres tables for generated
sheets + history (server-side, single-owner, FR-008/FR-011), Astro Content
Layer for the one static Game entry. Field contracts:
[contracts/rest-api.md](./contracts/rest-api.md) (wire shapes, mirrored by
Zod in `frontend/src/lib/sheets/schemas.ts` and Pydantic in
`backend/app/routes_sheets.py`),
[contracts/game-route.md](./contracts/game-route.md) (content entry + route).

## Postgres tables (SQLAlchemy, same database as AgentOS state)

### `song_sheets` — one immutable generated sheet per completed generation

| Field | Type | Required | Validation |
|---|---|---|---|
| `id` | uuid (pk) | yes | server-generated v4 |
| `owner_id` | text | yes | MUST equal `OWNER_ID` (`"owner"` default, env override permitted, R10); keeps the multi-user door open |
| `query` | text | yes | 1–200 chars, trimmed (the submitted song name) |
| `matched_title` | text | yes | 1–200 chars (title as found) |
| `matched_performer` | text | yes | 1–200 chars (performer as found) |
| `provider_refs` | jsonb | yes | provider identities, e.g. `{"lrclib_id": 969429, "genius_id": 123, "chart_url": "https://…"}`; at least the lyric ref present |
| `lyric_source` | text | yes | enum-ish: `chart` \| `lrclib` \| `lyrics_ovh` |
| `lyric_source_url` | text | yes | https link-back for FR-012 `lyrics:` label |
| `chord_source` | text | yes | enum-ish: `chart` \| `model-generated` \| `none` (`none` = lyrics-only, first-class per H1 + deadline skip) |
| `chord_source_url` | text | no | https link-back for FR-012 `chords:` label; NULL when `model-generated` or `none` |
| `model_id` | text | no | exact model ID + provider route; REQUIRED iff `chord_source = 'model-generated'`, NULL otherwise (R6 provenance) |
| `body` | jsonb | yes | structured sheet (see below); ≥1 section, ≥1 lyric line |
| `source_links` | jsonb | yes | FR-016 list, ≤8 items: `[{label, url, kind}]`, `kind` ∈ `lyrics` \| `chords` \| `video`; deduped against attribution URLs (R7) |
| `degraded` | jsonb | yes | `[]` on full sheets, else `[{part, reason}]` (`part` `video`/`chords`, `reason` `quota`/`timeout`/`unavailable` per contracts/rest-api.md; persisted so re-open renders the same notice) |
| `capo` / `tuning_note` | text | no | carried from chart when present (informational; no transposition ships) |
| `created_at` | timestamptz | yes | server clock, default now() |

Relationships: referenced by `history_entries.sheet_id`. Immutable after
insert — regenerate creates a NEW sheet, never updates (R7 no-requery rule
depends on this).

### Sheet `body` shape (shared by chart path and fallback path)

```jsonc
{ "sections": [
  { "heading": "Chorus",            // nullable; chart markers preserved as-is (R11)
    "lines": [
      { "text": "Lady, runnin' down to the riptide",
        "chords": [ {"offset": 0, "symbol": "Em"}, {"offset": 11, "symbol": "Dadd9"} ] }
    ] }
] }
```

Rules: `offset` = UTF-16 code-unit index into `text` (frontend renders
chords above lyrics by offset); `symbol` = standard Western notation incl.
full FR-013 vocabulary; lines with zero chords are legal (edge case:
lyrics-only lines render), and a body with zero chords on EVERY line is
legal only as `chord_source: 'none'` (lyrics-only, rule 2). The chart
parser (R0 hit path) and the model
fallback (R0 miss path, R6) MUST both emit exactly this shape.

### `history_entries` — one row per completed search (FR-008), newest first

| Field | Type | Required | Validation |
|---|---|---|---|
| `id` | uuid (pk) | yes | server-generated v4 |
| `owner_id` | text | yes | MUST equal `OWNER_ID` (same rule as sheets) |
| `query` | text | yes | 1–200 chars (echo of the submitted song name) |
| `matched_title` | text | yes | denormalized for list rendering without joining |
| `matched_performer` | text | yes | denormalized for list rendering without joining |
| `sheet_id` | uuid (fk → `song_sheets.id`) | yes | the generated sheet; RESTRICT on delete (delete removes the entry first, then its sheet when unreferenced) |
| `favorite` | boolean | yes | default `false`; the only mutable column (FR-018 PATCH) |
| `created_at` | timestamptz | yes | server clock; list order key (DESC, FR-009) |

No update-in-place beyond the FR-018 `favorite` flag: searching the same song twice yields two entries (each
completed search is stored, FR-008). Regenerate (FR-010) creates a NEW sheet
+ NEW entry pointing at it — the prior entry is preserved. The only removal
path is the confirmed FR-009 delete (entry + orphaned sheet). Dedup/identity key for "same song" reasoning (plan
default): normalized `matched_title + matched_performer` (lowercase,
punctuation/whitespace folded) — used for candidate merging (R3), never to
collapse history rows.

## Content Layer (static JSON — delta on 001, see contracts/game-route.md)

### Game entry `games/lyrics-chords.json`

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | `"Lyrics + Chords"` |
| `slug` | string | yes | `"lyrics-chords"`, unique within ukulele's games (existing rule 2) |
| `kind` | literal | yes | MUST be `"game"` |
| `courseSlug` | string | yes | MUST be `"ukulele"` (existing rule 3) |
| `description` | string | yes | 1–280 chars (FR-001 card text) |
| `rules` | string | yes | usage text (how a generation works); 001 requires `rules` before any game ships |
| `order` | number | yes | after the Chords/Harmonic Circles topics on the course page |

No other content changes: courses/topics/chords untouched; 001 validation
rules 1–9 unchanged, game rules 2–3 cover the new entry.

## Derived / UI state (not persisted)

- **Candidate** (transient, search → pick): `{title, artist, album?,
  artwork_url?, provider_refs}` — echoed back by the frontend on generate
  (contracts/rest-api.md); never stored except inside the resulting sheet's
  `provider_refs` + matched fields.
- **View states** per view (FR-014): `loading → ready | empty | error`;
  error MUST offer retry; empty states per spec (no-match, no history, no
  external sources).
- **Sheet render model**: `body` sections in order; chord symbols as text
  above `offset`; symbols matching the 24-entry catalog link to the Chords
  topic (R11 plan detail).

## Validation rules (backend + tests)

1. Every `song_sheets` row has ≥1 section, ≥1 lyric line; every chord
   `offset` is within its line; every `symbol` parses as Western notation.
2. `chord_source` three-way: `'model-generated'` ⟺ `model_id` present AND
   `chord_source_url` NULL; `'chart'` ⟺ URL present AND `model_id` NULL;
   `'none'` (lyrics-only) ⟺ BOTH NULL. `chord_source = 'none'` ⟹ `degraded`
   contains a `{part: 'chords', reason: 'timeout'|'unavailable'}` entry
   (`timeout` = deadline skip, `unavailable` = key absent or chords
   unrecoverable after the search+model attempt) and `body` carries zero
   chords on every line; the frontend keys the chords-missing notice off
   `chord_source == 'none'` (the `degraded` chords entry carries the reason).
3. `lyric_source_url` always present (FR-012 link-back is unconditional).
4. `source_links` ≤ 8, all https, no duplicates, none equal to an
   attribution URL.
5. Every `history_entries.sheet_id` resolves to a sheet (FK); list order is
   `created_at DESC`.
6. `owner_id` on every row equals `OWNER_ID` (single-owner invariant,
   FR-011) — enforced at insert, asserted in tests.
7. The only UPDATE path is the `history_entries.favorite` flag (FR-018):
   sheets are immutable (regenerate inserts a non-favorite entry; history
   re-open reads stored rows only — R7). The sole DELETE path removes one
   history entry plus its sheet when unreferenced (FR-009).
8. Game entry rules ride the existing `validateCollections()` + `prebuild`
   gate (no new content tooling).
9. Every `degraded` entry has `part` in `video`/`chords` and `reason` in
   `quota`/`timeout`/`unavailable`; `[]` on full sheets (contracts/rest-api.md).
