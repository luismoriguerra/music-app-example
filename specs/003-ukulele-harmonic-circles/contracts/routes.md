# Contract: Lesson Routes & View States (delta on 001)

**Feature**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15
**Spec**: [../spec.md](../spec.md) | **Research**: R3 in [../research.md](../research.md) |
**Base contract**: [001 routes](../../../001-music-course-catalog/contracts/routes.md)

## Routes (Astro file-based, static — one branch added)

| Route | File | Change in this feature |
|---|---|---|
| `/` | `src/pages/index.astro` | none |
| `/courses/[course]` | `src/pages/courses/[course].astro` | none (new card flows from content; order after Chords via `order: 1`) |
| `/courses/[course]/topics/[topic]` | `src/pages/courses/[course]/topics/[topic].astro` | **branch on `topic.format`**: `reference` → chord-explorer island (unchanged); `lesson` → static lesson reader (zero client JS); `circles` → circles-explorer island (new, `client:load`, FR-012/FR-013) |
| `/courses/[course]/games/[game]` | `src/pages/courses/[course]/games/[game].astro` | none (still reserved) |
| unknown path/slug | `src/pages/404.astro` | none (FR-010) |

Rules:
- Dispatch is data-driven on `topic.format` (R3). No slug conditionals
  in views — a future lesson topic needs only content, no code.
- `getStaticPaths()` is unchanged (all topics enumerate); the new topics
  yield `/courses/ukulele/topics/harmonic-circles` (FR-002, SC-001) and
  `/courses/ukulele/topics/circles` (FR-012).
- Reachability: Home → course → lesson in ≤3 selections (SC-001).

## Lesson view contract (FR-003–FR-006, FR-009)

The lesson reader renders, in order: breadcrumb (Courses / Ukulele /
Harmonic Circles), lesson title, description, intro paragraphs, one block
per section (heading + paragraphs + progression blocks), closing summary.

- Prose: Markdown → HTML at build time (`renderProse`), emitted via
  `set:html`; semantic `<h2>`/`<p>`/`<ul>` hierarchy; single readable
  column (~65ch), no horizontal scroll at 360px (SC-005).
- Progression block: progression name, key + scale degrees (e.g.
  I–vi–IV–V), and one inline diagram per chord (name + fingering diagram
  from the resolved Chords entry — FR-005), reused `ChordDiagram`
  rendering statically (no hydration).
- Chord detail: diagrams render read-only inline; no expansion, no audio.

## Explorer view contract (FR-012–FR-013)

The circles explorer mirrors the Chords explorer pattern: breadcrumb +
title + description, then the `CircleList` island — heading with count
badge, native `<select>` dropdown (All + one option per key present),
and one card per circle (name, key + scale degrees, chord names).
Expanding a card (at most one open) shows each chord's name + inline
`ChordDiagram` from the resolved Chords entry; reselect collapses;
filter change resets expansion. Empty (no circles, or no matches with a
"Show all" reset) and error (message + retry) states mirror the Chords
explorer. Entries derive from lesson progressions at page-frontmatter
time; the island receives the circles plus the Chords reference as
props and resolves inline — no fetching.

## View-state contract (FR-009, lesson view)

| State | Trigger | UI requirement |
|---|---|---|
| `loading` | content resolving | visible loading indicator |
| `ready` | chapter resolved, ≥1 section | full chapter per above |
| `empty` | zero sections | friendly message (shared ViewStates partial) |
| `error` | load/render failure | error message + retry action; never a blank page or crash |

Notes:
- Static pages resolve at build; `loading`/`error` primarily guard the
  content pipeline and future remote loaders, same as 001.
- The Chords explorer (`format: "reference"`) keeps its exact 001
  behavior — V-regression in quickstart.md proves no regression.

## Cross-app contract

None — the feature makes zero backend calls (research R5), same as 001.
