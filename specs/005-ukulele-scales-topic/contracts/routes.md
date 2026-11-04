# Contract: Scales Routes & View States (delta on 001/003)

**Feature**: `005-ukulele-scales-topic` | **Date**: 2026-09-16
**Spec**: [../spec.md](../spec.md) | **Research**: R3 in [../research.md](../research.md) |
**Base contracts**: [001 routes](../../../001-music-course-catalog/contracts/routes.md),
[003 routes](../../../003-ukulele-harmonic-circles/contracts/routes.md)

## Routes (Astro file-based, static — one branch added)

| Route                              | File                                              | Change in this feature                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                | `src/pages/index.astro`                           | none                                                                                                                                                                     |
| `/courses/[course]`                | `src/pages/courses/[course].astro`                | none (new card flows from content; order after Circles via `order: 3`)                                                                                                   |
| `/courses/[course]/topics/[topic]` | `src/pages/courses/[course]/topics/[topic].astro` | **branch on `topic.format === "scales"`**: collect the topic's scales + render the `ScaleList` island (`client:load`); `reference`/`lesson`/`circles` branches unchanged |
| `/courses/[course]/games/[game]`   | `src/pages/courses/[course]/games/[game].astro`   | none                                                                                                                                                                     |
| unknown path/slug                  | `src/pages/404.astro`                             | none (FR-013)                                                                                                                                                            |

Rules:

- Dispatch is data-driven on `topic.format` (R3). No slug conditionals
  in views — a future scales-like topic needs only content, no code.
- `getStaticPaths()` is unchanged (all topics enumerate); the new topic
  yields `/courses/ukulele/topics/scales` (FR-002, SC-001).
- Reachability: Home → course → scales in ≤3 selections (SC-001).

## Scales explorer view contract (FR-003–FR-011, FR-015)

The scales explorer mirrors the Chords explorer pattern: breadcrumb
(Courses / Ukulele / Scales) + title + description, then the `ScaleList`
island — heading with count badge, grouped native `<select>` dropdown (All
scales / By type: Major, Minor / By note: naturals, flats, sharps), and one
card per scale (display name). Opening a card shows a full-width focus view
for that scale (list + filter hidden): the scale's type, root note, note
sequence with degree labels, interval pattern, the `ScaleDiagram` fretboard
chart (numbered playing order, open-string marks, position label), and the
`ScaleNeck` 12-fret reference; a Back button and the Escape key return to
the list with filter state preserved.
Missing diagrams render a diagram-unavailable placeholder beside intact
notes/degrees (FR-015). Empty (no scales, or no matches with a "Show all"
reset) and error (message + retry) states mirror the Chords explorer. The
island receives the scales as props and filters/sorts inline — no fetching.

## View-state contract (FR-014)

| State     | Trigger                             | UI requirement                                                                     |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `loading` | content resolving                   | visible loading indicator                                                          |
| `ready`   | topic resolved, ≥1 scale            | full explorer per above                                                            |
| `empty`   | zero scales, or zero filter matches | friendly message (shared ViewStates partial); filter-empty MUST offer a reset path |
| `error`   | load/render failure                 | error message + retry action; never a blank page or crash                          |

Notes:

- Static pages resolve at build; `loading`/`error` primarily guard the
  content pipeline and future remote loaders, same as 001/003.
- The Chords (`reference`), lesson, and circles explorers keep their exact
  behavior — V-regression in quickstart.md proves no regression.

## Cross-app contract

None — the feature makes zero backend calls (research R5), same as 001/003.
