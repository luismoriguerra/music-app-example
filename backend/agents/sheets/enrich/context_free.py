"""Keyless Wikipedia song context via the MediaWiki API (US3, DR-010, FR-006, FR-007)."""

from __future__ import annotations

import json
import logging

import httpx

from agents.sheets.enrich import (
    STAGE_TIMEOUT_S,
    SongContext,
    bounded_get,
    compute_deadline,
    is_expired,
)

logger = logging.getLogger(__name__)

MAX_CONTEXT_LEN: int = 600
# Wikimedia User-Agent policy: generic library UAs are throttled (observed live as
# HTML-instead-of-JSON responses); identify the app.
WIKIPEDIA_USER_AGENT = "music-app-example/009-free-search-enrichment (private hobby; https://github.com/your-org/music-app-example)"
_ELLIPSIS = "..."


def truncate_summary(text: str, max_chars: int = MAX_CONTEXT_LEN) -> str:
    """Truncate encyclopedic summary to at most max_chars cleanly."""
    raw = (text or "").strip()
    if len(raw) <= max_chars:
        return raw

    # Attempt to cut at the last sentence end within limit
    cutoff = raw[:max_chars]
    last_period = cutoff.rfind(". ")
    if last_period > max_chars // 2:
        return cutoff[: last_period + 1].strip()

    # Fallback: cut at last whitespace inside the room left for the ellipsis.
    room = raw[: max_chars - len(_ELLIPSIS)]
    last_ws = room.rfind(" ")
    if last_ws > max_chars // 2:
        return room[:last_ws].strip() + _ELLIPSIS

    return room.strip() + _ELLIPSIS


WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
_API_MAX_BYTES = 256 * 1024


def _api_get(client: httpx.Client, params: dict[str, str], deadline: float) -> dict | None:
    """One MediaWiki API call, bounded by the remaining stage budget (raises on budget)."""
    resp, raw = bounded_get(
        client,
        WIKIPEDIA_API,
        deadline,
        params={**params, "format": "json", "formatversion": "2"},
        headers={"User-Agent": WIKIPEDIA_USER_AGENT},
        max_bytes=_API_MAX_BYTES,
        partial_ok=False,
    )
    if resp.status_code != 200:
        return None
    data = json.loads(raw)
    return data if isinstance(data, dict) else None


def _first_article(client: httpx.Client, titles: list[str], deadline: float) -> dict | None:
    """Resolve the first candidate title that is a real (non-disambiguation) article."""
    data = _api_get(
        client,
        {
            "action": "query",
            "prop": "extracts|info|pageprops",
            "exintro": "1",
            "explaintext": "1",
            "redirects": "1",
            "inprop": "url",
            "titles": "|".join(titles),
        },
        deadline,
    )
    pages = ((data or {}).get("query") or {}).get("pages") or []
    by_title = {p.get("title"): p for p in pages if isinstance(p, dict)}
    # Keep search rank order; follow redirects/normalization back to the resolved title.
    aliases: dict[str, str] = {}
    for key in ("normalized", "redirects"):
        for m in ((data or {}).get("query") or {}).get(key) or []:
            aliases[m.get("from")] = m.get("to")
    for t in titles:
        resolved = t
        for _ in range(3):
            resolved = aliases.get(resolved, resolved)
        page = by_title.get(resolved)
        if not page or page.get("missing") or "disambiguation" in (page.get("pageprops") or {}):
            continue
        if (page.get("extract") or "").strip():
            return page
    return None


def fetch(
    title: str,
    artist: str,
    *,
    deadline_s: float = STAGE_TIMEOUT_S,
    client: httpx.Client | None = None,
) -> SongContext | None:
    """Short Wikipedia context via the MediaWiki API: search, then one batched page read.

    Every network call carries a timeout capped by the remaining stage budget (DR-009,
    DR-010). Never raises; None on miss, disambiguation, timeout or error.
    """
    t = (title or "").strip()
    a = (artist or "").strip()
    if not t:
        return None
    deadline = compute_deadline(deadline_s)
    if is_expired(deadline):
        return None

    http = client or httpx.Client()
    try:
        found = _api_get(
            http,
            {"action": "query", "list": "search", "srsearch": f"{t} {a} song", "srlimit": "2"},
            deadline,
        )
        hits = [
            h.get("title")
            for h in ((found or {}).get("query") or {}).get("search") or []
            if isinstance(h, dict) and h.get("title")
        ]
        if not hits:
            return None
        page = _first_article(http, hits, deadline)
        if not page:
            return None
        text = truncate_summary(page["extract"], MAX_CONTEXT_LEN)
        url = str(page.get("fullurl") or "").strip()
        if url.startswith("http://"):
            url = "https://" + url[7:]
        if not url.startswith("https://"):
            url = f"https://en.wikipedia.org/wiki/{page['title'].replace(' ', '_')}"
        return SongContext(text=text, source="wikipedia", source_url=url) if text else None
    except Exception as exc:
        logger.warning("keyless context fetch failed: %s", exc)
        return None
    finally:
        if client is None:
            http.close()
