"""Keyless search enrichment package for candidate resolution, outbound links, and song context.

Governed by DR-001 through DR-006. All helpers honor stage deadlines, never raise
unhandled exceptions, and provide graceful degradation markers.
"""

from __future__ import annotations

import os
import re
import time
import unicodedata
from dataclasses import asdict, dataclass
from typing import Any

import httpx

# Timing (DR-009): per-stage budget; <= 0 disables enrichment (kill-switch).
STAGE_TIMEOUT_S: float = float(os.getenv("ENRICH_TIMEOUT_S", "3.0"))
# Exactly two keyless ddgs engines (DR-007): ddgs then runs ONE bounded wait(timeout)
# round. "auto" loops rounds until max_results and shuffles engines per call.
SEARCH_BACKENDS: str = os.getenv("ENRICH_SEARCH_BACKENDS", "brave,yahoo")
# Cap on the search call so link/oEmbed checks keep part of the stage budget.
SEARCH_MAX_S: float = 2.0
# ddgs takes whole-second timeouts: below this the search (and the links stage, which
# starts with it) is skipped and the pipeline reports `timeout` (FR-008).
SEARCH_MIN_S: float = 1.0


def search_timeout(deadline: float) -> int | None:
    """ddgs only accepts whole-second timeouts, so a search needs >= 1 s of budget.

    Returns min(SEARCH_MAX_S, remaining) truncated to int, or None (skip the search)
    when less than 1 s remains — never a timeout longer than the remaining budget.
    """
    remaining = deadline - time.monotonic()
    if remaining < SEARCH_MIN_S:
        return None
    return int(min(SEARCH_MAX_S, remaining))


DEFAULT_DEGRADED_PART: str = "enrichment"


@dataclass(frozen=True)
class EnrichedCandidate:
    """A likely song candidate from keyless web search."""

    title: str
    artist: str
    origin: str = "duckduckgo"
    confidence: float = 0.5

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "artist": self.artist,
            "album": None,
            "artwork_url": None,
            "provider_refs": {self.origin: fold_identity(self.title, self.artist)},
            "origin": self.origin,
            "confidence": self.confidence,
        }


@dataclass(frozen=True)
class EnrichedLink:
    """An outbound reference discovered keylessly."""

    label: str
    url: str
    kind: str  # 'lyrics' | 'chords' | 'video'

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class SongContext:
    """Short encyclopedic context about a song/performer."""

    text: str
    source: str = "wikipedia"
    source_url: str = ""

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def compute_deadline(timeout_s: float = STAGE_TIMEOUT_S) -> float:
    """Return monotonic deadline timestamp for a stage."""
    return time.monotonic() + max(0.0, float(timeout_s))


def is_expired(deadline: float) -> bool:
    """Check if monotonic deadline has passed."""
    return time.monotonic() >= deadline


def remaining_time(deadline: float, max_s: float = STAGE_TIMEOUT_S) -> float:
    """Return seconds remaining until deadline, clamped to [0.0, max_s]."""
    rem = deadline - time.monotonic()
    return max(0.0, min(float(max_s), rem))


MAX_REDIRECTS = 3
_MIN_CALL_S = 0.3
_MAX_CALL_S = 2.0


def bounded_get(
    client: httpx.Client,
    url: str,
    deadline: float,
    *,
    max_bytes: int,
    partial_ok: bool,
    params: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[httpx.Response, bytes]:
    """GET bounded by the stage deadline on any client (injected or owned).

    Redirects are followed here, not by httpx: at most MAX_REDIRECTS hops, each with
    `timeout = min(2 s, remaining)`, skipped under 0.3 s, and 3xx bodies are never read
    (httpx's own redirect loop reads them unbounded). A non-200 final response returns an
    empty body; a 200 body goes through `read_body`. Raises httpx errors on budget/cap.

    Not bounded (DR-009): DNS resolution, and response headers that trickle in (httpcore
    applies the read timeout per recv, not per response).
    """
    request = client.build_request("GET", url, params=params, headers=headers)
    for _ in range(MAX_REDIRECTS + 1):
        call_s = remaining_time(deadline, max_s=_MAX_CALL_S)
        if call_s < _MIN_CALL_S:
            raise httpx.TimeoutException("enrichment stage budget exhausted", request=request)
        request.extensions["timeout"] = httpx.Timeout(call_s).as_dict()
        resp = client.send(request, stream=True, follow_redirects=False)
        try:
            if resp.is_redirect:
                nxt = resp.next_request
                if nxt is None:
                    return resp, b""
                request = nxt
                continue
            if resp.status_code != 200:
                return resp, b""
            return resp, read_body(resp, deadline, max_bytes, partial_ok=partial_ok)
        finally:
            resp.close()
    raise httpx.TooManyRedirects("enrichment redirect cap reached", request=request)


def read_body(resp: httpx.Response, deadline: float, max_bytes: int, *, partial_ok: bool) -> bytes:
    """Stream a response body, stopping at `max_bytes` or the deadline.

    httpx read timeouts reset on every chunk, so a trickling host would otherwise outlive
    the stage. `partial_ok=False` (JSON) raises on truncation instead of returning a prefix.
    """
    body = b""
    for chunk in resp.iter_bytes():
        body += chunk
        if len(body) >= max_bytes or is_expired(deadline):
            if partial_ok:
                return body[:max_bytes]
            raise httpx.TimeoutException("body not complete within stage budget/size cap")
    return body


def make_degraded_entry(
    reason: str = "timeout",
    part: str = DEFAULT_DEGRADED_PART,
) -> dict[str, str]:
    """Create a structured degraded record (DR-005)."""
    valid_reasons = {"timeout", "unavailable", "quota"}
    safe_reason = reason if reason in valid_reasons else "unavailable"
    return {"part": part, "reason": safe_reason}


_NON_WORD_RE = re.compile(r"[\W_]+")


def _fold_side(value: str) -> str:
    """NFD accent-strip, lowercase, drop punctuation/space; keeps every script's letters."""
    decomposed = unicodedata.normalize("NFD", value or "")
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _NON_WORD_RE.sub("", stripped.lower())


def fold_identity(title: str, artist: str) -> str:
    """`title|artist` dedupe key: accents fold ("José" == "Jose"), non-Latin scripts
    (Cyrillic, CJK, Hangul, ...) are preserved so distinct songs never collapse to '|'.
    Equals the 004 `normalize_identity` key for Latin text."""
    return f"{_fold_side(title)}|{_fold_side(artist)}"


def dedup_and_rank_candidates(
    primary: list[dict[str, Any]],
    enriched: list[EnrichedCandidate | dict[str, Any]],
) -> list[dict[str, Any]]:
    """Deduplicate enriched candidates against primary and rank them last (FR-002, DR-005).

    Primary candidates maintain their incoming order. Enriched candidates matching
    an existing folded identity are dropped; remaining enriched candidates append.
    """
    seen_identities: set[str] = set()
    result: list[dict[str, Any]] = []

    for c in primary:
        t = c.get("title", "")
        a = c.get("artist", "")
        seen_identities.add(fold_identity(t, a))
        result.append(c)

    for item in enriched:
        candidate_dict = item.to_dict() if isinstance(item, EnrichedCandidate) else dict(item)
        t = candidate_dict.get("title", "")
        a = candidate_dict.get("artist", "")
        key = fold_identity(t, a)
        if not key or key == "|":
            continue
        if key not in seen_identities:
            seen_identities.add(key)
            result.append(candidate_dict)

    return result


def dedup_and_append_links(
    existing: list[dict[str, Any]],
    new_links: list[EnrichedLink | dict[str, Any]],
    attribution_urls: set[str] | None = None,
    max_links: int = 8,
) -> list[dict[str, Any]]:
    """Append new links up to max_links, deduplicating against existing and attribution."""
    attribution = attribution_urls or set()
    seen_urls: set[str] = set(attribution)
    result: list[dict[str, Any]] = []

    for link in existing:
        u = link.get("url")
        if u:
            seen_urls.add(u)
        result.append(link)
        if len(result) >= max_links:
            return result

    for item in new_links:
        link_dict = item.to_dict() if isinstance(item, EnrichedLink) else dict(item)
        u = link_dict.get("url")
        if not u or u in seen_urls:
            continue
        seen_urls.add(u)
        result.append(link_dict)
        if len(result) >= max_links:
            break

    return result
