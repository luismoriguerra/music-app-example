# Data Model: Rockstar UX Refresh

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. Storage: Astro Content Layer collections (typed JSON,
Zod-validated at build) — model extends 001/003/005 unchanged except the
documented `cover` key semantics — plus device-only theme preference.
Field contracts: [contracts/theme.md](./contracts/theme.md),
[contracts/routes.md](./contracts/routes.md),
[contracts/components.md](./contracts/components.md).

## Collections & entities

### Course (`courses`) — SEMANTICS CLARIFIED (no schema change)

`cover` stays `z.string().optional()` (no migration). This feature fixes
its *meaning*: known visual keys map to bundled SVG marks; anything else
renders as today (emoji/initial fallback).

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `title` | string | yes | 1–80 chars, e.g. `"Ukulele"` |
| `slug` | string | yes | `slugify(title)`, unique |
| `description` | string | yes | 1–280 chars (catalog card text) |
| `cover` | string | no | Visual key; `"ukulele"` renders the ukulele SVG badge; unknown values fall back to initial letter (unchanged behavior) |
| `order` | number | no | sort key, default 0 |

Ships with one edit: Ukulele `cover`: `"🎸"` → `"ukulele"`
(FR-004 — no more electric-guitar-for-ukulele).

### Topic / Game / Chord / Scale (`topics`, `games`, `chords`, `scales`) — UNCHANGED

No field, count, or validation change. Filter option sets, default
orderings, enharmonic-combined identity, and diagram shapes stay exactly
as specified in 001/003/005/006 — pills (R4) re-present the same options.

### ThemePreference (device-only, NEW)

The learner's appearance choice. Persisted in `localStorage`, never sent
anywhere (spec: no accounts, device-only).

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `preference` | enum | yes | `"dark"` \| `"light"` \| `"system"`; default `"dark"` |
| `storageKey` | literal | yes | MUST be `"music-app-example:theme"` (single key, shared by init script + island) |
| `effective` | derived | — | `"dark"` when preference is `"dark"`, or `"system"` with `prefers-color-scheme: dark`; else `"light"` |

### QuickStartSuggestion (derived constant, NEW)

Example songs on the game view (`lib/sheets/starter-songs.ts`,
`STARTER_SONGS: readonly string[]`, ≥4 entries). Not content —
a curated code constant (no schema, no collection).

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `query` | string | yes | 1–200 chars (matches the generator input limits), non-blank, unique; ukulele-friendly well-known songs generatable by the existing pipeline |

### FilterPillGroup (derived view-model, NEW)

One-tap presentation of an explorer's existing filter options. Derived at
render time from the pure filter modules — nothing persisted.

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `value` | string | yes | MUST be a valid `FilterOption`/`CircleFilter`/`ScaleFilterOption` of the owning explorer |
| `label` | string | yes | Human label from the existing `FILTER_GROUPS` (e.g. "Major", "Bb") |
| `count` | int | yes | Entries matching `value` (≥0; "All" equals collection size) |
| `selected` | boolean | yes | Exactly one `true` per group (single-select preserved) |

## Derived / UI state (not persisted)

- **Theme init**: SSR defaults `<html class="dark">`; blocking script in `Layout.astro` reads `storageKey`
  (missing → `"dark"`) → applies/removes `.dark` before first paint (no flash); the
  `ThemeToggle` island owns subsequent changes (FR-003).
- **Discovery grids**: `auto-rows-fr` + `h-full` cards balance uneven
  counts (FR-008); stretched-link anchor makes the whole card one link
  (FR-007).
- **Explorer filter**: pill selection → existing `filterX`/`sortX` →
  list + counts re-render; detail closes; "All" restores default order
  (FR-013/FR-014).
- **Game quick-start**: starter select → same `submit(query)` path as
  typed input (FR-009); `lg:` grid composes input/results beside
  history/tips (FR-010).
- **Lesson chapters**: mobile `<details>` (collapsed) + desktop sticky
  aside; `:target` + `aria-current` cue the current section (FR-015).
- **Neck frame**: `overflow-x-auto` + `min-w-[640px]` child + swipe hint;
  page never scrolls sideways (FR-017).
- **View states** (FR-022): `loading` → `ready` | `empty` | `error`
  behavior unchanged; `ViewStates` + 404 adopt rockstar styling only.
- **Hydration timing** (FR-024): explorer + generator islands hydrate
  on-visible; theme toggle hydrates on-idle; every island ships a
  readable SSR shell (content first, interactivity second).
- **Navigation intent** (FR-025): internal links prefetch on hover +
  viewport intent (destinations prepare before selection).
- **Layout stability** (FR-026/FR-027): heroes, grids, pill rows,
  figures, and neck frames reserve space; decorative art never blocks
  primary content.

## Validation rules (build + test)

Schemas (`defineCollection`, checked at `astro sync`/build):

- No schema change. Rules 1–29 from 001/003/005/006 still hold verbatim.

Cross-collection (`validateCollections()`, `prebuild` gate):

- No new rules. The Ukulele `cover` value `"ukulele"` is covered by the
  existing optional-string rule; the badge-key map is tested in unit
  tests, not the content gate (presentation, not content integrity).

UI-behavior rules (Vitest + quickstart audits, NEW):

- T1. `STARTER_SONGS` has ≥4 unique non-blank queries, each 1–200 chars.
- T2. Pills render every option of the owning explorer's `FILTER_GROUPS`
  with correct counts; exactly one selected; selection calls `onChange`
  with a valid filter value.
- T3. Theme helpers: default preference const is `"dark"` (`null` stored → dark);
  stored `system`+dark-media → dark, `system`+light-media → light; explicit wins; key exact.
- T4. Touch audit: primary targets ≥44px smallest dimension on phone
  viewports (SC-006) — class sweep + quickstart measurement.
- T5. Contrast audit: body ≥4.5:1, large/essential ≥3:1, both
  appearances, zero failures on primary flows (SC-005).
- T6. Routes: all established addresses resolve (FR-023) — container +
  quickstart regression.
- T7. Performance budgets (quickstart V6 measurement): largest content
  element ≤2.5s on mid-tier-phone 4G (SC-010); layout shift ≤0.1 on
  primary flows (SC-011); filter/theme/chapter interactions visibly
  respond ≤200ms (SC-012) — all five surfaces, both appearances.
- T8. Deferral markers (container tests): explorer + generator islands
  carry on-visible hydration, the theme toggle on-idle, primary nav
  links prefetch opt-in, and heroes/cards/diagrams reserved-space
  classes (FR-024–FR-027).
