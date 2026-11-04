# Decision: Keyless fallback when every candidate provider fails (reverses the zero-result-only rule)

## Status
**Proposed.** Reverses the clause in `contracts/enrichment.md` that kept `PROVIDER_ERROR` unchanged when every provider fails. Takes effect on merge; needs explicit approval before merge.

## Context
- Production song search had one live candidate source: LRCLIB (`lrclib.net/api/search`). The observed production responses carried no Genius candidates (only `lrclib_id` refs).
- 2026-10-30, backend logs (`song-search`, last 12 hours): 40 responses were 502 `PROVIDER_ERROR`, and every one was preceded by `lrclib search HTTP 503`; 13 were 200. Counts include the author's own probe requests.
- Under the recorded rule (keyless enrichment only on zero results), an LRCLIB outage turned most searches into the provider-error state.
- The frontend also labelled every non-2xx response as a connection failure. That copy is fixed in the same change.

**Question:** When every configured candidate provider fails, should keyless enrichment run before the error state?

**Constraints that matter**
- FR-001: a provider failure must never be shown as a no-match.
- FR-003: the learner picks; nothing auto-generates on an ambiguous match.
- FR-010: no new secrets.

## Options Considered
- **A. Keep `PROVIDER_ERROR` on total failure (recorded rule).** Rejected: an LRCLIB outage blocks search for the learner, with no path to a sheet.
- **B. Keyless fallback on total failure; `PROVIDER_ERROR` only if the fallback also finds nothing (chosen).** Measured from a developer machine on 2026-10-30: keyless candidates in 10 of 16 calls across four starter songs (6 empty). Misses were DuckDuckGo `No results found`; Brave returned 429 during the run. Production behaviour is not measured.
- **C. Retry LRCLIB 503 after `Retry-After`, then fail.** Not chosen for this change. LRCLIB documents the retry, but it was not shown to help: one query stayed 503 across five attempts at 1 s spacing. A retry belongs in `LyricsClient.search` only, because `_get_with_429` is shared with `fetch`; a retry there would skip the lyrics.ovh fallback during an outage. Follow-up.

## Decision
**B.** When every attempted provider fails (transport error, non-200, or persistent 429), run the keyless `search_free` fallback and return its candidates, ranked and deduplicated as before. Raise `CandidatesUnavailableError` (route → 502 `PROVIDER_ERROR`) only when the fallback also finds nothing. Zero-hit searches, and searches where any provider answered with hits, behave as before.

## Consequences
- Search keeps working during LRCLIB outages with weaker candidates (DuckDuckGo-derived, `provider_refs.duckduckgo`). The learner still picks; nothing auto-generates.
- Sheet generation for songs not on the chart still fetches lyrics from LRCLIB (`pipeline.py`, `if not chart_hit`). During an outage those songs return NO_MATCH (`LyricsMiss`). Pre-existing and not changed here.
- The frontend names the failure: non-2xx → "The song service returned an error"; rejected fetch → "Couldn't reach the song service".
- Contracts agree: `contracts/enrichment.md`, 009 `spec.md` (FR-001, scenarios 1 and 3), and 004 `contracts/rest-api.md`.

## Evidence
- Backend tests: `backend/tests/test_sheets_candidates.py` (fallback returns keyless candidates; empty fallback still raises; provider hits never mixed with keyless; LRCLIB down with Genius up returns Genius candidates) and `backend/tests/test_routes_sheets_search.py` (LRCLIB 503 with keyless hits → 200).
- Live route check with LRCLIB forced to 503: "Stand by Me" → 200 with two keyless candidates; "Riptide" → 502 in that run, and 4 of 4 non-empty in a later direct measurement.

## Revisit Trigger
Reopen after deploy if Railway logs show `keyless candidate fallback failed` next to most `song-search` 502s, or if the live keyless empty rate stays above 20%. DR-007's own trigger is defined on the live 10-song eval of the old `auto` backend, so it is the same kind of threshold, not the same metric. Also reopen once `GENIUS_ACCESS_TOKEN` is set and measured: a second provider should make keyless the last resort.

## Confidence
Medium. The mechanism is verified by tests and a live route check. Production effectiveness is unverified: the keyless measurements came from a developer machine, not from Railway.
