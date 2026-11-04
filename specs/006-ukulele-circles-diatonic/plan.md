# Implementation Plan: Ukulele Circles — Diatonic Harmony Focus View

**Branch**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ukulele-circles-diatonic/spec.md`

## Summary

Rework the Circles explorer to Scales-topic parity and teach full diatonic
harmony: the 12 major circles gain a grouped All/by-type/by-note filter and a
full-width focus view showing the key's scale notes, a seven-row diatonic
chord table (degree, chord, curated diagram, in-circle marking), and the
key's 12-fret neck reference. The Chords reference grows 24 → 36 with
curated diminished triads for all 12 pitches, and 12 canonical minor-key
circles (i–VI–III–VII) join the explorer for 24-key parity with Scales.
Technical approach (from research): diatonic rows are purely derived from
the Scales `SPELLING_TABLE` plus fixed triad-quality vectors, resolved to
the Chords catalog by pitch class (never by name, so Gb-major "Cb" resolves
to "B major"); `progressionSchema` gains a defaulted `type` field
(major/minor) so the 12 existing major progressions parse untouched; the
`CircleList` island is reworked onto the `ScaleList` focus-view skeleton and
reuses `ScaleNeck` unchanged; two new content-gate rules enforce chord
pitch agreement and progression-to-diatonic membership. No new collections, no
new routes, no backend changes; 001/003 spec amendments land via converge
(FR-017/FR-018).

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 7.x, React 19 islands — one
reworked island: `CircleList`; one extended: `ChordList`)

**Primary Dependencies**: `astro@7`, `zod` (schemas), Tailwind CSS v4 +
shadcn theme tokens (existing), ESLint + Prettier
(`eslint-plugin-astro`/`prettier-plugin-astro`); no new dependencies

**Storage**: N/A for feature data (static Content Layer collections,
extends 001/003/005)

**Testing**: Vitest + Testing Library + `experimental_AstroContainer`
(frontend); pytest regression-only (backend untouched)

**Target Platform**: Web — static frontend (Astro static output)

**Project Type**: Web application (frontend-only change; backend untouched)

**Performance Goals**: Circles list and circle focus view render within 2s
of navigation/selection on broadband/4G (SC-006; effectively instant —
client-side derivation over ≤36 catalog entries + 24 circles)

**Constraints**: Standard ukulele tuning GCEA; English-only copy; triads
only (major/minor/diminished, no sevenths); natural minor only; curated
diagrams for all 36 chords; readable at 360px with no horizontal scroll
(SC-007); keyboard-operable + AT-exposed open/close; no secrets in repo

**Scale/Scope**: 12 new chord entries + 12 new minor progressions in the
existing lesson (content); `chordSchema` type enum +1, `progressionSchema`
+1 defaulted field; Rule 4 amended (24→36) + Rules 28–29 new; `CircleList`
rework + `chords.ts`/`ChordList` diminished extension; 001 + 003 spec
amendments via converge

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                       | Status       | Notes                                                                                                                                                                                                               |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-driven (MUST phases)    | PASS         | specify done (0 markers); plan now; tasks → analyze → implement → converge to follow; analyze WILL run per spec Assumptions (cross-artifact footprint: 001/003 amendments, 24→36 contract change); no clarify needed |
| II. Monorepo boundaries         | PASS         | App code only under `frontend/`; specs under `specs/`; zero backend changes, zero cross-app calls                                                                                                                   |
| III. Test-first both apps       | PASS         | Vitest (schemas, derivation, filter/sort, validate additions, islands, container, content-integrity) written alongside per tasks; pytest suite untouched and must stay green                                         |
| IV. Agent evals                 | N/A          | No agents ship or change — no test-scenarios required                                                                                                                                                               |
| V. Evidence-based models        | N/A (record) | No hosted inference; research R11 is the decision record, no `openrouter-model-eval` run needed                                                                                                                     |
| VI. Browser AI                  | N/A (compat) | No browser AI; static content + filter/focus island — nothing to degrade                                                                                                                                            |
| VII. Backend runtime + Postgres | PASS         | `backend/` untouched; no state, no endpoints, no auth surface change                                                                                                                                                |
| VIII. Clean code & architecture | PASS         | Pure `lib/` derivation + schemas (zero Astro imports) → presentational islands → thin route (unchanged); `circles.ts` may import `scales.ts`/`notes.ts` (pure→pure, no cycle); ESLint+Prettier green before merge  |
| Tech Constraints & Standards    | PASS         | Astro+TS+Tailwind v4+Vitest; zero new deps; secrets via env only (none needed)                                                                                                                                      |
| Workflow gates                  | PASS (noted) | Frontend-only change implemented directly following the astro-frontend workflow (spec-first, test-first, layering, gates green); no cross-app handoff exists to delegate                                              |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/006-ukulele-circles-diatonic/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── content-schema.md
│   └── circles-view.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                                    # Astro app (only app touched)
├── src/
│   ├── content/
│   │   ├── topics/harmonic-circles.json    # EXTEND: minor-circle sections + 12 progressions (US4)
│   │   └── chords/*-diminished.json        # NEW: 12 diminished entries (US3 content)
│   ├── lib/
│   │   ├── notes.ts                        # EXTEND: CHORD_COUNT_V1 → CHORD_COUNT = 36 (+ reverse enharmonic lookup)
│   │   ├── chords.ts                       # EXTEND: "diminished" filter option + sort tier (FR-013)
│   │   ├── circles.ts                      # EXTEND: mode-aware grouped filter/sort + diatonicChords() derivation (FR-002/008)
│   │   ├── scales.ts                       # UNCHANGED (SPELLING_TABLE reused as oracle)
│   │   ├── sheets.ts                       # TOUCH: stale "24-entry" comment → 36 (no behavior change)
│   │   ├── chord-diagrams.ts               # TOUCH: stale "24-entry" comment → 36 (no behavior change)
│   │   └── content/
│   │       ├── schemas.ts                  # EXTEND: chord type enum + "diminished"; progression + defaulted type field
│   │       └── validate.ts                 # EXTEND: Rule 4 → 36; NEW Rules 28–29 (pitch agreement, diatonic membership)
│   ├── components/
│   │   ├── CircleList.tsx                  # REWORK: grouped filter + focus view + diatonic table + ScaleNeck (FR-002/004–011)
│   │   ├── ChordList.tsx                   # EXTEND: diminished option flows from chords.ts (no structural change)
│   │   ├── ScaleNeck.tsx                   # UNCHANGED (reused with notes + rootPitch, no badges)
│   │   └── ChordDiagram.tsx                # UNCHANGED (reused per diatonic row)
│   └── pages/courses/[course]/topics/[topic].astro  # UNCHANGED (already passes full chord reference)
├── scripts/check-content.ts                # UNCHANGED (loads chords dir generically; prints new counts)
├── tests/
│   ├── circles.test.ts                     # EXTEND: derivation + grouped filter + sort (rewrite filter/sort blocks)
│   ├── CircleList.test.tsx                 # REWORK: focus-view contract (Back/Esc, diatonic table, neck, states)
│   ├── chords.test.ts                      # EXTEND: diminished filter/sort tier
│   ├── ChordList.test.tsx                  # EXTEND: diminished option assertions
│   ├── content.schemas.test.ts             # EXTEND: 36-entry fixture set; Rule 4/28/29 invalid classes
│   ├── lesson.schemas.test.ts              # EXTEND: progression type-field fixtures
│   ├── scale.schemas.test.ts               # UNCHANGED (scales rules untouched)
│   └── CirclesTopic.test.ts                # NEW or EXTEND: container tests (focus view, 24 circles, 360px, integrity)
└── package.json                            # UNCHANGED (zero new deps)

backend/                                    # UNTOUCHED (no feature traffic, R10)
```

**Structure Decision**: Frontend-only extension of the 001 web-application
layout, following the 005 precedent for explorer rework (focus view +
neck) and the 001 precedent for reference growth (content + schema + gate
move together). Derivation lives in pure `lib/circles.ts` importing the
pure `lib/scales.ts` oracle (no cycle: `scales.ts` never imports
`circles.ts`); the route and content gate need no changes because both
already operate generically over the chords collection. Backend and shared
config untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
