# Data Model: Free Search Enrichment

**Feature**: `009-free-search-enrichment` | **Spec**: [spec.md](./spec.md)

No new tables. All additions ride the existing `song_sheets` row; `history_entries` unchanged.

## Entities

### Enriched Candidate (transient, not stored)

| Field | Type | Required | Rules |
|---|---|---|---|
| `title` | string | yes | 1–200 chars, trimmed |
| `artist` | string | yes | 1–200 chars, trimmed |
| `origin` | string | yes | `duckduckgo` (only free origin in v1) |
| `confidence` | float | yes | 0–1, informational; ordering only |

Relationships: appended after configured-provider candidates, deduped by folded `title|artist`; never auto-selected (FR-003).

### Enriched Link (persisted inside `song_sheets.source_links`)

| Field | Type | Required | Rules |
|---|---|---|---|
| `label` | string | yes | provider/title text, non-blank |
| `url` | string | yes | http(s), deduped vs attribution + internally, cap 8 total (existing MAX_LINKS) |
| `kind` | string | yes | `lyrics` \| `chords` \| `video` \| `context` |

Existing assembly order preserved: lyrics → chords → video; enriched items fill remaining cap only.

### Song Context (persisted, nullable on `song_sheets`)

| Field | Type | Required | Rules |
|---|---|---|---|
| `text` | string | yes, when present | ≤600 chars, factual, no lyric text |
| `source` | string | yes, when present | `wikipedia` |
| `source_url` | string | yes, when present | http(s) page URL |

Rules: absent (NULL) when no match; rendered in a separate block, never inside lyric body; re-open serves stored value with zero re-query (FR-009).

## State transitions

- Enrichment runs on generate/regenerate only (the only provider-querying paths). History `GET`/`DELETE` never enrich.
- Timeout/failure at any enrichment stage → skip stage, record `degraded {part: enrichment, reason: timeout|unavailable}`, keep today's behavior.
