# Contract: Circles Explorer View (rework of 003 explorer)

**Feature**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17
**Spec**: [../spec.md](../spec.md) | **Research**: R4–R5 in [../research.md](../research.md) |
**Base contracts**: [003 routes](../../../003-ukulele-harmonic-circles/contracts/routes.md),
[005 routes](../../../005-ukulele-scales-topic/contracts/routes.md)

## Routes (Astro file-based, static — zero changes)

| Route                              | File                                              | Change in this feature              |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------- |
| `/`                                | `src/pages/index.astro`                           | none                                |
| `/courses/[course]`                | `src/pages/courses/[course].astro`                | none (no new cards)                 |
| `/courses/[course]/topics/[topic]` | `src/pages/courses/[course]/topics/[topic].astro` | none (branch + props shape unchanged) |
| `/courses/[course]/games/[game]`   | `src/pages/courses/[course]/games/[game].astro`   | none                                |
| unknown path/slug                  | `src/pages/404.astro`                             | none                                |

Rules:

- The `circles` branch keeps collecting lesson progressions and passing
  `{circles, chords}` to `CircleList`; the chords prop now carries 36
  entries with no code change (generic collection load).
- No new addresses: `/courses/ukulele/topics/circles` and
  `/courses/ukulele/topics/chords` keep their slugs (FR-001/FR-013).

## Circles explorer view contract (FR-001–FR-011, FR-015)

The explorer mirrors the Scales explorer pattern: breadcrumb
(Courses / Ukulele / Circles) + title + description, then the reworked
`CircleList` island — heading with count badge (24), grouped native
`<select>` dropdown (All circles / By type: Major, Minor / By note:
naturals, flats, sharps), and one card per circle (name, key with both
spellings where applicable, type, progression degrees + chord names).

Selecting a card opens a full-width focus view for that circle (list +
filter hidden):

- Header: circle name; key with both spellings where the pitch has two
  (e.g. "Key of Gb / F#"); key type (Major/Minor) (FR-005).
- Facts `<dl>`: progression degrees + chord names; scale notes in order
  from the spelling row (FR-006).
- Diatonic table (FR-007–FR-010): exactly seven rows in scale order; each
  row shows the degree label (`I ii iii IV V vi vii°` / `i ii° III iv v
  VI VII`), the scale-spelled note, the chord name, its `ChordDiagram`,
  and an in-circle marker iff the chord belongs to the progression. Rows
  whose spelling differs from catalog naming show both (note "Cb" +
  "B major" diagram, FR-009). Missing diagrams render the
  diagram-unavailable placeholder beside intact labels (never a crash).
- Neck reference (FR-011): `ScaleNeck` with the key's notes + root pitch
  (tones only, no order badges), same tonic-fill + spelling-from-notes
  presentation as Scales.
- A "← Back to all circles" button (first focusable element) and the
  Escape key return to the list with the filter selection preserved;
  opening and returning are keyboard-operable and AT-exposed (FR-004).

The island receives circles + chords as props and derives/filters/sorts
inline — no fetching.

## Chords explorer delta (FR-012–FR-013)

`ChordList` keeps its structure; the type filter gains "Diminished" (12
entries when selected, SC-003) and default order tiers major → minor →
diminished per pitch. Count badge reads 36.

## View-state contract (FR-015)

| State     | Trigger                             | UI requirement                                                                     |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `loading` | content resolving                   | visible loading indicator                                                          |
| `ready`   | topic resolved, ≥1 circle           | full explorer per above                                                            |
| `empty`   | zero circles, or zero filter matches| friendly message (shared ViewStates partial); filter-empty MUST offer a reset path |
| `error`   | load/render failure                 | error message + retry action; never a blank page or crash                          |

Notes:

- Static pages resolve at build; `loading`/`error` primarily guard the
  content pipeline and future remote loaders, same as 001/003/005.
- 360px: focus view (table, diagrams, neck) renders with no horizontal
  scrolling (SC-007); the diatonic table stacks to one column.
- The lesson, scales, and games views keep their exact behavior —
  V-regression in quickstart.md proves no regression.

## Cross-app contract

None — the feature makes zero backend calls (research R10), same as 001/003/005.
