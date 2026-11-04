"""Candidate merge: Genius-primary + LRCLIB secondary (T033, 004)."""

from __future__ import annotations

import json
import logging

import httpx

from agents.sheets.lyrics import LyricsClient, LyricsError
from agents.sheets.normalize import fold_text

logger = logging.getLogger(__name__)

GENIUS_SEARCH = "https://api.genius.com/search"
USER_AGENT = "music-app-example/004-lyrics-chords (private hobby)"
TIMEOUT_S = 10.0
MAX_SHORT_RETRIES = 2


def _short_queries(q: str) -> list[str]:
    """R2 long→short ladder: title before ' - ' if present, else drop
    trailing words one at a time (never below two words), ≤2 retries."""
    if " - " in q:
        title_only = q.split(" - ", 1)[0].strip()
        return [title_only] if title_only and title_only != q else []
    words = q.split()
    out: list[str] = []
    while len(words) > 2 and len(out) < MAX_SHORT_RETRIES:
        words = words[:-1]
        out.append(" ".join(words))
    return out


def normalize_identity(title: str, artist: str) -> str:
    """Normalized title+artist key (lowercase/punctuation-folded)."""
    return f"{fold_text(title)}|{fold_text(artist)}"


def _genius_candidate(hit: dict) -> dict | None:
    result = hit.get("result") if isinstance(hit, dict) else None
    if not isinstance(result, dict):
        return None
    title = str(result.get("title", "") or "").strip()
    primary = result.get("primary_artist") or {}
    artist = str(primary.get("name", "") or "").strip() if isinstance(primary, dict) else ""
    if not title or not artist:
        # Fall back to full_title "Title by Artist" when structured bits miss.
        full = str(result.get("full_title", "") or "")
        if " by " in full:
            maybe_title, maybe_artist = full.rsplit(" by ", 1)
            title = title or maybe_title.strip()
            artist = artist or maybe_artist.strip()
    if not title or not artist:
        return None
    try:
        genius_id = int(result.get("id"))
    except (TypeError, ValueError):
        return None
    artwork = result.get("header_image_thumbnail_url") or result.get("header_image_url")
    return {
        "title": title,
        "artist": artist,
        "album": None,
        "artwork_url": artwork if isinstance(artwork, str) and artwork else None,
        "provider_refs": {"genius_id": genius_id},
    }


def _lrclib_candidate(row: dict) -> dict | None:
    if not isinstance(row, dict):
        return None
    title = str(row.get("trackName", "") or "").strip()
    artist = str(row.get("artistName", "") or "").strip()
    if not title or not artist:
        return None
    try:
        lrclib_id = int(row.get("id"))
    except (TypeError, ValueError):
        return None
    album = row.get("albumName")
    return {
        "title": title,
        "artist": artist,
        "album": album if isinstance(album, str) and album.strip() else None,
        "artwork_url": None,
        "provider_refs": {"lrclib_id": lrclib_id},
    }


def merge_candidates(genius_hits: list, lrclib_rows: list) -> list[dict]:
    """Genius rank first, then LRCLIB-only extras deduped by identity."""
    merged: list[dict] = []
    seen: set[str] = set()
    for hit in genius_hits or []:
        cand = _genius_candidate(hit)
        if cand is None:
            continue
        key = normalize_identity(cand["title"], cand["artist"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(cand)
    for row in lrclib_rows or []:
        cand = _lrclib_candidate(row)
        if cand is None:
            continue
        key = normalize_identity(cand["title"], cand["artist"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(cand)
    return merged


class CandidatesUnavailableError(Exception):
    """Every configured candidate provider failed (transport/non-200/429) and keyless
    enrichment found nothing either: the search did not run, so the caller must NOT
    present this as no-match."""


def _genius_search(client: httpx.Client, query: str, token: str) -> list:
    """Genius hits; raises CandidatesUnavailableError on transport/non-200 so the
    caller can tell a failed provider from a genuine zero-hit."""
    try:
        resp = client.get(
            GENIUS_SEARCH,
            params={"q": query},
            timeout=TIMEOUT_S,
            headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
        )
    except (httpx.TransportError, httpx.TimeoutException) as exc:
        raise CandidatesUnavailableError(f"genius transport: {exc}") from exc
    if resp.status_code != 200:
        raise CandidatesUnavailableError(f"genius HTTP {resp.status_code}")
    try:
        payload = json.loads(resp.text or "{}")
        hits = payload["response"]["hits"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise CandidatesUnavailableError(f"genius payload: {exc}") from exc
    return hits if isinstance(hits, list) else []


def search(
    query: str, genius_token: str | None = None, client: httpx.Client | None = None
) -> list[dict]:
    """Merged candidates: Genius (when tokened) + LRCLIB with R2 ladder.

    LRCLIB goes through the throttled, 429-aware LyricsClient (T020). One
    provider failing degrades to the other's rows; when EVERY configured
    provider fails, keyless enrichment (009 FR-001) is tried, and only an empty
    result raises CandidatesUnavailableError (FR-007: error-with-retry, never a
    false no-match).
    """
    q = (query or "").strip()
    if not q:
        return []
    owns_client = client is None
    http = client or httpx.Client(timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
    try:
        failures: list[str] = []
        genius_hits: list = []
        if genius_token:
            try:
                genius_hits = _genius_search(http, q, genius_token)
            except CandidatesUnavailableError as exc:
                logger.warning("song-search: genius degraded: %s", exc)
                failures.append(str(exc))
        lyrics = LyricsClient(client=http)
        rows: list = []
        try:
            for attempt in [q, *_short_queries(q)]:
                rows = lyrics.search(attempt)
                if rows:
                    break
        except LyricsError as exc:
            logger.warning("song-search: lrclib degraded: %s", exc)
            failures.append(f"lrclib: {exc}")
        attempted = 2 if genius_token else 1
        every_provider_failed = len(failures) == attempted
        if every_provider_failed:
            logger.error("song-search: every attempted provider failed: %s", failures)
        primary = merge_candidates(genius_hits, rows)
        if primary:
            return primary
        # Zero hits, or every provider failed: keyless enrichment (009 FR-001) first.
        from agents.sheets.enrich import dedup_and_rank_candidates
        from agents.sheets.enrich.candidates_free import search as search_free

        enriched = dedup_and_rank_candidates(primary, search_free(q))
        if enriched or not every_provider_failed:
            return enriched
        # 004 FR-007: nothing answered and keyless found nothing -> error-with-retry.
        raise CandidatesUnavailableError("; ".join(failures))
    finally:
        if owns_client:
            http.close()
