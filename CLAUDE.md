# music-app-example

Spec-driven music app. Spec Kit is the source of truth at the repo root; application code lives only in `frontend/` and `backend/`.

## Stack

- **Frontend** (`frontend/`): Astro + TypeScript, islands architecture, Tailwind CSS v4 + shadcn/ui. WebMCP tools (`document.modelContext`, progressive enhancement), MCP-UI client rendering backend MCP Apps views, in-browser LLMs (WebLLM for chat, Transformers.js v4 for embeddings/search/tagging, Chrome AI Prompt API where available).
- **Backend** (`backend/`): Python + Agno/AgentOS (FastAPI runtime, REST + MCP server mode) + PostgreSQL (sessions, memory, knowledge). LLMs exclusively via OpenRouter.
- **Evals & tests**: Agno test-scenarios as behavior regression gates; Vitest (frontend) + pytest (backend) unit tests for all code.

## Spec Kit workflow

Run slash commands in order, one phase at a time:

`/speckit-constitution` → `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` → `/speckit-converge`

- Constitution (`.specify/memory/constitution.md`) is non-negotiable governance; specs/plans must comply.
- Never hand-write app code that a spec phase should produce. Never skip specify/plan.

## MCP servers (project scope, `.mcp.json` — shared, no secrets inside)

- `openrouter` — live model catalog, pricing, benchmarks, test inference. Per-user auth: `claude mcp login openrouter` (one-time OAuth, capped key) or `/mcp` → openrouter → Authenticate.
- `astro-docs` — live Astro documentation. No auth.

## Subagents (`.claude/agents/`)

- `astro-frontend` — everything under `frontend/`.
- `agno-backend` — everything under `backend/`.
- Delegate by ownership; cross-app tasks hand off with explicit contracts (endpoints, MCP tools + schemas, `ui://` URIs).

## Skills (`.claude/skills/`)

- `speckit-*` — managed by Spec Kit, do not edit.
- `openrouter-model-eval` — run before any LLM choice/change; records the decision in the active spec's `research.md`.
- `run-app-locally` — start/stop/test the app with dev secrets from Infisical (`infisical run`); troubleshooting for missing-secret and DB auth errors.
- `add-secret` — plumb a new env var or secret through compose, `.env.example`, Infisical dev/prod and the Railway sync (also removal).
- `rotate-secret` — rotate API keys and DB passwords (dev and prod) without an outage; verification checks included.

## Conventions

- Repo root is Spec Kit + shared config only — no app code at root.
- No LLM provider calls from the browser except local/on-device inference; hosted inference goes through `backend/`.
- No hardcoded model IDs without an OpenRouter-MCP-backed decision record.
- Secrets via environment only, injected from Infisical (dev/prod); `.env.example` lists names only; never commit `.env` files.
- Clean code + clear architecture (constitution VIII): downward-only dependencies (frontend: pages → components → lib → content; backend: app → domain → persistence); lint/format green before merge.

## Commands (after scaffolding)

- Frontend dev: `cd frontend && npm run dev` · Frontend tests: `cd frontend && npm test` (or `npx vitest run`)
- Backend dev: `infisical run --env=dev --path=/backend -- docker compose up -d --build` (AgentOS + Postgres) · Backend tests: `infisical run --env=dev --path=/backend -- .venv/bin/pytest` in `backend/`
- Spec Kit: `specify integration status`, `specify self check`
