# Research: Rockstar UX Refresh

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.
Evidence: 2026-09-18 local audit (Astro preview + headless screenshots at
1280×800 and 390×844 across home, course, game, 3 explorers, lesson) plus the
owner's explicit "modern rockstar" direction.

**Domain scope**: Presentation + interaction only. Content catalog
(1 course, 4 topics, 1 game, 36 chords, 24 scales), filter semantics,
generation/analysis/history behavior, and all routes stay unchanged.

---

## R1. Rockstar theme system (dark-first, light-equal, no new deps)

- **Decision**: Extend the existing Tailwind v4 token block in
  `frontend/src/styles/global.css` (`@theme inline` + `:root`/`.dark`
  custom props + `@custom-variant dark`) with a rockstar accent family
  (one energetic accent + stage-glow tints), dark-first defaults
  (near-black stage background, warm paper text), a full light
  appearance (warm paper background, ink text), contrast-fixed
  `muted-foreground` values (≥4.5:1 body in both appearances), visible
  focus rings, and a `prefers-reduced-motion` block that flattens
  glows/transitions. Appearance is driven by a tiny pure
  `lib/theme.ts` (`ThemePreference = "dark" | "light" | "system"`,
  storage key `music-app-example:theme`, `resolveTheme()`/`effectiveTheme()`
  helpers, default `"dark"`) + a `ThemeToggle` React island (`client:idle`, per R12) + a blocking
  init script in `Layout.astro` that applies `.dark` before first
  paint (default = dark). Typography stays on the system stack
  with a bold display treatment (heavy weight, tight tracking, larger
  scale for heroes/headlines) — no web-font dependency.
- **Rationale**: The audit found a sterile monochrome system with no
  theme control despite `.dark` tokens existing. Building on the
  shipped `@custom-variant` mechanism (no new deps, no FOUC with the
  init script) is the smallest change that delivers dark-first
  rockstar + light-equal + persistence + reduced-motion. System-stack
  display type avoids font downloads (SC-008 2s budget) while still
  reading bold/poster-like at hero sizes.
- **Alternatives considered**:
  - New web-font display family (Google Fonts / fontsource) — rejected:
    extra download + FOUT risk against the 2s budget; system heavies
    suffice for the poster feel.
  - CSS-only theme (media query, no toggle/persistence) — rejected:
    FR-001/FR-003 require an explicit control with dark/light/system
    that persists.
  - Third-party theming library — rejected: one class toggle +
    localStorage needs no dependency.

## R2. Global shell (header, theme control, footer)

- **Decision**: Extend `Layout.astro`: a sticky rockstar header (app
  identity with stage mark + "Courses" nav + `ThemeToggle` island),
  the blocking theme init script, a widened main measure, and a
  minimal footer (app name + course LINKS). Header stays static Astro
  except the toggle island; footer is static.
- **Rationale**: The audit found a one-link text header with no nav,
  no theme control, and no footer. A sticky header keeps catalog nav
  + theme reachable on long lesson/explorer scrolls; keeping it
  static (island only for the toggle) preserves zero-JS readability.
- **Alternatives considered**:
  - Bottom nav bar on mobile — rejected for v1: adds a second nav
    system; the sticky top header + full-card targets already fix
    thumb reach.
  - Full app-menu drawer — rejected: one course + five destinations
    do not justify drawer complexity.

## R3. Discovery cards + heroes (full-surface, balanced, correct visual)

- **Decision**: New static `Hero.astro` (eyebrow + display headline +
  subcopy + optional art slot) composed by `index.astro` and
  `[course].astro` above balanced grids (`grid sm:2 lg:3` retained,
  with `auto-rows-fr` + `h-full` cards so uneven counts like 5-in-3
  read evenly). `CourseCard`/`TopicGameCard` become full-surface links
  via a stretched-link anchor (`after:absolute after:inset-0`,
  card `relative`, inner content `pointer-events`-safe), keep kind
  labels + descriptions, grow primary affordances to 44px+, and gain
  the rockstar card treatment (accent top-rule / glow on hover, focus
  ring). New static `UkuleleBadge.astro` (inline SVG ukulele mark)
  replaces the guitar-emoji `cover` rendering; `ukulele.json`
  `cover` changes to the `"ukulele"` visual key (schema unchanged —
  `cover` stays an optional string; unknown values fall back to the
  initial letter as today).
- **Rationale**: Directly fixes the three discovery findings: dead
  whitespace (hero fills + balances), button-only targets (stretched
  link = whole card tappable, keyboard users activate one link), and
  the electric-guitar-for-ukulele mismatch (dedicated SVG). Inline
  SVG keeps the badge crisp at all sizes with zero requests.
- **Alternatives considered**:
  - Whole-card `<a>` wrapping block content — rejected: valid but
    complicates inner interactive content; stretched-link keeps the
    existing article structure.
  - Remote illustration / photo hero — rejected: extra weight +
    licensing; CSS gradient + SVG mark deliver stage feel free.
  - `cover` schema enum — rejected: optional-string + known-key map
    supports future courses without a migration.

## R4. One-tap explorer filters (pills over unchanged semantics)

- **Decision**: New shared `FilterPills.tsx` (React, props-driven:
  `groups`, `value`, `counts`, `onChange`) rendered by `ChordList`,
  `CircleList`, and `ScaleList` in place of the native `<select>`:
  a `radiogroup` of pills with counts (e.g. "All (36)", "Major (12)"),
  wrapping row on `sm+`, horizontal snap-scroll row on phones
  (`overflow-x-auto`, `scrollbar-none`-ish, `aria-label` + hint).
  Filter *values* and *semantics* reuse the existing pure modules
  (`lib/chords.ts`, `lib/circles.ts`, `lib/scales.ts`) unchanged —
  pills are a presentation swap, not a filter rewrite. Selection
  preserves today's behavior (list updates, detail closes, "All"
  restores default order). Keyboard: arrow-key radiogroup + Tab.
- **Rationale**: The audit's core explorer finding is interaction
  cost: 2 clicks (open dropdown, pick) on desktop for a constantly
  used control. Visible pills cut every lookup to 1 selection
  (SC-003) with counts answering "how many?" before tapping. Sharing
  one control across three islands kills the post-third-use
  duplication the constitution forbids.
- **Alternatives considered**:
  - Keep `<select>` on mobile, pills on desktop (dual controls) —
    rejected: two controls to test/style/keep in sync; the scroll
    row is equally reachable on phones.
  - Checkbox multi-filters — rejected: changes filter semantics
    (spec keeps all/by-type/by-note single-select).

## R5. Game quick-start (starters + two-column + breadcrumb fix)

- **Decision**: New pure `lib/sheets/starter-songs.ts` exporting
  `STARTER_SONGS` (≥4 curated ukulele-friendly query strings, e.g.
  Riptide / Somewhere Over the Rainbow / Stand by Me / Perfect) +
  `SheetGenerator` gains a quick-start section (explanation + starter
  chips that submit on selection) and a `lg:` two-column composition
  (input + results left, history/tips right via CSS grid on the
  existing section — no state change). Input + primary actions grow
  to 44px+. The `[game].astro` route fetches the course title via
  `getCollection("courses")` (the `[topic].astro` precedent) and
  renders "Courses / {course} / {game}" — fixing the hardcoded
  "Course" placeholder (FR-011).
- **Rationale**: The audit's flagship game finding is a blank form
  over empty space. Starters prove the pipeline in one tap (SC-002)
  and teach the query shape; the two-column layout balances wide
  viewports without touching generation/history logic; the breadcrumb
  fix is a 5-line route edit following a shipped precedent.
- **Alternatives considered**:
  - Recent-history-as-starters — rejected: cold-start visitors have
    no history; curated starters work for everyone.
  - Starter carousel with artwork — rejected: artwork needs provider
    calls; plain chips are instant and offline-safe.

## R6. Lesson mobile chapter control (zero-JS details + desktop aside)

- **Decision**: Extend `LessonReader.astro` to render both a mobile
  `<details class="lg:hidden">` chapter control (collapsed by
  default, `<summary>` "In this chapter — N sections", current
  section cued via `:target` highlight + `aria-current` on the
  matching link after navigation) and the existing sticky desktop
  `<aside class="hidden lg:block">`. Body measure clamps to a
  comfortable reading width (`max-w-[65ch]` retained + mobile
  padding), chord figures keep `grid-cols-2 sm:4` with no-overlap
  guarantees, and `scroll-mt` offsets anchors below the sticky
  header. Zero new JS.
- **Rationale**: The audit found the mobile chapter list consuming
  the first screen before any lesson text. Native `<details>` is the
  smallest accessible collapse (free keyboard + AT semantics, no
  island, works no-JS); keeping the desktop aside untouched avoids
  regressing the working wide layout.
- **Alternatives considered**:
  - Scrollspy island (IntersectionObserver current-section) —
    rejected for v1: real current-section tracking is nice but JS
    + tests for marginal gain over `:target`; noted as follow-up.
  - Single drawer for all viewports — rejected: desktop sidebar is
    already good; don't churn it.

## R7. Neck-frame legibility (wrap-only, SVG untouched)

- **Decision**: New static `NeckFrame.astro` (pannable frame:
  `overflow-x-auto`, inner `min-w-[640px]`, visible "swipe for frets
  5–12 →" hint on coarse pointers, `tabindex=0` + `role=region` +
  `aria-label` for keyboard scroll) wrapping `ScaleNeck` at its two
  call sites (`CircleList`, `ScaleList` focus views). `ScaleNeck.tsx`
  SVG is untouched — legibility comes from giving the 760-unit
  viewBox room to render instead of shrinking to 360px.
- **Rationale**: The audit found 8.5–10px note labels shrinking to
  unreadable on phones. A pannable frame is the standard fix
  (page never scrolls sideways — SC-004 — while the diagram keeps
  full fidelity); wrap-only means zero regression risk to the
  gate-verified SVG.
- **Alternatives considered**:
  - 5-fret zoom view on mobile — rejected: second diagram variant
    to draw/test; panning keeps one source of truth.
  - Pinch-zoom JS — rejected: custom gesture code for what native
    overflow + keyboard scroll already do.

## R8. Touch targets, contrast, focus (audit-driven token + class pass)

- **Decision**: Bump every primary interactive target to 44px+
  (`h-9`/`h-10` → `h-11`/`h-12`, `size-8` icon buttons → `size-11`
  with inner icon unchanged) across cards, game input/actions,
  pills, entry rows, audio/diagram/transpose controls, and history
  actions. Fix `muted-foreground` tokens to ≥4.5:1 on their
  backgrounds in both appearances (verify with an automated contrast
  check in quickstart). Add a global visible `:focus-visible` ring
  via the accent + `outline-ring` tokens. Restyle `ViewStates` +
  404 to the rockstar identity with behavior unchanged.
- **Rationale**: Bundles the three cross-cutting audit findings
  (40px inputs, near-threshold greys, thin focus) into one
  verifiable pass with quickstart audits (SC-005/SC-006).
- **Alternatives considered**:
  - Per-component ad-hoc sizing — rejected: inconsistent; the token
    + class sweep keeps one rule everywhere.

## R9. Testing strategy

- **Decision**:
  - Frontend (Vitest, existing setup): theme unit tests
    (preference resolve/effective/storage key, system fallback);
    starter-songs tests (≥4, non-empty, unique, sane lengths);
    `FilterPills` jsdom tests (radiogroup roles, counts render,
    selection callback, arrow-key nav, scroll-row class);
    `ThemeToggle` jsdom tests (cycles preference, persists,
    toggles `.dark`, respects stored value); container tests
    (Layout header + toggle + hero + footer; full-card links +
    kind labels + grid classes + badge; game breadcrumb course
    name + starter SSR shell; lesson mobile details + desktop
    aside + measure + neck-frame hint; a11y: focus rings,
    touch-target classes, contrast-token presence,
    reduced-motion CSS); island tests (generator starter submit,
    explorers render pills with counts and preserve
    filter-on-back); content-integrity (ukulele cover key valid,
    routes unchanged).
  - Backend (pytest): untouched — no backend change, existing suite
    must stay green.
  - Validation: `quickstart.md` scenarios map 1:1 to user stories
    and run via `npm run dev` + Vitest + `npm run check-content` +
    contrast/touch/perf audits.
- **Rationale**: Satisfies Principle III (test-first) with the
  idiomatic runners; container + jsdom tests give the refresh the
  same contract safety prior features have, and the audits make
  SC-005/SC-006/SC-010–SC-012 machine-checked instead of eyeballed.
- **Alternatives considered**:
  - Playwright E2E — deferred (same as 001/003/005): unit +
    container + quickstart covers the static-content risk surface
    without flake/CI cost.
  - Visual snapshot tests — rejected: brittle across fonts/raster;
    class + token + behavior assertions are stable.

## R10. Backend role

- **Decision**: No backend involvement — zero feature traffic, no
  `backend/` changes, no migration, no new endpoint. Same posture as
  001/003/005.
- **Rationale**: A presentation refresh with anonymous reading needs
  no server work; the game pipeline, history, and analysis APIs are
  consumed unchanged.

## R11. LLM / model selection

- **Decision**: No hosted inference in this feature — no agents, chat,
  search, tagging, or recommendations ship. No model is chosen and no
  `openrouter-model-eval` run is required; this section is the decision
  record Principle V requires ("no model selected, nothing to evaluate").
- **Rationale**: Restyling pages and filters needs no LLM; adding one
  would be scope creep. Consistent with 001/003/005 R6/R11.

## R12. Performance strategy (content-first, intent-prefetch, still layout)

- **Decision**: Three mechanisms, all inside the existing stack (zero
  new deps):
  1. **Deferred hydration (FR-024)**: explorer islands (`ChordList`,
     `CircleList`, `ScaleList`) and `SheetGenerator` move from
     `client:load` to on-visible hydration at their route call sites
     (`[topic].astro`, `[game].astro`) — heroes, headings, and SSR
     shells paint first while island JS loads as the learner scrolls;
     `ThemeToggle` moves to on-idle hydration in `Layout.astro` (the
     blocking init script already applied the correct appearance, so
     the toggle can hydrate after first paint with no visual flash).
     Every island keeps a readable SSR shell so no-JS/slow-JS stays
     usable.
  2. **Intent prefetching (FR-025)**: enable prefetch for internal
     navigation (hover + viewport intent over catalog/course/topic/game
     links) via `astro.config.mjs` + opt-in markers on primary nav —
     verify the exact option shape against the `astro-docs` MCP server
     at implement time (live API authority per constitution). Static
     output keeps prefetches cheap (small HTML + shared assets).
  3. **Reserved space (FR-026/FR-027)**: heroes, card grids, pill rows,
     chord figures, and neck frames get min-height/aspect reservations
     in `global.css` + component classes so async islands and art pop
     into reserved slots instead of shoving content; decorative art is
     CSS/SVG-only and never blocks primary content. Budgets enforced by
     quickstart V6 audits: LCP ≤2.5s mid-tier-phone 4G (SC-010),
     CLS ≤0.1 (SC-011), interactions ≤200ms (SC-012).
- **Rationale**: The refresh adds heroes, pills, and starters above
  existing islands — without deferral, more above-the-fold JS would
  compete with first paint on phones. On-visible hydration is the
  idiomatic Astro lever (one directive per call site, SSR shells
  intact); prefetch exploits the app's tiny static pages for
  instant-feeling moves; reservations convert the new visual richness
  from a shift risk into stable slots.
- **Alternatives considered**:
  - Keep `client:load` everywhere — rejected: blocks first paint on
    the game/explorer pages the refresh makes heavier.
  - Service-worker precache/offline — rejected: offline use is out
    of scope (spec Assumptions); prefetch covers perceived speed.
  - Image CDN / raster heroes — rejected: no raster art ships (R1/R3
    are CSS/SVG-only), so there is nothing to optimize there.
  - SSR/streaming — rejected: static output is the shipped posture
    (001/002); budgets are achievable statically.

## Toolchain pins (verified 2026-09-18)

- Reuse the 001/003/005 scaffold: Node 22, Astro 7.x, React 19 islands,
  Tailwind CSS v4 (+ `tw-animate-css`), Vitest 5 + Testing Library,
  ESLint 9 + Prettier, `tsx` check-content runner. Zero new dependencies
  for this feature.
