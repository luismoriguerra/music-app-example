# Research: Free Search Enrichment

**Feature**: `009-free-search-enrichment` | **Date**: 2026-09-19
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Phase 0 output. Live Agno docs verified 2026-09-19 via web fetch (docs.agno.com + `agno` main). No NEEDS CLARIFICATION remains. No model choice in this feature (Principle V gate not triggered).

## R1. DuckDuckGoTools — candidate + link discovery (keyless)

> **Superseded by DR-007 (2026-09-22):** implemented with `WebSearchTools` on two pinned keyless engines (`brave,yahoo`) — one bounded ddgs round; the pinned `DuckDuckGoTools` hardwires the DuckDuckGo engine (no results live) and `"auto"` runs unbounded rounds.

- **Decision**: Use `agno.tools.duckduckgo.DuckDuckGoTools` (`ddgs` backend) as the only web-search toolkit, bounded: `enable_search=True, enable_news=False`, `fixed_max_results=5`, `timeout=10`, single call per stage.
- **Rationale**: Only free search toolkit needing no key; verified constructor params (`enable_search`, `enable_news`, `fixed_max_results`, `timeout`, `timelimit`, `region`, `backend`) and tool names (`web_search`, `search_news`). Fits the 25 s budget when capped at one 10 s call with pipeline-deadline short-circuit.
- **Alternatives considered**:
  - Tavily / Exa / SerpApi / Brave (rejected): all need paid keys — violates FR-010 keyless requirement.
  - `WebSearchTools(backend="yandex")` (rejected): same wrapper, weaker music metadata, no benefit over DDG default.
  - Live scraping of search HTML by hand (rejected): duplicates `ddgs` maintenance burden; Agno toolkit already handles backends.

## R2. WikipediaTools — song context (keyless)

> **Superseded by DR-010 (2026-09-22):** two bounded MediaWiki API calls over `httpx` (search, then one batched extract read). The `wikipedia` package (DR-002) was dropped: its `requests.get` has no timeout.

- **Decision**: Use `agno.tools.wikipedia.WikipediaTools` (`wikipedia` pkg) for US3 context only: `search_wikipedia("{title} {artist} song")`, truncate to ~600 chars, store with `source: wikipedia + page URL`.
- **Rationale**: Free, no key, encyclopedic license suitable for short factual display with attribution; never lyric text. Verified toolkit functions (`search_wikipedia`, `search_wikipedia_and_update_knowledge_base`); we use the former without a Knowledge insert.
- **Alternatives considered**:
  - DDG snippets as context (rejected): snippets are unreliable + attribution-murky; Wikipedia gives stable page URLs.
  - Knowledge-base insert (rejected): overkill for single-owner display text; plain JSON on the sheet row suffices.

## R3. WebsiteTools — link validation (keyless)

> **Superseded by DR-003:** `WebsiteTools.read_url` sleeps 1–3 s per page and cannot be capped; links are validated with a direct `httpx` GET (2 s timeout) and `<title>` extraction via `beautifulsoup4`.

- **Decision**: Use `agno.tools.website.WebsiteTools` (`beautifulsoup4`) `read_url` to HEAD/validate enriched page links (title extraction for labels), never to extract lyric/chord bodies.
- **Rationale**: Prevents dead/polluted links (cf. 004 T053 ` - Topic` suffix find); `read_url` defaults (`max_depth=3`, `max_links=10`) are capped by calling once per URL with an outer 5 s budget. Verified behavior from Agno docs.
- **Alternatives considered**:
  - No validation (rejected): DDG results include stale UG URLs; one cheap read keeps SC-002 honest.
  - Full crawl (rejected): depth/recursion wastes budget; single-URL reads only.

## R4. YouTubeTools — video enrichment without Data API quota (keyless)

> **Superseded by DR-008 (2026-09-22):** direct bounded `httpx` GET to `https://www.youtube.com/oembed` on canonical `watch?v=<id>` URLs; no toolkit, no captions path, no `youtube-transcript-api`.

- **Decision**: Use `agno.tools.youtube.YouTubeTools` (`youtube-transcript-api`) `get_youtube_video_data` (+ captions where available) on DDG-discovered `youtube.com/watch` URLs. Hybrid: YouTube Data API when `YOUTUBE_API_KEY` present, else DDG + YouTubeTools.
- **Rationale**: Verified toolkit (`get_youtube_video_captions`, `get_youtube_video_data`, `get_youtube_video_timestamps`); needs no Google key, dodging the 100-units/search quota that forces today's video empty state.
- **Alternatives considered**:
  - Unofficial Piped gateways (rejected per 004 R7): ToS risk + worse reliability than official captions library.
  - Data-API-only (rejected): preserves the exact gap US2 must close.

## R5. Lina — no such Agno module

- **Decision**: No `Lina` toolkit exists in Agno 2.x/3.x (verified against docs index + `agno` main tree). Closest owners: Llama models via OpenRouter (already governed by 004 Appendix A, unchanged here), Agno `Knowledge`/`Memory` (deferred — no new tables), LlamaIndex (rejected — Agno Knowledge replaces it).
- **Rationale**: Avoids a phantom dependency; records the lookup so review does not re-litigate it.

## R6. Budget, ranking, and ToS posture

> **Superseded by DR-009 (2026-09-22):** budgets are per-stage targets enforced by per-call timeouts and deadline gating (not preemption); `ENRICH_TIMEOUT_S=0` disables enrichment with `degraded {part: enrichment, reason: unavailable}`.

- **Decision**: Enrichment total ≤6 s (candidates ≤3 s, links ≤3 s, context lazy/parallel with links), always inside the inherited 25 s pipeline deadline; skip-vs-fail inherited from 004: skip enrichment → today's behavior + `degraded {part: enrichment, reason}` entry. Ranking: configured providers first, enriched items appended deduped by folded `title|artist` / URL. ToS: enrichment handles metadata/links only; lyric/chord reproduction stays on the 004 allowlisted paths with R8 mitigations.
- **Alternatives considered**:
  - Parallel fan-out to all toolkits (rejected): multiplies failure modes + budget risk; sequential capped stages are testable.
  - Persisting DDG snippets (rejected): snippet persistence adds licensing noise; persist labels + URLs + Wikipedia context only.

## Toolchain pins

- Backend adds (keyless, all free): `ddgs>=9,<10`, `beautifulsoup4>=4.12,<5`. `youtube-transcript-api` (DR-008) and `wikipedia` (DR-010) were dropped. No `openai` version change. Ruff + pytest unchanged.
- Frontend: no new deps; Zod schema gains nullable `context` object.

## Implementation Observations (2026-09-21)

- **Code state**: Keyless paths per DR-003, DR-006, DR-007, DR-008, DR-009, DR-010 (`backend/agents/sheets/enrich/`): `WebSearchTools(backend="brave,yahoo")` search with exception capture (skipped under 1 s, capped at 2 s); single link query `f"{t} {a} chords youtube"`; canonical YouTube URLs + bounded oEmbed; MediaWiki API context; per-phase httpx timeouts `min(2 s, remaining)`, streamed title reads stop at the stage deadline; candidate parser with Wikipedia / dash / `by` shapes, query-signalled orientation (one-side match only), noise-only dash sides yield to a `by` credit, accent-folded dedupe with majority orientation.
- **Bounded-stage measurement (2026-09-22, pinned engines)**: links 2.73–3.40 s vs 3.0 s budget; context 1.00–1.15 s (Yesterday, Wonderwall, Creep, Almohada). Earlier 4.56–7.01 s per song was dominated by unbounded `wikipedia` calls and multi-round ddgs "auto".
- **Hermetic test gates**: see PR description for current counts (backend `pytest` + `pytest evals/`, frontend Vitest).
- **SC-002 live sample (2026-09-21, links + context only — does not exercise the candidate parser)**: 10 well-known songs ("Creep", "Yellow", "Yesterday", "Wonderwall", "Riptide", "Hallelujah", "Hotel California", "Let It Be", "Someone Like You", "Stand By Me"), zero video keys:
  - Video links via public oEmbed: 10/10.
  - Both page and video link: 8/10 (meets SC-002 ≥8/10).
  - Wikipedia context: 8/10 (2 failures were Wikipedia returning HTML instead of JSON — generic-UA throttling).
  - Per song (links + context): 4.56–7.01 s; 4/10 above the 6 s target (see DR-009).
- **Candidate fallback live checks (2026-09-22)**: `"Riptde"` → `Riptide / Vance Joy`; `"amohada - jose jose"` → `Almohada / José José`, sheet generated (chart-sourced chords, 2 keyless videos).
