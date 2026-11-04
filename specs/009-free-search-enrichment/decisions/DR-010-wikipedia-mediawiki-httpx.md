# Decision: Song Context via the MediaWiki API over httpx (supersedes DR-002)

## Status
**Accepted — supersedes DR-002**

> **Amended post-merge (2026-09-22):** "bounded by construction" (Confidence) overstates the bound. The MediaWiki calls now go through `enrich.bounded_get()`: per-hop `min(2 s, remaining)` timeouts, at most 3 redirects, and byte-capped, clock-checked bodies. DNS resolution and response headers that trickle in are still not bounded, the same as every enrichment GET (DR-009, fourth amendment). The decision itself (MediaWiki over `httpx`, not the `wikipedia` package) is unchanged.

## Context
DR-002 chose the `wikipedia` package (two-step `search` → `page`). Its HTTP layer, `wikipedia.py:737` in wikipedia 1.4.0, is `requests.get(API_URL, params=params, headers=headers)` with **no timeout** and no API to set one. The DR-002 flow makes 4–5 such calls (search ×2, page, lazy `.summary`), and the deadline is only checked between them, so one stalled connection could hang `POST /sheets` indefinitely. That breaks FR-008 and SC-003, and DR-009's premise that every enrichment call is bounded.

**Question:** How should song context be fetched so every network call is bounded?

**Constraints that matter:**
- FR-006/FR-007: short factual context with a source link, never lyric text.
- FR-008/SC-003: every call bounded; the 25 s pipeline envelope must hold.
- FR-010: keyless.

## Options Considered
- **Option A — direct MediaWiki API via `httpx`.** One `list=search` call, then one batched `prop=extracts|info|pageprops` read (`exintro`, `explaintext`, `redirects`, `inprop=url`). Each call's timeout is `min(2 s, remaining stage budget)`, and calls are skipped under 0.3 s. Disambiguation and missing pages are skipped in search-rank order. The app identifies itself with its own User-Agent. **(chosen)**
- **Option B — keep `wikipedia` and wrap the stage in `future.result(timeout)`.** It returns on time, but the stalled thread keeps running, and a `with ThreadPoolExecutor()` block would wait on it at exit. **(rejected: leaks threads; the network call stays unbounded)**
- **Option C — keep DR-002 as is.** **(rejected: an unbounded call)**

## Assumptions
- [low risk] The MediaWiki action API (`formatversion=2`) is stable and keyless.
- [medium risk] Two calls are enough: rank-1 or rank-2 of `srsearch="{title} {artist} song"` is the song article when one exists.

## Evidence
- `site-packages/wikipedia/wikipedia.py:737` (1.4.0): `r = requests.get(API_URL, params=params, headers=headers)`, with no timeout.
- `backend/agents/sheets/enrich/context_free.py`: `_api_get` passes `timeout=budget`, where `budget = remaining_time(deadline, max_s=2.0)` and calls are skipped when it is under 0.3 s.
- `backend/tests/test_sheets_enrich_context.py`: `test_fetch_is_bounded_and_never_raises_on_timeout`, `test_fetch_skips_calls_when_budget_is_below_minimum`, `test_fetch_skips_disambiguation_and_missing_pages_in_rank_order`, `test_fetch_context_from_mediawiki_api_with_identified_user_agent` (asserts exactly 2 calls, each carrying the app UA).
- Live, 2026-09-22: context resolved in 1.00–1.15 s for Yesterday, Wonderwall, Creep and Almohada (previously 4–5 unbounded calls).

## Decision
**Option A.** It removes the `wikipedia` dependency and brings the stage down to two bounded calls. Option B is rejected because it hides the hang instead of preventing it.

## Confidence
High: the calls are bounded by construction, the failure modes are covered by tests, and it was verified live.

## Consequences
**Easier:** Deterministic tests through the `client=` seam, fewer requests, and no transitive `requests` usage on this path.
**Harder:** The response parsing (`normalized`/`redirects` alias chain, `pageprops.disambiguation`) now lives in domain code.
**Risks that remain:** Wikimedia may throttle bursts; the identified UA and two calls per sheet keep the load low.

## Revisit Trigger
Reopen if the live context hit rate drops below 7/10 in the SC-002 sample, or MediaWiki changes the `extracts` API.
