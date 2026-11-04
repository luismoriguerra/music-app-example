# Decision: Outbound Link Validation Method and Budget Protection

## Status
**Accepted**

## Context
User Story 2 (FR-004, FR-005) discovers outbound page and video links using DuckDuckGo search when dedicated video API keys are absent. Search engine results can return stale URLs, redirect loops, or dead pages. We need a lightweight validation mechanism that verifies URL liveness and extracts clean page titles without exceeding the 3-second link discovery stage budget.

**Question:** How should discovered outbound page links be validated before presentation without exceeding the 3 s link stage budget?

**Constraints that matter:**
- FR-008: Enrichment must fit inside the backend time budget (link discovery stage capped at ≤3.0 s).
- FR-005: Every enriched link must show its provider/label and open outside the app; sheet renders if none found.
- SC-002: 8 out of 10 generated sheets for well-known songs show at least one page link and at least one video link without video keys.

## Options Considered
- **Option A — Direct `httpx.head` or shallow `httpx.get` with bounded timeout.** Validate candidate URLs using `httpx.Client(follow_redirects=True, timeout=2.0)` (which is already a backend dependency). Use `HEAD` for status confirmation or a bounded `GET` with `BeautifulSoup` solely to extract `<title>` text for the label. Never raise exceptions on failure; drop failed links silently. **(chosen)**
- **Option B — Agno `WebsiteTools.read_url`.** Use Agno's built-in website reader toolkit. **(rejected: `WebsiteTools.read_url` instantiates `WebsiteReader` with fixed defaults `max_depth=3, max_links=10, timeout=10`. Crucially, `WebsiteReader.crawl` executes `self.delay()`—a mandatory `random.uniform(1, 3)` sleep—before every page fetch, including the initial URL. A single validation call takes 2–4 seconds minimum and blows past the 3-second stage budget. Furthermore, `WebsiteReader.read` re-raises `httpx` errors on initial URL failure, violating the non-raising contract)**
- **Option C — Zero validation (trust search engine URLs directly).** Display DuckDuckGo result titles and URLs directly without verification. **(rejected: DuckDuckGo returns stale or blocked URLs for chord/lyric sites; dead links undermine user trust and violate SC-002 quality expectations)**

## Assumptions
- [high risk] Target external sites (e.g. guitar chord blogs, lyric sites) respond to HTTP HEAD/GET within 2 seconds without requiring anti-bot browser verification.
- [medium risk] DDG-provided result titles can serve as a fallback label if shallow GET times out or fails title parsing.
- [low risk] `httpx` connection pooling prevents socket exhaustion during burst validations.

## Evidence
- `libs/agno/agno/tools/website.py:40-47`: `WebsiteTools.read_url` hardcodes `website = WebsiteReader()` with no constructor argument passthrough for depth, links, or delay.
- `libs/agno/agno/knowledge/reader/website_reader.py:73-80,185-188`: `WebsiteReader.crawl` calls `self.delay()` (`time.sleep(random.uniform(1, 3))`) immediately upon popping the first URL before issuing `httpx.get`.
- `libs/agno/agno/knowledge/reader/website_reader.py:246-248`: `WebsiteReader.crawl` re-raises `httpx.RequestError` when the initial URL fails, which would violate our pipeline contract if uncaught.
- `specs/009-free-search-enrichment/plan.md:25`: Pipeline budget allocates only ~6 seconds total for all enrichment, requiring ≤3 seconds for the link discovery stage.

## Decision
**Option A.** Use direct `httpx` requests with a 2-second timeout in `backend/agents/sheets/enrich/links_free.py` to validate outbound links and extract title labels. Option B (`WebsiteTools`) is rejected because its mandatory 1–3 second random sleep and uncontrolled crawl depth render it fundamentally incompatible with our backend time budget. Option C is rejected because unvalidated search links degrade user experience with 404s.

## Confidence
High — Directly using `httpx` provides complete control over timeouts, redirect policies, and exception handling while avoiding the forced delays of the crawler.

## Consequences
**Easier:** Predictable latency under 2 seconds per check, zero unexpected multi-page crawling, and zero random sleep penalties.
**Harder:** Link validation logic must be maintained directly in domain code rather than delegated to an Agno toolkit.
**Risks that remain:** Slow external servers may cause valid links to be dropped if they exceed 2 seconds; acceptable as links are supplementary.

## Revisit Trigger
Reopen if: Verified link retention drops significantly due to strict 2 s timeouts, or an Agno update introduces a lightweight single-URL validation toolkit without crawl delays.
