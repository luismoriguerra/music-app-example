# Quickstart: Ukulele Harmonic Circles Topic

**Feature**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/routes.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm (backend untouched — no Python/Docker needed for this feature).
- Fresh checkout on branch `003-ukulele-harmonic-circles`.

## Setup

```bash
cd frontend && npm install && cd ..
```

## Run

```bash
# Terminal 1 — frontend
cd frontend && npm run dev      # → http://localhost:4321
```

## Test

```bash
cd frontend && npx vitest run   # frontend unit tests (Principle III)
cd frontend && npm run check-content  # content integrity gate (also runs as prebuild)
cd frontend && npm run check && npm run lint && npm run format:check  # type-check + lint/format (Principle VIII)
pytest backend/                        # backend suite stays green (no backend change)
```

## Validation scenarios (map 1:1 to user stories)

### V1 — Discover and open the topic (Story 1, P1)

1. Open `/courses/ukulele`. Expect: course title + "Topic — Chords" card
   followed by "Topic — Harmonic Circles" and "Topic — Circles" cards
   with descriptions, in that order.
2. Select the Harmonic Circles card. Expect: navigation to
   `/courses/ukulele/topics/harmonic-circles` showing the lesson title.
3. Reachability (SC-001): Home → Ukulele card → Harmonic Circles card =
   2 selections ≤ 3.

### V2 — Read the lesson as book material (Story 2, P2)

1. Open the lesson view. Expect: breadcrumb, title, description, intro
   paragraphs, ≥4 headed sections in reading order, closing summary —
   continuous prose, single readable column.
2. Resize to 360px wide. Expect: no horizontal scrolling, all headings
   visible in order (SC-005).
3. Content audit (SC-003): count ≥3 complete harmonic circles; every
   circle lists its chords in playing order with scale degrees.

### V3 — Play along with progression diagrams (Story 3, P3)

1. In each progression block: Expect: every chord shows its name and
   fingering diagram inline (FR-005).
2. Cross-check one diagram per progression against the Chords view
   (`/courses/ukulele/topics/chords`, same chord name). Expect: identical
   fingering (acceptance #2).
3. `npm run check-content` passes with zero errors (SC-004); then
   temporarily break one lesson chord name in a scratch copy and rerun.
   Expect: failure naming topic + progression + chord (FR-008). Restore.

### V5 — Browse circles with the key filter (Story 4, P2)

1. Open `/courses/ukulele/topics/circles` directly. Expect: breadcrumb,
   title, description, heading with count badge, dropdown (All + all 12 keys — C, Db, D, Eb, E, F, F#, G, Ab, A,
   Bb, B), and one card per lesson circle (name, key, degrees, chord
   names); count equals the lesson's progression count (SC-007).
2. Pick "C" in the dropdown. Expect: exactly the C circle; pick All.
   Expect: the full list restored.
3. Expand a circle. Expect: every chord shows its name + diagram
   matching the Chords view; expanding another collapses the first;
   reselect collapses.
4. Resize to 360px. Expect: no horizontal scrolling. Empty/error
   states (zero circles, unmatched filter + reset, error + retry) are
   covered by the island tests.

### V4 — Regression (catalog, chords, 404, states)

1. Open `/` and `/courses/ukulele/topics/chords`. Expect: 001 behavior
   unchanged (cards, grouped filter, inline detail, no audio).
2. Open `/courses/ukulele/topics/scales`. Expect: 404 page with working
   link back to `/` (FR-010).
3. Lesson empty state: temporarily point the route at a lesson-less
   fixture (or empty sections array) in a scratch test. Expect: friendly
   empty message via the shared partial (FR-009). Restore.

## Done when

- V1–V5 pass, `npx vitest run` + `npm run check-content` + `npm run check`
  + `npm run lint` + `npm run format:check` green, `pytest backend/`
  green, lesson content visible within 2s of navigation (SC-002), and no
  secrets committed.
