# Feature Specification: Free Search Enrichment

**Feature Branch**: `009-free-search-enrichment`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Review agno built in features like DuckDuckGo for free search and other modules to continue enriching the Lyrics + Chords search feature (004). Add keyless enrichment for candidate resolution, source links, and song context without new paid keys."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a song even with weak metadata (Priority: P1)

A learner types a song name that returns zero or weak candidates (no paid metadata key configured, typo, or obscure spelling). The system uses free web search to propose additional likely matches so the learner can still pick the right song.

**Why this priority**: Candidate resolution is the entry gate to generation. When the paid metadata source is absent and the free lyric index misses, the learner is stuck at no-match today. Keyless fallback restores the flow with zero new secrets.

**Independent Test**: Can be fully tested by searching with a misspelled or long-form song name with paid keys disabled and verifying an enriched candidate list appears where a no-match appeared before. Delivers resolvability even before source-link quality is judged.

**Acceptance Scenarios**:

1. **Given** a learner submits a song name with zero candidates from configured providers, **or** every configured provider fails (for example LRCLIB `503`), **When** free enrichment runs, **Then** the candidate list shows additional likely matches with song title and performer.
2. **Given** enriched candidates are shown, **When** the learner picks one, **Then** sheet generation proceeds exactly as with any other pick.
3. **Given** free enrichment also finds nothing, **When** it completes, **Then** the existing no-match state appears with retry guidance after zero results, or the provider-error state with retry after a provider failure. A provider failure is never shown as no-match.

---

### User Story 2 - Useful source links without a video key (Priority: P2)

A learner generates a sheet while no video key is configured. The sheet still shows useful outbound page and video links discovered through free search, instead of an empty video section.

**Why this priority**: Source links are the feature's trust and discovery value. Today keyless mode ships page links only plus a video empty state. Free discovery fills the gap without quota or cost.

**Independent Test**: Can be fully tested by generating a well-known song with video keys disabled and verifying the sources list contains page and video links where only page links appeared before. Delivers link completeness even before song context is judged.

**Acceptance Scenarios**:

1. **Given** a sheet generated without a video key, **When** free enrichment completes, **Then** the sources list contains at least one page link and at least one video link.
2. **Given** free enrichment finds no video, **When** it completes, **Then** the sheet still renders fully and the video part shows its existing empty state with notice.
3. **Given** a stored sheet is re-opened from history, **When** it loads, **Then** no new enrichment runs and the stored links render unchanged.

---

### User Story 3 - Song context on the sheet (Priority: P3)

A learner viewing a generated sheet sees short factual context about the song and performer (for example release era, performer background) drawn from free encyclopedic sources, clearly separated from lyrics and chords.

**Why this priority**: Context turns a playable sheet into a learning moment. It builds on generation (004) and is strictly additive: lyrics, chords, and attribution never change.

**Independent Test**: Can be fully tested by opening a generated sheet for a well-known song and verifying a short context block appears with its own source label, dismissible without affecting the sheet. Delivers learning value even when candidates and links are unchanged.

**Acceptance Scenarios**:

1. **Given** a generated sheet for a well-known song, **When** context is available, **Then** a short context block appears separate from lyrics/chords with its source labeled.
2. **Given** no encyclopedic match exists, **When** enrichment completes, **Then** no context block appears and the sheet is otherwise unchanged.

---

### Edge Cases

- What happens when the learner submits an empty song name? The submission MUST be blocked with inline guidance; no enrichment runs.
- What happens when free enrichment is slow or fails? The sheet or candidate flow MUST degrade to today's behavior (existing candidates, page links, empty states) with no error blocking generation.
- What happens when free enrichment returns low-confidence or conflicting matches? Only matches meeting a confidence bar MUST appear, ranked below configured-provider matches; never auto-generate for an ambiguous match.
- What happens when an enriched link is dead or blocked? The app MUST NOT break; links open outside the app and their availability is not guaranteed.
- What happens when enrichment would reproduce lyrics or chords? It MUST NOT: enrichment supplies metadata and links only, never lyric or chord text.
- What happens under the generation time budget? Enrichment MUST fit inside the existing backend time budget; on timeout the flow MUST short-circuit to today's behavior with a degraded marker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When configured providers return zero candidates, or every configured provider fails (for example an upstream `503`), the system MUST attempt keyless web enrichment before showing a no-match or provider-error state. A provider failure MUST NOT be reported as a no-match: if enrichment also finds nothing after a failure, the existing provider-error state with retry applies.
- **FR-002**: Enriched candidates MUST carry song title and performer, MUST be ranked below configured-provider matches, and MUST be deduplicated against them.
- **FR-003**: The learner MUST pick from the combined candidate list; the system MUST never auto-generate for an ambiguous match.
- **FR-004**: When video keys are absent or video quota is exhausted, the system MUST attempt keyless video/page link discovery before rendering the sources empty state.
- **FR-005**: Every enriched link MUST show its provider/label, MUST open outside the app, and the sheet MUST still render when none are found.
- **FR-006**: A generated sheet MAY show a short factual context block about the song/performer from encyclopedic sources, visually separate from lyrics and chords, with its own source label; absence MUST NOT alter the sheet.
- **FR-007**: Enrichment MUST supply metadata and links only and MUST NOT reproduce, rewrite, or align lyric or chord text.
- **FR-008**: Enrichment MUST run within the existing backend time budget and MUST degrade gracefully on timeout or failure: existing candidates, links, and notices apply, plus a degraded marker.
- **FR-009**: History behavior MUST be unchanged: re-open serves the stored sheet with zero re-querying; regenerate creates a new entry; only stored links and context render on re-open.
- **FR-010**: Keyless enrichment MUST require no new secrets; all hosted fetching MUST go through the backend and the browser MUST never hold provider keys.

*Amendment 2026-10-30 (DR-011): FR-001 originally covered zero-result searches only. LRCLIB `503 ServerOverloaded` made song searches fail as `PROVIDER_ERROR` in production: 40 search 502s against 13 successes in backend logs over 12 hours, every failure `lrclib search HTTP 503` (counts include probe requests). A provider failure now also triggers keyless enrichment; `contracts/enrichment.md` is amended to match.*

### Key Entities

- **Enriched Candidate**: A likely song match from keyless search — song title, performer, confidence rank, and origin label; never auto-selected.
- **Enriched Link**: An outbound reference discovered keylessly — label/provider name plus link to a page or video for the matched song; links open outside the app.
- **Song Context**: Short factual text about the song/performer from encyclopedic sources with its source label, shown separate from the sheet body.

### Decision records

| Record | Settles | Status |
|---|---|---|
| [DR-001](decisions/DR-001-web-search-toolkit.md) | Web search toolkit for candidate fallback and link discovery (DuckDuckGoTools with ddgs exception handling) | **Superseded by DR-007** — pinned toolkit hardwires a non-responding engine |
| [DR-002](decisions/DR-002-song-context-source.md) | Song context acquisition source and URL extraction (two-step `wikipedia.search` + `wikipedia.page`) | **Superseded by DR-010** — library calls have no timeout |
| [DR-003](decisions/DR-003-link-validation-method.md) | Outbound link validation method and budget protection (direct `httpx` HEAD/GET vs crawler) | Accepted |
| [DR-004](decisions/DR-004-video-enrichment-metadata.md) | Video link enrichment and metadata retrieval (YouTubeTools oEmbed only, captions disabled per FR-007) | **Superseded by DR-008** — pinned toolkit cannot bound its request |
| [DR-005](decisions/DR-005-stage-budgets-and-degradation.md) | Enrichment stage time budgets (≤3 s/stage, ≤6 s total), ranking, and degraded reporting | **Superseded by DR-009** — budgets are targets, not preemptive |
| [DR-006](decisions/DR-006-context-storage-and-schema-evolution.md) | Song context storage and schema evolution (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `init_db`) | Accepted |
| [DR-007](decisions/DR-007-web-search-backend-auto.md) | Keyless web search via `WebSearchTools` on two pinned engines (`brave,yahoo`; one bounded ddgs round) | Accepted — supersedes DR-001 (corrected pre-merge) |
| [DR-008](decisions/DR-008-video-oembed-direct.md) | Video metadata via direct bounded oEmbed GET on canonical YouTube URLs | Accepted — supersedes DR-004 |
| [DR-009](decisions/DR-009-budget-targets-and-kill-switch.md) | `bounded_get`: ≤3 redirects, per-hop timeouts from the remaining budget, no 3xx body reads, clock-checked bodies; links skipped with `timeout` under 1 s; DNS and header trickle unbounded; SC-003 is a gated 004 target, guaranteed by neither 004 nor 009; `ENRICH_TIMEOUT_S` kill-switch; one enrichment marker | Accepted — supersedes DR-005 (corrected pre-merge, amended post-merge) |
| [DR-010](decisions/DR-010-wikipedia-mediawiki-httpx.md) | Song context via two MediaWiki API calls over `httpx` through `bounded_get` | Accepted — supersedes DR-002 (amended post-merge) |
| [DR-011](decisions/DR-011-keyless-fallback-on-provider-outage.md) | Keyless fallback when every candidate provider fails; reverses the zero-result-only clause in `contracts/enrichment.md` | **Proposed** — takes effect on merge; needs explicit approval before merge |

*Note: DR-001–DR-006 were ratified from research and review; DR-007–DR-010 supersede four of them with live-verification evidence (2026-09-21/22). DR-007 and DR-009 carry pre-merge correction notes.*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With paid keys disabled, a misspelled or long-form song search that shows no-match today shows a pickable candidate list after enrichment.
- **SC-002**: With video keys disabled, 8 out of 10 generated sheets for well-known songs show at least one page link and at least one video link.
- **SC-003**: A submitted song search still produces a sheet, candidate list, or no-match state within 30 seconds wall-clock, same envelope as today.
- **SC-004**: A history entry re-opened in a later visit shows the same links and context as stored, with zero new outbound lookups.
- **SC-005**: The owner can complete a search-to-sheet task for a named song on the first attempt without guidance.

## Assumptions

- The app remains a private single-user hobby app for personal practice; all history belongs to the synthetic single-owner identity.
- Keyless enrichment is metadata and links only; lyric/chord sourcing, attribution, and persistence rules from the base feature are unchanged.
- No new paid keys are provisioned for this feature; defined degraded states apply when keyless sources are unavailable.
- Backend generation keeps its existing time-budget envelope; per-stage timeouts short-circuit per edge cases.
- User interface copy is in English; localization is out of scope.
- Visitors use a modern browser with network connectivity; offline use is out of scope.

## Out of Scope

- New lyric or chord text sources; changes to chart-takes-all precedence or model chord alignment.
- Embedded playback of linked video or audio; printing, exporting, sharing, or publishing sheets.
- Login, multi-user accounts, or changes to history retention.
- Catalog-wide search across courses, topics, and games.
