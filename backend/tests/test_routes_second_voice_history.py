"""History-route tests (T021, 006, DR-002): list/get/delete via TestClient.

Postgres only, zero providers. Re-open serves stored rows without any
inference (R7/004-R7 extended).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

import db_models
from app.main import create_app

BODY = {
    "sections": [
        {
            "heading": "Verse 1",
            "lines": [
                {
                    "text": "I've heard there was a secret chord",
                    "chords": [{"offset": 0, "symbol": "C"}],
                },
            ],
        }
    ]
}


def _sheet_kwargs(**over: Any) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "owner_id": "owner",
        "query": "Hallelujah",
        "matched_title": "Hallelujah",
        "matched_performer": "Pentatonix",
        "provider_refs": {"lrclib_id": 1},
        "lyric_source": "lrclib",
        "lyric_source_url": "https://lrclib.net/api/get/1",
        "chord_source": "chart",
        "chord_source_url": "https://tabs.example.com/tab/1",
        "model_id": None,
        "body": BODY,
        "source_links": [],
        "degraded": [],
        "capo": None,
        "tuning_note": None,
    }
    kwargs.update(over)
    return kwargs


def valid_analysis() -> dict[str, Any]:
    return {
        "key": {"tonic": "C", "mode": "major", "justification": "Uses C, Am, F and G."},
        "scale": ["C", "D", "E", "F", "G", "A", "B"],
        "diatonic_chords": [
            {"degree": "I", "chord": "C"},
            {"degree": "ii", "chord": "Dm"},
            {"degree": "iii", "chord": "Em"},
            {"degree": "IV", "chord": "F"},
            {"degree": "V", "chord": "G"},
            {"degree": "vi", "chord": "Am"},
            {"degree": "vii°", "chord": "Bdim"},
        ],
        "progression": [
            {"section": "Verse 1", "chords": ["C"], "degrees": ["I"]},
        ],
        "special_chords": [],
        "cadences": [],
        "section_feel": [{"section": "Verse 1", "feeling": "Stable."}],
        "second_voice": {
            "melody_status": "missing",
            "strategy": "Use thirds above.",
            "up": None,
            "down": None,
            "recommendation": None,
        },
        "note_table": [
            {
                "section": "Verse 1",
                "lyric_snippet": "I've heard there was",
                "chord": "C",
                "first_voice": None,
                "second_voice": None,
                "interval": None,
                "explanation": "No melody.",
            },
        ],
        "singing_tips": ["Listen to the chord."],
    }


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
        conn.execute(text("DELETE FROM second_voice_analyses"))
        conn.execute(text("DELETE FROM history_entries"))
        conn.execute(text("DELETE FROM song_sheets"))
    db_models._engine = None


def _seed_sheet(test_engine, **over: Any) -> str:
    session = sessionmaker(bind=test_engine)()
    try:
        sheet = db_models.SongSheet(**_sheet_kwargs(**over))
        session.add(sheet)
        session.commit()
        return str(sheet.id)
    finally:
        session.close()


def _seed_analysis(test_engine, sheet_id: str, transpose: int, created_at: datetime) -> str:
    session = sessionmaker(bind=test_engine)()
    try:
        row = db_models.SecondVoiceAnalysis(
            owner_id="owner",
            sheet_id=sheet_id,
            transpose=transpose,
            model_id="openrouter/test-model",
            analysis=valid_analysis(),
            created_at=created_at,
        )
        session.add(row)
        session.commit()
        return str(row.id)
    finally:
        session.close()


def _seed_entry(test_engine, sheet_id: str) -> str:
    session = sessionmaker(bind=test_engine)()
    try:
        entry = db_models.HistoryEntry(
            owner_id="owner",
            query="Hallelujah",
            matched_title="Hallelujah",
            matched_performer="Pentatonix",
            sheet_id=sheet_id,
        )
        session.add(entry)
        session.commit()
        return str(entry.id)
    finally:
        session.close()


def _no_inference(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.routes_second_voice as routes

    def _boom(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("history re-open must not run inference")

    monkeypatch.setattr(routes.analyze_mod, "run_analysis", _boom)
    monkeypatch.setattr(routes.analyze_mod, "build_agent", _boom)


def test_list_is_newest_first_summaries_with_total(route_client: TestClient, test_engine) -> None:
    sheet_id = _seed_sheet(test_engine)
    base = datetime.now(UTC) - timedelta(days=1)
    old_id = _seed_analysis(test_engine, sheet_id, 0, base)
    new_id = _seed_analysis(test_engine, sheet_id, 5, base + timedelta(hours=1))
    resp = route_client.get(f"/api/v1/sheets/{sheet_id}/second-voice?limit=20")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 2
    assert [entry["id"] for entry in data["analyses"]] == [new_id, old_id]
    assert data["analyses"][0]["transpose"] == 5
    assert data["analyses"][0]["model_id"] == "openrouter/test-model"
    assert "analysis" not in data["analyses"][0]  # summaries only
    assert "created_at" in data["analyses"][0]


def test_list_unknown_sheet_is_404(route_client: TestClient) -> None:
    resp = route_client.get(f"/api/v1/sheets/{uuid4()}/second-voice")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_list_empty_song_returns_empty_page(route_client: TestClient, test_engine) -> None:
    sheet_id = _seed_sheet(test_engine)
    resp = route_client.get(f"/api/v1/sheets/{sheet_id}/second-voice")
    assert resp.status_code == 200
    assert resp.json() == {"analyses": [], "total": 0}


def test_get_one_serves_stored_row_with_zero_providers(
    route_client: TestClient, test_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    _no_inference(monkeypatch)
    sheet_id = _seed_sheet(test_engine)
    analysis_id = _seed_analysis(test_engine, sheet_id, 5, datetime.now(UTC))
    resp = route_client.get(f"/api/v1/second-voice/{analysis_id}")
    assert resp.status_code == 200, resp.text
    envelope = resp.json()["analysis"]
    assert envelope["id"] == analysis_id
    assert envelope["transpose"] == 5
    assert envelope["analysis"]["key"]["tonic"] == "C"


def test_get_unknown_analysis_is_404(route_client: TestClient) -> None:
    resp = route_client.get(f"/api/v1/second-voice/{uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_delete_removes_only_that_row(route_client: TestClient, test_engine) -> None:
    sheet_id = _seed_sheet(test_engine)
    base = datetime.now(UTC)
    doomed = _seed_analysis(test_engine, sheet_id, 5, base)
    sibling = _seed_analysis(test_engine, sheet_id, 3, base + timedelta(minutes=1))
    resp = route_client.delete(f"/api/v1/second-voice/{doomed}")
    assert resp.status_code == 204
    assert resp.content == b""
    assert route_client.get(f"/api/v1/second-voice/{doomed}").status_code == 404
    kept = route_client.get(f"/api/v1/second-voice/{sibling}")
    assert kept.status_code == 200
    listed = route_client.get(f"/api/v1/sheets/{sheet_id}/second-voice")
    assert listed.json()["total"] == 1  # sheet + sibling intact


def test_second_delete_is_404(route_client: TestClient, test_engine) -> None:
    sheet_id = _seed_sheet(test_engine)
    analysis_id = _seed_analysis(test_engine, sheet_id, 5, datetime.now(UTC))
    assert route_client.delete(f"/api/v1/second-voice/{analysis_id}").status_code == 204
    second = route_client.delete(f"/api/v1/second-voice/{analysis_id}")
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "NOT_FOUND"


def test_sheet_delete_cascades_through_entry_delete(route_client: TestClient, test_engine) -> None:
    sheet_id = _seed_sheet(test_engine)
    entry_id = _seed_entry(test_engine, sheet_id)
    analysis_id = _seed_analysis(test_engine, sheet_id, 5, datetime.now(UTC))
    assert route_client.delete(f"/api/v1/history/{entry_id}").status_code == 204
    assert route_client.get(f"/api/v1/second-voice/{analysis_id}").status_code == 404
    assert route_client.get(f"/api/v1/sheets/{sheet_id}/second-voice").status_code == 404
