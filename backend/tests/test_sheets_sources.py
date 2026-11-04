"""Sources tests (T022): FR-016 link assembly + YouTube quota safety.

Principle III: defines the `agents.sheets.sources` API before T034 —
composition order (lyric pages → chord/tab pages → video), cap 8,
dedup vs FR-012 attribution URLs, key-absent + quota-exhausted video
degradation (M4: pages intact, degraded entry recorded).
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx

from agents.sheets.sources import (
    assemble_source_links,
    fetch_video_links,
    page_links_for,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _client_for(handler):
    seen: list = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    return httpx.Client(transport=httpx.MockTransport(wrapped)), seen


def _youtube_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/search"):
        params = request.url.params
        assert params["type"] == "video"
        assert params["videoEmbeddable"] == "true"
        return httpx.Response(200, text=(FIXTURES / "youtube_search.json").read_text())
    assert request.url.path.endswith("/videos")
    return httpx.Response(200, text=(FIXTURES / "youtube_videos.json").read_text())


def test_fetch_video_links_search_plus_topup() -> None:
    http, seen = _client_for(_youtube_handler)
    links, degraded = fetch_video_links("Riptide Vance Joy", api_key="key", client=http)
    assert degraded is None
    assert [link["kind"] for link in links] == ["video", "video"]
    assert links[0]["url"] == "https://www.youtube.com/watch?v=uJ_1HMAGb4k"
    assert "Vance Joy" in links[0]["label"]
    assert any(r.url.path.endswith("/videos") for r in seen)


def test_fetch_video_links_no_key_is_unavailable() -> None:
    links, degraded = fetch_video_links("Riptide", api_key=None, client=None)
    assert links == []
    assert degraded == {"part": "video", "reason": "unavailable"}


def test_fetch_video_links_quota_exhausted() -> None:
    payload = {"error": {"errors": [{"reason": "quotaExceeded"}], "code": 403}}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text=json.dumps(payload))

    http, _ = _client_for(handler)
    links, degraded = fetch_video_links("Riptide", api_key="key", client=http)
    assert links == []
    assert degraded == {"part": "video", "reason": "quota"}


def test_fetch_video_links_transport_error_never_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    http, _ = _client_for(handler)
    links, degraded = fetch_video_links("Riptide", api_key="key", client=http)
    assert links == []
    assert degraded == {"part": "video", "reason": "unavailable"}


def test_page_links_for_builds_lyric_and_chord_pages() -> None:
    refs = {"lrclib_id": 969429}
    lyrics, chords = page_links_for("Riptide", "Vance Joy", refs, chart_url=None)
    assert any("lrclib.net" in page["url"] for page in lyrics)
    assert any("lyrics.ovh" in page["url"] for page in lyrics)
    assert any("ultimate-guitar.com/search.php" in page["url"] for page in chords)
    assert any("songsterr.com" in page["url"] for page in chords)
    for page in lyrics + chords:
        assert page["label"] and page["url"].startswith("https://")


def test_page_links_for_includes_chart_url_on_hit() -> None:
    lyrics, chords = page_links_for("R", "V", {}, chart_url="https://tabs.ug/tab/1")
    assert chords[0] == {"label": "Ultimate Guitar", "url": "https://tabs.ug/tab/1"}


def test_assemble_orders_and_dedups_vs_attribution() -> None:
    lyrics = [{"label": "LRCLIB", "url": "https://lrclib.net/api/get/1"}]
    chords = [
        {"label": "Ultimate Guitar", "url": "https://tabs.ug/tab/1"},
        {"label": "Songsterr", "url": "https://www.songsterr.com/?pattern=x"},
    ]
    videos = [{"label": "vid", "url": "https://www.youtube.com/watch?v=a", "kind": "video"}]
    links = assemble_source_links(
        lyrics, chords, videos, attribution_urls={"https://tabs.ug/tab/1"}
    )
    kinds = [link["kind"] for link in links]
    assert kinds == ["lyrics", "chords", "video"]
    assert all(link["url"] != "https://tabs.ug/tab/1" for link in links)


def test_assemble_caps_at_8_keeping_order() -> None:
    videos = [
        {"label": f"v{i}", "url": f"https://www.youtube.com/watch?v=v{i:02d}", "kind": "video"}
        for i in range(10)
    ]
    lyrics = [{"label": "LRCLIB", "url": "https://lrclib.net/api/get/1"}]
    links = assemble_source_links(lyrics, [], videos, attribution_urls=set())
    assert len(links) == 8
    assert links[0]["kind"] == "lyrics"
    assert all(link["kind"] == "video" for link in links[1:])


def test_assemble_dedups_internal_duplicates() -> None:
    page = {"label": "X", "url": "https://example.com/x"}
    links = assemble_source_links([page], [dict(page)], [], attribution_urls=set())
    assert links == [{"label": "X", "url": "https://example.com/x", "kind": "lyrics"}]


def test_assemble_all_empty_is_empty() -> None:
    assert assemble_source_links([], [], [], attribution_urls=set()) == []


def test_page_links_strip_channel_suffixes_from_artist() -> None:
    # T055: LRCLIB-only candidates carry "X - Topic" artists; page links
    # must use the clean performer name (lyrics.ovh 404s otherwise).
    lyrics, chords = page_links_for("Hey Jude", "The Beatles - Topic", {})
    urls = [link["url"] for link in lyrics + chords]
    assert urls and all("Topic" not in url for url in urls)
    assert any("The+Beatles" in url for url in urls)
    lyrics2, _ = page_links_for("Stand by Me", "Stand by Me - Movie Soundtrack", {})
    assert all("Soundtrack" not in link["url"] for link in lyrics2)
