# Decision: Web Search Toolkit for Candidate and Link Discovery

## Status
**Superseded by DR-007 (2026-09-22)**

> The pinned agno 2.4.7 `DuckDuckGoTools` hardwires `backend="duckduckgo"`, which returned "No results found" live; DR-007 switches to `WebSearchTools(backend="auto")`. Body kept for history.

## Context
Feature 009 enriches candidate resolution when configured metadata providers return zero results (e.g. typos or obscure titles) and discovers outbound reference links without requiring paid API keys. We need a reliable, keyless search toolkit that can execute within a bounded budget without introducing external secret dependencies.

**Question:** Which search toolkit should provide keyless web search for candidate fallback and link discovery?

**Constraints that matter:**
- FR-010: Keyless enrichment must require no new secrets; all hosted fetching must go through the backend.
- FR-001: Attempt keyless web enrichment before showing a no-match state.
- FR-008: Enrichment must fit inside the backend time budget and degrade gracefully on timeout or failure.

## Options Considered
- **Option A — Agno DuckDuckGoTools (`ddgs` backend) with explicit exception mapping.** Use `agno.tools.duckduckgo.DuckDuckGoTools` with `enable_search=True, enable_news=False, fixed_max_results=5, timeout=10` and wrap calls to catch `ddgs` exceptions (`RatelimitException`, `TimeoutException`, `DDGSException`), mapping them to `degraded {part: "enrichment", reason: "unavailable"}`. **(chosen)**
- **Option B — Commercial search API toolkits (Tavily, SerpAPI, Brave, Exa).** Use specialized search toolkits with high structured-data accuracy. **(rejected: requires paid API keys or free-tier keys, directly violating FR-010)**
- **Option C — Direct custom HTML web scraping.** Scrape search engine result pages directly using `httpx` and `BeautifulSoup`. **(rejected: fragile, prone to anti-scraping blocks, high maintenance overhead compared to `ddgs`)**

## Assumptions
- [high risk] DuckDuckGo (`ddgs`) search remains accessible without IP blocking or aggressive captcha challenges from the backend deployment environment.
- [medium risk] Returned search result snippets and titles contain sufficient song and performer metadata to parse viable candidate pairs.
- [low risk] The `ddgs` package maintains compatibility with Agno 2.x/3.x tool interfaces.

## Evidence
- `backend/pyproject.toml:13`: Backend uses `agno[os]>=2.0,<3` and currently has no paid search keys configured.
- `libs/agno/agno/tools/duckduckgo.py:34-60`: `DuckDuckGoTools` provides `enable_search`, `fixed_max_results`, `timeout` configurations and defaults to the DuckDuckGo backend.
- `libs/agno/agno/tools/websearch.py:80-92`: `web_search()` invokes `ddgs.text()` within a context manager but does not catch `ddgs` exceptions; callers must handle `RatelimitException` and network failures explicitly.
- `specs/009-free-search-enrichment/spec.md:73,82`: FR-001 mandates keyless fallback and FR-010 forbids new secrets.

## Decision
**Option A.** Adopt `agno.tools.duckduckgo.DuckDuckGoTools` as the sole web search toolkit for candidate fallback and link discovery. Commercial APIs (Option B) violate FR-010 by requiring secrets. Custom scraping (Option C) introduces unnecessary maintenance overhead. Callers in `candidates_free.py` and `links_free.py` must catch all `ddgs` exceptions to guarantee graceful degradation.

## Confidence
High — DuckDuckGoTools requires zero configuration or secrets, directly fits Agno's agent and tool patterns, and has been verified in upstream Agno source.

## Consequences
**Easier:** Zero credentials to provision, rotate, or manage in Railway or local development.
**Harder:** Rate limiting and search snippet volatility must be actively handled in application code.
**Risks that remain:** Upstream DuckDuckGo structural changes or rate limits may cause intermittent search degradation; mitigated by FR-008 graceful degradation fallback to standard no-match or empty states.

## Revisit Trigger
Reopen if: DuckDuckGo rate limiting causes search failure rates to exceed 10% in production telemetry, or a project-wide ADR approves a keyless self-hosted search gateway (e.g. SearXNG).
