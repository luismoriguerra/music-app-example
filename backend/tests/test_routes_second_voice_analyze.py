"""Analyze-route tests (T012, 006): POST analyze + persist via TestClient.

The agent seam (`routes_second_voice.analyze_mod.run_analysis`) is stubbed
so these tests stay hermetic; live behavior is covered by evals (T028).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

import db_models
from agents.second_voice.analyze import SkipAnalysis
from app.main import create_app

BODY = {
    "sections": [
        {
            "heading": "Verse 1",
            "lines": [
                {
                    "text": "I've heard there was a secret chord",
                    "chords": [
                        {"offset": 0, "symbol": "C"},
                        {"offset": 11, "symbol": "Am"},
                    ],
                },
                {"text": "That David played", "chords": []},
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
            {
                "section": "Verse 1",
                "chords": ["C", "Am"],
                "degrees": ["I", "vi"],
            },
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


def snapshot_payload() -> dict[str, Any]:
    return {
        "transpose": 5,
        "chords_by_line": [
            {
                "section": 0,
                "line": 0,
                "chords": [
                    {"offset": 0, "symbol": "F"},
                    {"offset": 11, "symbol": "Dm"},
                ],
            },
            {"section": 0, "line": 1, "chords": []},
        ],
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


def _seed_sheet(test_engine) -> str:
    session = sessionmaker(bind=test_engine)()
    try:
        sheet = db_models.SongSheet(**_sheet_kwargs())
        session.add(sheet)
        session.commit()
        return str(sheet.id)
    finally:
        session.close()


def _analysis_count(test_engine) -> int:
    with test_engine.begin() as conn:
        row = conn.execute(text("SELECT COUNT(*) FROM second_voice_analyses")).first()
        assert row is not None
        return int(row[0])


def test_analyze_persists_and_returns_contract_shape(
    route_client: TestClient, test_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routes_second_voice as routes

    sheet_id = _seed_sheet(test_engine)
    expected = valid_analysis()

    def _stub(snapshot: Any, body: Any, **kw: Any) -> tuple[dict, str]:
        assert snapshot[0]["chords"][0]["symbol"] == "F"  # transposed, not stored
        return expected, "openrouter/test-model"

    monkeypatch.setattr(routes.analyze_mod, "run_analysis", _stub)
    resp = route_client.post(f"/api/v1/sheets/{sheet_id}/second-voice", json=snapshot_payload())
    assert resp.status_code == 200, resp.text
    envelope = resp.json()["analysis"]
    assert envelope["sheet_id"] == sheet_id
    assert envelope["transpose"] == 5
    assert envelope["model_id"] == "openrouter/test-model"
    assert envelope["analysis"]["key"]["tonic"] == "C"
    assert "owner_id" not in envelope
    assert _analysis_count(test_engine) == 1


def test_analyze_tampered_snapshot_is_422_and_stores_nothing(
    route_client: TestClient, test_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routes_second_voice as routes

    sheet_id = _seed_sheet(test_engine)
    called: list = []

    def _boom(snapshot: Any, body: Any, **kw: Any) -> tuple[dict, str]:
        called.append(True)
        raise AssertionError("agent must not run on invalid snapshots")

    monkeypatch.setattr(routes.analyze_mod, "run_analysis", _boom)
    payload = snapshot_payload()
    payload["chords_by_line"] = payload["chords_by_line"][:1]  # drop a line
    resp = route_client.post(f"/api/v1/sheets/{sheet_id}/second-voice", json=payload)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert called == []
    assert _analysis_count(test_engine) == 0


def test_analyze_unknown_sheet_is_404(route_client: TestClient) -> None:
    resp = route_client.post(f"/api/v1/sheets/{uuid4()}/second-voice", json=snapshot_payload())
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_analyze_agent_failure_is_502_and_stores_nothing(
    route_client: TestClient, test_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routes_second_voice as routes

    sheet_id = _seed_sheet(test_engine)

    def _fail(snapshot: Any, body: Any, **kw: Any) -> tuple[dict, str]:
        raise SkipAnalysis("unavailable")

    monkeypatch.setattr(routes.analyze_mod, "run_analysis", _fail)
    resp = route_client.post(f"/api/v1/sheets/{sheet_id}/second-voice", json=snapshot_payload())
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "PROVIDER_ERROR"
    assert _analysis_count(test_engine) == 0


def test_analyze_rerun_inserts_new_row(
    route_client: TestClient, test_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routes_second_voice as routes

    sheet_id = _seed_sheet(test_engine)
    monkeypatch.setattr(
        routes.analyze_mod,
        "run_analysis",
        lambda snapshot, body, **kw: (valid_analysis(), "openrouter/test-model"),
    )
    first = route_client.post(f"/api/v1/sheets/{sheet_id}/second-voice", json=snapshot_payload())
    payload = snapshot_payload()
    payload["transpose"] = 3
    second = route_client.post(f"/api/v1/sheets/{sheet_id}/second-voice", json=payload)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["analysis"]["id"] != second.json()["analysis"]["id"]
    assert second.json()["analysis"]["transpose"] == 3
    assert _analysis_count(test_engine) == 2
