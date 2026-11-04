# Contracts: Free Search Enrichment

No new REST routes. Existing 004 envelopes gain additive, backward-compatible fields.

## REST (additive only)

- `POST /api/v1/song-search` → `{candidates[]}` unchanged; enriched candidates append with `provider_refs: {duckduckgo: "<folded title|artist>"}` marker, `album: null`, `artwork_url: null` (shape parity with 004 candidates), and rank last. Enriched candidates run when configured providers return zero results or every configured provider fails (amended 2026-10-30 by DR-011); the 004 `PROVIDER_ERROR` path applies only when enrichment also finds nothing, so a provider failure is never answered with `[]`. Route validator MUST accept this origin (today it requires `genius_id`/`lrclib_id`): generate/fetch already resolves by title + artist with optional id, so the validator amendment is accept-only, no fetch change.
- `POST /api/v1/sheets` / `POST /api/v1/history/{id}/regenerate` → `sheet` gains:
  - `context: {text, source, source_url} | null`
  - `degraded[]` may contain `{part: enrichment, reason: timeout|unavailable}`
- `GET /api/v1/history`, `GET /api/v1/history/{id}` → sheet includes stored `context` verbatim.

## Domain (internal)

- `enrich.candidates_free.search(query, *, deadline_s) -> list[EnrichedCandidate]` — keyless `WebSearchTools` (pinned engines, DR-007) mapped to deduped candidates.
- `enrich.links_free.discover(title, artist, *, deadline_s, client=None) -> (pages[], videos[])` — keyless search + `httpx` page validation + canonical YouTube oEmbed (DR-003, DR-007, DR-008).
- `enrich.context_free.fetch(title, artist, *, deadline_s, client=None) -> SongContext | None` — MediaWiki API over `httpx` (DR-010).

All three: never raise (return empty/None on failure) and use zero provider keys. Searches go through ddgs (`search_timeout()`: capped at 2 s, skipped under 1 s). Page, oEmbed and MediaWiki GETs go through `bounded_get()`: at most 3 redirects, per-hop `timeout = min(2 s, remaining)`, no hop under 0.3 s, 3xx bodies never read, and final bodies byte-capped and clock-checked. DNS resolution and trickled response headers are not bounded (DR-009).
