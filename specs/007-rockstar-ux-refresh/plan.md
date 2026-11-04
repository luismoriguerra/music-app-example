# Implementation Plan: Rockstar UX Refresh

**Branch**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-rockstar-ux-refresh/spec.md`

## Summary

Give the music course catalog a modern rockstar identity and fix the
desktop + mobile UX gaps found in the 2026-09-18 audit: a dark-first
stage-inspired theme with light equal, a shared header with theme
control, welcoming catalog/course heroes with balanced full-card grids,
a Lyrics + Chords game that opens with example songs instead of empty
space, one-tap filter options with counts on the Chords/Circles/Scales
explorers, a collapsible lesson chapter control plus a pannable 12-fret
neck frame on phones, 44px+ touch targets, readable contrast, full
keyboard operability, and a performance pass (content-first rendering,
instant-feeling navigation, zero layout jumps) — with zero route
changes and zero backend changes.
Technical approach (from research): extend the Tailwind v4 theme tokens
in `global.css` with a rockstar accent family plus dark/light
appearances driven by a tiny theme library persisted on-device; stretch
`CourseCard`/`TopicGameCard` to full-surface links with a hero section
on catalog + course pages; add a shared `FilterPills` control fed by the
existing pure filter modules; extend `SheetGenerator` with a curated
starter-song constant and a two-column game layout while the game route
fetches the real course title for its breadcrumb; render the lesson
chapter list as a mobile `<details>` plus desktop sticky aside; wrap
`ScaleNeck` in a pannable frame with a hint; defer non-critical islands
to on-visible/on-idle hydration and prefetch internal navigation so
content paints first and moves feel instant; reserve space for heroes,
cards, and diagrams to hold layout still; and gate everything with
Vitest container + island tests plus quickstart contrast/touch/perf
audits.

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 7.x, React 19 islands —
theme toggle + filter pills + extended generator; lesson/hero/cards stay
static Astro)

**Primary Dependencies**: `astro@7`, `@astrojs/react`, `zod` (schemas,
unchanged), Tailwind CSS v4 via `@tailwindcss/vite` + `tw-animate-css`
(existing), `lucide-react` (icons, existing), ESLint + Prettier
(`eslint-plugin-astro`/`prettier-plugin-astro`); zero new dependencies

**Storage**: N/A for feature data (static Content Layer collections,
extends 001/003/005) + device-only theme preference (`localStorage`,
new tiny `lib/theme.ts`); no backend state

**Testing**: Vitest + Testing Library + `experimental_AstroContainer`
(frontend); pytest regression-only (backend untouched)

**Target Platform**: Web — static frontend (Astro static output),
desktop wide viewports + 360px phones

**Project Type**: Web application (frontend-only change; backend untouched)

**Performance Goals**: Refreshed views show primary content within 2s of
navigation on broadband/4G (SC-008, matching the pre-refresh baseline);
largest content element within 2.5s on a mid-tier phone over 4G
(SC-010); layout shift at or below 0.1 on primary flows (SC-011);
filter/theme/chapter interactions visibly respond within 200ms
(SC-012; filtering itself is effectively instant — client-side over
≤36 entries); theme switch applies within one frame with no flash of
wrong appearance on revisit

**Constraints**: Standard ukulele tuning GCEA (unchanged content);
English-only copy; no route changes (FR-023 — all established addresses
resolve); content-first rendering + intent-prefetched navigation +
reserved layout space (FR-024–FR-027, budgets SC-008/SC-010–SC-012);
semantic markup + keyboard operability + visible focus on every
refreshed control (FR-020); 44px+ primary touch targets on phones
(SC-006); 4.5:1 body / 3:1 large-text contrast in both appearances
(SC-005); `prefers-reduced-motion` respected (FR-021); no secrets in repo

**Scale/Scope**: 5 refreshed surfaces (catalog home, course page,
3 explorers, Lyrics + Chords game, Harmonic Circles lesson + neck
frame); 1 content edit (Ukulele `cover` → ukulele-appropriate visual);
~6 new/shared components (`ThemeToggle`, `Hero`, `FilterPills`,
`UkuleleBadge`, `NeckFrame`, lesson mobile chapter control) + extensions
to 8 existing components/routes; pattern supports future courses with
content-only changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS (justified) | specify done; plan now; tasks → implement → converge to follow; clarify skipped per spec Assumptions (audit evidence + explicit rockstar direction); analyze SHOULD run before implement unless converge justifies skipping |
| II. Monorepo boundaries | PASS | App code only under `frontend/`; specs under `specs/`; zero backend changes, zero cross-app calls |
| III. Test-first both apps | PASS | Vitest (theme lib, starter songs, pills, container + island + diagram-frame tests) written alongside per tasks; pytest suite untouched and must stay green |
| IV. Agent evals | N/A | No agents ship or change — no test-scenarios required |
| V. Evidence-based models | N/A (recorded) | No hosted inference; research R11 is the decision record, no `openrouter-model-eval` run needed |
| VI. Browser AI | N/A (compatible) | No browser AI; static content + islands degrade to readable no-JS shells (SSR `<html class="dark">` default renders dark; pills SSR as a readable radiogroup shell, full filtering requires JS) |
| VII. Backend runtime + Postgres | PASS | `backend/` untouched; no state, no endpoints, no auth surface change |
| VIII. Clean code & architecture | PASS | Pure `lib/` (`theme.ts`, `starter-songs.ts`, existing filter modules, zero Astro imports) → presentational components/islands → thin page composition; ESLint+Prettier green before merge |
| Tech Constraints & Standards | PASS | Astro+TS+Tailwind v4+Vitest; zero new deps; no `@astrojs/tailwind`; secrets via env only (none needed) |
| Workflow gates | PASS (noted) | Frontend-only change implemented directly following the astro-frontend workflow (spec-first, test-first, layering, gates green); no cross-app handoff exists to delegate; one-liner commands already documented |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

*Amendment 2026-09-18 (performance): FR-024–FR-027 + SC-010–SC-012 added
to spec; research R12, data-model T7/T8, components/routes contract
deltas, quickstart V6 perf audits, and tasks T040–T043 added here.
Re-check holds — still frontend-only, zero new deps, zero route/
backend changes.*

## Project Structure

### Documentation (this feature)

```text
specs/007-rockstar-ux-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── theme.md
│   ├── routes.md
│   └── components.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                                    # Astro app (only app touched)
├── src/
│   ├── content/
│   │   └── courses/ukulele.json            # EDIT: cover → ukulele-appropriate visual key (US1 content)
│   ├── lib/
│   │   ├── theme.ts                        # NEW: ThemePreference ("dark"|"light"|"system"), storage key, resolve/effective helpers (pure, zero Astro imports)
│   │   └── sheets/
│   │       └── starter-songs.ts            # NEW: STARTER_SONGS (≥4 curated query strings) + helper (pure, zero Astro imports)
│   ├── components/
│   │   ├── ThemeToggle.tsx                 # NEW: theme island (dark/light/system control, client:idle — init script already applied .dark; persists + toggles)
│   │   ├── Hero.astro                      # NEW: static welcoming hero (eyebrow + headline + subcopy + optional art slot)
│   │   ├── UkuleleBadge.astro              # NEW: static ukulele-appropriate course visual (SVG, replaces guitar emoji)
│   │   ├── FilterPills.tsx                 # NEW: shared one-tap filter control (radiogroup, counts, scrollable row; props-driven)
│   │   ├── NeckFrame.astro                 # NEW: static pannable frame w/ hint for 12-fret neck (overflow-x-auto + min-width child)
│   │   ├── CourseCard.astro                # EXTEND: full-surface stretched link + UkuleleBadge + 44px+ target + rockstar card treatment
│   │   ├── TopicGameCard.astro             # EXTEND: full-surface stretched link + 44px+ target + rockstar card treatment
│   │   ├── ChordList.tsx                   # EXTEND: FilterPills (replaces select), counts, 44px+ rows, preserve filter/detail semantics
│   │   ├── CircleList.tsx                  # EXTEND: FilterPills (replaces select), counts, 44px+ rows, preserve focus-view semantics
│   │   ├── ScaleList.tsx                   # EXTEND: FilterPills (replaces select), counts, 44px+ rows, preserve focus-view semantics
│   │   ├── SheetGenerator.tsx              # EXTEND: starter-song quick-start section + two-column lg layout + 44px+ input/actions
│   │   ├── LessonReader.astro              # EXTEND: mobile <details> chapter control + desktop sticky aside + reading measure + current-section cue
│   │   ├── ScaleNeck.tsx                   # EXTEND (wrap-only): render inside NeckFrame via callers (CircleList/ScaleList); SVG untouched
│   │   └── ViewStates.astro                # EXTEND: rockstar-styled empty/loading/error (behavior unchanged)
│   ├── layouts/
│   │   └── Layout.astro                    # EXTEND: rockstar header (identity + ThemeToggle + catalog nav) + theme init script + footer slot + intent prefetch on primary nav
│   ├── styles/
│   │   └── global.css                      # EXTEND: rockstar accent family + dark-first tokens + contrast fixes + reduced-motion + focus rings + reserved-space helpers (hero/card/diagram min-heights)
│   └── pages/
│       ├── index.astro                     # EXTEND: Hero + balanced card grid (full-card links)
│       ├── courses/[course].astro          # EXTEND: Hero + balanced card grid (full-card links)
│       ├── courses/[course]/games/[game].astro  # EXTEND: fetch course title for breadcrumb (fix "Course" placeholder); two-column shell; SheetGenerator → on-visible hydration
│       └── courses/[course]/topics/[topic].astro # EXTEND (directives only): explorer islands → on-visible hydration (branching intact; islands render refreshed UI)
├── astro.config.mjs                        # EXTEND: enable prefetch for internal navigation (hover/viewport intent; verify against astro-docs MCP at implement)
├── tests/
│   ├── theme.test.ts                       # NEW: preference resolve/effective/storage-key unit tests
│   ├── starter-songs.test.ts               # NEW: ≥4 curated starters, non-empty, generatable-shape tests
│   ├── FilterPills.test.tsx                # NEW: radiogroup, counts, selection, keyboard, mobile scroll class
│   ├── ThemeToggle.test.tsx                # NEW: island tests (cycles preference, persists, toggles .dark)
│   ├── RockstarShell.test.ts               # NEW: container tests (Layout header + toggle + hero + footer on home/course)
│   ├── RockstarCards.test.ts               # NEW: container tests (full-card links, kind labels, balanced grid classes, badge)
│   ├── RockstarGame.test.ts                # NEW: container tests (breadcrumb course name, starter section SSR shell)
│   ├── SheetGenerator.starters.test.tsx    # NEW: island tests (starter select → submit, two-column classes, 44px targets)
│   ├── RockstarExplorers.test.tsx          # NEW: island tests (pills replace select in Chord/Circle/Scale lists, counts, back-preserves-filter)
│   ├── LessonReader.rockstar.test.ts       # NEW: container tests (mobile details + desktop aside, measure class, neck frame hint)
│   ├── RockstarA11y.test.ts                # NEW: container tests (focus rings, touch-target classes, contrast token presence, reduced-motion CSS)
│   └── RockstarPerf.test.ts                # NEW: container tests (island defer directives, prefetch opt-in on nav links, reserved-space classes)
├── scripts/check-content.ts                # UNCHANGED (cover stays optional string; no schema change)
└── package.json                            # UNCHANGED (zero new deps)

backend/                                    # UNTOUCHED (no feature traffic, R10)
```

**Structure Decision**: Frontend-only restyle + interaction uplift inside
the 001 web-application layout. New pure modules (`lib/theme.ts`,
`lib/sheets/starter-songs.ts`, zero Astro imports) keep Principle VIII
layering (thin pages → presentational components/islands → pure lib);
existing filter semantics in `lib/chords.ts`, `lib/circles.ts`,
`lib/scales.ts` are reused unchanged behind the new `FilterPills`
control. Backend and shared config untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
