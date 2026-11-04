# Contract: Sheets REST API (frontend ↔ backend)

**Feature**: `004-lyrics-chords-generator` | **Date**: 2026-09-16
**Spec**: [../spec.md](../spec.md) | **Research**: R0/R2/R3/R7/R10 in [../research.md](../research.md) | **Data model**: [../data-model.md](../data-model.md)

Phase 1 output. This is the constitution-II handoff contract: the Astro
island (`SheetGenerator`, R11) and the FastAPI routes (`app/routes_sheets.py`,
R10) MUST implement exactly these shapes. Wire shapes are mirrored by Zod in
`frontend/src/lib/sheets/schemas.ts` and Pydantic in
`backend/app/routes_sheets.py`; Zod/Pydantic tests with one valid + one
invalid fixture per shape double as contract tests.

Base URL: `PUBLIC_API_URL` (default `http://localhost:8000`); all calls are
runtime island fetches, never SSR (R11). No auth headers in v1 — the backend
stamps the synthetic `OWNER_ID` server-side (FR-011, R10). CORS: the browser origin MUST be covered by the API's `CORS_ORIGINS` (default `http://localhost:4321`); otherwise every island POST fails preflight (R10).

## Error shape (all endpoints)

```jsonc
// HTTP 4xx/5xx → { "error": { "code": "...", "message": "human-readable" } }
{ "error": { "code": "NO_MATCH", "message": "No songs matched 'xyz'." } }
```

| Code | HTTP | When | Frontend maps to |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | empty/over-long query, malformed candidate echo, bad id | inline guidance / retry (FR-003, FR-007) |
| `NO_MATCH` | 404 | zero candidates (search) or zero lyrics+charts (generate) | no-match state + retry spelling (FR-007) |
| `NOT_FOUND` | 404 | unknown history entry id | in-list re-open → entry-unavailable, list keeps working (edge case); `?entry=` deep link → island-rendered not-found view (game-route.md, FR-015) |
| `PROVIDER_ERROR` | 502 | upstream fetch failed after fallbacks | error state + retry, input preserved (FR-007) |

Never leak stack traces or provider internals in `message`. No endpoint returns 429 in v1: metered-quota spend (YouTube) and per-stage deadline skips degrade to a 200 sheet with a `degraded` entry (below), never a request-level error — the sheet always renders with page links intact (M4, R10).

## Endpoints

### `POST /api/v1/song-search` — candidates (FR-006)

Request (FR-003: 1–200 chars, trimmed; empty → `VALIDATION_ERROR`):

```jsonc
{ "query": "Riptide" }
```

Response 200 — candidates in merge order (R3: Genius rank, then
LRCLIB-only extras deduped by normalized title+artist); empty array is
legal and maps to the no-match state (frontend treats `[]` like
`NO_MATCH`, no error thrown):

```jsonc
{ "candidates": [
  { "title": "Riptide", "artist": "Vance Joy",
    "album": null, "artwork_url": null,
    "provider_refs": { "lrclib_id": 969429, "genius_id": 123 } }
] }
```

`album`/`artwork_url` are nullable (LRCLIB-only mode has neither, R3).
`provider_refs` keys are optional individually; at least one present.

When every configured candidate provider fails (for example LRCLIB `503`), keyless enrichment (009 `contracts/enrichment.md`, DR-011) runs first; `PROVIDER_ERROR` (502) is returned only when it also finds nothing.

### `POST /api/v1/sheets` — generate + persist (FR-004/005/008/012/016)

Request — the raw query plus the learner-picked candidate echoed back
verbatim (backend re-validates it; tampered/empty → `VALIDATION_ERROR`):

```jsonc
{ "query": "Riptide",
  "candidate": { "title": "Riptide", "artist": "Vance Joy",
    "album": null, "artwork_url": null, "provider_refs": { "lrclib_id": 969429 } } }
```

Response 200 — the persisted sheet (subset of `song_sheets`, no
`owner_id` on the wire):

```jsonc
{ "entry_id": "uuid", "sheet": {
  "id": "uuid", "query": "Riptide",
  "matched_title": "Riptide", "matched_performer": "Vance Joy",
  "lyric_source": "chart", "lyric_source_url": "https://…",
  "chord_source": "chart", "chord_source_url": "https://…", "model_id": null,
  "body": { "sections": [ { "heading": "Chorus", "lines": [
    { "text": "…", "chords": [ {"offset": 0, "symbol": "Em"} ] } ] } ] },
  "source_links": [ {"label": "…", "url": "https://…", "kind": "video"} ],
  "degraded": [],
  "capo": null, "tuning_note": null, "created_at": "2026-09-16T00:00:00Z"
} }
```

Rules: exactly one of three shapes (R0) — chart-hit: `chord_source: "chart"`,
URL present, `model_id` null, whole sheet from the chart; fallback:
`chord_source: "model-generated"`, `model_id` present, URL null, fetched
lyrics + model-aligned chords; lyrics-only: `chord_source: "none"`, BOTH
null, every body line carries zero chords, `degraded` MUST include
`{part: "chords", reason: "timeout"|"unavailable"}` (`timeout` = deadline
skip, `unavailable` = key absent or chords unrecoverable after the
search+model attempt), and the frontend renders the chords-missing notice
keyed off `chord_source == "none"` (data-model rule 2); `source_links` ≤ 8 (R7). Side effect: inserts one `song_sheets` row +
one `history_entries` row (FR-008). On lyrics miss everywhere → `NO_MATCH`
(no rows written). `degraded` is `[]` on a full sheet, else one entry per skipped part — `{part: "video"|"chords", reason: "quota"|"timeout"|"unavailable"}` (video quota spent → `quota`, deadline skip → `timeout`, key absent / chords unrecoverable → `unavailable`; persisted with the sheet so re-open renders the same notice with zero re-query). Backend budget 25 s (SC-002).

### `GET /api/v1/history?limit=&offset=&q=&favorite=` — list newest-first (FR-009/018)

Response 200 (`limit` default 20, max 100; `offset` default 0; `q` optional
name filter, ≤200 chars, case- and accent-insensitive substring over `query`,
`matched_title`, `matched_performer`; `favorite=true` lists favorites only):

```jsonc
{ "entries": [
  { "id": "uuid", "query": "Riptide",
    "matched_title": "Riptide", "matched_performer": "Vance Joy",
    "sheet_id": "uuid", "favorite": false,
    "created_at": "2026-09-16T00:00:00Z" }
], "total": 42 }
```

Order is ALWAYS `created_at DESC`; `total` counts the filtered set. Served
from Postgres only.

### `PATCH /api/v1/history/{entry_id}` — mark/unmark favorite (FR-018)

Request `{ "favorite": true|false }`; response 200 = the updated entry (list
entry shape). Unknown id → `NOT_FOUND`. Postgres only, zero providers.

### `GET /api/v1/history/{entry_id}` — re-open stored sheet (FR-009/018)

Response 200 — the generate `{entry_id, sheet}` envelope plus the entry's
`favorite` flag (`{entry_id, favorite, sheet}`). MUST serve
the stored rows with ZERO provider re-querying (R7 quota rule); a missing
id → `NOT_FOUND`. Dangling sheet_id (DB corruption only; FK RESTRICT forbids otherwise) → NOT_FOUND, frontend maps to entry-unavailable.

### `POST /api/v1/history/{entry_id}/regenerate` — fresh sheet (FR-010)

Response 200 — a NEW `{entry_id, sheet}` pair: re-runs the R0 pipeline for
the entry's `query` + matched song, inserts a NEW sheet + NEW entry, and
returns them. This is the ONLY history op that queries providers (R7).
Unknown id → `NOT_FOUND`; upstream failure → `PROVIDER_ERROR` (prior entry
untouched).

### `DELETE /api/v1/history/{entry_id}` — remove an entry (FR-009)

Response 204 with an empty body: deletes the entry, then its sheet when no
other entry references it (1:1 in v1, so normally always; entry-first order
satisfies the FK RESTRICT). Postgres only, zero providers. Unknown id →
`NOT_FOUND`; deleting an already-deleted id → `NOT_FOUND` (not idempotent-204).

## Non-goals (v1)

The only UPDATE is the FR-018 favorite flag (regenerate inserts; data-model
rule 7); DELETE ships only for history entries (above); no auth
endpoints (FR-011); no streaming/SSE (single JSON responses fit the 30 s
budget); no MCP/`ui://` surface (R10/R11).
