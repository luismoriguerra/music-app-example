"""Fixture tests for keyless link discovery and validation (T012, DR-003, DR-008, US2)."""

import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from agents.sheets.enrich.links_free import discover as discover_links_free

_FIXTURES = Path(__file__).parent / "fixtures" / "enrich"
_OEMBED = json.loads((_FIXTURES / "youtube_oembed.json").read_text())


def _search_returns(hits):
    tools = MagicMock()
    tools.web_search.return_value = json.dumps(hits)
    return patch("agents.sheets.enrich.links_free.WebSearchTools", return_value=tools)


def _client(*, oembed_status: int = 200, page_status: int = 200, delay_s: float = 0.0, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(str(request.url))
        if delay_s:
            time.sleep(delay_s)
            raise httpx.ReadTimeout("slow upstream", request=request)
        if request.url.path == "/oembed":
            return httpx.Response(oembed_status, json=_OEMBED if oembed_status == 200 else {})
        return httpx.Response(
            page_status, html="<html><head><title>Creep Chords - Site</title></head></html>"
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_discovers_validated_pages_and_canonical_videos():
    hits = json.loads((_FIXTURES / "ddg_links.json").read_text()) + [
        # Real shapes seen live: must normalize/dedupe to one canonical watch URL.
        {"title": "Creep", "href": "https://m.youtube.com/watch?v=XFkzRNyygfk&t=3"},
        {
            "title": "Tu navegador está obsoleto",
            "href": "https://music.youtube.com/watch?v=AE_fqeY1T6I",
        },
        {"title": "Radiohead", "href": "https://www.youtube.com/@Radiohead"},
    ]
    seen: list = []
    with _search_returns(hits):
        pages, videos = discover_links_free(
            "Creep", "Radiohead", deadline_s=3.0, client=_client(seen=seen)
        )

    assert [v.url for v in videos] == [
        "https://www.youtube.com/watch?v=XFkzRNyygfk",
        "https://www.youtube.com/watch?v=AE_fqeY1T6I",
    ]
    assert videos[0].label == "Radiohead - Creep" and videos[0].kind == "video"
    assert {p.url for p in pages} == {
        "https://tabs.ultimate-guitar.com/tab/radiohead/creep-chords-4169",
        "https://www.songfacts.com/facts/radiohead/creep",
    }
    assert pages[0].kind == "chords" and pages[0].label == "Creep Chords"
    # YouTube URLs are never fetched as pages (interstitial titles).
    assert not any("youtube.com/watch" in u and "/oembed" not in u for u in seen)


def test_video_dropped_when_oembed_is_not_200():
    hits = [{"title": "Private", "href": "https://www.youtube.com/watch?v=gone"}]
    with _search_returns(hits):
        _, videos = discover_links_free(
            "Creep", "Radiohead", deadline_s=3.0, client=_client(oembed_status=404)
        )
    assert videos == []


def test_upgrades_http_and_keeps_only_https():
    hits = [
        {"title": "HTTP Link", "href": "http://example.com/chords"},
        {"title": "HTTPS Link", "href": "https://example.com/lyrics"},
        {"title": "FTP", "href": "ftp://example.com/x"},
    ]
    with _search_returns(hits):
        pages, _ = discover_links_free("Song", "Artist", deadline_s=3.0, client=_client())
    assert {p.url for p in pages} == {"https://example.com/chords", "https://example.com/lyrics"}


def test_search_failure_never_raises():
    tools = MagicMock()
    tools.web_search.side_effect = TimeoutError("search timed out")
    with patch("agents.sheets.enrich.links_free.WebSearchTools", return_value=tools):
        assert discover_links_free("Creep", "Radiohead", deadline_s=3.0) == ([], [])


def test_stage_is_bounded_by_deadline_with_stalled_hosts():
    # Six hits against hosts that stall: per-call timeouts come from the remaining
    # budget, so the whole stage ends near its deadline instead of 6 x 2 s.
    hits = [{"title": f"Page {i}", "href": f"https://site{i}.example/chords"} for i in range(6)]
    seen: list = []
    with _search_returns(hits):
        started = time.monotonic()
        pages, videos = discover_links_free(
            "Creep", "Radiohead", deadline_s=1.5, client=_client(delay_s=0.3, seen=seen)
        )
    assert (pages, videos) == ([], [])
    assert 1 <= len(seen) < 6  # search ran, stalled hosts were cut off by the deadline
    assert time.monotonic() - started < 2.0


def test_search_skipped_when_less_than_one_second_remains():
    # ddgs only takes whole-second timeouts; never hand it more time than is left.
    tools = MagicMock()
    with patch("agents.sheets.enrich.links_free.WebSearchTools", return_value=tools) as cls:
        assert discover_links_free("Creep", "Radiohead", deadline_s=0.8) == ([], [])
    cls.assert_not_called()


def test_slow_trickle_page_read_stops_at_the_stage_deadline():
    # httpx read timeouts reset per chunk, so a host trickling bytes must be cut by the
    # stage clock, not by the 64 KB cap.
    def trickle():
        for _ in range(50):
            time.sleep(0.1)
            yield b"<html><head><title>x</title>" + b" " * 16

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=trickle())

    hits = [{"title": "Slow", "href": "https://slow.example/chords"}]
    with _search_returns(hits):
        started = time.monotonic()
        discover_links_free(
            "Creep",
            "Radiohead",
            deadline_s=1.5,
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )
    assert time.monotonic() - started < 2.0  # 50 x 0.1 s = 5 s without the clock check


def test_trickling_oembed_response_stops_at_the_stage_deadline():
    def trickle():
        for _ in range(50):
            time.sleep(0.1)
            yield b'{"title": ' + b" " * 16

    transport = httpx.MockTransport(lambda r: httpx.Response(200, content=trickle()))
    hits = [{"title": "Creep", "href": "https://www.youtube.com/watch?v=XFkzRNyygfk"}]
    with _search_returns(hits):
        started = time.monotonic()
        pages, videos = discover_links_free(
            "Creep", "Radiohead", deadline_s=1.5, client=httpx.Client(transport=transport)
        )
    assert (pages, videos) == ([], [])
    assert time.monotonic() - started < 2.0  # 5 s without the clock check
