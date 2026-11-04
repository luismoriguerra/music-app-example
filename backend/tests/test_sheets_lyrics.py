"""Lyrics client tests (T020): LRCLIB search/fetch + lyrics.ovh fallback.

Principle III: defines the `agents.sheets.lyrics` API before T032 —
/api/search single keyword query (raw rows; the R2 long→short ladder lives
in `agents.sheets.candidates` on top of it), /api/get exact (both params
required) or /api/get/{id}, lyrics.ovh GET /v1 fallback, User-Agent
identification, throttle, 429 + Retry-After honor.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from agents.sheets.lyrics import LyricsClient, LyricsError, LyricsMiss

FIXTURES = Path(__file__).parent / "fixtures"


def _fixture(name: str) -> str:
    return (FIXTURES / name).read_text()


def _client_for(handler, throttle_s: float = 0.0):
    seen: list = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    transport = httpx.MockTransport(wrapped)
    client = LyricsClient(client=httpx.Client(transport=transport), throttle_s=throttle_s)
    return client, seen


def test_search_returns_raw_lrclib_rows() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/search"
        assert request.url.params["q"] == "Riptide"
        assert "music-app-example" in request.headers["user-agent"]
        return httpx.Response(200, text=_fixture("lrclib_search.json"))

    client, seen = _client_for(handler)
    rows = client.search("Riptide")
    assert len(rows) == 2 and len(seen) == 1
    assert rows[0]["id"] == 969429 and rows[0]["trackName"] == "Riptide"


def test_search_non_200_or_bad_json_raises_not_empty() -> None:
    # A 5xx / garbage body is a provider failure; only a real 200 [] is a miss.
    client, _ = _client_for(lambda req: httpx.Response(500, text="boom"))
    with pytest.raises(LyricsError):
        client.search("Riptide")
    client, _ = _client_for(lambda req: httpx.Response(200, text="{not json"))
    with pytest.raises(LyricsError):
        client.search("Riptide")
    client, _ = _client_for(lambda req: httpx.Response(200, text="[]"))
    assert client.search("Riptide") == []


def test_search_persistent_429_raises() -> None:
    client, _ = _client_for(lambda req: httpx.Response(429, text="slow"))
    with pytest.raises(LyricsError):
        client.search("Riptide")


def test_fetch_identifies_user_agent() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "music-app-example" in request.headers["user-agent"]
        return httpx.Response(200, text=_fixture("lrclib_get.json"))

    client, _ = _client_for(handler)
    client.fetch("Riptide", "Vance Joy")


def test_fetch_honors_429_retry_after(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list = []
    monkeypatch.setattr("agents.sheets.lyrics.time.sleep", sleeps.append)
    calls: list = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, text="slow down", headers={"Retry-After": "0"})
        return httpx.Response(200, text=_fixture("lrclib_get.json"))

    client, _ = _client_for(handler)
    assert client.fetch("Riptide", "Vance Joy").text
    assert sleeps == [0]


def test_fetch_persistent_429_raises() -> None:
    client, _ = _client_for(lambda req: httpx.Response(429, text="slow"))
    with pytest.raises(LyricsError):
        client.fetch("Riptide", "Vance Joy")


def test_fetch_exact_get_hit() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/get"
        assert request.url.params["track_name"] == "Riptide"
        assert request.url.params["artist_name"] == "Vance Joy"
        return httpx.Response(200, text=_fixture("lrclib_get.json"))

    client, _ = _client_for(handler)
    got = client.fetch("Riptide", "Vance Joy")
    assert got.source == "lrclib"
    assert "riptide" in got.text.lower()
    assert got.url == "https://lrclib.net/api/get/969429"


def test_fetch_exact_miss_tries_get_by_id() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/get/969429":
            return httpx.Response(200, text=_fixture("lrclib_get.json"))
        return httpx.Response(404, text="{}")

    client, seen = _client_for(handler)
    got = client.fetch("Riptide", "Vance Joy", lrclib_id=969429)
    assert got.source == "lrclib"
    assert any(r.url.path == "/api/get/969429" for r in seen)


def test_fetch_lrclib_miss_falls_back_to_ovh() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.lyrics.ovh":
            assert request.url.path == "/v1/Vance Joy/Riptide"
            return httpx.Response(200, text=_fixture("lyrics_ovh.json"))
        return httpx.Response(404, text="{}")

    client, _ = _client_for(handler)
    got = client.fetch("Riptide", "Vance Joy")
    assert got.source == "lyrics_ovh"
    assert "riptide" in got.text.lower()


def test_fetch_all_miss_raises_lyrics_miss() -> None:
    client, _ = _client_for(lambda req: httpx.Response(404, text="{}"))
    with pytest.raises(LyricsMiss):
        client.fetch("Xyz", "Nobody")


def test_fetch_instrumental_or_empty_is_miss() -> None:
    payload = json.dumps({"id": 1, "instrumental": True, "plainLyrics": ""})
    client, _ = _client_for(lambda req: httpx.Response(200, text=payload))
    with pytest.raises(LyricsMiss):
        client.fetch("X", "Y")


def test_fetch_transport_error_raises_lyrics_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    client, _ = _client_for(handler)
    with pytest.raises(LyricsError):
        client.fetch("Riptide", "Vance Joy")


def test_throttle_between_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list = []
    monkeypatch.setattr("agents.sheets.lyrics.time.sleep", sleeps.append)
    client, _ = _client_for(
        lambda req: httpx.Response(200, text=_fixture("lrclib_get.json")), throttle_s=0.3
    )
    client.fetch("a", "b")
    client.fetch("c", "d")
    assert sleeps == [0.3]
