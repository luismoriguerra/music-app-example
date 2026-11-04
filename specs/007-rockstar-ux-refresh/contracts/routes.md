# Contract: Routes & View States (no-change + breadcrumb fix)

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
**Spec**: [../spec.md](../spec.md) | **Research**: R5 in [../research.md](../research.md) |
**Base contracts**: [001 routes](../../../001-music-course-catalog/contracts/routes.md),
[003 routes](../../../003-ukulele-harmonic-circles/contracts/routes.md),
[005 routes](../../../005-ukulele-scales-topic/contracts/routes.md),
[004 game route](../../../004-lyrics-chords-generator/contracts/game-route.md)

## Routes (Astro file-based, static — ZERO route changes, FR-023)

| Route | File | Change in this feature |
| ----- | ---- | ---------------------- |
| `/` | `src/pages/index.astro` | PRESENTATION ONLY: Hero + balanced full-card grid (same addresses out) |
| `/courses/[course]` | `src/pages/courses/[course].astro` | PRESENTATION ONLY: Hero + balanced full-card grid (same addresses out) |
| `/courses/[course]/topics/[topic]` | `src/pages/courses/[course]/topics/[topic].astro` | DIRECTIVES ONLY: explorer islands → on-visible hydration (branching intact; islands render refreshed UI, FR-024) |
| `/courses/[course]/games/[game]` | `src/pages/courses/[course]/games/[game].astro` | PRESENTATION + breadcrumb fix: fetch course title (the `[topic].astro` precedent) and render "Courses / {course} / {game}"; two-column shell for the game (FR-010/FR-011); `SheetGenerator` → on-visible hydration (FR-024) |
| unknown path/slug | `src/pages/404.astro` | STYLING ONLY: rockstar treatment, same behavior + link back |

Rules:

- `getStaticPaths()` untouched on every route — all established
  addresses resolve byte-identically (SC-009).
- Breadcrumb vocabulary: `Courses / {Course Title} / {Topic|Game Title}`
  on every topic and game view; the hardcoded "Course" breadcrumb label in `[game].astro` MUST
  be replaced with the real course title (FR-011). (The `[topic].astro` `<title>` fallback `?? "Course"` is untouched by this feature.)
- Reachability preserved: Home → course → topic/game ≤3 selections.

## View-state contract (FR-022 — behavior unchanged, styled)

| State | Trigger | UI requirement |
| ----- | ------- | -------------- |
| `loading` | content resolving | visible loading indicator (rockstar-styled) |
| `ready` | content resolved | refreshed view per components contract |
| `empty` | zero items / zero filter matches / no history | friendly rockstar message; filter-empty MUST offer a reset path; game-empty MUST show starters (FR-009) |
| `error` | load/render failure | error message + retry action; never a blank page or crash |
| `not-found` | unknown address | styled 404 identifying the missing content + link back to `/` |

## Cross-app contract

None — the feature makes zero backend calls; game/history/analysis APIs
are consumed unchanged by the existing islands.
