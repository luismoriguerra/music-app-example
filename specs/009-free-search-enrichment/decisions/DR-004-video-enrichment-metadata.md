# Decision: Video Link Enrichment and Metadata Retrieval Method

## Status
**Superseded by DR-008 (2026-09-22)**

> The pinned agno 2.4.7 `YouTubeTools` takes no `timeout` and calls `urlopen` unbounded (0/10 videos live); DR-008 adopts this record's Option E (direct oEmbed). Body kept for history.

## Context
FR-004 requires keyless video link discovery when `YOUTUBE_API_KEY` is missing or its daily quota is exhausted. In this keyless mode, DuckDuckGo identifies candidate YouTube URLs (`youtube.com/watch?v=...`). We must verify these video URLs and extract display metadata (video title, channel/author name, thumbnail) within a 3-second budget without violating copyright or lyric reproduction restrictions.

**Question:** How should video links be enriched and verified when no video API key is configured?

**Constraints that matter:**
- FR-004: When video keys are absent or video quota exhausted, attempt keyless video link discovery before empty state.
- FR-005: Every enriched link must show its provider/label and open outside the app.
- FR-007: Enrichment must supply metadata and links only; must NOT reproduce, rewrite, or align lyric or chord text.
- FR-008: Enrichment must run within the backend time budget (video stage capped at ≤3.0 s).

## Options Considered
- **Option A — DuckDuckGo discovery + `YouTubeTools.get_youtube_video_data` with captions explicitly disabled.** Use DuckDuckGo to find `youtube.com/watch` URLs, then invoke `YouTubeTools(enable_get_video_captions=False, enable_get_video_timestamps=False, timeout=3).get_youtube_video_data(url)`. This calls the public YouTube oEmbed endpoint (`https://www.youtube.com/oembed`) via standard HTTP, returning clean title and author metadata with zero API key requirement and zero caption leakage. **(chosen)**
- **Option B — `YouTubeTools` with transcript caption fetching (`get_youtube_video_captions`).** Use Agno's caption fetching capabilities to inspect video content. **(rejected: song captions are literal lyric text; fetching or storing them directly violates FR-007. Furthermore, no downstream requirement or schema consumes video captions, making it dead code and an unnecessary compliance hazard)**
- **Option C — YouTube Data API v3 only.** Require `YOUTUBE_API_KEY` for all video link resolution. **(rejected: defeats the core goal of User Story 2, which is to eliminate the empty video section for keyless users)**
- **Option D — Unofficial scraper libraries (e.g. pytube, yt-dlp) or Piped instances.** Scrape video pages directly. **(rejected: high maintenance overhead, frequent breakage, and potential terms-of-service compliance risks)**
- **Option E — Direct `httpx` GET to `https://www.youtube.com/oembed`.** Fetch oEmbed JSON directly using the existing `httpx` client. **(considered: eliminates the `youtube-transcript-api` dependency; deferred to preserve Agno toolkit consistency in v1, but designated as the immediate drop-in alternative if transcript dependency causes install issues)**

## Assumptions
- [high risk] YouTube's public oEmbed endpoint (`youtube.com/oembed`) remains accessible without authentication and responds within 3 seconds.
- [medium risk] `youtube-transcript-api` remains a mandatory import for the `YouTubeTools` module even when caption functions are disabled.
- [low risk] DuckDuckGo video search queries (`"{title} {artist} official video site:youtube.com"`) reliably surface relevant official or lyric video URLs.

## Evidence
- `libs/agno/agno/tools/youtube.py:70-105`: `YouTubeTools.get_youtube_video_data` executes `urlopen("https://www.youtube.com/oembed?...")` using standard Python urllib and returns `{title, author_name, author_url, thumbnail_url}` with zero API keys.
- `libs/agno/agno/tools/youtube.py:107-135`: `YouTubeTools.get_youtube_video_captions` calls `YouTubeTranscriptApi().fetch()` and returns `" ".join(line.text for line in captions)`, which constitutes copyrighted lyric text for musical tracks.
- `libs/agno/agno/tools/youtube.py:27`: The `YouTubeTools` constructor defaults to `timeout=30`, which is dangerous if unconstrained; passing `timeout=3` is supported and necessary.
- `specs/009-free-search-enrichment/spec.md:79`: FR-007 explicitly states: "Enrichment MUST supply metadata and links only and MUST NOT reproduce, rewrite, or align lyric or chord text."

## Decision
**Option A.** Configure `agno.tools.youtube.YouTubeTools` with `enable_get_video_captions=False`, `enable_get_video_timestamps=False`, and `timeout=3` in `backend/agents/sheets/enrich/links_free.py`. Use only `get_youtube_video_data` to parse oEmbed metadata from DDG-discovered links. Option B is rejected because video transcripts constitute lyric text in violation of FR-007. Options C and D are rejected for failing keyless requirements and operational instability respectively. Option E remains an active alternative if `youtube-transcript-api` dependency overhead is to be eliminated.

## Confidence
High — YouTube oEmbed is an industry-standard, stable, rate-friendly public endpoint that delivers exact author and title metadata without authentication.

## Consequences
**Easier:** Clean metadata extraction without quota tracking, secret provisioning, or lyric copyright risk.
**Harder:** `youtube-transcript-api` must be included in `backend/pyproject.toml` solely to satisfy Agno's top-level module import in `tools/youtube.py`.
**Risks that remain:** Occasional DDG search noise may suggest live performances or cover versions rather than official audio/video tracks; mitigated by displaying author name in the link label.

## Revisit Trigger
Reopen if: YouTube deprecates or gates its public oEmbed endpoint behind authentication or captchas.
