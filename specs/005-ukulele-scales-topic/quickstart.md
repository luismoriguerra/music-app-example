# Quickstart: Ukulele Scales Topic

**Feature**: `005-ukulele-scales-topic` | **Date**: 2026-09-16
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/routes.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm (backend untouched — no Python/Docker needed for this feature).
- Fresh checkout with the `005-ukulele-scales-topic` spec implemented.

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

1. Open `/courses/ukulele`. Expect: course title + "Topic — Chords",
   "Topic — Harmonic Circles", "Topic — Circles" cards followed by a
   "Topic — Scales" card with description, in that order.
2. Select the Scales card. Expect: navigation to
   `/courses/ukulele/topics/scales` showing the scale list.
3. Reachability (SC-001): Home → Ukulele card → Scales card =
   2 selections ≤ 3.

### V2 — Filter scales by type or note (Story 2, P2)

1. Open `/courses/ukulele/topics/scales` directly. Expect: breadcrumb,
   title, description, heading with count badge (24), grouped dropdown
   (All scales / Major, Minor / naturals, flats, sharps), and one card
   per scale (SC-004).
2. Pick "Major" in the dropdown. Expect: exactly the 12 major scales;
   pick "Minor". Expect: exactly the 12 minor scales; pick All.
   Expect: the full list restored (list updates within 2s, SC-002).
3. Pick "Bb" then "A#". Expect: both show the same combined
   "Bb / A#" entries (FR-004/FR-007).
4. Pick a note, then reselect All via the empty-state reset path when a
   filter matches nothing (if reachable). Expect: full list restored.

### V3 — Study notes and fingering (Story 3, P3)

1. Open any entry (e.g. "C major"). Expect: full-width focus view (list
   and filter hidden) showing type, root note, 8-note sequence with degree
   labels, interval pattern, a fretboard-chart diagram with 8 numbered dots
   in playing order + position label, and a 12-fret neck reference (FR-006).
2. Activate "Back to all scales". Expect: the full list is restored;
   reopen the entry and press Escape. Expect: the focus view closes and
   the list is restored (FR-006).
3. Spot-check "Db / C# minor". Expect: notes read C# D# E F# G# A B C#
   (conventional spelling, FR-008) — no double-flats anywhere in the list.
4. `npm run check-content` passes with zero errors (SC-005); then
   temporarily break one scale's note in a scratch copy and rerun.
   Expect: failure naming the entry + diverging degree (rule 25). Restore.
5. Resize to 360px wide with a scale detail open. Expect: diagram, neck,
   and notes fully visible, no horizontal scrolling (SC-008).
6. Keyboard: Tab to an entry, Enter/Space opens the focus view; Escape
   returns to the list; assistive tech exposes the open/close state
   (FR-006).

### V4 — Regression (catalog, chords, circles, 404, states)

1. Open `/`, `/courses/ukulele/topics/chords`,
   `/courses/ukulele/topics/harmonic-circles`, and
   `/courses/ukulele/topics/circles`. Expect: 001/003 behavior unchanged
   (cards, filters, inline detail, no audio).
2. Open `/courses/ukulele/topics/scales-typo`. Expect: 404 page with
   working link back to `/` (FR-013).
3. Scales empty state: temporarily point the route at a scales-less
   fixture (or empty array) in a scratch test. Expect: friendly empty
   message via the shared partial (FR-014). Restore.

## Done when

- V1–V4 pass, `npx vitest run` + `npm run check-content` + `npm run check`
  - `npm run lint` + `npm run format:check` green, `pytest backend/`
    green, scales list visible within 2s of navigation (SC-007), 360px
    render clean (SC-008), and no secrets committed.
