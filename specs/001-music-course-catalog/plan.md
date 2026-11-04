# Implementation Plan: Music Course Catalog (Ukulele + Chords)

**Branch**: `001-music-course-catalog` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-music-course-catalog/spec.md`

## Summary

Build the v1 music course catalog: a Home page listing course cards, a course
page listing Topic/Game cards, and the Ukulele course's Chords topic as a
filterable chord reference (grouped dropdown: All chords / Major / Minor /
per-note with flats + sharps; inline-expanding detail display on select,
single-open and collapsible; audio researched in R8 with a
recommendation, none ships in v1). Technical approach
(from research): Astro 5 Content Layer holds all curated content as
Zod-validated JSON in `frontend/` with static pages and one React island for
the Chords explorer; `backend/` ships as an AgentOS + Postgres scaffold with
no feature traffic so monorepo workflow gates hold from day one.

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 7.x — `create-astro` resolved
`astro@7.3.2` at scaffold time, superseding the `astro@5` planning pin; same
Content Layer / Container APIs — React 19 islands) + Python 3.12 (AgentOS backend)

**Primary Dependencies**: `astro@7`, `@astrojs/react@6`, `react`/`react-dom` 19,
`tailwindcss` v4 + `@tailwindcss/vite`, shadcn/ui (React: `components.json`,
`src/components/ui/*`, `src/lib/utils.ts`, CVA/clsx/tailwind-merge/lucide-react),
`zod`, `tsx` (check-content runner), ESLint + Prettier (`eslint-plugin-astro`/`prettier-plugin-astro`)
lint/format (frontend); `agno[os]`, `fastapi`,
`uvicorn`, `psycopg[binary]`, `sqlalchemy`, `ruff` lint/format (backend);
`@mcp-ui/client` reserved for future AppRenderer use (not installed in v1 —
no MCP views ship)

**Storage**: N/A for feature data (static Content Layer collections);
PostgreSQL 17 via pgvector image for backend runtime state (scaffold only)

**Testing**: Vitest + React Testing Library + jsdom (frontend); pytest +
httpx (backend)

**Target Platform**: Web — static frontend (Astro static output) + local
Docker Compose backend (api + db)

**Project Type**: Web application (frontend + backend)

**Performance Goals**: Chord filter updates visibly within 2s of selection
(SC-002, target <100ms client-side); static pages show primary content
within 2s on broadband/4G (SC-007) with zero-JS on Home/course pages
(single hydrated island on Chords view only)

**Constraints**: Standard ukulele tuning GCEA; English-only UI; modern
browser + network (offline out of scope); semantic markup + keyboard
operability for cards/dropdown/list; no secrets in repo (`.env` gitignored)

**Scale/Scope**: ≥20 course cards Home, ≥50 topic/game cards per course page
(SC-004); 24 chord entries (12 pitches × major/minor, SC-005), ~20 grouped
filter options; 1 course, 1 topic, 0 games seed v1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS | specify → clarify done; plan now; tasks → analyze → implement → converge to follow |
| II. Monorepo boundaries | PASS | App code only under `frontend/` + `backend/`; specs under `specs/`; zero cross-app calls in v1 (see contracts/routes.md) |
| III. Test-first both apps | PASS | Vitest (schemas, slug, filter, components) + pytest (health, config) planned test-first in tasks |
| IV. Agent evals | N/A | No agents ship or change in this feature — no test-scenarios required |
| V. Evidence-based models | N/A (recorded) | No hosted inference in v1; research R6 is the decision record, no `openrouter-model-eval` run needed |
| VI. Browser AI | N/A (compatible) | No browser AI in v1; React-island choice preserves the AppRenderer path; no WebMCP tools to expose yet |
| VII. Backend runtime + Postgres | PASS | AgentOS + own Postgres via Compose scaffold; no SQLite; JWT/RBAC deferred with written justification (anonymous, no exposed deployment in v1) |
| VIII. Clean code & architecture | PASS | Pure lib incl. Zod schemas, thin content.config wiring + check-content prebuild gate (R10); ESLint+Prettier/Ruff one-liners scaffolded |
| Tech Constraints & Standards | PASS | Astro+TS+Tailwind v4+shadcn+Vitest / Agno+pytest+Postgres; secrets via env only |
| Workflow gates | PASS | Ownership split frontend/backend defined; one-liner dev/test/build per app in quickstart |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/001-music-course-catalog/
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
frontend/                          # Astro app (astro-frontend owns)
├── src/
│   ├── content.config.ts          # thin wiring: defineCollection({ loader, schema }) importing pure lib schemas (per-entry only)
│   ├── content/
│   │   ├── courses/ukulele.json
│   │   ├── topics/chords.json     # topic entry (chord entries in chords/)
│   │   ├── games/                 # empty in v1 (reserved)
│   │   └── chords/*.json          # 24 entries (major+minor x 12 pitches, enharmonics combined)
│   ├── lib/
│   │   ├── slug.ts                # slugify + uniqueness helpers
│   │   ├── chords.ts              # filterChords() + FilterOption; Chord via z.infer (no Astro imports)
│   │   ├── notes.ts               # NOTE_ROOTS/ALIASES + ROOT_PITCH/ENHARMONIC_PAIR (zero-import leaf)
│   │   ├── content/schemas.ts     # pure Zod schemas + refines (imports zod + ../notes only)
│   │   ├── content/validate.ts    # validateCollections() cross-collection checks (imports types + ../notes only)
│   │   └── utils.ts               # shadcn cn() helper (clsx + tailwind-merge)
│   ├── styles/
│   │   └── global.css             # Tailwind v4 import + @theme tokens (via Layout)
│   ├── layouts/
│   │   └── Layout.astro           # shared layout importing global.css (every page uses it)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives (button, native-select, dialog, card, ...)
│   │   ├── CourseCard.astro       # static card
│   │   ├── TopicGameCard.astro    # static card with kind label
│   │   ├── ChordDiagram.tsx       # SVG diagram (React, island-safe)
│   │   ├── ChordList.tsx          # filter island: dropdown + list + detail
│   │   └── ViewStates.astro       # loading/empty/error partials
│   └── pages/
│       ├── index.astro            # / (Story 1)
│       ├── 404.astro              # not-found (FR-014)
│       └── courses/
│           ├── [course].astro     # course page (Story 2)
│           └── [course]/
│               ├── topics/[topic].astro   # Chords view (Story 3)
│               └── games/[game].astro     # reserved pattern
├── tests/  (*.test.ts(x) + fixtures; all frontend unit tests live here)
├── scripts/check-content.ts       # reads src/content/**/*.json + validateCollections, exits non-zero (run via tsx; prebuild gate)
├── package.json                   # pins: astro@7, react 19, tailwindcss v4, vitest 5, Testing Library, tsx, eslint 9 (eslint-plugin-jsx-a11y has no eslint 10 peer yet); scripts: "check-content": "tsx scripts/check-content.ts", "prebuild": "npm run check-content"
├── components.json                # shadcn CLI config (rsc:false, tsx:true, @/* aliases)
└── README.md                      # dev/test/build one-liners

backend/                           # AgentOS service (agno-backend owns)
├── app/main.py                    # AgentOS app + GET /health
├── db.py                          # PostgresDb wiring (env config)
├── agents/                        # empty in v1 (reserved)
├── evals/                         # empty in v1 (no agents → no evals)
├── tests/test_health.py           # health + config tests
├── pyproject.toml                 # pins: agno[os], fastapi, uvicorn, pytest
├── Dockerfile
└── README.md                      # dev/test/build one-liners

docker-compose.yml                  # api + db (pgvector/pgvector:pg17) — root shared config
.env.example                        # DB_* + future keys (no secrets)
```

**Structure Decision**: Web application layout. `frontend/` = Astro 5 static
site with Content Layer collections and one React island; `backend/` =
minimal AgentOS + Postgres scaffold proving the Compose path with no v1
feature traffic. Shared Compose file + `.env.example` at root per Principle II
(shared config allowed). Layering follows Principle VIII / R10: thin routes over presentational components over pure lib; app composition over domain over persistence.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
