# Decision: Keyless Web Search Backend (supersedes DR-001)

## Status
**Accepted — supersedes DR-001**

> **Corrected pre-merge (2026-09-22):** `backend="auto"` is not bounded. In ddgs 9.10 `_search` (`ddgs.py:171-201`), "auto" puts wikipedia and grokipedia first, shuffles the remaining engines per call (`:92-99`), and keeps running `wait(timeout)` rounds until it has `max_results`, so one call can take several multiples of the timeout, and results vary between runs. The implementation now pins exactly two keyless engines, `SEARCH_BACKENDS = "brave,yahoo"` (env `ENRICH_SEARCH_BACKENDS`; `enrich/__init__.py:20`). With two engines ddgs makes a single bounded `wait(timeout)` round, and `search_timeout()` caps the round at 2 s. Measured live: both query shapes answered in 1.6 s, including YouTube hits. `google,brave` failed on the Spanish query. Unknown backend names such as `api` or `html` silently fall back to "auto". Everything else in this record (toolkit choice, keyless posture, rejected options) is unchanged. Revisit trigger now reads: either pinned engine errors on more than 20% of the live eval.

## Context
DR-001 chose `agno.tools.duckduckgo.DuckDuckGoTools`. Live verification on 2026-09-21 against the pinned stack (agno 2.4.7, ddgs 9.10.0) showed the DuckDuckGo engine returning `DDGSException: No results found.` for ordinary song queries while the other keyless ddgs engines answered. The installed `DuckDuckGoTools.__init__` hardcodes `backend="duckduckgo"` and rejects any override (passing `backend=` raises `TypeError: got multiple values for keyword argument 'backend'`), so the DR-001 toolkit cannot be pointed at a working engine.

**Question:** Which keyless search entry point should candidate fallback and link discovery use?

**Constraints that matter:**
- FR-010: no new secrets; every engine must be keyless.
- FR-001/FR-004: fallback must actually return results for common song queries.
- DR-001 Revisit Trigger ("DuckDuckGo … search failure rates") has fired.

## Options Considered
- **Option A — `agno.tools.websearch.WebSearchTools(backend="auto")`.** Same Agno toolkit family (`DuckDuckGoTools` is a thin subclass of it); `ddgs` "auto" meta-search rotates across its keyless engines. **(chosen)**
- **Option B — keep `DuckDuckGoTools`.** **(rejected: fixed `backend="duckduckgo"` returned no results live; cannot be reconfigured)**
- **Option C — call `ddgs.DDGS().text(..., backend="api"|"html"|"lite")` directly.** Works, but leaves the Agno toolkit layer and duplicates its JSON shaping. **(rejected: no benefit over Option A)**

## Assumptions
- [medium risk] At least one of the ddgs keyless engines stays reachable from the deployment IP.
- [low risk] "auto" result titles keep the `title/href/body` shape the parser relies on.

## Evidence
- `site-packages/agno/tools/duckduckgo.py:20-40` (agno 2.4.7): `__init__` forwards `backend="duckduckgo"` unconditionally.
- Live command 2026-09-21: `DDGS().text('Creep Radiohead', backend='duckduckgo')` → `No results found.`; `backend='api'|'html'|'lite'|'auto'` → 2 results each.
- Live command 2026-09-21: `WebSearchTools(backend='auto').web_search('Creep Radiohead chords')` → 3 hits (Ultimate Guitar, Songsterr, chord sites).
- `backend/agents/sheets/enrich/candidates_free.py:217-218` and `backend/agents/sheets/enrich/links_free.py:104-105`: both call sites use `WebSearchTools(backend="auto")`.
- `ddgs` exceptions still propagate from `web_search` (see DR-001 evidence); both modules catch them and return empty results.

## Decision
**Option A.** Use `WebSearchTools(backend="auto")` for both enrichment searches. DuckDuckGoTools is rejected because its engine is hardwired and was not returning results; direct `DDGS` use is rejected as redundant.

## Confidence
Medium — works live today; depends on ddgs engine availability, which varies over time.

## Consequences
**Easier:** Search keeps working when any single engine soft-blocks; still keyless, still Agno.
**Harder:** Results can differ run-to-run (engine rotation), so parsing must be robust to title noise (see `candidates_free` fixtures).
**Risks that remain:** All keyless engines rate-limit bursts; mitigated by single bounded call per stage and graceful empty results.

## Revisit Trigger
Reopen if: `backend="auto"` returns empty for >20% of the live 10-song eval (`evals/test_sheets_enrich_live.py`), or Agno ships a DuckDuckGoTools that accepts a backend override.
