# Decision: Enrichment Stage Time Budgets, Ranking, and Graceful Degradation

## Status
**Superseded by DR-009 (2026-09-22)**

> Budgets are enforced via per-call timeouts and deadline gating, not hard preemption (measured 4/10 songs over 6 s live); DR-009 records that and the `ENRICH_TIMEOUT_S` kill-switch. Ranking/dedupe rules carry over unchanged. Body kept for history.

## Context
SC-003 requires that search and sheet generation complete within the existing 30-second wall-clock envelope (25-second backend generation deadline). Because free external web services (DuckDuckGo, Wikipedia, external websites, YouTube oEmbed) exhibit variable latency and unpredictable rate limits, enrichment must operate under strict, isolated time bounds without ever starving core sheet generation stages (lyrics and chords). Furthermore, candidate ranking and failure states must be clearly defined.

**Question:** How should time budgets be partitioned across enrichment stages and how should degraded states be reported?

**Constraints that matter:**
- FR-008: Enrichment must run within the existing backend time budget and must degrade gracefully on timeout or failure with a degraded marker.
- FR-002: Enriched candidates must be ranked below configured-provider matches and deduplicated against them.
- FR-003: The learner must pick from the candidate list; the system must never auto-generate for an ambiguous match.
- SC-003: Wall-clock generation time within 30 seconds.

## Options Considered
- **Option A — Bounded 3.0 s stage timeouts, 6.0 s total enrichment cap, folded dedup, and structured degraded markers.** Impose a strict 3.0 s deadline on the candidate fallback stage, 3.0 s on the link discovery stage, and 3.0 s on the song context stage (executed concurrently or pipelined with links). Total enrichment execution is capped at 6.0 s against the 25.0 s pipeline budget. When a stage exceeds its deadline or encounters an uncaught network exception, the stage is skipped, existing candidates/links/empty states are preserved, and an entry `{part: "enrichment", reason: "timeout" | "unavailable"}` is appended to the sheet's `degraded` list. Enriched candidates are appended after configured-provider candidates and deduplicated by folded `title|artist`. **(chosen)**
- **Option B — Unbounded opportunistic enrichment.** Allow enrichment tasks to run until the outer 25.0 s pipeline deadline expires. **(rejected: a slow DuckDuckGo search or hung website validation will consume the time budget required by the OpenRouter chord generation LLM, causing generation failures across the pipeline)**
- **Option C — Fail-fast on enrichment errors.** Raise HTTP 500 or validation errors if free enrichment tools fail or get rate-limited. **(rejected: violates FR-008 and turns an optional additive feature into a critical point of failure for core generation)**
- **Option D — Silent omission of degraded markers.** Drop failed enrichment without appending to the `degraded` array. **(rejected: eliminates observability, prevents automated eval testing of degradation behavior, and violates contract specifications)**

## Assumptions
- [high risk] DuckDuckGo text search completes within 3.0 s for at least 90% of requests under normal network conditions.
- [medium risk] Downstream clients (frontend) handle `{part: "enrichment", reason: ...}` in the sheet's `degraded` array without validation errors.
- [low risk] Folded `title|artist` comparison (lowercase, stripped punctuation, normalized whitespace) prevents duplicate candidates between paid and free sources.

## Evidence
- `specs/009-free-search-enrichment/plan.md:25-26`: Specifies a 25 s backend budget with enrichment stages capped at ~6 s combined, short-circuiting on deadline.
- `backend/agents/sheets/pipeline.py:114,145-235`: Existing pipeline uses `_expired()` deadline checks and appends `{part: "...", reason: "..."}` to `degraded`.
- `backend/db_models.py:206-217`: `validate_degraded` validates the structure of degraded entries against allowed parts and reasons.
- `specs/009-free-search-enrichment/contracts/enrichment.md:10`: Declares that `degraded[]` may contain `{part: "enrichment", reason: "timeout" | "unavailable"}`.

## Decision
**Option A.** Enforce 3.0-second individual stage deadlines with a 6.0-second aggregate enrichment cap in `backend/agents/sheets/enrich/__init__.py`. Catch all toolkit exceptions and deadline expirations, appending `{part: "enrichment", reason: "timeout" | "unavailable"}` to the sheet's `degraded` array. Rank enriched candidates strictly after primary candidates with folded-identity deduplication. Reject Options B, C, and D for budget risk, availability hazard, and lack of observability respectively.

## Confidence
High — Directly mirrors the battle-tested degradation patterns established in feature 004 and protects core generation invariants.

## Consequences
**Easier:** Predictable generation latency, reliable regression testing via synthetic timeouts, and safe recovery from external service outages.
**Harder:** Frontend and backend schemas must be updated to accept `"enrichment"` as a valid degraded part enum.
**Risks that remain:** On slow network environments, enrichment will degrade to standard empty states; acceptable per specification.

## Revisit Trigger
Reopen if: Telemetry indicates that 3.0 seconds is insufficient for DuckDuckGo responses in production regions, requiring an adaptive timeout or asynchronous background enrichment.
