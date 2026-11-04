"""History route tests (T044) via TestClient + transient Postgres.

Covers GET /api/v1/history (limit/offset, newest-first), GET
/api/v1/history/{entry_id} (stored envelope, zero provider re-querying,
NOT_FOUND incl. dangling sheet_id), and POST
/api/v1/history/{entry_id}/regenerate (NEW sheet + NEW entry, append-only,
prior untouched). Regenerate's pipeline is stubbed at the
`routes_sheets.generate_sheet` seam so these tests stay hermetic; the live
pipeline path is already covered by T024.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

import db_models
from agents.sheets.pipeline import ProviderFailure
from app.main import create_app

BODY = {
    "sections": [
        {
            "heading": "Chorus",
            "lines": [{"text": "line one", "chords": [{"offset": 0, "symbol": "Am"}]}],
        }
    ]
}
LINKS = [
    {"label": "LRCLIB page", "url": "https://lrclib.net/search/riptide", "kind": "lyrics"},
]


def _sheet_kwargs(**over: Any) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "owner_id": "owner",
        "query": "Riptide",
        "matched_title": "Riptide",
        "matched_performer": "Vance Joy",
        "provider_refs": {"lrclib_id": 969429},
        "lyric_source": "chart",
        "lyric_source_url": "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
        "chord_source": "chart",
        "chord_source_url": "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-2",
        "model_id": None,
        "body": BODY,
        "source_links": LINKS,
        "degraded": [],
        "capo": None,
        "tuning_note": None,
    }
    kwargs.update(over)
    return kwargs


def _seed_entry(test_engine, query: str, created_at: datetime) -> tuple[str, str]:
    """Seed one sheet + entry on its own committed session (visible to routes).

    Must NOT use the `db_session` fixture: that session lives inside an outer
    rolled-back transaction, so its rows stay invisible to route connections.
    Returns (entry_id, sheet_id) as strings.
    """
    session = sessionmaker(bind=test_engine)()
    try:
        sheet = db_models.SongSheet(**_sheet_kwargs(query=query))
        sheet.created_at = created_at
        session.add(sheet)
        session.flush()
        entry = db_models.HistoryEntry(
            owner_id="owner",
            query=query,
            matched_title=sheet.matched_title,
            matched_performer=sheet.matched_performer,
            sheet_id=sheet.id,
        )
        entry.created_at = created_at
        session.add(entry)
        session.commit()
        return str(entry.id), str(sheet.id)
    finally:
        session.close()


@pytest.fixture()
def route_client(monkeypatch: pytest.MonkeyPatch, test_engine) -> TestClient:
    url = test_engine.url
    database_url = (
        f"postgresql://{url.username}:{quote(str(url.password))}"
        f"@{url.host}:{url.port}/{url.database}"
    )
    monkeypatch.setenv("DATABASE_URL", database_url)
    db_models._engine = None
    client = TestClient(create_app())
    yield client
    with test_engine.begin() as conn:
        conn.execute(text("DELETE FROM history_entries"))
        conn.execute(text("DELETE FROM song_sheets"))
    db_models._engine = None


def _no_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail loudly if a route touches the provider HTTP client (R7, FR-009)."""

    def _boom(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("history re-open must not query providers or enrichers")

    import app.routes_sheets as routes

    monkeypatch.setattr(routes, "build_http_client", _boom)
    try:
        import agents.sheets.enrich.candidates_free as c_free
        import agents.sheets.enrich.context_free as ctx_free
        import agents.sheets.enrich.links_free as l_free

        monkeypatch.setattr(c_free, "search", _boom)
        monkeypatch.setattr(l_free, "discover", _boom)
        monkeypatch.setattr(ctx_free, "fetch", _boom)
    except ImportError:
        pass


def test_history_list_newest_first(route_client, test_engine, monkeypatch) -> None:
    _no_providers(monkeypatch)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    _seed_entry(test_engine, "Yesterday", base)
    _seed_entry(test_engine, "Riptide", base + timedelta(hours=1))
    _seed_entry(test_engine, "Imagine", base + timedelta(hours=2))
    with route_client as http:
        resp = http.get("/api/v1/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert [e["query"] for e in body["entries"]] == ["Imagine", "Riptide", "Yesterday"]
    first = body["entries"][0]
    assert set(first) == {
        "id",
        "query",
        "matched_title",
        "matched_performer",
        "sheet_id",
        "favorite",
        "created_at",
    }


def test_history_list_pagination(route_client, test_engine, monkeypatch) -> None:
    _no_providers(monkeypatch)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    for i, q in enumerate(["a-song", "b-song", "c-song"]):
        _seed_entry(test_engine, q, base + timedelta(hours=i))
    with route_client as http:
        resp = http.get("/api/v1/history", params={"limit": 1, "offset": 1})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert [e["query"] for e in body["entries"]] == ["b-song"]


def test_history_list_limit_bounds(route_client, test_engine, monkeypatch) -> None:
    _no_providers(monkeypatch)
    with route_client as http:
        assert http.get("/api/v1/history", params={"limit": 100}).status_code == 200
        over = http.get("/api/v1/history", params={"limit": 101})
        assert over.json()["error"]["code"] == "VALIDATION_ERROR"
        assert over.status_code == 422
        zero = http.get("/api/v1/history", params={"limit": 0})
        assert zero.status_code == 422
        neg = http.get("/api/v1/history", params={"offset": -1})
        assert neg.status_code == 422


def test_history_get_returns_generate_envelope(route_client, test_engine, monkeypatch) -> None:
    _no_providers(monkeypatch)
    _seed_entry(test_engine, "Riptide", datetime(2026, 9, 1, tzinfo=UTC))
    with route_client as http:
        listed = http.get("/api/v1/history").json()["entries"][0]
        resp = http.get(f"/api/v1/history/{listed['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["entry_id"] == listed["id"]
    sheet = body["sheet"]
    assert sheet["id"] == listed["sheet_id"]
    assert sheet["query"] == "Riptide"
    assert sheet["matched_title"] == "Riptide"
    assert "owner_id" not in sheet and "provider_refs" not in sheet
    assert sheet["created_at"].endswith("Z")


def test_history_get_serves_stored_context_verbatim_zero_requery(
    route_client, test_engine, monkeypatch
) -> None:
    """FR-009 / SC-004: History re-open serves stored context verbatim with zero outbound calls."""
    _no_providers(monkeypatch)
    context_fixture = {
        "text": "Riptide is a song by Australian singer-songwriter Vance Joy.",
        "source": "wikipedia",
        "source_url": "https://en.wikipedia.org/wiki/Riptide_(Vance_Joy_song)",
    }
    with sessionmaker(bind=test_engine)() as session:
        kwargs = _sheet_kwargs(context=context_fixture)
        sheet = db_models.SongSheet(**kwargs)
        session.add(sheet)
        session.flush()
        entry = db_models.HistoryEntry(
            owner_id="owner",
            query="Riptide",
            matched_title="Riptide",
            matched_performer="Vance Joy",
            sheet_id=sheet.id,
        )
        session.add(entry)
        session.commit()
        entry_id = str(entry.id)

    with route_client as http:
        resp = http.get(f"/api/v1/history/{entry_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sheet"]["context"] == context_fixture


def test_history_get_unknown_is_not_found(route_client, monkeypatch) -> None:
    _no_providers(monkeypatch)
    missing = "00000000-0000-0000-0000-000000000000"
    with route_client as http:
        resp = http.get(f"/api/v1/history/{missing}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_history_get_dangling_sheet_is_not_found(route_client, test_engine, monkeypatch) -> None:
    """DB-corruption branch: entry points at a sheet that no longer exists."""
    _no_providers(monkeypatch)
    _seed_entry(test_engine, "Riptide", datetime(2026, 9, 1, tzinfo=UTC))
    with route_client as http:
        listed = http.get("/api/v1/history").json()["entries"][0]
        orig_get = Session.get

        def _missing_sheet(self, entity, ident, **kw):  # type: ignore[no-untyped-def]
            if entity is db_models.SongSheet:
                return None
            return orig_get(self, entity, ident, **kw)

        monkeypatch.setattr(Session, "get", _missing_sheet)
        resp = http.get(f"/api/v1/history/{listed['id']}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def _stub_pipeline(monkeypatch: pytest.MonkeyPatch, calls: dict) -> None:
    """Stub the pipeline seam: persist canned rows, return a fresh envelope."""

    import app.routes_sheets as routes

    def _fake_generate(query, candidate, **kw):  # type: ignore[no-untyped-def]
        calls["query"] = query
        calls["candidate"] = candidate
        calls["deadline_s"] = kw.get("deadline_s")
        row = _sheet_kwargs(query=query)
        sheet_id, entry_id = kw["persist"](
            row,
            {
                "owner_id": "owner",
                "query": query,
                "matched_title": candidate["title"],
                "matched_performer": candidate["artist"],
            },
        )
        sheet = dict(row, id=sheet_id)
        sheet.pop("owner_id", None)
        sheet.pop("provider_refs", None)
        return {"entry_id": entry_id, "sheet": sheet}

    monkeypatch.setattr(routes, "generate_sheet", _fake_generate)


def test_regenerate_new_sheet_and_entry_prior_untouched(
    route_client, test_engine, monkeypatch
) -> None:
    calls: dict = {}
    _stub_pipeline(monkeypatch, calls)
    _seed_entry(test_engine, "Riptide", datetime(2026, 9, 1, tzinfo=UTC))
    with route_client as http:
        old = http.get("/api/v1/history").json()["entries"][0]
        resp = http.post(f"/api/v1/history/{old['id']}/regenerate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["entry_id"] != old["id"]
    assert body["sheet"]["id"] != old["sheet_id"]
    assert body["sheet"]["query"] == "Riptide"
    # Full pipeline re-run for the entry's query + matched song (H4).
    assert calls["query"] == "Riptide"
    assert calls["candidate"]["title"] == "Riptide"
    assert calls["candidate"]["artist"] == "Vance Joy"
    assert calls["deadline_s"] == 25
    # Append-only: prior entry still re-opens its original sheet.
    with route_client as http:
        reopened = http.get(f"/api/v1/history/{old['id']}").json()
        listed = http.get("/api/v1/history").json()
    assert reopened["sheet"]["id"] == old["sheet_id"]
    assert listed["total"] == 2
    assert listed["entries"][0]["id"] == body["entry_id"]


def test_regenerate_unknown_is_not_found(route_client, monkeypatch) -> None:
    calls: dict = {}
    _stub_pipeline(monkeypatch, calls)
    missing = "00000000-0000-0000-0000-000000000000"
    with route_client as http:
        resp = http.post(f"/api/v1/history/{missing}/regenerate")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    assert calls == {}


def test_regenerate_provider_failure_keeps_prior(
    route_client, db_session: Session, test_engine, monkeypatch
) -> None:
    import app.routes_sheets as routes

    def _boom(*a, **kw):  # type: ignore[no-untyped-def]
        raise ProviderFailure("lyrics down")

    monkeypatch.setattr(routes, "generate_sheet", _boom)
    _seed_entry(test_engine, "Riptide", datetime(2026, 9, 1, tzinfo=UTC))
    with route_client as http:
        old = http.get("/api/v1/history").json()["entries"][0]
        resp = http.post(f"/api/v1/history/{old['id']}/regenerate")
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "PROVIDER_ERROR"
    with route_client as http:
        listed = http.get("/api/v1/history").json()
        assert listed["total"] == 1
        assert listed["entries"][0]["id"] == old["id"]

    assert db_session.query(db_models.SongSheet).count() == 1
    assert "traceback" not in resp.text.lower()


def test_history_delete_removes_entry_and_orphaned_sheet(
    route_client, test_engine, monkeypatch
) -> None:
    _no_providers(monkeypatch)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    _seed_entry(test_engine, "Yesterday", base)
    doomed, doomed_sheet = _seed_entry(test_engine, "Riptide", base + timedelta(hours=1))
    with route_client as http:
        resp = http.delete(f"/api/v1/history/{doomed}")
    assert resp.status_code == 204
    assert resp.content == b""
    with route_client as http:
        listed = http.get("/api/v1/history").json()
        assert listed["total"] == 1
        assert [e["query"] for e in listed["entries"]] == ["Yesterday"]
        assert http.get(f"/api/v1/history/{doomed}").status_code == 404
        # Second delete: the entry is already gone.
        gone = http.delete(f"/api/v1/history/{doomed}")
        assert gone.status_code == 404
        assert gone.json()["error"]["code"] == "NOT_FOUND"
    # Orphaned sheet collected (1:1 entry→sheet in v1); sibling intact.
    session = sessionmaker(bind=test_engine)()
    try:
        assert session.get(db_models.SongSheet, UUID(doomed_sheet)) is None
        assert session.query(db_models.HistoryEntry).count() == 1
        assert session.query(db_models.SongSheet).count() == 1
    finally:
        session.close()


def test_history_delete_unknown_is_not_found(route_client, monkeypatch) -> None:
    _no_providers(monkeypatch)
    missing = "00000000-0000-0000-0000-000000000000"
    with route_client as http:
        resp = http.delete(f"/api/v1/history/{missing}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_run_pipeline_builds_polite_clients_by_default(monkeypatch) -> None:
    # R8 ToS mitigation: the LIVE generate path must throttle (T031 UG 1-2 s,
    # T020 LRCLIB 200-500 ms). Only tests may scale to 0.
    from app import routes_sheets as routes

    monkeypatch.delenv("PROVIDER_THROTTLE_SCALE", raising=False)
    seen: dict[str, float] = {}

    class _Chart:
        def __init__(self, *, client, throttle_s):
            seen["chart"] = throttle_s
            raise RuntimeError("stop")

    monkeypatch.setattr(routes, "ChartClient", _Chart)
    monkeypatch.setattr(routes, "build_http_client", lambda: None)
    with pytest.raises(RuntimeError):
        routes._run_pipeline("x", {"title": "x", "artist": "y"})
    assert 1.0 <= seen["chart"] <= 2.0
    assert routes._throttle_scale() == 1.0


def test_history_favorite_patch_and_filter(route_client, test_engine, monkeypatch) -> None:
    """FR-018: PATCH toggles favorite; favorite=true filters; total counts filtered set."""
    _no_providers(monkeypatch)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    fav_id, _ = _seed_entry(test_engine, "Riptide", base)
    _seed_entry(test_engine, "Imagine", base + timedelta(hours=1))
    with route_client as http:
        resp = http.patch(f"/api/v1/history/{fav_id}", json={"favorite": True})
        assert resp.status_code == 200
        assert resp.json()["favorite"] is True
        favs = http.get("/api/v1/history", params={"favorite": "true"}).json()
        assert favs["total"] == 1
        assert [e["id"] for e in favs["entries"]] == [fav_id]
        assert http.get("/api/v1/history").json()["total"] == 2
        http.patch(f"/api/v1/history/{fav_id}", json={"favorite": False})
        assert http.get("/api/v1/history", params={"favorite": "true"}).json()["total"] == 0


def test_history_favorite_patch_unknown_and_invalid(route_client, monkeypatch) -> None:
    _no_providers(monkeypatch)
    with route_client as http:
        missing = http.patch(
            "/api/v1/history/00000000-0000-4000-8000-000000000000", json={"favorite": True}
        )
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "NOT_FOUND"
        bad = http.patch(
            "/api/v1/history/00000000-0000-4000-8000-000000000000", json={"favorite": "yes"}
        )
        assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_history_name_filter_accent_and_case_insensitive(
    route_client, test_engine, monkeypatch
) -> None:
    """FR-018: `q` matches query/title/performer ignoring case and accents."""
    _no_providers(monkeypatch)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    accented, _ = _seed_entry(test_engine, "Cómo yo nadie te ha amado", base)
    _seed_entry(test_engine, "Riptide", base + timedelta(hours=1))
    _seed_entry(test_engine, "100%_literal", base + timedelta(hours=2))
    with route_client as http:
        hit = http.get("/api/v1/history", params={"q": "COMO yo"}).json()
        assert [e["id"] for e in hit["entries"]] == [accented]
        assert hit["total"] == 1
        # Performer column ("Vance Joy" seeded on every row) matches too.
        assert http.get("/api/v1/history", params={"q": "vance"}).json()["total"] == 3
        # LIKE wildcards in the term are literal.
        assert http.get("/api/v1/history", params={"q": "%_"}).json()["total"] == 1
        assert http.get("/api/v1/history", params={"q": "zzz"}).json()["total"] == 0
