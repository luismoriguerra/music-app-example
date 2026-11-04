# Implementation Plan: Free Search Enrichment

**Branch**: `feat/free-search-enrichment-1606` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-free-search-enrichment/spec.md`

## Summary

Enrich the 004 Lyrics + Chords search with keyless free search and metadata sources: DuckDuckGo web search for candidate fallback and video/page link discovery, Wikipedia for song context, direct httpx for link validation, and YouTube oEmbed for video enrichment. All enrichment is metadata/links-only, ranked below configured providers, budget-bound with graceful degradation, history behavior unchanged. Architectural decisions recorded in [spec.md](./spec.md#decision-records) (DR-001 through DR-006).

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript + Astro 7 (frontend touch-ups only)

**Primary Dependencies**: Agno 2.x (`agno.tools.websearch.WebSearchTools` on pinned engines `brave,yahoo`, DR-007), `ddgs`, `beautifulsoup4` (title extraction, DR-003), httpx (link validation, YouTube oEmbed, MediaWiki API — DR-003/DR-008/DR-010), FastAPI + AgentOS, SQLAlchemy, Zod

**Storage**: PostgreSQL (existing `song_sheets` / `history_entries` only; enriched links + context persist inside existing `source_links` / new nullable `context` JSON on the sheet row — no new tables)

**Testing**: pytest (backend domain + routes), Vitest (frontend render of context block + enriched links), Agno test-scenarios (enrichment degradation gates)

**Target Platform**: Linux server (Railway) + modern browser; `docker compose up` local stack

**Project Type**: Web application (Astro frontend + FastAPI backend)

**Performance Goals**: SC-003: search-to-result within existing 30 s wall-clock (25 s backend budget); enrichment stages capped at ~6 s combined, short-circuit on deadline

> **Superseded by DR-009 (2026-09-22):** enrichment budgets are per-stage targets (`ENRICH_TIMEOUT_S`, default 3 s) enforced by per-call timeouts and deadline gating, not a hard ~6 s cap. SC-003 is a gated target carried over from 004 and is not guaranteed.

**Constraints**: No new secrets (all keyless); browser never holds keys; enrichment never reproduces lyric/chord text (R8 posture from 004); per-part attribution unchanged; history re-open zero re-query

**Scale/Scope**: Single-owner hobby app; ~100 free searches/day equivalent with zero quota cost; 10-song validation sample

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Spec-Driven: spec ratified before plan; tasks after plan; analyze before implement.
- [x] II. Monorepo Boundaries: backend domain in `backend/agents/sheets/enrich/` owned by `agno-backend`; frontend only presents `context` + links via existing `SheetView`/`SourceLinks` contracts.
- [x] III. Test-First: pytest + Vitest + eval gates defined in plan;Fixtures recorded so CI never hits live providers.
- [x] IV. Agent Behavior Evaluated: degradation + ranking gates for every new tool path.
- [x] V. Evidence-Based Models: no model choice/change in this feature — reuse of Appendix A winner `openai/gpt-5.6-luna` unchanged; no `openrouter-model-eval` required (no new inference path).
- [x] VI. Browser AI: no browser inference change; WebMCP/MCP-UI untouched.
- [x] VII. Backend as Runtime: REST-first, AgentOS mount unchanged, Postgres only, secrets via env, graceful key absence preserved.
- [x] VIII. Clean Code & Architecture: `app/` → `agents/sheets/enrich/` → persistence; pure domain, no web imports in domain; named constants for timeouts/budgets; Ruff + ESLint/Prettier green.

Post-design re-check: PASS — no new violations; no complexity-tracking entry needed (no new service, no new table).

## Project Structure

### Documentation (this feature)

```text
specs/009-free-search-enrichment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── agents/sheets/enrich/
│   ├── __init__.py
│   ├── candidates_free.py    # DDG candidate fallback (US1)
│   ├── links_free.py         # DDG + website + youtube link discovery (US2)
│   └── context_free.py       # Wikipedia song context (US3)
├── app/routes_sheets.py      # wire enrichment stages (no new routes)
├── tests/test_sheets_enrich_*.py
└── evals/test_sheets_enrich.py

frontend/
├── src/components/SheetView.tsx   # context block (presentational only)
├── src/components/SourceLinks.tsx # enriched kinds (no logic change)
└── src/lib/sheets/schemas.ts      # context field (Zod, pure)
```

**Structure Decision**: Web-app layout per 004 precedent. New pure domain package `backend/agents/sheets/enrich/` keeps pipeline layering (`app/` wires, domain enriches, persistence unchanged). Frontend changes are presentational only; no business logic leaves `backend/`.

## Complexity Tracking

> No constitution violations; table omitted.
