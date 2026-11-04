# Decision: Keyless Video Metadata via Direct oEmbed (supersedes DR-004)

## Status
**Accepted — supersedes DR-004**

## Context
DR-004 chose `YouTubeTools(enable_get_video_captions=False, timeout=3).get_youtube_video_data`. That evidence came from agno `main`. The pinned agno 2.4.7 `YouTubeTools.__init__` has no `timeout` parameter (construction with `timeout=` raised `TypeError`, dropping every video in the first live sample: 0/10), and its `get_youtube_video_data` calls `urlopen(url)` with no timeout, which cannot be bounded to the 3 s stage (DR-005/DR-009). DR-004 already named direct oEmbed as Option E, the drop-in alternative.

**Question:** How should keyless video links be verified and labeled within a bounded time?

**Constraints that matter:**
- FR-004/FR-005: keyless video links with provider label, opening outside the app.
- FR-007: metadata only — never captions/transcripts (lyric text).
- FR-008: each network call must be bounded.

## Options Considered
- **Option A — keep `YouTubeTools`.** **(rejected: pinned version cannot take a timeout; `urlopen` is unbounded; import also forces the `youtube-transcript-api` dependency)**
- **Option B — direct `httpx` GET to `https://www.youtube.com/oembed`** with the existing link-validation client (2 s timeout), only for URLs normalized by `_canonical_youtube_url` to `https://www.youtube.com/watch?v=<id>`; append the link only on HTTP 200. **(chosen)**
- **Option C — YouTube Data API only.** **(rejected: needs a key; defeats US2)**

## Assumptions
- [medium risk] Public oEmbed stays unauthenticated.
- [low risk] Non-200 oEmbed reliably indicates private/removed videos, so dropping them removes dead links.

## Evidence
- `site-packages/agno/tools/youtube.py:18` (agno 2.4.7): `__init__` signature has no `timeout`; `:91` `with urlopen(url) as response:` — no timeout.
- Live sample 2026-09-21 (before change): `Toolkit.__init__() got an unexpected keyword argument 'timeout'` on every video hit → 0/10 video links.
- `backend/agents/sheets/enrich/links_free.py:47` `_canonical_youtube_url` (www/m/music/youtu.be/shorts → `watch?v=`; channels/playlists → None); `:151` oEmbed GET with `timeout=call_s` (remaining budget), link appended only on 200. Tests: `tests/test_sheets_enrich_links.py::test_discovers_validated_pages_and_canonical_videos`, `::test_video_dropped_when_oembed_is_not_200`.
- Live sample 2026-09-21 (after change): videos found for 10/10 songs; `music.youtube.com` interstitial ("Tu navegador está obsoleto") no longer scraped as a page link.

## Decision
**Option B.** Direct oEmbed via `httpx`, canonical YouTube URLs, drop on non-200. Drops the `youtube-transcript-api` dependency, and makes the FR-007 no-captions posture structural (no transcript code path exists).

## Confidence
High — observed working live; smaller dependency surface than Option A.

## Consequences
**Easier:** Bounded, dedupable video links matching the Data API URL form; one fewer dependency.
**Harder:** oEmbed response parsing lives in domain code instead of a toolkit.
**Risks that remain:** oEmbed rate limits under burst; mitigated by ≤2 videos per sheet.

## Revisit Trigger
Reopen if: YouTube gates oEmbed behind auth, or the live eval video hit rate drops below 8/10.
