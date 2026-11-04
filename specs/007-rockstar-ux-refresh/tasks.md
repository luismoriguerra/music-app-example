# Tasks: Rockstar UX Refresh

**Input**: Design documents from `/specs/007-rockstar-ux-refresh/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — constitution Principle III (test-first, both apps,
NON-NEGOTIABLE) requires them. Within each phase, test tasks precede
their implementation and MUST fail before it. Backend has no tasks
(research R10); its suite must stay green (T038).

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3, US4 P4,
US5 P5) for independent implementation and testing. US1 ships the shared
identity shell; US2–US5 land as independent surface refreshes on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/`, `backend/` at repository root (per plan.md)
- Frontend source: `frontend/src/...`; frontend tests: `frontend/tests/*.test.ts(x)`
- `ChordList.tsx` / `CircleList.tsx` / `ScaleList.tsx` grow across US4→US5
  (pills → neck-frame wraps); phases touching the same file stay sequential

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing scaffold is green before feature work

- [x] T001 Verify baseline gates in `frontend/` on a clean tree: `npx vitest run` green, `npm run check-content` green, `npm run check` + `npm run lint` + `npm run format:check` green (existing scaffold per plan.md; zero new deps for this feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure libraries + rockstar token foundation that every
story renders inside — MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Theme unit tests in `frontend/tests/theme.test.ts` targeting pure `frontend/src/lib/theme.ts` (zero Astro/React imports): `ThemePreference` is exactly `"dark" | "light" | "system"` with default `"dark"`; `storageKey` MUST be `"music-app-example:theme"`; `resolveTheme(null)` → `"dark"` (default); `effectiveTheme("system", dark-media)` → `"dark"`, `effectiveTheme("system", light-media)` → `"light"`, explicit `"dark"`/`"light"` win over media
- [x] T003 [P] Starter-songs tests in `frontend/tests/starter-songs.test.ts` targeting pure `frontend/src/lib/sheets/starter-songs.ts` (zero Astro/React imports): `STARTER_SONGS` holds ≥4 entries, each a unique non-blank query of 1–200 chars (data-model T1); no duplicates, no empty strings
- [x] T004 [P] Implement `frontend/src/lib/theme.ts` per `contracts/theme.md` (preference type + storage-key const + `resolveTheme()`/`effectiveTheme()` helpers; zero Astro/React imports) (depends on T002)
- [x] T005 [P] Implement `frontend/src/lib/sheets/starter-songs.ts` per `contracts/components.md` (`STARTER_SONGS`: ≥4 curated ukulele-friendly queries, e.g. Riptide / Somewhere Over the Rainbow / Stand by Me / Perfect; pure, zero Astro/React imports) (depends on T003)
- [x] T006 [P] Implement rockstar tokens in `frontend/src/styles/global.css` per `contracts/theme.md` (extend `@theme inline` + `:root`/`.dark`: rockstar accent family used sparingly for primary actions/active pills/focus/highlights; dark-first stage + full light appearance; `muted-foreground` fixed to ≥4.5:1 on backgrounds in both appearances; global `:focus-visible` ring ≥2px; `prefers-reduced-motion` static equivalent) — verified by T036 a11y tests + quickstart V6 audits (no unit test covers raw CSS)

**Checkpoint**: Foundation ready — pure libs tested, tokens in place; user story implementation can now begin

---

## Phase 3: User Story 1 - Feel a modern rockstar identity (Priority: P1) 🎯 MVP

**Goal**: Shared header with theme control, dark/light/system appearances
persisted on-device, ukulele-correct course visual, hero + footer shell,
rockstar-styled shared states (FR-001–FR-004, FR-022).

**Independent Test**: Open home, course, one explorer, game, lesson in both
appearances — header, headline style, accent, imagery, theme control, footer
present and consistent; switching persists across reload with no flash.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Toggle island tests in `frontend/tests/ThemeToggle.test.tsx` (cycles dark → light → system; persists every change to `"music-app-example:theme"`; toggles `.dark` on `<html>` immediately; honors a stored value on mount, defaults to dark when nothing stored; exposes state via `aria-pressed`/`aria-label`; keyboard-operable; 44px+ target)
- [x] T008 [P] [US1] Shell container tests in `frontend/tests/RockstarShell.test.ts` (Layout SSR-defaults `<html class="dark">` + renders sticky header with identity link to `/` + Courses nav + toggle mount point + blocking theme init script + minimal footer; `Hero` renders eyebrow/headline/subcopy; `UkuleleBadge` SVG renders with `aria-label`; `ViewStates` + 404 keep props/behavior with rockstar classes)

### Implementation for User Story 1

- [x] T009 [US1] Implement `frontend/src/components/ThemeToggle.tsx` per `contracts/theme.md` (`client:idle` island: preference cycle + persist + immediate `.dark` application + accessible state + 44px+ target; imports pure `frontend/src/lib/theme.ts` only) (depends on T007)
- [x] T010 [US1] Extend `frontend/src/layouts/Layout.astro` per `contracts/theme.md` (sticky rockstar header: identity + Courses nav + `ThemeToggle client:idle`; blocking init script applying `.dark` before first paint; widened main measure; minimal footer with catalog/course links) (depends on T008, T009)
- [x] T011 [P] [US1] Implement `frontend/src/components/Hero.astro` (static: `eyebrow` + `title` + `subcopy` + `art: "stage" | "none"` props, zero JS) + `frontend/src/components/UkuleleBadge.astro` (static inline-SVG ukulele mark with `title` prop for `aria-label`) per `contracts/components.md` and edit `frontend/src/content/courses/ukulele.json` (`cover`: `"🎸"` → `"ukulele"`; schema unchanged, FR-004) (depends on T008)
- [x] T012 [P] [US1] Restyle `frontend/src/components/ViewStates.astro` + `frontend/src/pages/404.astro` per `contracts/theme.md` (same props/states/behavior — empty/loading/error+retry, not-found + back-link — rockstar styling only, FR-022) (depends on T008)
- [x] T013 [US1] Validate quickstart V1 in `specs/007-rockstar-ux-refresh/quickstart.md` (five-surface identity consistency, theme cycle + persistence + no-flash, ukulele badge, reduced-motion static render)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Discover courses and topics on any screen (Priority: P2)

**Goal**: Welcoming heroes + balanced full-surface card grids with kind
labels on catalog and course pages, single column on phones (FR-005–FR-008).

**Independent Test**: Open home + course at 1280px and 360px — hero,
balanced grids, full-card selection (pointer + one Tab stop), kind labels;
no page sideways scroll on phones.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Cards container tests in `frontend/tests/RockstarCards.test.ts` (home renders `Hero` + one card per course with visual/title/description/entry; course page renders `Hero` + one card per topic/game with Topic/Game kind labels; every card is ONE link via stretched anchor — whole surface activates, single Tab stop, visible focus; grids carry balanced classes `auto-rows-fr` + `h-full` cards; 44px+ affordances; 360px single-column classes, no page sideways scroll)

### Implementation for User Story 2

- [x] T015 [US2] Extend `frontend/src/components/CourseCard.astro` per `contracts/components.md` (full-surface stretched link `after:absolute after:inset-0` + card `relative`; `cover === "ukulele"` → `UkuleleBadge`, other values keep today's fallback; 44px+ affordance; rockstar card treatment + focus ring; props unchanged) (depends on T014)
- [x] T016 [P] [US2] Extend `frontend/src/components/TopicGameCard.astro` per `contracts/components.md` (same stretched-link + 44px + treatment + focus contract as T015; kind label + description unchanged; props unchanged) (depends on T014)
- [x] T017 [US2] Extend `frontend/src/pages/index.astro` + `frontend/src/pages/courses/[course].astro` per `contracts/components.md` (compose `Hero` above balanced grids `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr`; same addresses out, FR-023) (depends on T015, T016)
- [x] T018 [US2] Validate quickstart V2 in `specs/007-rockstar-ux-refresh/quickstart.md` (hero + balanced 5-card grid, full-card pointer + keyboard selection, 360px stack, SC-001 ≤3 selections)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Start a song without guessing (Priority: P3)

**Goal**: Game opens with explanation + selectable example songs, balanced
two-column wide layout, real course name in the breadcrumb (FR-009–FR-011).

**Independent Test**: Open the game with empty history on desktop + phone —
explanation, ≥4 starters, balanced layout; starter selection starts
generation; breadcrumb shows the real course name.

### Tests for User Story 3 ⚠️

- [x] T019 [P] [US3] Game container tests in `frontend/tests/RockstarGame.test.ts` (breadcrumb reads `Courses / {course} / {game}` with the real course title — never the `"Course"` placeholder, FR-011; quick-start SSR shell present; `lg:` two-column shell classes; routes/addresses unchanged)
- [x] T020 [P] [US3] Generator starter island tests in `frontend/tests/SheetGenerator.starters.test.tsx` (quick-start section renders explanation + ≥4 starter chips from `STARTER_SONGS`; chip selection calls the existing `submit(query)` path; candidates/sheet/history/error sub-views untouched; input + actions 44px+; stacked order on phones)

### Implementation for User Story 3

- [x] T021 [P] [US3] Extend `frontend/src/pages/courses/[course]/games/[game].astro` per `contracts/routes.md` (fetch course title via `getCollection("courses")` — the `[topic].astro` precedent — render `Courses / {course} / {game}`; two-column shell for the game; `getStaticPaths()` untouched) (depends on T019)
- [x] T022 [P] [US3] Extend `frontend/src/components/SheetGenerator.tsx` per `contracts/components.md` (quick-start section from pure `frontend/src/lib/sheets/starter-songs.ts` rendered when no sheet/candidates show, chips → existing `submit()`; `lg:grid lg:grid-cols-[1fr_320px]` composition; 44px+ input/actions; zero fetch-logic change; DEVIATION owner-directed 2026-09-18: history auto-open + vertical list, candidates focus mode + Back to search, per-row generating — supersedes 004 carousel, record in converge against FR-010/contracts) (depends on T020)
- [x] T023 [US3] Validate quickstart V3 in `specs/007-rockstar-ux-refresh/quickstart.md` (starters + side-by-side history at 1280px, 1-selection generation SC-002, 360px stack, breadcrumb course name)

**Checkpoint**: At this point, User Stories 1–3 should all work independently

---

## Phase 6: User Story 4 - Filter and open reference entries in one tap (Priority: P4)

**Goal**: Visible pill filters with counts replace the dropdown in all
three explorers; same filter semantics, detail + back behavior preserved
(FR-012–FR-014).

**Independent Test**: Open each explorer on desktop + phone — pill row with
counts, 1-selection updates, "All" restores default order, entry detail
opens with a labeled back path preserving filter + scroll.

### Tests for User Story 4 ⚠️

- [x] T024 [P] [US4] Pills tests in `frontend/tests/FilterPills.test.tsx` (renders `radiogroup` + `radio` pills with labels + counts from props; exactly one `aria-checked="true"`; selection calls `onChange` with a valid filter value; arrow-key nav + Tab; wrapping row on `sm+` + `overflow-x-auto snap-x` scroll row on phones)
- [x] T025 [P] [US4] Explorer integration tests in `frontend/tests/RockstarExplorers.test.tsx` (Chord/Circle/Scale lists render `FilterPills` — no `<select>` — with every option of their `FILTER_GROUPS` and correct counts incl. `All` = full size; each option filters via existing `filterX` semantics; `All` restores default order; entry open → labeled back preserves filter + scroll; 44px+ pills/rows)

### Implementation for User Story 4

- [x] T026 [US4] Implement `frontend/src/components/FilterPills.tsx` per `contracts/components.md` (props-driven `groups`/`value`/`counts`/`onChange`/`id?`; radiogroup + arrow keys; responsive row/scroll-row; 44px+ pills; zero filter-semantics code — values flow to existing libs) (depends on T024)
- [x] T027 [US4] Integrate pills into `frontend/src/components/ChordList.tsx` per `contracts/components.md` (`FilterPills` replaces `<select>` with `FILTER_GROUPS` + live counts; same `filterChords`/`sortChords` pipeline; detail/back semantics unchanged; 44px+ rows) (depends on T025, T026)
- [x] T028 [P] [US4] Integrate pills into `frontend/src/components/CircleList.tsx` per `contracts/components.md` (same pills contract as T027 with circle filter groups; focus-view + Back/Escape semantics unchanged; 44px+ rows) (depends on T025, T026)
- [x] T029 [P] [US4] Integrate pills into `frontend/src/components/ScaleList.tsx` per `contracts/components.md` (same pills contract as T027 with scale filter groups; focus-view + Back/Escape semantics unchanged; 44px+ rows) (depends on T025, T026)
- [x] T030 [US4] Validate quickstart V4 in `specs/007-rockstar-ux-refresh/quickstart.md` (pill counts + 1-selection SC-003 + All-restore per explorer, detail/back preservation, 360px scroll row, keyboard pills)

**Checkpoint**: At this point, User Stories 1–4 should all work independently

---

## Phase 7: User Story 5 - Read lessons and fretboards comfortably on mobile (Priority: P5)

**Goal**: Collapsed chapter control + comfortable measure on phones,
legible chord figures, pannable 12-fret neck frame with hint, thumb-sized
media controls (FR-015–FR-018).

**Independent Test**: Open the lesson + one scale detail + one circle
detail at 360px — collapsed chapters, readable text/figures, neck pans
in-frame with hint and page never scrolls sideways; controls tappable
one-handed.

### Tests for User Story 5 ⚠️

- [x] T031 [P] [US5] Lesson/neck container tests in `frontend/tests/LessonReader.rockstar.test.ts` (mobile `<details class="lg:hidden">` collapsed chapter control with `summary` + section links + `:target`/`aria-current` cue; desktop `<aside class="hidden lg:block">` sticky index intact; `max-w-[65ch]` measure + `scroll-mt` anchors; `NeckFrame` with `overflow-x-auto` + `min-w-[640px]` child + swipe hint + `tabindex="0"` `role="region"` label; figures `grid-cols-2 sm:4`; 44px+ media controls)

### Implementation for User Story 5

- [x] T032 [US5] Implement neck frame per `contracts/components.md` as `frontend/src/components/NeckFrame.tsx` (DEVIATION: contract names `NeckFrame.astro`, but React islands CircleList/ScaleList cannot import `.astro`; single `.tsx` implementation, `.astro` twin deleted — record in converge) (depends on T031)
- [x] T033 [P] [US5] Extend `frontend/src/components/LessonReader.astro` per `contracts/components.md` (mobile `<details>` + desktop sticky `<aside>` chapter controls; current-section cue; reading measure + no-overlap figures + `scroll-mt`; zero new JS) (depends on T031)
- [x] T034 [US5] Wrap `ScaleNeck` call sites with `NeckFrame` in `frontend/src/components/CircleList.tsx` + `frontend/src/components/ScaleList.tsx` per `contracts/components.md` (wrap-only — `ScaleNeck.tsx` SVG untouched) (depends on T032)
- [x] T035 [US5] Validate quickstart V5 in `specs/007-rockstar-ux-refresh/quickstart.md` (collapsed chapters + current-section cue, legible figures, in-frame neck pan with hint, one-handed controls at 360px)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility proof, performance pass, full gates, release readiness

- [x] T036 [P] Accessibility contract tests in `frontend/tests/RockstarA11y.test.ts` (global `:focus-visible` ring present; primary targets carry 44px+ classes — SC-006; theme tokens carry contrast-fixed values + `prefers-reduced-motion` block in `frontend/src/styles/global.css` — SC-005/FR-021; cards/pills/starters/chapters/frames expose correct roles + states; async/list views — SheetGenerator, Chord/Circle/Scale explorers + ViewStates consumers — render loading/empty/error/ready per routes.md view-state table — FR-022)
- [x] T037 Remediation sweep across touched `frontend/src/components/*.astro|*.tsx` + `frontend/src/pages/**/*.astro` + `frontend/src/styles/global.css` for gaps found by T036 (undersized targets, low-contrast text, missing focus/roles, missing loading/empty/error/ready states) — styling + state-completeness only, no logic change (depends on T036)
- [x] T040 [P] Performance contract tests in `frontend/tests/RockstarPerf.test.ts` (data-model T8: explorer + generator islands render SSR shells with on-visible hydration markers; theme toggle on-idle; header + card links carry prefetch opt-in — external links excluded; heroes/cards/pill-rows/figures/neck-frames carry reserved-space classes; decorative art never gates primary content)
- [x] T041 Defer island hydration per `contracts/components.md` + `contracts/routes.md` in `frontend/src/pages/courses/[course]/topics/[topic].astro` (explorers → on-visible) + `frontend/src/pages/courses/[course]/games/[game].astro` (`SheetGenerator` → on-visible) + `frontend/src/layouts/Layout.astro` (`ThemeToggle` → on-idle; SSR shells readable pre-hydration, FR-024) (depends on T040)
- [x] T042 [P] Enable intent prefetching per `contracts/components.md` in `frontend/astro.config.mjs` (verify option shape against `astro-docs` MCP at implement) + prefetch opt-in on primary internal nav in `frontend/src/layouts/Layout.astro` + `frontend/src/components/CourseCard.astro` + `frontend/src/components/TopicGameCard.astro` (FR-025; external/source links excluded) (depends on T040)
- [x] T043 [P] Reserved-space pass per `contracts/components.md` in `frontend/src/styles/global.css` (min-height/aspect helpers) + `frontend/src/components/Hero.astro` + `frontend/src/components/CourseCard.astro` + `frontend/src/components/TopicGameCard.astro` + `frontend/src/components/FilterPills.tsx` + `frontend/src/components/LessonReader.astro` + `frontend/src/components/NeckFrame.astro` (heroes/grids/pill-rows/figures/frames hold stable slots; art pops in without shoving content, FR-026/FR-027) (depends on T040)
- [x] T038 Run full gates per `specs/007-rockstar-ux-refresh/quickstart.md` V6: in `frontend/`, `npx vitest run` + `npm run check-content` (prebuild green on real content incl. `"ukulele"` cover) + `npm run check` + `npm run lint` + `npm run format:check`; in repo root, `pytest backend/` green (no backend change); V6 audits (contrast zero-fail SC-005, touch zero-undersized SC-006, keyboard-only journey SC-007, ≤2s timing SC-008, perf budgets SC-010–SC-012 incl. throttled-network FR-024/FR-025 re-check, all addresses resolve SC-009/FR-023) (depends on T037, T041, T042, T043)
- [ ] T039 Final review in `specs/007-rockstar-ux-refresh/`: constitution compliance I–VIII + gates (incl. layering + lint/format green), SC-001 task-based check COMPLETE with ≥9/10 unaided successes (10 first-time visitors; blocks release on miss), audit evidence attached (contrast, touch, AND perf budgets SC-010–SC-012), and converge readiness across spec.md/plan.md/tasks.md (depends on T038)
  - Measured 2026-09-18 on `npm run build` + `astro preview --port 4321` (lighthouse 13.5, Chrome 153 headless, mobile + simulated throttling, SSR `<html class="dark">` default). Raw: /tmp/lh-{home,course,explorer,game,lesson}.json. Gates: vitest 53 files/516 passed; check-content OK (1 course, 4 topics, 1 game, 36 chords, 24 scales, ukulele cover); astro check 0 errors/0 warnings/5 hints; eslint clean; prettier clean; pytest backend/ 224 passed/135 skipped.
  - SC-005 contrast: lighthouse axe color-contrast 0 fails ×5 in DARK (SSR default) ✅; LIGHT token computation (oklch→sRGB): fg 16.85, muted 6.35, card 18.10, rock-on-bg 4.67 (thinnest, +0.17 margin), rock-fg-on-rock 4.87, primary 17.16 — all ≥4.5:1 ✅. DARK tokens: fg 15.81, muted 8.12, card 14.44, rock 6.68, rock-fg 6.67, primary 14.22 ✅; LIGHT CDP DOM walk 0 fails ×5 (checked 11/30/99/23/322 nodes, scrollW≤vp no h-overflow) ✅ re-verified on preview :4322 (same dist).
  - SC-006 touch: lighthouse target-size 0 fails ×5 (geometry appearance-independent) ✅.
  - SC-007 keyboard: CDP 40-Tab walks ×4 (home/explorer/game/lesson): 0 traps (repeats=0), all stops reachable incl. cards/pills/inputs/history ✅; ArrowRight roving on FilterPills verified (focus→idx1, aria-checked follows) ✅; indicators = native outline rings on nav/controls ([ring] in walk) + forensics-verified box-shadow rings where the walk probe is outline-only — card article stacked 0.92+1.84px ≈2.75px ring, chord button 2px ring ✅; axe a11y 1.00 ×5 ✅. MEASURED on preview :4322 (same dist), scripts /tmp/cdp-{audit,focus,ring}-4322.mjs.
  - SC-008 primary content ≤2s: TTI 1.65/1.65/1.80/1.98/1.35s home/course/explorer(chords)/game(lyrics-chords)/lesson(harmonic-circles) ✅.
  - SC-009 addresses: curl 200 ×7 (/, /courses/ukulele, 4 topics, 1 game), 404 on /courses/nope + /topics/nope ✅.
  - SC-010 LCP ≤2.5s: 1.65/1.65/1.80/1.98/1.35s home/course/explorer/game/lesson ✅ (perf 1.00/1.00/1.00/0.99/1.00, TBT 0ms ×5, FCP 1.28/1.28/0.90/0.92/1.05s).
  - SC-011 CLS ≤0.1: 0.000 ×5 ✅ (reserved-space helpers; zero shift under simulated throttling).
  - SC-012 ≤200ms response: CDP per-interaction — theme toggle 7–17ms ×5 surfaces (appearance flip ×5, followup probe w/ storage reset) ✅, FilterPills select 32.4ms (aria-checked flip) ✅, chapter jump 31.2ms (hash #introduction) ✅; TBT 0ms ×5 + deferred hydration (explorers/generator client:visible, toggle client:idle) + intent prefetch per RockstarPerf tests ✅. MEASURED on preview :4322 (same dist), scripts /tmp/cdp-{audit,followup}-4322.mjs.
  - OUTSTANDING — SC-001 user study ONLY (10 first-time visitors, ≥9/10 unaided): human-only, BLOCKS RELEASE. SC-007/SC-012 are measured above; no audit rides along with SC-001.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 → US2 → US3 → US4 → US5 sequential by priority (later phases compose US1's shell; US5 wraps US4's islands)
  - US2/US3/US4/US5 are independently testable once US1's shell lands
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1's shell (`Layout`, `Hero`, badge) — independently testable once US1 lands
- **User Story 3 (P3)**: Depends on US1's shell — independently testable once US1 lands
- **User Story 4 (P4)**: Depends on US1's shell — independently testable once US1 lands
- **User Story 5 (P5)**: Depends on US1's shell + US4's island integration (wraps US4's `CircleList`/`ScaleList`) — independently testable once US1/US4 land

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Pure libs before components (foundational)
- Components before page composition
- Story complete (validate task) before moving to next priority

### Parallel Opportunities

- T002 + T003 (different test files) can run in parallel
- T004 + T005 + T006 (`lib/theme.ts`, `lib/sheets/starter-songs.ts`, `global.css` — different files) can run in parallel after T002/T003
- T007 + T008 (toggle tests, shell tests — different files) can run in parallel
- T009 + T011 + T012 (`ThemeToggle.tsx`, Hero/Badge/cover, ViewStates/404 — different files) can run in parallel after T007/T008
- T015 + T016 (`CourseCard.astro`, `TopicGameCard.astro` — different files) can run in parallel after T014
- T019 + T020 (game container tests, generator island tests — different files) can run in parallel
- T021 + T022 (`[game].astro`, `SheetGenerator.tsx` — different files) can run in parallel after T019/T020
- T024 + T025 (pills tests, explorer tests — different files) can run in parallel
- T027 + T028 + T029 (`ChordList.tsx`, `CircleList.tsx`, `ScaleList.tsx` — different files) can run in parallel after T025/T026
- T032 + T033 (`NeckFrame.astro`, `LessonReader.astro` — different files) can run in parallel after T031
- T036 + T040 (a11y tests, perf tests — different files) can run in parallel
- T041 + T042 + T043 (hydration directives, prefetch, reserved space — different files) can run in parallel after T040 (T043's `global.css` helpers are additive to T006's tokens — coordinate to avoid same-hunk conflicts)

---

## Parallel Example: User Story 4

```bash
# Launch tests for User Story 4 together:
Task: "Pills tests in frontend/tests/FilterPills.test.tsx"
Task: "Explorer integration tests in frontend/tests/RockstarExplorers.test.tsx"

# After tests fail as expected, implement the shared control:
Task: "Implement frontend/src/components/FilterPills.tsx"

# Then launch the three island integrations together:
Task: "Integrate pills into frontend/src/components/ChordList.tsx"
Task: "Integrate pills into frontend/src/components/CircleList.tsx"
Task: "Integrate pills into frontend/src/components/ScaleList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline green)
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (rockstar shell on every page)
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart V1)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP — recognizable rockstar identity!)
3. Add User Story 2 → Test independently → Deploy/Demo (confident discovery)
4. Add User Story 3 → Test independently → Deploy/Demo (welcoming game)
5. Add User Story 4 → Test independently → Deploy/Demo (one-tap explorers)
6. Add User Story 5 → Test independently → Deploy/Demo (comfortable mobile study)
7. Each story adds value without breaking previous stories

### Single-Agent Execution (this session)

Run in dependency/listing order — T001 → T037, then T040 → T043, then T038 → T039
(respecting [P] batching where files differ), validating each story checkpoint
via its quickstart section before advancing. (IDs are non-sequential in Phase 8
by amendment history; listing order is authoritative.)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Visual refresh discipline: presentation + interaction only — filter semantics, generation/history/analysis behavior, content counts, and all routes stay byte-identical (FR-023); any behavior drift found during implement MUST be reverted or converged via `/speckit-converge`
- Converge pending (owner-directed 2026-09-18, game flow vs FR-010/contracts/T022): history auto-open + vertical list (supersedes 004 carousel), candidates focus mode hides search form + history/tips aside with Back to search, per-row generating state — fetch semantics unchanged, sub-view composition changed; needs /speckit-converge record.
- Performance discipline: the refresh MUST NOT ship slower than baseline — deferral/prefetch/reserved-space (T040–T043) land before the gates (T038), and any budget miss (SC-010–SC-012) blocks release until fixed or explicitly converged
- Codegen discipline (all 007 tasks): (1) every component/view rendering async, fetched, or list/filterable content (SheetGenerator, Chord/Circle/Scale explorers, ViewStates consumers, cards/pages composing them) ships loading + empty + error + ready states (FR-022; T037 sweep fails on missing states there) — static presentational pieces (Hero, UkuleleBadge, NeckFrame) are exempt by definition; (2) Hero, FilterPills, NeckFrame, UkuleleBadge, ThemeToggle each render standalone in their test; (3) zero new logic in pages/components — pure `lib/` + unchanged backend APIs only (R10; drift reverted/converged); (4) fastest correct option wins per T040–T043, budgets SC-010–SC-012 block release.
