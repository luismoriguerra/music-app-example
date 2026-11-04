# Quickstart: Free Search Enrichment

**Feature**: `009-free-search-enrichment`

## Prerequisites

- Stack up: `docker compose up` (API + Postgres), frontend `npm run dev --workspace frontend`.
- Keyless mode: unset `GENIUS_ACCESS_TOKEN`, `YOUTUBE_API_KEY` to exercise enrichment; `OPENROUTER_API_KEY` optional (fallback path unchanged).

## Validate

1. **US1 candidate fallback**: `POST /api/v1/song-search {"query": "Riptde"}` → expect combined list with DDG-origin entries ranked last; pick one → `POST /api/v1/sheets` succeeds.
2. **US2 links without video key**: generate a well-known song → `sheet.source_links` contains a `video` entry with `youtube.com/watch` URL; no key configured.
3. **US3 context**: same sheet → `sheet.context.source == "wikipedia"` with `source_url`; frontend shows separate context block.
4. **Degradation**: start the API with `ENRICH_TIMEOUT_S=0` → enrichment is skipped; sheets carry `degraded [{part: "enrichment", reason: "unavailable"}]` and behave as 004. Values between 0 and 1 skip the links stage (the search needs ≥1 s) and mark `reason: "timeout"`. Blocking DDG/Wikipedia at the network instead yields empty enrichment (no marker — see DR-009 residual risk).
5. **History zero re-query**: `GET /api/v1/history/{id}` twice → identical `source_links` + `context`, no new lookups (`tests/test_routes_sheets_history.py::test_history_get_serves_stored_context_verbatim_zero_requery`).
6. **Gates**: in `backend/` — `ruff format --check . && ruff check .`, `pytest`, `pytest evals/`, and the live gate `ENRICH_LIVE_EVALS=1 pytest evals/test_sheets_enrich_live.py` (network); in `frontend/` — `npm run lint`, `npm run format:check`, `npm run check`, `npx vitest run`.
