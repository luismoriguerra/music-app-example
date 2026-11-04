# Contract: Routes & View States

**Feature**: `001-music-course-catalog` | **Date**: 2026-09-15
**Spec**: [../spec.md](../spec.md) | **Research**: R4 in [../research.md](../research.md)

## Routes (Astro file-based, static)

| Route | File | Params | Content source |
|---|---|---|---|
| `/` | `src/pages/index.astro` | — | `courses` collection (FR-001) |
| `/courses/[course]` | `src/pages/courses/[course].astro` | `course` = `courses.slug` | course + its topics + games (FR-003) |
| `/courses/[course]/topics/[topic]` | `src/pages/courses/[course]/topics/[topic].astro` | `course`, `topic` = `topics.slug` | topic + its chords for `chords` (FR-007) |
| `/courses/[course]/games/[game]` | `src/pages/courses/[course]/games/[game].astro` | `course`, `game` = `games.slug` | reserved — no game ships in v1 |
| unknown path/slug | `src/pages/404.astro` | — | not-found page + link to `/` (FR-014, SC-006) |

Rules:
- `getStaticPaths()` enumerates every route from collections; unknown slugs
  MUST render `404.astro`, never a blank page or crash.
- Card entry actions: course card → `/courses/[course]` (FR-002);
  topic/game card → its topic/game route (FR-004).
- Reachability: Home → course → Chords in ≤3 selections (SC-001).

## View-state contract (FR-016, every view)

Each view MUST implement all four states:

| State | Trigger | UI requirement |
|---|---|---|
| `loading` | content resolving | visible loading indicator |
| `ready` | content resolved, non-empty | full content per FR-001/003/007 |
| `empty` | zero items / zero filter matches | friendly message + recovery (FR-013; Chords: dropdown reset) |
| `error` | load/render failure | error message + retry action; list MUST NOT crash on a
| | | single bad entry (chord placeholder path per edge case) |

Notes:
- Static pages resolve at build; `loading`/`error` primarily exercise the
  hydrated Chords island (filter + detail) and future remote loaders.
- Chord detail display (FR-010): entry expands in place showing name, type,
  root, diagram — single-open, reselect collapses, keyboard-operable with
  exposed expanded state; no audio in v1.

## Cross-app contract (v1)

None — the feature makes zero backend calls (research R5). If a future
feature adds backend traffic, its plan MUST define the REST/MCP contract
before parallel frontend/backend implementation (constitution II).
