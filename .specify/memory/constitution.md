<!--
Sync Impact Report (remove before commit — scratch review material, not governance):
- Version change: 1.2.2 → 1.3.0 (MINOR — Principle VIII materially expanded with durable codegen rules)
- Modified principles: VIII. Clean Code & Clear Architecture (added Component completeness, Standalone reusability, Logic placement, Performance-first codegen bullets)
- Added sections: none (expansion within Principle VIII)
- Removed sections: none
- Deferred TODOs: none
- Prior uncommitted amendments still pending review: 1.0.0 → 1.0.1 (relaxed inferred MUSTs); 1.0.1 → 1.0.2 (spec-dir path drift); 1.0.2 → 1.1.0 (Tailwind v4 + shadcn/ui); 1.1.0 → 1.2.0 (Principle VIII); 1.2.0 → 1.2.1 (pure-schema layering + linter pick); 1.2.1 → 1.2.2 (Astro 5 → 7 constraint correction)
-->

# Music App Constitution

## Core Principles

### I. Spec-Driven Development (NON-NEGOTIABLE)

Every feature MUST flow through the core Spec Kit phases in order: specify →
plan → tasks → implement → converge, under this constitution. No application
code may be written without a ratified spec and plan. The `clarify` phase
SHOULD run before `plan` when requirements are ambiguous, and `analyze`
SHOULD run after `tasks` before `implement`; skipping either MUST be
justified in the spec or PR. When spec and implementation
conflict, the spec wins until formally amended via `/speckit-converge`.

Rationale: specs are the durable contract between human intent and agent
execution. Skipping phases produces untestable, unevaluated code that rots.

### II. Monorepo Boundaries (NON-NEGOTIABLE)

The repo root MUST contain only Spec Kit artifacts (`.specify/`, `specs/`),
agent configuration (`.claude/`, `.mcp.json`, `CLAUDE.md`), and shared config
(compose files, `.gitignore`, `.env.example`). All application code MUST live
in exactly one owner: `frontend/` (Astro app, owned by the `astro-frontend`
subagent) or `backend/` (Agno/AgentOS service, owned by the `agno-backend`
subagent). Cross-app work MUST hand off through explicit contracts: REST
endpoints, MCP tool schemas, and `ui://` resource URIs — never through
unilateral edits to the other app.

Rationale: hard boundaries keep two runtimes (browser + Python) independently
testable, deployable, and delegable without merge-time surprises.

### III. Test-First, Both Apps (NON-NEGOTIABLE)

All code in `frontend/` and `backend/` MUST have unit tests: Vitest for every
component, island, util, and WebMCP tool module; pytest for every agent,
tool, route, and schema. Tests MUST be written before or alongside
implementation (Red-Green-Refactor) and MUST pass before any task is marked
complete. Untested code MUST NOT merge.

Rationale: a music app with playback, inference, and agent behavior has too
many silent failure modes to rely on manual verification.

### IV. Agent Behavior Is Evaluated

Every agent behavior change MUST be covered by Agno test-scenarios that run as
regression gates. New agents MUST ship with an initial scenario suite;
prompt, tool, or model changes MUST extend and re-run the suite. Eval gates
MUST be green before merge, same as unit tests.

Rationale: unit tests verify code paths; only scenario evals verify that
agents still behave. Without them, model and prompt drift go undetected.

### V. Evidence-Based Model Selection (NON-NEGOTIABLE)

All hosted LLM access MUST go through OpenRouter. Every model choice or change
MUST be made with live data from the `openrouter` project MCP server
(catalog, per-provider pricing/latency, benchmarks, test inference) by
running the `openrouter-model-eval` skill, and MUST record a decision
(requirements, candidates, test results, winner + rationale, exact model ID
and provider route) in the active spec's `research.md`. Hardcoded model IDs
without a decision record are forbidden. Model changes MUST re-run the
affected Agno eval gates (Principle IV).

Rationale: the model landscape changes weekly; training-data guesses about
price, quality, and availability expire. Live evidence plus decision records
make model choices reviewable and revisitable.

### VI. Browser AI: On-Device First, Progressive Everywhere

Browser AI MUST prefer on-device inference and MUST degrade gracefully:

- Chat/assistant features MUST use WebLLM (WebGPU) with a hosted fallback
  through `backend/` when WebGPU is unavailable.
- Embeddings, semantic search, and tagging MUST use Transformers.js v4
  (WebGPU with automatic WASM fallback).
- The Chrome AI Prompt API (Gemini Nano) MAY be used as a zero-download
  enhancement where available, never as the only path.
- WebMCP tools MUST be registered from a single `frontend/src/lib/webmcp/`
  module via `document.modelContext`, feature-detected (`'modelContext' in
  document`), with tight JSON schemas — the app MUST work fully when WebMCP
  is absent.
- Backend MCP Apps views MUST be rendered with `@mcp-ui/client` AppRenderer
  (`text/html;profile=mcp-app`, `ui://` resources, `_meta.ui.resourceUri`
  linkage).
- The browser MUST NEVER hold provider API keys or call hosted LLM APIs
  directly, except local/on-device inference. Hosted inference goes through
  `backend/`.

Rationale: on-device inference gives privacy, offline capability, and zero
marginal cost; progressive enhancement keeps every feature working on every
browser; keys in bundles leak.

### VII. Backend as Runtime and MCP Server

`backend/` MUST be a Python + Agno service served by AgentOS (FastAPI
runtime exposing REST, SSE, and MCP server mode). All persistent state
(sessions, memory, knowledge, runtime data) MUST live in the project's own
PostgreSQL database. SQLite SHOULD NOT appear in shared paths; any dev-only
SQLite use MUST be decided explicitly at plan time. Local dev SHOULD run the
full stack (AgentOS + Postgres) via Docker Compose (`docker compose up`);
alternatives MUST be documented in the plan. Auth (JWT with RBAC suggested)
SHOULD be enabled early and MUST be enforced before any network-exposed
deployment; the exact scheme is decided at plan time. Secrets MUST come
exclusively from environment. Tools needing rich presentation MUST ship MCP
Apps UI resources (`ui://` URIs + `_meta.ui.resourceUri`) for the Astro
frontend to render.

Rationale: one runtime (AgentOS) gives APIs, sessions, streaming, memory,
evals, and MCP from a single codebase; Postgres as the single source of truth
eliminates "works on my machine" state bugs. Compose, SQLite-avoidance, and
JWT/RBAC are assistant-suggested defaults — the first plan confirms, amends,
or strikes them.

### VIII. Clean Code & Clear Architecture

Both apps MUST follow clean-code practices and a clear layered architecture:

- Frontend (`frontend/src/`): `pages/` (thin routes: fetch content, compose
  components, no business logic) → `components/` (shadcn `ui/` primitives +
  domain components; presentational, props in, events out) → `lib/` (pure
  domain logic AND Zod schemas: filter, slug, note lookups, content schemas;
  no UI or framework imports — zero `astro*` imports) → `content/` (data).
  `content.config.ts` is thin Astro wiring only: it imports the pure schemas
  from `lib/` and calls `defineCollection({ loader, schema })`. Shared shell
  via `layouts/` + `styles/`. Dependency direction is strictly downward: pages
  may import components and lib; components may import lib and `ui/`;
  `content.config.ts` may import lib schemas; `lib/` MUST NOT import
  components, pages, `content.config.ts`, or any Astro APIs.
- Backend (`backend/`): `app/` (AgentOS/FastAPI composition: routes, wiring)
  → domain (`agents/`, services, tools) → `db.py` + persistence (Postgres).
  Domain modules MUST NOT import the web layer; configuration flows in via
  environment, never hardcoded.
- Clean code, both apps: small focused modules with one responsibility;
  explicit names over abbreviations; explicit types/schemas at boundaries
  (Zod in frontend, Pydantic or typed models in backend); no dead code, no
  magic numbers/strings (named constants); no duplication across the
  `frontend/`/`backend/` boundary, and none within an app past a third use.
- Component completeness: every component, island, or view that renders
  async, fetched, or list/filterable content MUST handle all UI states —
  `loading` (visible indicator + reserved space, never layout-shifting
  pop-in), `empty` (friendly message + next action), `error` (message +
  retry action, never a blank page or crash), and `ready` — plus
  `not-found` where addresses resolve. Shared states MUST live in one
  place (`ViewStates` or equivalent), not ad-hoc per view. Static
  presentational pieces with no async data (badges, heroes, frames) are
  exempt by definition.
- Standalone reusability: new UI MUST be a standalone presentational
  component (props in, events out; zero cross-component imports; zero
  business logic) that renders correctly in isolation under its
  container/jsdom test with mock props, enabling easy decoupling and reuse.
- Logic placement: business and domain logic MUST live in `backend/`
  domain modules or pure `lib/` (zero framework imports); pages and
  components MUST NOT embed business rules, fetch orchestration, or
  duplicated semantics — they compose and present only.
- Performance-first codegen: implementers MUST prefer the fastest correct
  option — content-first rendering, deferred hydration, intent
  prefetching, reserved layout space, zero new dependencies by default.
  Where a spec defines measured budgets (LCP/CLS/interaction timing), a
  budget miss MUST block release until fixed or explicitly converged.
- Lint and format gates: each app MUST ship one-command lint and format
  checks that run green in local gates (`frontend`: ESLint + Prettier with
  `eslint-plugin-astro` + `prettier-plugin-astro`; `backend`: Ruff for
  lint+format). Biome is rejected for the frontend (partial `.astro`
  support: frontmatter script only, templates unformatted/unlinted).
  Unformatted or unlinted code MUST NOT merge.

Rationale: two runtimes and two agents sharing one repo rot fast without
enforced layering. Downward-only dependencies keep domain logic testable in
isolation (Principle III), make ownership handoffs (Principle II) mechanical,
and let future features land without archaeology.

## Technology Constraints & Standards

- Frontend: Astro 7 + TypeScript (islands architecture), Tailwind CSS v4
  (latest at scaffold time, exact version pinned in `package.json`) via the
  `@tailwindcss/vite` plugin (the deprecated `@astrojs/tailwind` integration
  MUST NOT be used), shadcn/ui (React) as the UI component library and
  example-generation source, Vitest for unit tests, `@mcp-ui/client` for MCP
  Apps rendering. Live API authority is the `astro-docs` project MCP server —
  consult it instead of guessing APIs.
- Backend: Python + Agno SDK + AgentOS, pytest for unit tests, Agno
  test-scenarios for evals, own PostgreSQL database. Docker Compose for local
  dev and JWT/RBAC are suggested defaults to confirm at plan time, enforced
  before any network-exposed deployment.
- LLM plane: OpenRouter for all hosted inference (OpenAI-compatible
  interface); live model authority is the `openrouter` project MCP server.
- Protocol standards: MCP Apps (`ui://`, `text/html;profile=mcp-app`,
  `_meta.ui.resourceUri`) for tool UIs; WebMCP draft API
  (`document.modelContext`) for page-exposed tools.
- Repo-wide: Spec Kit 1.x CLI; Node and Python toolchains pinned per-app;
  secrets via environment only (`.env` never committed); lint/format tooling
  pinned per-app (Principle VIII) and green before merge.

## Development Workflow & Quality Gates

1. Specify before building: `/speckit-specify` → `/speckit-plan` →
   `/speckit-tasks` (required); `/speckit-clarify` before plan and
   `/speckit-analyze` before implement (SHOULD — justify if skipped).
2. Delegate by ownership: `frontend/` tasks to `astro-frontend`,
   `backend/` tasks to `agno-backend`; cross-app contracts agreed before
   parallel implementation.
3. Model decisions via `openrouter-model-eval` before wiring any LLM.
4. Quality gates for every change: spec compliance, unit tests green,
   lint/format green, architecture layering respected (Principle VIII),
   Agno eval gates green (agent changes), no secrets committed,
   `/speckit-converge` review after implementation.
5. `frontend/` and `backend/` MUST each keep their dev, test, build, lint,
   and format commands as one-liners documented in their READMEs — with a
   short architecture overview (layers + dependency direction) — working
   from a fresh checkout.

## Governance

This constitution supersedes all other practices in this repo. Amendments
MUST be made via `/speckit-constitution`, MUST bump the version (MAJOR for
incompatible principle changes, MINOR for new principles/sections, PATCH
for clarifications), and MUST include a Sync Impact Report for review.
All PRs and `/speckit-analyze` runs MUST verify spec/plan/task compliance
with these principles; violations MUST be justified in the PR or the
constitution amended first. Review this document whenever the stack,
protocol standards (MCP Apps, WebMCP), or eval strategy materially changes.

**Version**: 1.3.0 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-18
