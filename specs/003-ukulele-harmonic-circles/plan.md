# Implementation Plan: Ukulele Harmonic Circles Topic

**Branch**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ukulele-harmonic-circles/spec.md`

## Summary

Add a "Harmonic Circles" lesson topic to the Ukulele course: a new topic
card on the course page opening a method-book-style chapter (intro + fifteen
headed sections + summary) teaching twelve complete I–vi–IV–V circles
(all twelve major keys) with every progression chord showing its name and fingering
diagram inline, resolved from the existing 24-entry Chords reference,
plus a sticky in-chapter index (FR-011) linking intro, sections, and
summary via derived heading anchors.
Technical approach (from research): extend the `topics` JSON schema with
an explicit `format: "reference" | "lesson" | "circles"` discriminator plus an
embedded `lesson` chapter object (Markdown prose, build-time `marked`
rendering, raw HTML forbidden); the topic route branches on `format`
(reference → unchanged chord explorer, lesson → static zero-JS
reader, circles → new explorer island); chord references resolve by
exact name with build-failing validation. Follow-up: the Circles
explorer derives its entries from the lesson progressions (single
source). No backend changes, no new routes; the explorer island is the
feature's only hydrated component.

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 7.x, React 19 available for
islands — one needed (circles explorer); lesson view is static HTML)

**Primary Dependencies**: `astro@7`, `zod`, `marked` (new, pinned at
implement), Tailwind CSS v4 + shadcn theme tokens (existing),
ESLint + Prettier (`eslint-plugin-astro`/`prettier-plugin-astro`)

**Storage**: N/A for feature data (static Content Layer collections,
extends 001)

**Testing**: Vitest + `experimental_AstroContainer` (frontend); pytest
regression-only (backend untouched)

**Target Platform**: Web — static frontend (Astro static output)

**Project Type**: Web application (frontend-only change; backend untouched)

**Performance Goals**: Lesson view shows full content within 2s of
navigation on broadband/4G (SC-002); zero client JS on the lesson page
(static render, no island)

**Constraints**: Standard ukulele tuning GCEA; English-only prose;
major/minor chord vocabulary only (existing reference); semantic markup
(`<h2>`/`<p>`/`<ul>` from Markdown); readable single column, no
horizontal scroll at 360px (SC-005); no secrets in repo

**Scale/Scope**: 2 new topic entries: the lesson (15 sections,
12 progressions, 48 chord references resolving to all 24 reference entries)
plus the Circles explorer deriving the same 12 progressions with a
key-filter dropdown; pattern supports future lesson topics with
content-only changes (new circles appear in the explorer automatically)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS (justified) | specify done; plan now; tasks → implement → converge to follow; clarify skipped per user scoping with justification in spec Assumptions; lightweight analyze runs before implement |
| II. Monorepo boundaries | PASS | App code only under `frontend/`; specs under `specs/`; zero backend changes, zero cross-app calls |
| III. Test-first both apps | PASS | Vitest (lesson schemas, resolver, validateCollections additions, container tests, explorer collector + island tests) written alongside per tasks; pytest suite untouched and must stay green |
| IV. Agent evals | N/A | No agents ship or change — no test-scenarios required |
| V. Evidence-based models | N/A (recorded) | No hosted inference; research R6 is the decision record, no `openrouter-model-eval` run needed |
| VI. Browser AI | N/A (compatible) | No browser AI; lesson page is static zero-JS — nothing to degrade |
| VII. Backend runtime + Postgres | PASS | `backend/` untouched; no state, no endpoints, no auth surface change |
| VIII. Clean code & architecture | PASS | Pure `lib/` (schemas + `lessons.ts`/`circles.ts`, zero Astro imports) → presentational `LessonReader`/`CircleList` → thin page branch; ESLint+Prettier green before merge |
| Tech Constraints & Standards | PASS | Astro+TS+Tailwind v4+Vitest; `marked` pinned new dep; secrets via env only (none needed) |
| Workflow gates | PASS (noted) | Frontend-only change implemented directly following the astro-frontend workflow (spec-first, test-first, layering, gates green); no cross-app handoff exists to delegate; one-liner commands already documented |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/003-ukulele-harmonic-circles/
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
│   │   ├── topics/harmonic-circles.json    # NEW: topic entry + full chapter (US1+US2 content)
│   │   └── topics/circles.json             # NEW: explorer topic entry (US4; entries derive from the lesson)
│   ├── lib/
│   │   ├── lessons.ts                      # NEW: resolveLessonChords() + renderProse() + slugifyHeading()/sectionSlugs() (pure, zero Astro imports)
│   │   ├── circles.ts                      # NEW: collectLessonCircles() + resolveCircleChords() + filter/sort (pure, zero Astro imports)
│   │   └── content/
│   │       ├── schemas.ts                  # EXTEND: format discriminator + lesson/progression schemas (rules 10-14, 17)
│   │       └── validate.ts                 # EXTEND: rule 15 (lesson chord refs resolve, naming errors)
│   ├── components/
│   │   ├── LessonReader.astro              # NEW: static chapter renderer (prose + progression blocks + inline diagrams + chapter index)
│   │   └── CircleList.tsx                  # NEW: circles explorer island (key dropdown + single-open inline diagrams, client:load)
│   └── pages/
│       └── courses/[course]/topics/[topic].astro  # EXTEND: branch on topic.format (reference vs lesson vs circles)
├── tests/
│   ├── lesson.schemas.test.ts              # NEW: chapter fixtures (valid + 5 invalid classes)
│   ├── lessons.test.ts                     # NEW: resolver + renderProse unit tests
│   ├── circles.test.ts                     # NEW: collector + resolver + filter/sort unit tests
│   ├── CircleList.test.tsx                 # NEW: island tests (dropdown, expansion, states; jsdom)
│   └── LessonReader.test.ts                # NEW: container tests (chapter render, route branch, empty state)
├── scripts/check-content.ts                # UNCHANGED (extended schema + rules flow through)
└── package.json                            # EXTEND: pin marked

backend/                                    # UNTOUCHED (no feature traffic, R5)
```

**Structure Decision**: Frontend-only extension of the 001 web-application
layout. New pure modules (`lib/lessons.ts`, `lib/circles.ts`, schema additions) keep
Principle VIII layering (thin page branch → presentational reader →
pure lib); the lesson page adds zero client JS and the explorer adds one island. Backend and shared
config untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
