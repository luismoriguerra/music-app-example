# Decision: Song Context Acquisition Source and URL Extraction

## Status
**Superseded by DR-010 (2026-09-22)**

> The `wikipedia` package issues `requests.get` with no timeout (4–5 calls per fetch); DR-010 replaces it with two bounded MediaWiki API calls over `httpx`. Body kept for history.

## Context
User Story 3 (FR-006) provides short encyclopedic song context on the generated sheet with an explicit source label and link. Data Model entity `SongContext` requires both `text` (≤600 chars) and `source_url` (canonical page URL). We must select a retrieval mechanism that reliably returns both the summary text and the page URL without key requirements or lyric text reproduction.

**Question:** How should song encyclopedic context be fetched and attributed without paid keys or lyric reproduction?

**Constraints that matter:**
- FR-006: Generated sheet may show short factual context from encyclopedic sources with its own source label; absence must not alter the sheet.
- FR-007: Enrichment supplies metadata and links only; must not reproduce, rewrite, or align lyric or chord text.
- FR-010: Keyless enrichment must require no new secrets.
- Data Model rule: `SongContext` requires `text`, `source: "wikipedia"`, and `source_url` (http(s) page URL).

## Options Considered
- **Option A — Two-step direct `wikipedia` package call (`search` then `page`).** Execute `hits = wikipedia.search(f"{title} {artist} song", results=1)` in domain module `context_free.py`. If hits found, fetch `page = wikipedia.page(hits[0], auto_suggest=False, redirect=True)` and extract `.summary` truncated to 600 characters and `.url` as `source_url`. Treat empty hits, `DisambiguationError`, `PageError`, and timeouts as an absent context (`None`). **(chosen)**
- **Option B — `agno.tools.wikipedia.WikipediaTools.search_wikipedia`.** Use Agno's built-in Wikipedia toolkit. **(rejected: returns only `wikipedia.summary()` inside a `Document` object with no page URL attribute, making the mandatory `source_url` field unobtainable without external string synthesis; also defaults `auto_suggest=True` which aggressively mis-resolves short song titles)**
- **Option C — Search engine snippets (DuckDuckGo text results).** Use web search snippets as context text. **(rejected: snippets are uncurated, frequently truncated mid-sentence, have murky licensing, and risk containing scraped lyric fragments)**
- **Option D — Agno Knowledge Base insertion via `search_wikipedia_and_update_knowledge_base`.** Store encyclopedic knowledge in vector/knowledge tables. **(rejected: over-engineered for single-owner display text; violates the zero-new-tables architecture constraint)**

## Assumptions
- [high risk] Wikipedia API does not throttle or IP-block the backend service under typical usage.
- [medium risk] Two-step search (`wikipedia.search` followed by `wikipedia.page`) completes within the 3.0 s stage budget and reliably surfaces the intended song article.
- [low risk] Wikipedia summaries remain factual overview text and do not reproduce copyrighted lyric sheets.

## Evidence
- `libs/agno/agno/tools/wikipedia.py:46-56`: `WikipediaTools.search_wikipedia` calls `wikipedia.summary(query, auto_suggest=self.auto_suggest)` and returns `Document(name=query, content=content)`. The canonical article URL is not captured or exposed.
- `libs/agno/agno/tools/wikipedia.py:18`: `auto_suggest` defaults to `True`, which causes the underlying library to substitute alternative search terms unpredictably on song queries.
- `specs/009-free-search-enrichment/data-model.md:36`: `SongContext.source_url` is mandatory when context is present (`http(s) page URL`).
- `specs/009-free-search-enrichment/spec.md:78-79`: FR-006 mandates an attributed source label and FR-007 strictly forbids lyric text reproduction.

## Decision
**Option A.** Call the `wikipedia` library directly using a two-step pattern (`wikipedia.search` followed by `wikipedia.page(hits[0], auto_suggest=False, redirect=True)`) inside `backend/agents/sheets/enrich/context_free.py`. Extract `.summary` truncated to 600 characters and `.url` as `source_url`. Option B is rejected because `WikipediaTools` drops the article URL necessary to satisfy the data model and uses risky auto-suggestion. Options C and D are rejected for quality risk and architectural over-complexity respectively.

## Confidence
High — Direct library use allows access to the complete `WikipediaPage` object (`url`, `summary`, `title`) while honoring all data model constraints and time bounds.

## Consequences
**Easier:** Clean data model compliance with verified article URLs and robust handling of disambiguation pages.
**Harder:** The backend must manage `wikipedia` exceptions (`PageError`, `DisambiguationError`) explicitly in domain code.
**Risks that remain:** Disambiguation pages for songs with generic names (e.g. "Stay", "One") will resolve to `None` unless query disambiguation heuristics are added; acceptable under FR-006 (absence must not alter sheet).

## Revisit Trigger
Reopen if: Context resolution hit rate falls below 50% for well-known catalog songs due to disambiguation, requiring multi-query fallback or search-first resolution.
