# Quickstart: Ukulele Circles — Diatonic Harmony Focus View

**Feature**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/circles-view.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm (backend untouched — no Python/Docker needed for this feature).
- Fresh checkout with the `006-ukulele-circles-diatonic` spec implemented.

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

### V1 — Study a circle's diatonic harmony (Story 1, P1)

1. Open `/courses/ukulele/topics/circles` directly. Expect: breadcrumb,
   title, description, heading with count badge (24), grouped dropdown
   (All circles / Major, Minor / naturals, flats, sharps), one card per
   circle showing name, key, type, degrees, chord names.
2. Select "Circle in C — the 50s progression". Expect: full-width focus
   view (list + filter hidden) showing the key (C, Major), progression
   I–vi–IV–V with chord names, scale notes C D E F G A B C, and a
   diatonic table with exactly seven rows — I C major, ii D minor,
   iii E minor, IV F major, V G major, vi A minor, vii° B diminished —
   each with a fingering diagram; C/Am/F/G rows marked in-circle, the
   other three not (SC-001).
3. Scroll down. Expect: 12-fret neck reference of the C-major tones with
   the tonic filled (FR-011).
4. Activate "← Back to all circles". Expect: the full list restored;
   reopen the circle and press Escape. Expect: the focus view closes and
   the list is restored with the prior filter intact (SC-008).
5. Open "Circle in Gb/F#". Expect: diatonic row 4 shows note "Cb" with
   the "B major" diagram (FR-009) — never blank.
6. Resize to 360px wide with a focus view open. Expect: table, diagrams,
   and neck fully visible, no horizontal scrolling (SC-007).
7. Keyboard: Tab to a card, Enter/Space opens the focus view; Escape
   returns; assistive tech exposes the open/close state (FR-004).

### V2 — Filter circles by type or note (Story 2, P2)

1. Pick "Major" in the dropdown. Expect: exactly the 12 major circles;
   pick "Minor". Expect: exactly the 12 minor circles; pick All.
   Expect: the full list restored in pitch-then-name order (list updates
   within 2s, SC-006).
2. Pick "Gb" then "F#". Expect: both show the same circle(s) for that
   pitch; repeat for "Bb"/"A#" (FR-002/SC-004).
3. Filter to a combination with no matches (if reachable via crafted
   state) or verify the empty-state copy in tests. Expect: "no matching
   circles" message with a reset path (FR-015).

### V3 — Diminished chords in the Chords reference (Story 3, P3)

1. Open `/courses/ukulele/topics/chords`. Expect: 36 entries; the type
   filter offers Major, Minor, Diminished (SC-003).
2. Pick "Diminished". Expect: exactly the 12 diminished entries
   (e.g. "B diminished", "Bb / A# diminished"), each opening to a
   fingering diagram.
3. Spot-check default order for one pitch (e.g. C major, C minor,
   C diminished adjacent in that tier order) (FR-013).

### V4 — Minor-key circles (Story 4, P4)

1. Filter the Circles view to "Minor". Expect: exactly 12 minor-key
   circles, one per minor scale key (FR-016).
2. Open the A-minor circle. Expect: seven rows — i A minor, ii° B
   diminished, III C major, iv D minor, v E minor, VI F major, VII G
   major — with the i–VI–III–VII chords marked in-circle, plus A-minor
   scale notes and neck reference.

### V5 — Content gate (FR-014/SC-005)

1. `npm run check-content` passes with zero errors on the shipped tree.
2. In a scratch copy: (a) change one progression chord to a non-diatonic
   name and rerun — expect failure naming the circle + chord (rule 29);
   (b) corrupt one diminished diagram fret and rerun — expect failure
   naming the entry (rule 28); (c) delete one chord file and rerun —
   expect the exact-36 failure (rule 4). Restore after each.

### V6 — Regression (catalog, lesson, scales, 404, states)

1. Open `/`, `/courses/ukulele/topics/chords`,
   `/courses/ukulele/topics/harmonic-circles`, and
   `/courses/ukulele/topics/scales`. Expect: 001/003/005 behavior
   unchanged except the specified deltas (36 chords, new lesson
   sections, reworked circles explorer).
2. Open `/courses/ukulele/topics/circles-typo`. Expect: 404 page with
   working link back to `/`.
3. Task-based check (SC-002): ask 5 first-time learners to "find the
   diminished chord in the key of G" — at least 4 name "F# diminished"
   from the G-circle table unaided.

## Done when

- V1–V6 pass, `npx vitest run` + `npm run check-content` + `npm run check`
  + `npm run lint` + `npm run format:check` green, `pytest backend/`
  green, list + focus render within 2s (SC-006), 360px render clean
  (SC-007), and no secrets committed.
