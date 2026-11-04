# Implementation Plan: Ukulele Scales Topic

**Branch**: `005-ukulele-scales-topic` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-ukulele-scales-topic/spec.md`

## Summary

Add a "Scales" explorer topic to the Ukulele course: a new topic card on the
course page opening a filterable reference of 24 major/natural-minor scales
(12 chromatic roots × 2 types), each entry opening in a full-width focus
view to show its note sequence (conventional spelling, no theoretical
keys), scale degrees, interval pattern, a numbered fretboard-chart
fingering diagram, and a landscape 12-fret neck reference.
Technical approach (from research): new `scales` Content Layer collection
with a `scaleSchema` (identity fields cloned from chords + notes/degrees/
intervals + positions array); new `format: "scales"` topic value with a
route dispatch branch (the 003 circles precedent, not the reference default);
a `ScaleList` React island mirroring `ChordList` (grouped filter, major-first
sort, full-width focus detail); a `ScaleDiagram` SVG component extending
the `ChordDiagram` idiom to numbered playing order plus a `ScaleNeck`
landscape 12-fret reference; parallel `validateCollections`
rules including a spelling-table gate. No backend changes, no new routes;
the explorer island is the feature's only hydrated component.

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 7.x, React 19 islands — one new
island: scales explorer)

**Primary Dependencies**: `astro@7`, `zod` (schemas), Tailwind CSS v4 +
shadcn theme tokens (existing), ESLint + Prettier
(`eslint-plugin-astro`/`prettier-plugin-astro`); no new dependencies

**Storage**: N/A for feature data (static Content Layer collections,
extends 001/003)

**Testing**: Vitest + Testing Library + `experimental_AstroContainer`
(frontend); pytest regression-only (backend untouched)

**Target Platform**: Web — static frontend (Astro static output)

**Project Type**: Web application (frontend-only change; backend untouched)

**Performance Goals**: Scales view shows the list within 2s of navigation on
broadband/4G (SC-007); filter updates within 2s (SC-002, effectively instant
— client-side filter over 24 entries)

**Constraints**: Standard ukulele tuning GCEA; English-only copy;
major/natural-minor vocabulary only (DR-004); one-octave first-position
fingerings (FR-011); no double-flats/sharps in any note sequence (FR-008);
readable at 360px with no horizontal scroll (SC-008); semantic markup +
keyboard operability; no secrets in repo

**Scale/Scope**: 1 new topic entry ("Scales", `order: 3`) + 24 new scale
entries; one new island + two diagram components (`ScaleDiagram`, `ScaleNeck`); pattern supports future
reference topics with content-only changes once the format exists

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                       | Status           | Notes                                                                                                                                                                                                           |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-driven (MUST phases)    | PASS (justified) | specify done; plan now; tasks → implement → converge to follow; clarify skipped per spec Assumptions (deliberate DR-001–DR-005 instead); analyze deferred to converge review per spec Assumptions               |
| II. Monorepo boundaries         | PASS             | App code only under `frontend/`; specs under `specs/`; zero backend changes, zero cross-app calls                                                                                                               |
| III. Test-first both apps       | PASS             | Vitest (scale schemas, spelling table, filter/sort, validateCollections additions, island + diagram tests, container tests) written alongside per tasks; pytest suite untouched and must stay green             |
| IV. Agent evals                 | N/A              | No agents ship or change — no test-scenarios required                                                                                                                                                           |
| V. Evidence-based models        | N/A (recorded)   | No hosted inference; research R6 is the decision record, no `openrouter-model-eval` run needed                                                                                                                  |
| VI. Browser AI                  | N/A (compatible) | No browser AI; static content + one filter island — nothing to degrade                                                                                                                                          |
| VII. Backend runtime + Postgres | PASS             | `backend/` untouched; no state, no endpoints, no auth surface change                                                                                                                                            |
| VIII. Clean code & architecture | PASS             | Pure `lib/` (`scales.ts`, schema additions, zero Astro imports) → presentational `ScaleDiagram`/`ScaleList` → thin page branch; ESLint+Prettier green before merge                                              |
| Tech Constraints & Standards    | PASS             | Astro+TS+Tailwind v4+Vitest; zero new deps; secrets via env only (none needed)                                                                                                                                  |
| Workflow gates                  | PASS (noted)     | Frontend-only change implemented directly following the astro-frontend workflow (spec-first, test-first, layering, gates green); no cross-app handoff exists to delegate; one-liner commands already documented |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/005-ukulele-scales-topic/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── content-schema.md
│   └── routes.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                                    # Astro app (only app touched)
├── src/
│   ├── content/
│   │   ├── topics/scales.json              # NEW: topic entry (format "scales", order 3)
│   │   └── scales/*.json                   # NEW: 24 scale entries (US2+US3 content)
│   ├── lib/
│   │   ├── scales.ts                       # NEW: SPELLING_TABLE + filter/sort + spelling lookup (pure, zero Astro imports)
│   │   └── content/
│   │       ├── schemas.ts                  # EXTEND: "scales" format value + scale/scaleDiagram schemas (rules 19-22)
│   │       └── validate.ts                 # EXTEND: scales collection rules — refs, count, dupes, filter coverage, spelling gate (rules 23-26)
│   ├── components/
│   │   ├── ScaleDiagram.tsx                # NEW: fretboard-chart SVG (numbered playing order, open marks, position label)
│   │   ├── ScaleNeck.tsx                   # NEW: landscape 12-fret neck SVG (all tones, tonic fill, order badges; DR-006)
│   │   └── ScaleList.tsx                   # NEW: scales explorer island (grouped dropdown + full-width focus detail, client:load)
│   ├── content.config.ts                   # EXTEND: register scales collection
│   └── pages/
│       └── courses/[course]/topics/[topic].astro  # EXTEND: branch on format "scales" (collect scales + render ScaleList)
├── tests/
│   ├── scale.schemas.test.ts               # NEW: scale fixtures (valid + invalid classes)
│   ├── scales.test.ts                      # NEW: spelling table + filter/sort unit tests
│   ├── ScaleList.test.tsx                  # NEW: island tests (dropdown, expansion, states; jsdom)
│   ├── ScaleDiagram.test.tsx               # NEW: diagram tests (order dots, open marks, empty state)
│   └── ScalesTopic.test.ts                 # NEW: container tests (route branch, topic render, empty state)
├── scripts/check-content.ts                # EXTEND: load scales collection through scaleSchema + validateCollections
└── package.json                            # UNCHANGED (zero new deps)

backend/                                    # UNTOUCHED (no feature traffic, R5)
```

**Structure Decision**: Frontend-only extension of the 001 web-application
layout, following the 003 circles precedent (new format value + dispatch
branch + island). New pure modules (`lib/scales.ts`, schema additions) keep
Principle VIII layering (thin page branch → presentational island →
pure lib); the explorer adds one island. Backend and shared config untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
