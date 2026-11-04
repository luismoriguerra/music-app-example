# Quickstart: Rockstar UX Refresh

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/theme.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm (backend untouched — no Python/Docker needed for this feature).
- Fresh checkout with the `007-rockstar-ux-refresh` spec implemented.

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

### V1 — Rockstar identity (Story 1, P1)

1. Open `/`, `/courses/ukulele`, one explorer, the game, and the lesson.
   Expect: sticky header (identity + Courses nav + theme control),
   display headlines, one accent family, stage texture, footer — same
   system on all five pages.
2. Cycle the theme control dark → light → system. Expect: instant
   switch, persists across reload (localStorage `music-app-example:theme`),
   system tracks the OS preference; revisit shows no flash of the
   wrong appearance.
3. Inspect the Ukulele card visual. Expect: ukulele SVG badge — no
   electric-guitar emoji (FR-004).
4. Enable reduced-motion in the OS. Expect: glows/transitions render
   static; all content intact (FR-021).

### V2 — Discovery on any screen (Story 2, P2)

1. Open `/` and `/courses/ukulele` at 1280px. Expect: hero + balanced
   grids (5 course cards read evenly, no stranded-row feeling), kind
   labels on every course card.
2. Select each card by clicking its image/title/whitespace (not the
   button). Expect: destination opens (FR-007). Repeat by keyboard:
   one Tab stop per card, Enter opens, focus ring visible.
3. Resize to 360px. Expect: single column, no page sideways scroll,
   44px+ card targets (SC-004/SC-006).
4. Reachability (SC-001): Home → Ukulele → Chords = 2 selections ≤ 3.

### V3 — Game quick-start (Story 3, P3)

1. Open `/courses/ukulele/games/lyrics-chords` with empty history at
   1280px. Expect: explanation + ≥4 starter chips + side-by-side
   history/tips (no vast empty region); breadcrumb reads
   "Courses / Ukulele / Lyrics + Chords" (FR-011).
2. Select a starter. Expect: generation starts as if typed+submitted
   (SC-002 — 1 selection from landing).
3. Resize to 360px. Expect: input → action → starters → history stack,
   44px+ input/actions, no page sideways scroll.

### V4 — One-tap explorer filters (Story 4, P4)

1. Open each explorer (`chords`, `circles`, `scales`) at 1280px.
   Expect: visible pill row with counts ("All (36)" etc.), no
   dropdown; selecting any pill updates the list immediately (1
   selection, SC-003); "All" restores default order.
2. Open one entry, then go back. Expect: detail shows diagrams/info
   with a labeled back path; returning preserves filter + scroll
   position (FR-014).
3. Resize to 360px. Expect: scrollable pill row (reachable, labeled),
   44px+ pills/rows, no page sideways scroll.
4. Keyboard: Tab to pills, arrows move, Space selects; entries open
   with Enter; focus always visible (FR-020).

### V5 — Lesson + fretboard on mobile (Story 5, P5)

1. Open `/courses/ukulele/topics/harmonic-circles` at 360px. Expect:
   collapsed "In this chapter — N sections" control above lesson text
   (not a full list); expanding jumps to sections; current section
   cued (FR-015).
2. Scroll through chord figures. Expect: names + diagrams legible, no
   overlap at 360px+ (FR-016).
3. Open one scale detail + one circle detail at 360px. Expect: neck
   reference pans inside its frame with a visible swipe hint; page
   never scrolls sideways (FR-017/SC-004).
4. Tap audio/diagram/transpose controls one-handed. Expect: 44px+
   targets, reliable hits (SC-006).

### V6 — Audits + regression

1. Contrast audit (both appearances, all five surfaces): body ≥4.5:1,
   large/essential ≥3:1, zero failures (SC-005).
2. Touch audit (360px, primary flows): every target ≥44px smallest
   dimension, zero undersized (SC-006).
3. Keyboard-only core journey: catalog → course → explorer detail →
   back, game starter, lesson chapters, theme switch — all reachable,
   visibly focused, no traps (SC-007).
4. Timing: each refreshed view shows primary content ≤2s on broadband/
   4G, matching/beating baseline (SC-008).
5. Performance budgets (all five surfaces, both appearances, mid-tier
   phone 4G + desktop broadband): largest content element ≤2.5s
   (SC-010); layout shift ≤0.1 with no jumps under the pointer
   (SC-011); filter/theme/chapter interactions visibly respond ≤200ms
   (SC-012). Throttle the network and re-check V1–V5: headings, text,
   and navigation appear first and stay usable while secondary
   interactivity prepares (FR-024); hover/scroll a card, then select
   it — the destination lands instantly (FR-025).
6. Regression: every established address resolves (SC-009/FR-023);
   filter semantics, generation/history/analysis behavior, and all
   view-state behaviors unchanged; `pytest backend/` green.

## Done when

- V1–V6 pass, `npx vitest run` + `npm run check-content` + `npm run check`
  + `npm run lint` + `npm run format:check` green, `pytest backend/`
  green, 360px renders clean, audits zero-fail (contrast, touch, AND
  perf budgets), and no secrets committed.
