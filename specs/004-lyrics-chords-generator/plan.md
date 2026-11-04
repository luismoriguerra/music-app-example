# Implementation Plan: Ukulele Lyrics + Chords Generator

**Branch**: `004-lyrics-chords-generator` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-lyrics-chords-generator/spec.md`

## Summary

Ukulele's first Game card: a "Lyrics + Chords" generator. A song-name input
drives backend search → candidate disambiguation → sheet generation (lyrics
with aligned chord symbols, per-part attribution, outbound sources incl.
video), with server-side single-owner history for re-open and regenerate.
Technical approach (from research): chart-takes-all pipeline (R0) — top-rated
chord chart supplies the whole sheet on hit; on chart miss, LRCLIB/lyrics.ovh
lyrics plus model-aligned chords via the gated OpenRouter fallback (R6);
YouTube + page links persisted per sheet with a no-requery rule (R7). Astro
stays fully static (game page shell + runtime `SheetGenerator` search island, plus one prerendered sheet-page shell hosting the `SheetEntry` island, rewritten for every entry id — 2026-10-01 amendment, R11);
`backend/` gains REST routes + `agents/sheets/` domain + SQLAlchemy history
tables on the existing Postgres (R10).

## Technical Context

**Language/Version**: TypeScript 6.x (Astro 7.x — `astro@7.3.2`, React 19
islands) + Python 3.12 (AgentOS backend)

**Primary Dependencies**: `astro@7`, `@astrojs/react@6`, `react`/`react-dom` 19,
`tailwindcss` v4 + `@tailwindcss/vite`, shadcn/ui primitives, `zod` v4, Vitest 5
+ Testing Library + jsdom, `tsx`, ESLint + Prettier (astro plugins) — no new
frontend deps; backend: `agno[os]`, `fastapi`, `uvicorn`, `psycopg[binary]`,
`sqlalchemy`, `pgvector`, `httpx` (promoted dev → main), `openai>=1,<2`
(runtime for Agno's OpenRouter provider behind the R6 fallback Agent —
no bare SDK calls; configured only after research Appendix A is filled), pytest, ruff

**Storage**: PostgreSQL 17 (existing Compose `db`, pgvector image) — new
`song_sheets` + `history_entries` tables via SQLAlchemy (R10, data-model.md);
Astro Content Layer JSON for the static `games/lyrics-chords.json` entry only.
No SQLite anywhere.

**Testing**: Vitest + React Testing Library + jsdom (frontend, incl. Zod
contract tests for REST shapes); pytest + httpx `TestClient` + recorded
provider fixtures (backend); Agno test-scenarios for the model fallback path
(`chord_coverage`, `attribution_present`, `vocabulary_valid`,
`lyrics_untouched`) — see R12

**Target Platform**: Web — static Astro frontend + Docker Compose backend
(api + db), same topology as 001/002

**Project Type**: Web application (frontend + backend)

**Performance Goals**: Search → sheet/candidates/no-match within 30 s
(SC-002); backend budget 25 s (10 s per provider call; model fallback ≤20 s);
chart/lyrics hits target p50 <10 s; history re-open is a single local DB read
(no provider re-query, R7)

**Constraints**: Standard ukulele tuning GCEA; full chord vocabulary, standard
Western notation (FR-013); English-only UI; modern browser + network (offline
out of scope); semantic markup + keyboard operability for input, cards, lists,
history; no redistribution/publishing/sharing of song content; no embedded
playback (links out only); secrets via env only; polite provider clients
(sequential + throttle, honor 429); YouTube ~100 searches/day quota → persist
links, re-query only on generate/regenerate; CORS via CORSMiddleware from CORS_ORIGINS env (default http://localhost:4321)

**Scale/Scope**: Single owner (synthetic `OWNER_ID`, no login); history in the
hundreds of entries; 1 game entry; 5 REST endpoints; n=8 probe songs as the
measured baseline (counts, not a projected rate)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS | specify → H1–H5 review (user-accepted, recorded in spec Clarifications) → plan now; tasks → analyze → implement → converge to follow |
| II. Monorepo boundaries | PASS | App code only under `frontend/` + `backend/`; cross-app handoff via `contracts/rest-api.md` (+ `contracts/game-route.md`) before parallel implementation |
| III. Test-first both apps | PASS | R12: Vitest (schemas, lib, island, content gate) + pytest (routes, domain w/ fixtures, models) planned test-first in tasks; CI hermetic (no live providers) |
| IV. Agent evals | PASS (planned) | Fallback path is the only nondeterministic step; 4 Agno scenarios defined in R12, MUST be green before merge + re-run on prompt/tool/model change |
| V. Evidence-based models | CONDITIONAL PASS | No model chosen in this plan (MCP unavailable in plan session); R6 + Appendix A define the mandatory tasks-phase `openrouter-model-eval` gate — no model-ID code merges before the record is filled |
| VI. Browser AI | PASS (compatible) | No browser AI in this feature; all hosted fetching/inference via `backend/`; browser holds zero keys; no WebMCP/MCP-UI surface added |
| VII. Backend runtime + Postgres | PASS | AgentOS mount unchanged; feature tables are SQLAlchemy on the same Postgres; Compose dev; no SQLite; JWT/RBAC deferred with written justification (single-owner, no login per FR-011, no exposed deployment) |
| VIII. Clean code & architecture | PASS | Frontend: thin game shell → presentational components → pure `lib/` (+ Zod); no SSR fetch. Backend: `app/routes_sheets.py` → `agents/sheets/` → `db_models.py`; env-only config; ESLint+Prettier/Ruff gates |
| Tech Constraints & Standards | PASS | Astro+TS+Tailwind v4+shadcn+Vitest / Agno+pytest+Postgres; OpenRouter-only hosted inference; secrets via env only |
| Workflow gates | PASS | Ownership split (island+shell → astro-frontend; routes+domain+evals → agno-backend); contracts agreed first; one-liner dev/test/build per app in quickstart |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations). The single residual risk (R8 UG
persistence) is a user-accepted licensing posture with documented triggers,
not a constitution violation.

## Project Structure

### Documentation (this feature)

```text
specs/004-lyrics-chords-generator/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── rest-api.md      # backend REST contract (frontend ↔ backend)
│   └── game-route.md    # game content entry + route/view-state contract (delta on 001)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/                          # Astro app (astro-frontend owns)
├── src/
│   ├── content/
│   │   └── games/lyrics-chords.json  # NEW: Game entry (title "Lyrics + Chords", kind game, courseSlug ukulele, rules, order)
│   ├── lib/
│   │   ├── sheets.ts                 # NEW: pure helpers (candidate select, chord-position normalize, catalog cross-link match; zero Astro imports)
│   │   ├── chord-diagrams.ts         # NEW (M2 amendment 2026-09-16): pure FR-013 symbol parse + GCEA voicing search for off-catalog chords + semitone transpose helpers (transpose amendment 2026-09-16; zero Astro imports)
│   │   └── sheets/
│   │       └── schemas.ts            # NEW: Zod schemas mirroring contracts/rest-api.md (response validation)
│   ├── components/
│   │   ├── SheetGenerator.tsx        # NEW: React island — input → candidates → paginated/filterable history; generate/open navigate to the sheet page (sheet-page amendment 2026-10-01)
│   │   ├── SheetEntry.tsx            # NEW (sheet-page amendment 2026-10-01): dedicated sheet page island — id from path, title breadcrumb, favorite/regenerate/delete, not-found
│   │   ├── SheetView.tsx             # NEW: presentational sheet (sections, chords-above-lyrics, attribution block, "Chords in this song" reference rail)
│   │   ├── ChordPopover.tsx          # NEW (inline-diagrams amendment 2026-09-16): inline chord symbol disclosing its ChordDiagram on mouse hover / tap-pin / Escape-close
│   │   ├── TransposeControl.tsx        # NEW (transpose amendment 2026-09-16): presentational semitone stepper with reset + Reset/±3 shortcuts (display-only)
│   │   ├── CandidateList.tsx         # NEW: presentational candidate rows
│   │   ├── HistoryList.tsx           # NEW: presentational history grid (newest-first, title/open links to the sheet page, favorite star, regenerate + delete behind confirm)
│   │   ├── ConfirmDialog.tsx         # NEW (sheet-actions amendment 2026-09-16): shared inline alertdialog (Cancel autofocus, Escape, destructive/neutral) used by card + sheet toolbar for regenerate/delete
│   │   └── SourceLinks.tsx           # NEW: presentational FR-016 outbound links
│   ├── lib/sheets/history-api.ts    # NEW (2026-10-01): shared history REST client + navigateTo seam
│   └── pages/
│       └── courses/[course]/games/
│           ├── [game].astro                # EDIT: render SheetGenerator island for lyrics-chords; keep coming-soon for other games
│           └── lyrics-chords/entry.astro   # NEW (2026-10-01): static sheet-page shell for /lyrics-chords/<entry_id>
├── public/serve.json              # NEW (2026-10-01): prod rewrite /lyrics-chords/:entry → shell (dev twin: middleware in astro.config.mjs)
├── tests/  (*.test.ts(x) + fixtures: schema valid/invalid, lib/sheets, lib/chord-diagrams, island states, game-entry integrity)
├── scripts/check-content.ts       # EXTEND (if needed): games-entry integrity assertions ride the existing validateCollections gate
└── README.md                      # EXTEND: PUBLIC_API_URL env documented

backend/                           # AgentOS service (agno-backend owns)
├── app/
│   ├── main.py                    # EDIT: include routes_sheets router (health + AgentOS mount unchanged)
│   └── routes_sheets.py           # NEW: REST routes (search, sheets, history CRUD, regenerate) + error taxonomy
├── agents/sheets/                 # NEW: domain package (no web imports)
│   ├── __init__.py
│   ├── pipeline.py                # R0 orchestration (chart-hit → whole sheet; miss → lyrics + fallback)
│   ├── charts.py                  # R5 Python chart client (search+fetch, fixtures)
│   ├── lyrics.py                  # R1/R2 LRCLIB primary + lyrics.ovh fallback
│   ├── candidates.py              # R3 Genius-primary merge (+ LRCLIB-only no-token mode)
│   ├── sources.py                 # R7 FR-016 link assembly (pages + YouTube)
│   ├── normalize.py               # chart/lyrics → structured line/chord-position shape
│   └── fallback.py                # R6 Agno Agent chord alignment, factory-built + NOT in AgentOS (wired ONLY after Appendix A gate)
├── db_models.py                   # NEW: SQLAlchemy song_sheets + history_entries (+ OWNER_ID constant)
├── evals/                         # NEW: Agno scenarios (chord_coverage, attribution_present, vocabulary_valid, lyrics_untouched)
├── tests/                         # NEW: route/domain/model tests + recorded provider fixtures (no live calls)
├── pyproject.toml                 # EDIT: httpx → main deps; add openai>=1,<2 (Agno OpenRouter provider runtime)
└── README.md                      # EXTEND: new env vars + eval one-liner

docker-compose.yml                  # EDIT: add ${OPENROUTER_API_KEY:-}/${YOUTUBE_API_KEY:-}/${GENIUS_ACCESS_TOKEN:-}/${OWNER_ID:-} under api.environment (no new service; compose has no env_file so explicit entries are required)
.env.example                        # EDIT: OPENROUTER_API_KEY / YOUTUBE_API_KEY / GENIUS_ACCESS_TOKEN / CORS_ORIGINS / OWNER_ID placeholders (all optional at runtime w/ graceful degradation)
frontend/Dockerfile               # NOTE: PUBLIC_API_URL is inlined at Astro build time — prod builds need it as a build ARG or the bundle bakes http://localhost:8000 (deploy note)
```

**Structure Decision**: Web application layout, extending the 001/002 trees in
place. No new top-level project, service, or framework. Frontend proves the
reserved Game route with one entry + one island; backend grows its first
feature traffic inside the existing `app/ → agents/ → db` layering on the
existing Postgres. Contracts (`rest-api.md`, `game-route.md`) are agreed
before any parallel frontend/backend task.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
