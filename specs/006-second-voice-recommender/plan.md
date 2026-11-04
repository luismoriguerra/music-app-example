# Implementation Plan: AI Second-Voice Recommender (Lyrics + Chords)

**Branch**: `006-second-voice-recommender` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-second-voice-recommender/spec.md` + DR-001/DR-002/DR-003 (all Accepted).

## Summary

A transpose-aware "AI 2nd voice" button inside the 004 Lyrics + Chords sheet view. The learner sets a singing key with the stepper, selects the button, and the backend runs the owner's 19-step English harmonic + second-voice curriculum through an Agno Agent over OpenRouter with a `SecondVoiceOut` JSON `output_schema`. The frontend POSTs the rendered transposed chords (`chords_by_line` from `displaySheet`) plus provenance (DR-001: zero transpose duplication, parity by construction); the backend validates shape/count/vocabulary against the immutable stored sheet, zips onto stored lyrics, and persists every completed analysis with per-song newest-first history (DR-002). Rendering is data-driven from JSON with fail-closed semantics on schema violation (DR-003); the no-melody gate holds (strategy only, zero invented pitches).

## Technical Context

**Language/Version**: TypeScript 6.x (Astro 7.x — `astro@7.3.2`, React 19 islands) + Python 3.12 (AgentOS backend). Same pins as 004; no version changes.

**Primary Dependencies**: No new deps either app. Frontend: `astro@7`, `@astrojs/react@6`, React 19, Tailwind v4 + `@tailwindcss/vite`, shadcn/ui primitives, `zod` v4, Vitest 5 + Testing Library + jsdom, ESLint + Prettier (astro plugins). Backend: `agno[os]`, `fastapi`, `uvicorn`, `psycopg[binary]`, `sqlalchemy`, `pgvector`, `httpx`, `openai>=1,<2` (Agno OpenRouter provider runtime, already added in 004), pytest, ruff.

**Storage**: PostgreSQL 17 (existing Compose `db`, pgvector image) — new `second_voice_analyses` table via SQLAlchemy (FK → `song_sheets`, CASCADE; R4, data-model.md). No content-layer changes (no new card/route/entry). No SQLite anywhere.

**Testing**: Vitest + React Testing Library + jsdom (frontend: Zod mirrors, `lib/second-voice` pure helpers, panel/view/history components); pytest + httpx `TestClient` + recorded fixtures (backend: routes, snapshot validation, models); Agno test-scenarios for the analysis agent (`transpose_respected`, `degrees_consistent`, `non_diatonic_flagged`, `no_invented_melody` [critical], `english_format_complete`, `latency_within_budget`) — see R6.

**Target Platform**: Web — static Astro frontend + Docker Compose backend (api + db), same topology as 001/002/004.

**Project Type**: Web application (frontend + backend).

**Performance Goals**: Request → structured analysis / error-with-retry within 60 s wall (SC-002); backend inference budget 45 s (single Agno call, ~2–4k output tokens); history list + re-open are single local DB reads (zero providers, R7/004-R7).

**Constraints**: Standard ukulele tuning GCEA (analysis assumes it); full chord vocabulary, standard Western notation (004 FR-013, reused); All-English chrome + analysis body (FR-012); Anglo note names with explicit sharps/flats; semantic markup + keyboard operability for button, panel, history; no redistribution/publishing/sharing of song content or analyses; minimal lyric snippets as table anchors only; secrets via env only; no lyric text on the request wire (DR-001/FR-002).

**Scale/Scope**: Single owner (synthetic `OWNER_ID`, no login); analyses in the hundreds (same scale as 004 history); 0 new routes on the Astro side (panel inside the open sheet view); 4 new REST endpoints; frozen eval sample: 5 analyses over ≥3 songs at varied offsets (SC-005).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS | specify (this spec + DR-001–003 Accepted) → plan now; tasks → analyze → implement → converge to follow |
| II. Monorepo boundaries | PASS | App code only under `frontend/` + `backend/`; handoff via `contracts/rest-api.md` (+ `contracts/analysis-panel.md`) before parallel implementation |
| III. Test-first both apps | PASS | R11: Vitest (schemas, lib, panel/view/history) + pytest (routes, validation, models) planned test-first in tasks; CI hermetic (no live inference; evals skip without key, 004 precedent) |
| IV. Agent evals | PASS (planned) | New analysis agent ships with a 6-scenario suite (R6); gates MUST be green before merge + re-run on prompt/tool/model change; `no_invented_melody` is critical |
| V. Evidence-based models | CONDITIONAL PASS | No model chosen in this plan; R3 + Appendix A define the mandatory tasks-phase `openrouter-model-eval` gate — no model-ID code merges before the record is filled; Luna MUST NOT be reused without re-evaluation (different task) |
| VI. Browser AI | PASS (compatible) | No browser AI; all inference via `backend/`; browser holds zero keys; no WebMCP/MCP-UI surface added |
| VII. Backend runtime + Postgres | PASS | AgentOS mount unchanged; new table is SQLAlchemy on the same Postgres; Compose dev; no SQLite; JWT/RBAC deferred with the same written justification as 004 (single-owner, no login per FR-005, no exposed deployment) |
| VIII. Clean code & architecture | PASS | Frontend: island tree → container + presentational components → pure `lib/` (+ Zod); no SSR fetch. Backend: `app/routes_second_voice.py` → `agents/second_voice/` → `db_models.py`; env-only config; ESLint+Prettier/Ruff gates; no cross-boundary transpose duplication (DR-001) |
| Tech Constraints & Standards | PASS | Astro+TS+Tailwind v4+shadcn+Vitest / Agno+pytest+Postgres; OpenRouter-only hosted inference; secrets via env only |
| Workflow gates | PASS | Ownership split (panel+view+history → astro-frontend; routes+domain+evals → agno-backend); contracts agreed first; one-liner dev/test/build per app in quickstart |

Post-design re-check: no new violations introduced. No Complexity Tracking entries needed. FR-012 is all-English (Spanish locale removed 2026-09-17 per owner request); no constitution carve-out remains.

## Project Structure

### Documentation (this feature)

```text
specs/006-second-voice-recommender/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── rest-api.md      # backend REST contract (frontend ↔ backend)
│   └── analysis-panel.md # panel/view-state contract (delta on 004 game-route)
├── decisions/           # DR-001/DR-002/DR-003 (Accepted, pre-plan)
├── checklists/
│   └── requirements.md  # spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                          # Astro app (astro-frontend owns)
├── src/
│   ├── lib/
│   │   ├── second-voice.ts         # NEW: pure helpers (snapshot builder displaySheet→chords_by_line, stale check, heading map; zero Astro imports)
│   │   └── sheets/
│   │       └── schemas.ts          # EDIT: Zod mirrors of contracts/rest-api.md (request, analysis, list/get/delete shapes)
│   ├── components/
│   │   ├── SecondVoicePanel.tsx    # NEW: container — trigger button + POST/GET/DELETE via apiBaseUrl, stale derivation, history open/close, loading/error/empty states
│   │   ├── SecondVoiceView.tsx     # NEW: presentational — practical sections (Recommended second voice, note table, singing tips) + missing-melody notice from Analysis JSON (amended 2026-11-02, 013)
│   │   ├── AnalysisHistoryList.tsx # NEW: presentational — newest-first entries (@Tr badge, timestamp, model), open + delete via ConfirmDialog reuse
│   │   └── SheetView.tsx           # EDIT: shared stepper + Sheet | AI 2nd voice tabs; SecondVoicePanel lazy-mounted in the analysis tabpanel (hidden keeps state); thread apiBaseUrl; pass displaySheet + transpose; no tabs when chordsMissing
│   └── (SheetGenerator.tsx)        # EDIT (only if needed): thread apiBaseUrl into SheetView
├── tests/  (second-voice.test.ts, schemas additions, SecondVoicePanel/View/HistoryList tests, SheetView button-placement tests)
└── README.md                      # untouched (PUBLIC_API_URL already documented in 004)

backend/                           # AgentOS service (agno-backend owns)
├── app/
│   ├── main.py                    # EDIT: include routes_second_voice router (health + AgentOS mount unchanged)
│   └── routes_second_voice.py     # NEW: REST routes (analyze, list, get, delete) + error taxonomy reuse
├── agents/second_voice/           # NEW: domain package (no web imports)
│   ├── __init__.py
│   ├── analyze.py                 # SecondVoiceOut schemas + INSTRUCTIONS (19 steps) + build_agent factory + run/zip (004 fallback.py precedent)
│   └── validate.py                # snapshot-vs-stored validation (counts, offsets, FR-013 vocab) + transpose-range guard
├── db_models.py                   # EDIT: second_voice_analyses table + validators + mapper events + CASCADE
├── evals/
│   └── test_second_voice.py       # NEW: 6 Agno scenarios (R6), live, skip without key (004 eval precedent)
├── tests/                         # NEW: route/validation/model tests + recorded analysis fixtures (no live calls)
└── README.md                      # EXTEND: analysis routes + eval one-liner + budget env (if any)

docker-compose.yml                  # untouched (OPENROUTER_API_KEY already wired in 004)
.env.example                        # untouched (no new env vars; inference reuses OPENROUTER_API_KEY)
```

**Structure Decision**: Web application layout, extending the 004 trees in place. No new top-level project, service, or framework. Frontend proves the panel-inside-sheet composition with one container + two presentational components + one pure lib module; backend grows its second feature surface inside the existing `app/ → agents/ → db` layering on the existing Postgres. Contracts (`rest-api.md`, `analysis-panel.md`) are agreed before any parallel frontend/backend task.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
