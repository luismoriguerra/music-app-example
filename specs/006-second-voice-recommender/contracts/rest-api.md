# Contract: Second-Voice REST API (frontend ↔ backend)

**Feature**: `006-second-voice-recommender` | **Date**: 2026-09-17
**Spec**: [../spec.md](../spec.md) | **Research**: R0/R4/R9 in [../research.md](../research.md) | **Data model**: [../data-model.md](../data-model.md)

Phase 1 output. This is the constitution-II handoff contract: the `SecondVoicePanel` container (R5/R10) and the FastAPI routes (`app/routes_second_voice.py`, R9) MUST implement exactly these shapes. Wire shapes are mirrored by Zod in `frontend/src/lib/sheets/schemas.ts` and Pydantic in `backend/app/routes_second_voice.py`; Zod/Pydantic tests with one valid + one invalid fixture per shape double as contract tests.

Base URL: `PUBLIC_API_URL` (default `http://localhost:8000`); all calls are runtime island-tree fetches, never SSR (R10). No auth headers in v1 — the backend stamps the synthetic `OWNER_ID` server-side (FR-005, R9). CORS: unchanged from 004 (`CORS_ORIGINS`, default `http://localhost:4321`).

## Error shape (all endpoints — 004 taxonomy reused, no new codes)

```jsonc
// HTTP 4xx/5xx → { "error": { "code": "...", "message": "human-readable" } }
{ "error": { "code": "VALIDATION_ERROR", "message": "Snapshot line count (41) does not match stored sheet (40)." } }
```

| Code | HTTP | When | Frontend maps to |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | bad transpose range, snapshot count/offset/vocab mismatch, malformed ids | inline guidance / retry (FR-003, FR-011); nothing stored |
| `NOT_FOUND` | 404 | unknown sheet id (analyze/list) or unknown analysis id (get/delete) | in-panel not-found notice + back to sheet (FR-011; 004 FR-015 idiom) |
| `PROVIDER_ERROR` | 502 | inference failed (timeout, key absent, schema-invalid model output) after the single attempt | error state + retry, sheet + stepper preserved (FR-011, FR-014); nothing stored |

Never leak stack traces, keys, or provider internals in `message`. Key absence and model schema violations are `PROVIDER_ERROR` (not 500): the panel degrades per-route with retry (FR-014). No endpoint returns 429 in v1.

## Endpoints

### `POST /api/v1/sheets/{sheet_id}/second-voice` — analyze + persist (FR-002/003/004/005)

Request — the rendered transposed snapshot (DR-001) plus provenance. `transpose` is −11…+11; `chords_by_line` covers EVERY section/line of the sheet in order (empty `chords` arrays legal for lyric-only lines); no lyric text on the wire:

```jsonc
{ "transpose": 5,
  "chords_by_line": [
    { "section": 0, "line": 0, "chords": [ {"offset": 0, "symbol": "C"}, {"offset": 11, "symbol": "Am"} ] },
    { "section": 0, "line": 1, "chords": [] }
] }
```

Response 200 — the persisted analysis (subset of `second_voice_analyses`, no `owner_id` on the wire):

```jsonc
{ "analysis": {
  "id": "uuid", "sheet_id": "uuid", "transpose": 5, "model_id": "…",
  "analysis": { "key": {...}, "scale": [...], /* R1 SecondVoiceOut */ },
  "created_at": "2026-09-17T00:00:00Z"
} }
```

Rules: backend validates `transpose` range → snapshot section/line counts equal the stored sheet → every `offset` within its stored line width (UTF-16 code units) → every `symbol` FR-013-valid; ANY mismatch → `VALIDATION_ERROR`, nothing stored (FR-003). Unknown `sheet_id` → `NOT_FOUND`. On valid input: single Agno run (45 s budget, R7); model output validated against `SecondVoiceOut` + the no-melody invariant (data-model rule 2); schema/invariant violation, timeout, or missing key → `PROVIDER_ERROR`, nothing stored (FR-014). Success inserts ONE row and returns it (FR-005). Pitch correctness is trusted (single-owner); shape correctness is verified (FR-003).

### `GET /api/v1/sheets/{sheet_id}/second-voice?limit=&offset=` — list newest-first (FR-006)

Response 200 (`limit` default 20, max 100; `offset` default 0) — summaries only, never full JSON (data-model rule 6):

```jsonc
{ "analyses": [
  { "id": "uuid", "sheet_id": "uuid", "transpose": 5,
    "model_id": "…", "created_at": "2026-09-17T00:00:00Z" }
], "total": 3 }
```

Order is ALWAYS `created_at DESC`. Served from Postgres only, ZERO provider calls (FR-006, FR-013). Unknown `sheet_id` → `NOT_FOUND` (not empty list — distinguishes "no analyses" from "no song").

### `GET /api/v1/second-voice/{analysis_id}` — re-open stored analysis (FR-006)

Response 200 — the full `{analysis…}` envelope (same shape as the analyze response). MUST serve the stored row with ZERO provider re-querying (FR-013). Missing id → `NOT_FOUND`, frontend maps to in-panel notice + back to sheet.

### `DELETE /api/v1/second-voice/{analysis_id}` — remove one analysis (FR-007)

Response 204 with an empty body: deletes exactly that row; the parent sheet and sibling analyses are untouched. Postgres only, zero providers. Unknown id → `NOT_FOUND`; deleting an already-deleted id → `NOT_FOUND` (not idempotent-204 — 004 idiom).

## Non-goals (v1)

No UPDATE (re-run inserts; data-model rule 5); no cross-song listing or aggregate endpoints (per-song scope only, DR-002); no auth endpoints (FR-005); no streaming/SSE (single JSON responses fit the 60 s budget, R7); no MCP/`ui://` surface (R9/R10); no melody-input endpoints (FR-010 v2).
