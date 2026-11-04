# Decision: Enrichment Budgets as Targets, Kill-Switch, and Degraded Reporting (supersedes DR-005)

## Status
**Accepted — supersedes DR-005**

> **Corrected pre-merge (2026-09-22):** this record first assumed every enrichment call was already bounded. Two were not. The `wikipedia` package issued `requests.get` without a timeout (fixed by DR-010), and ddgs "auto" ran repeated `wait(timeout)` rounds (fixed by pinning two engines, see the DR-007 correction). As implemented, every network call in both stages now takes `timeout = min(2 s, remaining stage budget)` and is skipped under 0.3 s: search via `search_timeout()`; oEmbed/page GETs (`links_free.py:132-172`, page reads capped at 64 KB); MediaWiki calls (`context_free.py:52-61`). A stage can therefore overrun its budget by at most one in-flight call's connection overhead. Measured live: links 2.7–3.4 s against a 3.0 s budget, context 1.0–1.15 s. This makes the rejection of preemption (Option B) valid. The unused `TOTAL_ENRICH_BUDGET_S` / `ENRICH_TOTAL_BUDGET_S` was removed.

> **Amended post-merge (2026-09-22):** the note above overstates the bound in three ways, now corrected:
> - httpx timeouts are **per phase**: connect and read each get up to `call_s`. One call can therefore take about 2× its budget, which is more than "connection overhead".
> - `search_timeout()` returned at least 1 s even when less time remained, because ddgs only takes whole seconds. It now returns None, and the search is skipped, when less than 1 s remains (`enrich/__init__.py`, tests `::test_search_skipped_when_less_than_one_second_remains`).
> - The streamed page-title read did not check the clock, and httpx's read timeout resets on every chunk. It now also stops at the stage deadline (`links_free.py`, `::test_slow_trickle_page_read_stops_at_the_stage_deadline`).
>
> **Accurate guarantee:** each call uses per-phase timeouts of `min(2 s, remaining)` and is skipped below 0.3 s. The search is skipped below 1 s and capped at 2 s. A stage can overrun its budget by about 2× one call's budget (≤4 s worst case). SC-003 still holds with margin.

> **Amended again post-merge (2026-09-22, retracts the "Accurate guarantee" above):** the guarantee above was false on the production path. The stages' own `httpx.Client(follow_redirects=True)` followed up to 20 redirects, each hop with fresh per-phase timeouts and no deadline check. The oEmbed and MediaWiki GETs also read whole bodies without checking the clock (read timeouts reset per chunk). Fixed:
> - `enrich.bounded_client(deadline)` follows at most 3 redirects. A `request` hook runs before every hop: it refuses the hop once the deadline has passed and clamps every phase timeout to the time left (`test_sheets_enrich_core.py::test_bounded_client_*`).
> - `enrich.read_body()` streams oEmbed, MediaWiki and page bodies, stopping at a byte cap or the stage deadline (`::test_trickling_oembed_*`, `::test_trickling_mediawiki_*`, `::test_read_body_*`).
> - The pipeline skips the links stage with `degraded {enrichment, timeout}` when less than 1 s remains (`SEARCH_MIN_S`, the ddgs floor). Before this it returned empty with no marker. Setting `ENRICH_TIMEOUT_S` between 0 and 1 therefore always marks links `timeout`.
>
> **Guarantee as implemented [analysis, not measured]:** no hop starts after the deadline. Connect and each body chunk are bounded by the time left when the hop started, so one in-flight call can overrun by up to about 2× the remaining budget (at most 4 s).
>
> **Still unbounded:** DNS resolution (sync `getaddrinfo`, outside httpx timeouts) and ddgs's internal requests beyond its own `timeout`. SC-003 depends on the 25 s envelope absorbing these.

> **Amended a third time post-merge (2026-09-22, replaces the hook mechanism and the "≈2×" figure above):** the `bounded_client` request hook did not bound redirects. httpx's redirect loop reads every intermediate 3xx body with no clock or size cap, and the hook ran only on clients the stages created, so tests with an injected client never exercised it. Replaced by `enrich.bounded_get(client, url, deadline, …)`, used for page, oEmbed and MediaWiki GETs on any client. It sends with `follow_redirects=False` and follows `next_request` for at most 3 hops. Each hop gets `timeout = min(2 s, remaining)` and is not sent with less than 0.3 s left. 3xx bodies are never read, and the final 200 body goes through `read_body` (`test_sheets_enrich_core.py::test_bounded_get_*`).
>
> **What is bounded:** hop count, when a hop starts, each per-read timeout (clamped to the time left), and body bytes and time.
>
> **Not bounded, so there is no numeric worst case:** DNS resolution; response headers that trickle in (httpcore applies the read timeout per `recv`, not per response, and skips 1xx responses); ddgs requests beyond its own `timeout`. The measured stage times (links 2.2–3.4 s, context 0.95–1.15 s) are observations, not guarantees. SC-003 relies on the 25 s envelope absorbing these cases.

> **Amended a fourth time post-merge (2026-09-22, SC-003 and Option B):** the notes above wrongly say the 25 s envelope "absorbs" unbounded calls (lines 22 and 28), and that "SC-003 still holds with margin" (line 13 and Confidence). Nothing absorbs a stalled call. `POST /api/v1/sheets` runs `generate_sheet(..., deadline_s=25)` synchronously (`app/routes_sheets.py:264-273`). `app/main.py` adds only CORS middleware. The pipeline checks its deadline only between stages. A stalled DNS lookup or a result host that trickles its headers can therefore hold a request past 30 s.
> - **SC-003 status:** holds in every measurement so far (live 10-song eval about 57 s total, 2.1–3.4 s links, 0.86–1.15 s context per song). It is **not guaranteed** against a stalled DNS lookup or header trickle. There is no worst-case number.
> - **Option B (preemption)** is the only hard bound. Rejecting it is now a cost trade-off (thread machinery in a sync pipeline for a hobby app, accepting the rare stall), not the claim in the line 6 note that "every call is bounded". The Revisit Trigger stands: any observed SC-003 breach reopens this record in favour of preemption.

> **Scope correction (2026-09-22, narrows the fourth amendment):** SC-003 is a gated target carried over from 004. Neither 004 nor 009 guarantees it, and enrichment is not the only risk. The 004 stages use fixed per-phase timeouts that ignore the pipeline deadline:
> - `charts.py:153,164`, `lyrics.py:18,63`, `sources.py:13,37`, `candidates.py:17,128`, `routes_sheets.py:36`: all `10.0` s.
> - `_expired()` only gates when a stage starts.
>
> So a slow but healthy chart or lyrics host, on a stage that starts late, can exceed 30 s with no DNS or header problem, and preempting enrichment would not fix that. **Revisit Trigger, narrowed:** reopen this record in favour of preemption only when an observed SC-003 breach traces to an enrichment stage overrunning its budget. A breach caused by a 004 stage belongs to the 004 pipeline, not this record.

## Context
DR-005 decided "strict 3.0 s per stage, 6.0 s total" enforcement. The implementation bounds each individual network call (search `timeout`, 2 s per HTTP GET) and gates each stage on the remaining pipeline deadline, but does not preempt a stage mid-flight. The live 10-song sample measured 4.6–7.0 s per song for links + context, i.e. 4/10 above the 6 s figure. Recording that as "enforced" would be false. Operators also need an off switch (quickstart step 4).

**Question:** What timing guarantees does enrichment actually provide, and how are skips reported?

**Constraints that matter:**
- SC-003: total request ≤30 s wall-clock (25 s backend deadline) — must hold.
- FR-008: degrade gracefully with a `degraded {part: enrichment}` marker.

## Options Considered
- **Option A — targets + per-call bounds + deadline gating + env kill-switch.** `STAGE_TIMEOUT_S` (env `ENRICH_TIMEOUT_S`, default 3.0) caps the budget handed to each stage as `min(STAGE_TIMEOUT_S, remaining pipeline deadline)`; a stage is skipped when that is ≤0.5 s. `STAGE_TIMEOUT_S <= 0` disables enrichment. One marker per sheet: `unavailable` when disabled, `timeout` when skipped for time. **(chosen)**
- **Option B — hard preemption (thread/future with `result(timeout)`).** Enforces the 6 s total, but adds thread-pool machinery to a sync pipeline for a hobby app with a 25 s envelope. **(rejected for v1; see Revisit Trigger)**
- **Option C — keep DR-005 wording.** **(rejected: contradicts measured data)**

## Assumptions
- [medium risk] Per-call bounds keep a single enrichment stage well under the remaining 25 s envelope.
- [low risk] One marker per sheet is enough signal for the UI notice.

## Evidence
- `backend/agents/sheets/enrich/__init__.py:15-16`: `STAGE_TIMEOUT_S`/`TOTAL_ENRICH_BUDGET_S` read from env.
- `backend/agents/sheets/pipeline.py:242-247` `_enrich_budget`; `:251-254` and `:274-277` skip with `unavailable`/`timeout`.
- `backend/tests/test_sheets_pipeline.py::test_enrichment_disabled_marks_unavailable_and_skips_calls` and `::test_deadline_expired_before_video_skips_video` (asserts `[video/timeout, enrichment/timeout]`).
- Live sample 2026-09-21: per-song 4.56–7.01 s; all requests well inside SC-003's 30 s.

## Decision
**Option A.** Budgets are per-stage targets enforced through per-call timeouts and deadline gating, not hard preemption. `ENRICH_TIMEOUT_S=0` is the kill-switch. Ranking/dedupe rules from DR-005 are unchanged.

## Confidence
Medium — SC-003 holds with margin; the 6 s figure is a target, not a guarantee.

## Consequences
**Easier:** Deterministic tests via the injectable clock; ops can disable enrichment without deploy.
**Harder:** A slow-but-responding host can push one stage past its target.
**Risks that remain:** Provider outages are still reported only as empty results, not `unavailable`; listed as a follow-up.

## Revisit Trigger
Reopen if: live eval p90 per-song enrichment exceeds 10 s, or any request breaches SC-003.
