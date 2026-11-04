"""Search/generate route tests (T024) via TestClient + transient Postgres.

Principle III: defines the `app.routes_sheets` API before T038 —
POST /api/v1/song-search + POST /api/v1/sheets, error taxonomy (4
codes, no 429), degraded assertions on 200, CORS preflight, 25 s
budget. Providers are faked at the httpx layer (MockTransport);
wiring requirements for T038: routes MUST use `session_scope()` (no
engine caching), call `pipeline.generate_sheet` + `fallback.align`
as module attrs (monkeypatchable), build HTTP via
`build_http_client()`, and map RequestValidationError → 422
VALIDATION_ERROR with the {error:{code,message}} shape.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from urllib.parse import quote

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

import app.routes_sheets as routes_sheets
import db_models
from agents.sheets import pipeline
from agents.sheets.fallback import SkipModel
from app.main import create_app
from db_models import HistoryEntry, SongSheet

FIXTURES = Path(__file__).parent / "fixtures"


def _store_html(payload: dict) -> str:
    return f"<div class='js-store' data-content='{json.dumps(payload)}'></div>"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


class FakeUpstream:
    """Recorded provider responses keyed by host/path, with miss switches."""

    def __init__(self) -> None:
        self.chart_hit = True
        self.lyrics_hit = True
        self.genius_empty = False
        self.genius_down = False
        self.lyrics_5xx = False
        self.lyrics_empty = False
        self.lyrics_down = False
        self.requests: list = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        host, path = request.url.host, request.url.path
        if host == "api.genius.com":
            if self.genius_down:
                return httpx.Response(503, text="{}")
            if self.genius_empty:
                return httpx.Response(200, text='{"response": {"hits": []}}')
            return httpx.Response(200, text=_read("genius_search.json"))
        if host == "lrclib.net":
            if self.lyrics_down:
                raise httpx.ConnectError("lrclib down")
            if self.lyrics_5xx:
                return httpx.Response(503, text="{}")
            if path == "/api/search":
                return httpx.Response(
                    200, text="[]" if self.lyrics_empty else _read("lrclib_search.json")
                )
            if not self.lyrics_hit:
                return httpx.Response(404, text="{}")
            return httpx.Response(200, text=_read("lrclib_get.json"))
        if host == "api.lyrics.ovh":
            if self.lyrics_down:
                raise httpx.ConnectError("ovh down")
            if not self.lyrics_hit:
                return httpx.Response(404, text="{}")
            return httpx.Response(200, text=_read("lyrics_ovh.json"))
        if host == "www.ultimate-guitar.com":
            if not self.chart_hit:
                empty = {"store": {"page": {"data": {"results": []}}}}
                return httpx.Response(200, text=_store_html(empty))
            payload = json.loads(_read("chart_search.json"))
            return httpx.Response(200, text=_store_html(payload))
        if host == "tabs.ultimate-guitar.com":
            payload = json.loads(_read("chart_tab.json"))
            return httpx.Response(200, text=_store_html(payload))
        if host == "www.googleapis.com":
            name = "youtube_videos.json" if path.endswith("/videos") else "youtube_search.json"
            return httpx.Response(200, text=_read(name))
        raise AssertionError(f"unexpected upstream {host}{path}")


@pytest.fixture()
def upstream(monkeypatch: pytest.MonkeyPatch) -> FakeUpstream:
    fake = FakeUpstream()
    monkeypatch.setattr(
        routes_sheets,
        "build_http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(fake.handler)),
    )
    return fake


@pytest.fixture()
def route_client(monkeypatch: pytest.MonkeyPatch, test_engine) -> TestClient:
    url = test_engine.url
    database_url = f"postgresql://{url.username}:{quote(str(url.password))}@{url.host}:{url.port}/{url.database}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("GENIUS_ACCESS_TOKEN", "tok")
    monkeypatch.setenv("YOUTUBE_API_KEY", "key")
    db_models._engine = None
    client = TestClient(create_app())
    yield client
    with test_engine.begin() as conn:
        conn.execute(text("DELETE FROM history_entries"))
        conn.execute(text("DELETE FROM song_sheets"))
    db_models._engine = None


CANDIDATE = {
    "title": "Riptide",
    "artist": "Vance Joy",
    "album": None,
    "artwork_url": None,
    "provider_refs": {"lrclib_id": 969429},
}


def test_search_valid_merge_order(route_client, upstream) -> None:
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Riptide"})
    assert resp.status_code == 200
    cands = resp.json()["candidates"]
    assert cands[0]["provider_refs"] == {"genius_id": 123456}
    assert cands[0]["artwork_url"] is not None
    assert cands[-1]["provider_refs"] == {"lrclib_id": 969430}


def test_search_trims_query(route_client, upstream) -> None:
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "  Riptide  "})
    assert resp.status_code == 200
    lrclib_q = [r.url.params["q"] for r in upstream.requests if r.url.host == "lrclib.net"]
    assert lrclib_q and all(q == q.strip() for q in lrclib_q)


def test_search_empty_query_is_validation_error(route_client, upstream) -> None:
    with route_client as http:
        for payload in ({"query": ""}, {"query": "   "}, {}):
            resp = http.post("/api/v1/song-search", json=payload)
            assert resp.status_code == 422
            assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_overlong_query_is_validation_error(route_client, upstream) -> None:
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "x" * 201})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_zero_results_is_empty_list(route_client, upstream) -> None:
    upstream.genius_empty = True
    upstream.lyrics_empty = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "xyz-gibberish"})
    assert resp.status_code == 200
    assert resp.json() == {"candidates": []}


def test_search_all_providers_down_is_provider_error_not_no_match(route_client, upstream) -> None:
    # Live 2026-09-16: an LRCLIB non-200 on the only attempted provider (no
    # Genius token) rendered as the FR-007 *no-match* state. Every attempted
    # provider failing must be error-with-retry.
    upstream.genius_down = True
    upstream.lyrics_down = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Bloom Lily Kershaw"})
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "PROVIDER_ERROR"


def test_search_lrclib_5xx_without_genius_is_provider_error(
    route_client, upstream, monkeypatch
) -> None:
    # Only LRCLIB is attempted (no token); its 503 must not read as no-match.
    monkeypatch.delenv("GENIUS_ACCESS_TOKEN", raising=False)
    upstream.lyrics_5xx = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Riptide"})
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "PROVIDER_ERROR"


def test_search_lrclib_5xx_with_keyless_hits_is_candidates_not_provider_error(
    route_client, upstream, monkeypatch
) -> None:
    # LRCLIB 503 is the only attempted provider and keyless enrichment finds songs:
    # the learner gets a pickable list, not the provider-error state (009 FR-001).
    from agents.sheets.enrich import EnrichedCandidate

    monkeypatch.delenv("GENIUS_ACCESS_TOKEN", raising=False)
    monkeypatch.setattr(
        "agents.sheets.enrich.candidates_free.search",
        lambda q: [EnrichedCandidate(title="Riptide", artist="Vance Joy")],
    )
    upstream.lyrics_5xx = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Riptide"})
    assert resp.status_code == 200
    cands = resp.json()["candidates"]
    assert [(c["title"], c["artist"]) for c in cands] == [("Riptide", "Vance Joy")]


def test_search_lrclib_zero_hits_without_genius_is_no_match(
    route_client, upstream, monkeypatch
) -> None:
    monkeypatch.delenv("GENIUS_ACCESS_TOKEN", raising=False)
    upstream.lyrics_empty = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Bloom Lily Kershaw"})
    assert resp.status_code == 200
    assert resp.json() == {"candidates": []}


def test_search_one_provider_down_degrades_to_the_other(route_client, upstream) -> None:
    upstream.genius_down = True
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Riptide"})
    assert resp.status_code == 200
    cands = resp.json()["candidates"]
    assert cands and all("lrclib_id" in c["provider_refs"] for c in cands)


def test_search_no_token_is_lrclib_only(route_client, upstream, monkeypatch) -> None:
    monkeypatch.delenv("GENIUS_ACCESS_TOKEN", raising=False)
    with route_client as http:
        resp = http.post("/api/v1/song-search", json={"query": "Riptide"})
    assert resp.status_code == 200
    assert all(c["artwork_url"] is None for c in resp.json()["candidates"])
    assert not any(r.url.host == "api.genius.com" for r in upstream.requests)


def test_sheets_chart_hit_shape(route_client, upstream, db_session: Session) -> None:
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Riptide", "candidate": CANDIDATE})
    assert resp.status_code == 200
    envelope = resp.json()
    uuid.UUID(envelope["entry_id"])
    sheet = envelope["sheet"]
    uuid.UUID(sheet["id"])
    assert sheet["query"] == "Riptide"
    assert sheet["matched_title"] == "Riptide"
    assert sheet["matched_performer"] == "Vance Joy"
    assert sheet["lyric_source"] == "chart"
    assert sheet["lyric_source_url"].startswith("https://tabs.ultimate-guitar.com/")
    assert sheet["chord_source"] == "chart"
    assert sheet["chord_source_url"] == sheet["lyric_source_url"]
    assert sheet["model_id"] is None
    assert [s["heading"] for s in sheet["body"]["sections"]] == ["Verse 1", "Chorus"]
    assert sheet["body"]["sections"][0]["lines"][0]["chords"][0]["symbol"] == "Am"
    assert len(sheet["source_links"]) <= 8
    assert all(link["url"].startswith("https://") for link in sheet["source_links"])
    assert sheet["degraded"] == []
    assert sheet["created_at"]
    assert db_session.query(HistoryEntry).count() == 1
    assert db_session.query(SongSheet).count() == 1


def test_sheets_candidate_echo_revalidated(route_client, upstream) -> None:
    bad = dict(CANDIDATE, title="  ")
    with route_client as http:
        assert http.post("/api/v1/sheets", json={"query": "R", "candidate": bad}).status_code == 422
        resp = http.post("/api/v1/sheets", json={"query": "R"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_sheets_fallback_shape(route_client, upstream, monkeypatch) -> None:
    upstream.chart_hit = False
    body = {
        "sections": [
            {"heading": None, "lines": [{"text": "la", "chords": [{"offset": 0, "symbol": "C"}]}]}
        ]
    }
    monkeypatch.setattr(
        "agents.sheets.fallback.align", lambda text, **kw: (body, "openrouter/test-model")
    )
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Riptide", "candidate": CANDIDATE})
    assert resp.status_code == 200
    sheet = resp.json()["sheet"]
    assert sheet["lyric_source"] == "lrclib"
    assert sheet["chord_source"] == "model-generated"
    assert sheet["chord_source_url"] is None
    assert sheet["model_id"] == "openrouter/test-model"


def test_sheets_lyrics_only_shape(route_client, upstream, monkeypatch) -> None:
    upstream.chart_hit = False

    def _skip(text: str, **kw):
        raise SkipModel("unavailable")

    monkeypatch.setattr("agents.sheets.fallback.align", _skip)
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Riptide", "candidate": CANDIDATE})
    assert resp.status_code == 200
    sheet = resp.json()["sheet"]
    assert sheet["chord_source"] == "none"
    assert sheet["chord_source_url"] is None
    assert sheet["model_id"] is None
    for section in sheet["body"]["sections"]:
        for line in section["lines"]:
            assert line["chords"] == []
    assert sheet["degraded"] == [{"part": "chords", "reason": "unavailable"}]


def test_sheets_lyrics_miss_is_no_match_no_rows(
    route_client, upstream, db_session: Session
) -> None:
    upstream.chart_hit = False
    upstream.lyrics_hit = False
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Xyz", "candidate": CANDIDATE})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NO_MATCH"
    assert db_session.query(HistoryEntry).count() == 0
    assert db_session.query(SongSheet).count() == 0


def test_sheets_lyrics_down_is_provider_error(route_client, upstream) -> None:
    upstream.chart_hit = False
    upstream.lyrics_down = True
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Riptide", "candidate": CANDIDATE})
    assert resp.status_code == 502
    body = resp.json()
    assert body["error"]["code"] == "PROVIDER_ERROR"
    assert "traceback" not in json.dumps(body).lower()


def test_cors_preflight_allows_configured_origin(route_client, upstream) -> None:
    with route_client as http:
        resp = http.options(
            "/api/v1/song-search",
            headers={
                "Origin": "http://localhost:4321",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:4321"
    # `astro dev --host 127.0.0.1` advertises the other loopback spelling.
    with route_client as http:
        resp2 = http.options(
            "/api/v1/song-search",
            headers={
                "Origin": "http://127.0.0.1:4321",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert resp2.headers["access-control-allow-origin"] == "http://127.0.0.1:4321"


def test_generate_plumbs_25s_budget(route_client, upstream, monkeypatch) -> None:
    real = pipeline.generate_sheet
    seen: dict = {}

    def wrapper(*args, **kwargs):
        seen.update(kwargs)
        return real(*args, **kwargs)

    monkeypatch.setattr("app.routes_sheets.generate_sheet", wrapper)
    with route_client as http:
        resp = http.post("/api/v1/sheets", json={"query": "Riptide", "candidate": CANDIDATE})
    assert resp.status_code == 200
    assert seen.get("deadline_s") == 25
