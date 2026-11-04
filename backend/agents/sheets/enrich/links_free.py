"""Keyless outbound link discovery and validation (US2, DR-003, DR-004, FR-004, FR-005)."""

from __future__ import annotations

import json
import logging
import re
from urllib.parse import parse_qs, urlparse

import httpx
from agno.tools.websearch import WebSearchTools
from bs4 import BeautifulSoup

from agents.sheets.enrich import (
    SEARCH_BACKENDS,
    STAGE_TIMEOUT_S,
    EnrichedLink,
    bounded_get,
    compute_deadline,
    is_expired,
    remaining_time,
    search_timeout,
)

_MIN_CALL_S = 0.3
_MAX_CALL_S = 2.0
_TITLE_READ_BYTES = 64 * 1024  # <title> lives in <head>; never download whole pages
_OEMBED_MAX_BYTES = 64 * 1024

logger = logging.getLogger(__name__)

# Fast check and normalization for YouTube URLs
_YT_NETLOCS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}


def _is_youtube(url: str) -> bool:
    try:
        return urlparse(url).netloc.lower() in _YT_NETLOCS
    except Exception:
        return False


def _canonical_youtube_url(url: str) -> str | None:
    """`https://www.youtube.com/watch?v=<id>` for any YouTube video URL (www/m/music,
    youtu.be, /shorts/); None for non-video YouTube URLs (channels, playlists, @handles)."""
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if host not in _YT_NETLOCS:
            return None
        vid = ""
        if host == "youtu.be":
            vid = parsed.path.strip("/").split("/")[0]
        elif parsed.path.startswith("/shorts/"):
            vid = parsed.path[8:].strip("/").split("/")[0]
        elif parsed.path == "/watch":
            vid = (parse_qs(parsed.query).get("v") or [""])[0]
        return f"https://www.youtube.com/watch?v={vid}" if vid else None
    except Exception:
        return None


def _extract_page_title(html: str) -> str | None:
    try:
        soup = BeautifulSoup(html, "html.parser")
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            clean = title_tag.string.strip()
            # Strip common site suffixes
            clean = re.sub(r"\s*[-|–—]\s*.*$", "", clean).strip()
            return clean if clean else None
    except Exception:
        pass
    return None


def discover(
    title: str,
    artist: str,
    *,
    deadline_s: float = STAGE_TIMEOUT_S,
    client: httpx.Client | None = None,
) -> tuple[list[EnrichedLink], list[EnrichedLink]]:
    """Discover outbound page links and video links using free web search and oEmbed.

    Returns:
        (pages, videos): Tuple of discovered EnrichedLink lists.
    Guaranteed never to raise.
    """
    t = (title or "").strip()
    a = (artist or "").strip()
    if not t and not a:
        return [], []

    deadline = compute_deadline(deadline_s)
    if is_expired(deadline):
        return [], []

    pages: list[EnrichedLink] = []
    videos: list[EnrichedLink] = []

    try:
        search_query = f"{t} {a} chords youtube"
        timeout_s = search_timeout(deadline)
        if timeout_s is None:
            return [], []

        tools = WebSearchTools(
            backend=SEARCH_BACKENDS,
            enable_search=True,
            enable_news=False,
            fixed_max_results=6,
            timeout=timeout_s,
        )

        raw_result = tools.web_search(search_query)
        if not raw_result:
            return [], []

        hits = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
        if not isinstance(hits, list):
            hits = []
        http = client or httpx.Client()
        owns_http = client is None

        try:
            for hit in hits:
                # Cheap early exit; bounded_get re-checks the budget on every hop.
                call_s = remaining_time(deadline, max_s=_MAX_CALL_S)
                if call_s < _MIN_CALL_S:
                    break
                if not isinstance(hit, dict):
                    continue

                url = str(hit.get("href") or "").strip()
                hit_title = str(hit.get("title") or "").strip()
                if url.startswith("http://"):
                    url = "https://" + url[7:]
                if not url.startswith("https://"):
                    continue
                if _is_youtube(url):
                    # Never GET YouTube as a page (interstitial titles); videos only.
                    canon_yt = _canonical_youtube_url(url)
                    if not canon_yt or len(videos) >= 2 or any(v.url == canon_yt for v in videos):
                        continue
                    try:
                        oembed_resp, raw = bounded_get(
                            http,
                            "https://www.youtube.com/oembed",
                            deadline,
                            params={"format": "json", "url": canon_yt},
                            max_bytes=_OEMBED_MAX_BYTES,
                            partial_ok=False,
                        )
                        if oembed_resp.status_code != 200:
                            continue
                        vdata = json.loads(raw)
                        vtitle = vdata.get("title") or hit_title or f"{t} - {a}"
                        vauthor = vdata.get("author_name") or a
                        label = (
                            f"{vtitle} - {vauthor}" if vauthor and vauthor not in vtitle else vtitle
                        )
                        videos.append(EnrichedLink(label=label, url=canon_yt, kind="video"))
                    except Exception:
                        continue
                else:
                    if len(pages) >= 4:
                        continue
                    # Validate page; read only the head for the <title>.
                    try:
                        resp, head = bounded_get(
                            http, url, deadline, max_bytes=_TITLE_READ_BYTES, partial_ok=True
                        )
                        if resp.status_code != 200:
                            continue
                        html = head.decode(resp.encoding or "utf-8", errors="replace")
                        page_title = _extract_page_title(html) or hit_title or url
                        is_chord = "chord" in url.lower() or "tab" in url.lower()
                        kind = "chords" if is_chord else "lyrics"
                        pages.append(EnrichedLink(label=page_title, url=url, kind=kind))
                    except Exception:
                        continue
        finally:
            if owns_http:
                http.close()

        return pages, videos
    except Exception as exc:
        logger.warning("keyless link discovery failed: %s", exc)
        return [], []
