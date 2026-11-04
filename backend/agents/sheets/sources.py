"""FR-016 source-link assembly + YouTube quota safety (T034, 004)."""

from __future__ import annotations

import json
import re
from urllib.parse import quote_plus

import httpx

YOUTUBE_SEARCH = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS = "https://www.googleapis.com/youtube/v3/videos"
TIMEOUT_S = 10.0
MAX_LINKS = 8


def fetch_video_links(
    query: str, api_key: str | None = None, client: httpx.Client | None = None
) -> tuple[list[dict], dict | None]:
    """YouTube search.list + videos.list top-up; never raises."""
    if not api_key:
        return [], {"part": "video", "reason": "unavailable"}
    owns = client is None
    http = client or httpx.Client(timeout=TIMEOUT_S)
    try:
        try:
            resp = http.get(
                YOUTUBE_SEARCH,
                params={
                    "q": query,
                    "key": api_key,
                    "part": "snippet",
                    "type": "video",
                    "videoEmbeddable": "true",
                    "maxResults": 5,
                },
                timeout=TIMEOUT_S,
            )
        except (httpx.TransportError, httpx.TimeoutException):
            return [], {"part": "video", "reason": "unavailable"}
        if resp.status_code != 200:
            if resp.status_code == 403 and "quotaExceeded" in (resp.text or ""):
                return [], {"part": "video", "reason": "quota"}
            return [], {"part": "video", "reason": "unavailable"}
        try:
            payload = json.loads(resp.text or "{}")
        except json.JSONDecodeError:
            return [], {"part": "video", "reason": "unavailable"}
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or not items:
            return [], None
        videos: list[dict] = []
        ids: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            vid = (
                (item.get("id") or {}).get("videoId") if isinstance(item.get("id"), dict) else None
            )
            if not vid:
                continue
            snippet = item.get("snippet") or {}
            title = snippet.get("title", "") if isinstance(snippet, dict) else ""
            channel = snippet.get("channelTitle", "") if isinstance(snippet, dict) else ""
            label = str(title).strip() or str(channel).strip() or "YouTube video"
            videos.append(
                {"label": label, "url": f"https://www.youtube.com/watch?v={vid}", "kind": "video"}
            )
            ids.append(vid)
        # Metadata top-up (1 unit): refresh labels from videos.list when available.
        try:
            top = http.get(
                YOUTUBE_VIDEOS,
                params={"id": ",".join(ids), "key": api_key, "part": "snippet"},
                timeout=TIMEOUT_S,
            )
        except (httpx.TransportError, httpx.TimeoutException):
            return videos, None
        if top.status_code == 200:
            try:
                payload = json.loads(top.text or "{}")
            except json.JSONDecodeError:
                return videos, None
            by_id: dict[str, dict] = {}
            for item in payload.get("items", []) if isinstance(payload, dict) else []:
                if isinstance(item, dict) and item.get("id"):
                    by_id[str(item["id"])] = item
            refreshed: list[dict] = []
            for link, vid in zip(videos, ids, strict=True):
                item = by_id.get(vid)
                if isinstance(item, dict):
                    snippet = item.get("snippet") or {}
                    title = snippet.get("title", "") if isinstance(snippet, dict) else ""
                    if isinstance(title, str) and title.strip():
                        link = dict(link, label=title.strip())
                refreshed.append(link)
            return refreshed, None
        return videos, None
    finally:
        if owns:
            http.close()


_ARTIST_SUFFIX_RE = re.compile(r"\s+-\s+(topic|.*soundtrack)$", re.IGNORECASE)


def _clean_artist(artist: str) -> str:
    """Strip LRCLIB channel suffixes (X - Topic, Y - Movie Soundtrack).

    T055 live find: suffix-polluted artists produce 404ing page links
    (lyrics.ovh) and noisy search URLs. LRCLIB-only mode (no Genius key)
    surfaces these; Genius-ranked candidates rarely need it.
    """
    return _ARTIST_SUFFIX_RE.sub("", artist or "").strip()


def page_links_for(
    title: str, artist: str, refs: dict, chart_url: str | None = None
) -> tuple[list[dict], list[dict]]:
    """Build lyric + chord page links (no network)."""
    t = (title or "").strip()
    a = _clean_artist(artist)
    lyrics: list[dict] = []
    lrclib_id = refs.get("lrclib_id") if isinstance(refs, dict) else None
    if isinstance(lrclib_id, int):
        lyrics.append({"label": "LRCLIB", "url": f"https://lrclib.net/api/get/{lrclib_id}"})
    else:
        q = quote_plus(f"{t} {a}".strip())
        lyrics.append({"label": "LRCLIB", "url": f"https://lrclib.net/search?q={q}"})
    lyrics.append(
        {"label": "lyrics.ovh", "url": f"https://api.lyrics.ovh/v1/{quote_plus(a)}/{quote_plus(t)}"}
    )
    chords: list[dict] = []
    if chart_url:
        chords.append({"label": "Ultimate Guitar", "url": chart_url})
    chords.append(
        {
            "label": "Ultimate Guitar search" if chart_url else "Ultimate Guitar",
            "url": f"https://www.ultimate-guitar.com/search.php?title={quote_plus(t)}&artist={quote_plus(a)}",
        }
    )
    chords.append(
        {
            "label": "Songsterr",
            "url": f"https://www.songsterr.com/?pattern={quote_plus(f'{t} {a}'.strip())}",
        }
    )
    return lyrics, chords


def assemble_source_links(
    lyrics: list[dict], chords: list[dict], videos: list[dict], attribution_urls: set[str]
) -> list[dict]:
    """Order lyric->chord->video, dedup vs attribution + internally, cap 8."""
    blocked = set(attribution_urls or set())
    seen: set[str] = set()
    out: list[dict] = []

    def _push(pages: list[dict], kind: str) -> None:
        for page in pages:
            if not isinstance(page, dict):
                continue
            url = page.get("url")
            label = page.get("label")
            if not isinstance(url, str) or not url or not isinstance(label, str) or not label:
                continue
            if url in blocked or url in seen:
                continue
            seen.add(url)
            out.append({"label": label, "url": url, "kind": page.get("kind") or kind})
            if len(out) >= MAX_LINKS:
                return

    _push(lyrics or [], "lyrics")
    if len(out) < MAX_LINKS:
        _push(chords or [], "chords")
    if len(out) < MAX_LINKS:
        _push(videos or [], "video")
    return out
