# Research: Music Course Catalog (Ukulele + Chords)

**Feature**: `001-music-course-catalog` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.

---

## R1. Content sourcing for catalog, course, and chord data

- **Decision**: Astro 5 Content Layer (`src/content.config.ts`, `defineCollection`
  with `glob`/`file` loaders) holding curated content in the `frontend/` app as
  typed JSON entries with Zod schemas. Pages query via `getCollection()` and
  render statically. No backend dependency for this feature.
- **Rationale**: The spec fixes content as curated and built in, with no
  authoring/CMS interface, no accounts, and anonymous browsing. Content
  collections give schema validation at build time, automatic TypeScript types,
  and 5x-faster Markdown builds with 25-50% less memory on Astro 5 — exactly
  the content-site shape this feature is. It also keeps the v1 critical path
  free of network failure modes, which simplifies FR-016 error states to
  build-time validation plus client-side fallbacks.
- **Alternatives considered**:
  - Backend REST API serving courses/chords — rejected for v1: no dynamic
    state exists to justify the latency, ops surface, and test doubles; the
    Content Layer loader API leaves the door open to add a remote loader later
    without changing page queries.
  - Markdown/MDX files per chord — rejected: 24 chord entries with structured
    diagram data are cleaner as validated JSON than as frontmatter-heavy
    Markdown; MDX buys nothing without prose content.

## R2. Interactive island framework

- **Decision**: React (18 or 19, whichever the scaffold installs) for the
  interactive islands: chord filter dropdown + list (User Story 3) and chord
  detail display (FR-010). Hydrate with `client:load` on the Chords view only;
  catalog and course pages stay static HTML. `@astrojs/react` integration.
- **Rationale**: Constitution Principle VI mandates rendering backend MCP Apps
  views with `@mcp-ui/client` AppRenderer, whose peer dependencies are
  `react ^18 || ^19` + `react-dom`. Choosing React now avoids a second island
  framework later and unlocks React Testing Library for island unit tests.
  Scoping hydration to the Chords view keeps Home/course pages at zero-JS.
- **Alternatives considered**:
  - Preact/Solid/Svelte islands — rejected: each would force a *second*
    framework alongside React when AppRenderer lands, doubling client bundles
    and test setups.
  - Framework-free vanilla web components — rejected: weaker test ergonomics
    and no reuse path toward AppRenderer.

## R3. Chord diagram data representation + renderer

- **Decision**: Structured data per chord — `strings: "GCEA"` (tuning),
  `frets: [n,n,n,n]` (`-1` = muted, `0` = open), `fingers: [n,n,n,n]`
  (`0` = no finger specified), `baseFret: number` (default 1),
  `barres: [{fret, fromString, toString}]` — rendered by a `ChordDiagram`
  component as inline SVG (4 strings x 5 frets, dots + finger numbers, nut vs
  base-fret label). Missing/invalid diagram data renders the FR-013/edge-case
  placeholder instead of breaking the list.
- **Rationale**: Structured data is filterable, validatable (Zod), and
  re-renderable at any size; SVG keeps diagrams crisp, themeable, and
  accessible (title/desc + text fallback). The 4-integer frets array is the
  industry-standard compact shape for ukulele.
- **Alternatives considered**:
  - Pre-rendered PNG/SVG assets per chord — rejected: 24 assets to author and
    version, no good story for enharmonic duplicates or future chord types.
  - ASCII/text diagrams — rejected: poor visual quality for a learning app,
    weak accessibility story.

## R4. Slugs, routing, and 404

- **Decision**: `slugify(title)` → lowercase ASCII, spaces/punctuation to
  single hyphens, max 64 chars; uniqueness scoped per collection (courses) and
  per parent (topics/games within a course); collisions resolved with `-2`,
  `-3` suffixes and surfaced at build time. Routes:
  - `/` — catalog Home (User Story 1)
  - `/courses/[course]` — course page (User Story 2)
  - `/courses/[course]/topics/[topic]` — topic view (Chords)
  - `/courses/[course]/games/[game]` — game view (no game ships in v1;
    route pattern reserved)
  - `404.astro` — not-found page with link back to catalog (FR-014, SC-006).
  Kind is a declared data field, and the URL segment (`topics/` vs `games/`)
  mirrors it, so a topic and game may share a display title without collision.
- **Rationale**: Title-derived slugs satisfy FR-015; per-scope uniqueness plus
  build-time validation makes collisions a loud authoring error, not a runtime
  bug. Separate `topics/` and `games/` segments keep the declared-kind rule
  (clarification #7) visible in the URL and routable with Astro file-based
  `getStaticPaths`.
- **Alternatives considered**:
  - Flat `/courses/[course]/[item]` with kind lookup — rejected: forces
    cross-kind slug uniqueness and hides kind from the URL.
  - Opaque IDs — rejected: violates FR-015's human-readable requirement.

## R5. Backend role in v1 (AgentOS + Postgres scaffold)

- **Decision**: Scaffold `backend/` as an AgentOS app (FastAPI runtime,
  `PostgresDb`, pgvector Postgres via Docker Compose, `GET /health`, env-based
  config, `.env.example`) with **no feature traffic** in v1. The catalog
  feature is frontend-complete; the backend exists so constitution workflow
  gate #5 (both apps keep working dev/test/build one-liners) holds from day
  one and future agent/MCP features have a runtime to land in. This confirms
  two assistant-suggested defaults and defers one:
  - Docker Compose for local dev — **confirmed** (matches the official
    `agentos-docker-template` / `agent-platform/run-local` shape: `api` +
    `db` services, `docker compose up`).
  - No SQLite anywhere — **confirmed** (Postgres via Compose even for dev;
    `backend/*.db` stays gitignored as a tripwire).
  - JWT/RBAC — **deferred with justification**: spec mandates anonymous
    browsing with no accounts and no network-exposed deployment in v1;
    enforcement lands before any exposed deployment per constitution VII.
- **Rationale**: Building a content API nobody calls would violate YAGNI and
  add failure modes to a static feature; shipping zero backend would violate
  the monorepo workflow gates and leave AgentOS integration unproven. A
  health-checked scaffold is the minimal honest middle.
- **Alternatives considered**:
  - Full content API in v1 — rejected per R1 (no dynamic state).
  - No backend directory until needed — rejected: breaks workflow gate #5 and
    defers proving the Compose + Postgres path.

## R6. LLM / model selection

- **Decision**: No hosted inference in this feature — no agents, chat, search,
  tagging, or recommendations ship in v1. Therefore no model is chosen and no
  `openrouter-model-eval` run is required; this section is the decision record
  Principle V requires ("no model selected, nothing to evaluate").
- **Rationale**: The spec's scope (browse, filter, view diagrams) needs no
  LLM; adding one would violate scope discipline. When the first LLM-backed
  feature arrives, the skill runs and its record lands in that spec's
  `research.md`.
- **Alternatives considered**: none — any model choice would be scope creep.

## R7. Testing strategy

- **Decision**:
  - Frontend (Vitest + React Testing Library + jsdom): unit tests for slug
    utils, chord filter logic, content schemas (valid + invalid fixtures),
    `ChordDiagram` rendering (incl. placeholder path), filter island behavior
    (each dropdown option → visible list), and card components; `.astro`
    components render in tests via `experimental_AstroContainer` from
    `astro/container`, and `vitest.config.ts` is built with `getViteConfig()`
    from `astro/config` so container rendering + `@astrojs/react` resolve in
    tests; Zod schema tests double as contract tests for `contracts/content-schema.md`.
  - Backend (pytest): config/env tests, `/health` test, Compose service
    presence test (parsable compose file, Postgres reachable marker).
  - Validation: `quickstart.md` scenarios map 1:1 to user stories and run via
    `npm run dev` + Vitest + `docker compose up` smoke check.
- **Rationale**: Satisfies constitution Principle III (test-first, both apps)
  with the idiomatic runner per runtime; schema tests give the static-content
  architecture the same contract safety a REST API would get from contract
  tests.
- **Alternatives considered**:
  - Playwright E2E in v1 — deferred: valuable later, but unit + schema +
    quickstart validation covers the v1 risk surface without the flake/CI cost.

## R8. Chord audio playback — required evaluation (FR-010 follow-up; no audio ships in v1)

- **Decision**: Recommend Tone.js over WebAudio (synthesized plucks:
  PluckSynth / PolySynth with Karplus-Strong-style timbres) as the default
  for future chord-audio work, with a per-chord sample-pack upgrade path if
  realism demands it. No audio is implemented in this feature — this section
  satisfies the spec's REQUIRED plan-phase audio research (FR-010 +
  Assumptions) so a future audio feature starts from a decision, not a blank
  spike.
- **Rationale**: Tone.js is MIT-licensed, React/Astro-friendly (client-only
  island, no SSR issues), zero-asset (no licensing or bundle cost for 24
  chords), and good enough for learning previews (pitch-accurate strums with
  ukulele-ish pluck envelopes). It answers the user's "LLM or
  provider/library?" question directly: no LLM or hosted provider is needed —
  chord audio is deterministic synthesis from the `frets[]` data already in
  the model (MIDI pitch = string tuning + fret), so a client-side library is
  the right layer. Future work only needs a `chord → frequencies[]` helper
  plus a Tone.js strum call; the constitution's WebMCP/MCP-UI rules are
  unaffected (no tools exposed, no keys involved).
- **Alternatives considered**:
  - soundfont-player + guitar/ukulele SoundFont — realistic timbres, small
    dependency; rejected as default because SoundFont asset quality varies,
    licensing must be vetted per font, and async font loading complicates the
    FR-016 loading states. Viable runner-up if Tone.js timbres test poorly.
  - Raw WebAudio Karplus-Strong (hand-rolled) — zero dependency, full
    control; rejected as default because it re-implements what Tone.js ships
    and tested; keep as fallback if Tone.js bundle size becomes an issue.
  - Per-chord recorded samples (24 MP3/OGG) — best realism; rejected for
    v-next default due to asset authoring, licensing, bundle/lazy-load
    complexity, and enharmonic duplication cost. Reserved as the realism
    upgrade path (lazy-load per chord on first preview).
  - Hosted audio/music APIs or LLM providers (incl. via OpenRouter) —
    rejected: no LLM synthesizes pitched instrument audio; a network round
    trip per chord preview adds latency, cost, keys, and offline failure for
    zero quality gain over client synthesis. No `openrouter-model-eval` run
    needed (consistent with R6).

## R9. UI styling + component library (Tailwind CSS v4 + shadcn/ui)

- **Decision**: Tailwind CSS v4 (latest at scaffold time, exact version pinned
  in `frontend/package.json`) via the `@tailwindcss/vite` plugin — no
  `tailwind.config.js`, no `@astrojs/tailwind` (deprecated, v3-only). Theme
  via CSS-first `@theme` tokens in `frontend/src/styles/global.css`, imported
  once through a shared `Layout.astro` so every page has Tailwind in its
  module graph (v4 has no auto-injection). shadcn/ui (React, `rsc: false`,
  `tsx: true`) as the UI component library and example-generation source:
  `npx shadcn@latest init` after the `@/*` → `./src/*` alias exists,
  components land in `frontend/src/components/ui/` with `cn()` in
  `frontend/src/lib/utils.ts`, and are used inside React islands with client
  directives. Static `.astro` cards/partials use Tailwind utilities + the
  same theme tokens directly. v1 seeds `button`, `native-select` (filter
  dropdown: native `<select>` + `<optgroup>`, shadcn NativeSelect primitive or
  Tailwind-styled `<select>`), `dialog`/`collapsible` (detail display
  reference), and `card` primitives. The chord filter dropdown MUST use the
  native select; Radix-based shadcn `Select` is reserved for future use only
  if custom option rendering is needed.
- **Rationale**: User-directed stack. v4's Vite-native pipeline is the
  officially recommended Astro path (the old integration is deprecated and
  auto-injection is gone, hence the shared-Layout rule). shadcn gives
  accessible, copy-into-repo primitives that match the card/dropdown/detail
  UI this feature needs, materials for example generation, and its CLI
  officially supports Astro. React-based shadcn composes with the R2
  React-island decision — no second framework.
  Native select is chosen for the ~20-option text-only filter: native mobile
  picker UI, keyboard/a11y for free, and trivial jsdom tests via
  `selectOptions` — no Radix pointer-capture/ResizeObserver mocks.
- **Alternatives considered**:
  - Tailwind v3 + `@astrojs/tailwind` — rejected: deprecated, unmaintained,
    no Astro v6 peer support; v3 PostCSS pipeline is legacy.
  - Hand-rolled CSS / CSS modules only — rejected: slower, inconsistent with
    the shadcn examples the user wants to generate from.
  - Full runtime component framework (MUI, Chakra) — rejected: heavier
    client runtime, conflicts with shadcn-as-source; shadcn's copy-owned
    components fit the static-first Astro model better.
  - Radix-based shadcn `Select` for the v1 filter — rejected: needs
    `hasPointerCapture`/`scrollIntoView`/`ResizeObserver` mocks in jsdom, will
    not open on `userEvent.click` (needs pointerDown/keyboard), and gives up
    the native mobile picker for text-only options with no custom rendering need.

## R10. Clean-code & architecture mapping for this feature (Principle VIII)

- **Decision**: Apply Principle VIII layering directly to the v1 file plan
  (see plan.md project tree). Frontend: thin `pages/` routes compose
  `components/` (shadcn `ui/` + domain cards/islands) over pure `lib/`
  (`slug.ts`, `chords.ts` with `filterChords()`, `notes.ts` leaf constants,
  `content/schemas.ts` with all Zod schemas + refines, `content/validate.ts`
  with `validateCollections()` for cross-collection checks — zero Astro imports
  anywhere in `lib/`); `content.config.ts` is thin wiring only
  (`defineCollection({ loader, schema })` importing pure schemas — per-entry
  validation at `astro sync`/build) + `frontend/scripts/check-content.ts`
  running `validateCollections` over `src/content/**/*.json` as the `prebuild` gate (run via `tsx`: `"check-content": "tsx scripts/check-content.ts"`, `"prebuild": "npm run check-content"`);
  `Chord` type flows via `z.infer` from the schema module (no
  `astro:content` import in lib, no import cycle); shared shell in
  `layouts/`+`styles/`. Chord rendering stays a pure pipeline —
  `ChordDiagram.tsx` takes a validated `ChordDiagram` value and returns
  inline SVG with no data fetching inside. Backend scaffold mirrors the
  layering at minimum size: `app/` composition over `db.py` persistence,
  `agents/`+`evals/` reserved. Lint and format tooling are pinned at
  scaffold time (frontend: ESLint + Prettier with `eslint-plugin-astro` +
  `prettier-plugin-astro`; backend: Ruff) with `lint`/`format` one-liners
  in each README next to dev/test/build.
- **Rationale**: v1 is small enough that layering costs almost nothing and
  large enough (24 chord entries, 4 collections, filter + detail island)
  to rot without it. Keeping `lib/` framework-free makes the filter/slug
  units trivially testable (R7); banning data fetching from components
  keeps islands serializable for the future AppRenderer path (R2). Pure
  schema + validate modules keep T007's contract tests runnable in plain Vitest
  (no Astro loader; per-entry fixtures assert Zod throws, referential/collection
  fixtures assert `validateCollections()` errors) and let `chords.ts` type
  against `z.infer` without touching `astro:content`.
- **Alternatives considered**:
  - No enforced layering ("organize later") — rejected: Principle VIII now
    forbids it, and retrofitting layering after US3 lands costs more than
    scaffolding it in T001/T002.
  - Shared `packages/` for cross-app code — rejected for v1: no shared
    domain code exists yet (zero cross-app calls); revisit when a real
    shared contract appears.
  - Zod schemas inside `content.config.ts` importing lookups from `lib/` —
    rejected: invites a `content.config.ts` ↔ `lib/chords.ts` import cycle
    (or forces `lib/` to import `astro:content` for the Chord type,
    violating VIII); pure schema modules + thin wiring avoid both.
  - Cross-collection checks inside `content.config.ts` — rejected: Astro 5 loads
    entries later via loaders during `astro sync`/build, so no loaded-entries hook
    exists there; they live in pure `content/validate.ts`, executed by
    `frontend/scripts/check-content.ts` (reads `src/content/**/*.json`, exits
    non-zero naming the entry) wired as `prebuild` (tsx runner) + a Vitest integrity test.
  - Node 22 built-in type stripping for check-content.ts — rejected: forces explicit `.ts` import specifiers in the script + `allowImportingTsExtensions` in tsconfig for zero benefit; `tsx` devDep keeps extensionless imports and matches the Vitest toolchain.

## Toolchain pins (verified 2026-09-15)

- Node v22.19.0, npm 10.9.3, Python 3.12.11, Docker 29.4.0 (all present).
- Astro 7.x (`astro@7.3.2` resolved by `create-astro` at implementation; plan-time
  pin was `astro@5` — Content Layer + `experimental_AstroContainer` APIs unchanged),
  `@astrojs/react@6`, `@tailwindcss/vite`, TypeScript 5.x, React 19 per
  scaffold, `tailwindcss` v4 (latest, pinned at scaffold), shadcn/ui deps
  (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
  `tw-animate-css`, Radix primitives as pulled by added components),
  Vitest 5 + Testing Library + jsdom, `tsx` (check-content runner), ESLint 9 +
  Prettier (`eslint-plugin-astro`, `eslint-plugin-jsx-a11y` — no ESLint 10 peer
  yet — `prettier-plugin-astro`) for lint/format.
- Vitest default `environment: "node"`; React island tests opt in per file with
  `// @vitest-environment jsdom`. Reason (found at implementation): under a jsdom
  default, Vitest uses the web transform, so `.astro` imports compile to the
  client stub (not an `isAstroComponentFactory`) and `renderToString` throws
  `NoMatchingRenderer`. Container tests need the SSR transform → node.
- Astro glob loader gotcha: the data store (`node_modules/.astro/data-store.json`)
  keeps stale entries when a collection directory becomes empty (loader warns and
  skips sync). `rm -rf node_modules/.astro` after deleting the last entry of a
  collection.
- Backend: `agno[os]`, `fastapi`, `uvicorn`, `psycopg[binary]`, `sqlalchemy`,
  `pgvector/pgvector:pg17` image, `pytest` (+ `httpx` for app tests),
  `ruff` for lint/format.
- Exact versions are pinned at scaffold time in `frontend/package.json` and
  backend packaging, and recorded in `tasks.md` setup tasks — not guessed here.
