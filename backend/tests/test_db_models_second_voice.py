"""SQLAlchemy model tests for second_voice_analyses (T007, 006).

Runs against transient Postgres (conftest `db_session`: per-test rollback).
No SQLite anywhere (Principle VII). Row-rule violations raise ValueError
from mapper-event validation; structural DB violations raise IntegrityError.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import SecondVoiceAnalysis, SongSheet


def valid_body() -> dict[str, Any]:
    return {
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
                ],
            }
        ]
    }


def add_sheet(db_session: Session, **overrides: Any) -> SongSheet:
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
        "body": valid_body(),
        "source_links": [],
        "degraded": [],
        "capo": None,
        "tuning_note": None,
    }
    kwargs.update(overrides)
    sheet = SongSheet(**kwargs)
    db_session.add(sheet)
    db_session.flush()
    return sheet


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
                "chords": ["C", "Am", "F", "G"],
                "degrees": ["I", "vi", "IV", "V"],
            },
        ],
        "special_chords": [{"chord": "E7", "function": "Secondary dominant V7/vi leading to Am."}],
        "cadences": [{"name": "V–I", "chords": ["G", "C"], "location": "End of the chorus."}],
        "section_feel": [{"section": "Verse 1", "feeling": "Stable and bright."}],
        "second_voice": {
            "melody_status": "missing",
            "strategy": "Use diatonic thirds above.",
            "up": None,
            "down": None,
            "recommendation": None,
        },
        "note_table": [
            {
                "section": "Verse 1",
                "lyric_snippet": "I've heard there was a secret chord",
                "chord": "C",
                "first_voice": None,
                "second_voice": None,
                "interval": None,
                "explanation": "No melody, so no exact pitch is proposed.",
            },
        ],
        "singing_tips": ["Sing softly and listen to the chord."],
    }


def add_analysis(db_session: Session, sheet: SongSheet, **overrides: Any) -> SecondVoiceAnalysis:
    kwargs: dict[str, Any] = {
        "owner_id": "owner",
        "sheet_id": sheet.id,
        "transpose": 5,
        "model_id": "openrouter/test-model",
        "analysis": valid_analysis(),
    }
    kwargs.update(overrides)
    row = SecondVoiceAnalysis(**kwargs)
    db_session.add(row)
    db_session.flush()
    return row


def test_valid_insert_round_trips(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    row = add_analysis(db_session, sheet)
    assert row.id is not None
    assert row.transpose == 5
    assert row.analysis["key"]["tonic"] == "C"


def test_transpose_out_of_range_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    for bad in (-12, 12):
        with pytest.raises(ValueError, match="transpose"):
            add_analysis(db_session, sheet, transpose=bad)
        db_session.rollback()


def test_blank_model_id_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    for bad in ("", "   ", None):
        with pytest.raises(ValueError, match="model_id"):
            add_analysis(db_session, sheet, model_id=bad)
        db_session.rollback()


MINOR_DIATONICS = [
    {"degree": "i", "chord": "Am"},
    {"degree": "ii°", "chord": "Bdim"},
    {"degree": "III", "chord": "C"},
    {"degree": "iv", "chord": "Dm"},
    {"degree": "v", "chord": "Em"},
    {"degree": "VI", "chord": "F"},
    {"degree": "VII", "chord": "G"},
]


def test_minor_key_natural_minor_set_inserts(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["key"] = {"tonic": "A", "mode": "minor", "justification": "Resolves to Am."}
    analysis["diatonic_chords"] = MINOR_DIATONICS
    row = add_analysis(db_session, sheet, analysis=analysis)
    assert row.analysis["key"]["mode"] == "minor"


def test_minor_key_with_major_set_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["key"]["mode"] = "minor"
    with pytest.raises(ValueError, match="minor key"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_six_diatonics_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["diatonic_chords"] = analysis["diatonic_chords"][:6]
    with pytest.raises(ValueError, match="diatonic"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_misordered_degrees_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    first, second = analysis["diatonic_chords"][0], analysis["diatonic_chords"][1]
    analysis["diatonic_chords"][0], analysis["diatonic_chords"][1] = second, first
    with pytest.raises(ValueError, match="diatonic"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_progression_length_mismatch_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["progression"] = [{"section": "Verse 1", "chords": ["C", "Am"], "degrees": ["I"]}]
    with pytest.raises(ValueError, match="degrees"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_non_western_symbol_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["diatonic_chords"][0]["chord"] = "H"
    with pytest.raises(ValueError, match="symbol"):
        add_analysis(db_session, sheet, analysis=analysis)
    db_session.rollback()
    analysis = valid_analysis()
    analysis["note_table"][0]["chord"] = "Z9"
    with pytest.raises(ValueError, match="symbol"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_long_snippet_rejected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["note_table"][0]["lyric_snippet"] = "x" * 121
    with pytest.raises(ValueError, match="snippet"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_concise_caps_rejected(db_session: Session) -> None:
    """Verbose prose / too many rows fail closed at insert (concise)."""
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["section_feel"][0]["feeling"] = "x" * 481
    with pytest.raises(ValueError, match="concise"):
        add_analysis(db_session, sheet, analysis=analysis)
    db_session.rollback()
    analysis = valid_analysis()
    analysis["singing_tips"] = ["Sing."] * 6
    with pytest.raises(ValueError, match="concise"):
        add_analysis(db_session, sheet, analysis=analysis)


@pytest.mark.parametrize(
    ("field", "pitch"),
    [("first_voice", "G"), ("second_voice", "E"), ("interval", "3rd")],
)
def test_missing_melody_with_pitched_row_rejected(
    db_session: Session, field: str, pitch: str
) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["note_table"][0][field] = pitch
    with pytest.raises(ValueError, match="missing"):
        add_analysis(db_session, sheet, analysis=analysis)


@pytest.mark.parametrize("field", ["up", "down", "recommendation"])
def test_missing_melody_with_proposal_rejected(db_session: Session, field: str) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["second_voice"][field] = "Sing a third above."
    with pytest.raises(ValueError, match="proposal"):
        add_analysis(db_session, sheet, analysis=analysis)


def test_empty_special_chords_accepted(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    analysis = valid_analysis()
    analysis["special_chords"] = []
    row = add_analysis(db_session, sheet, analysis=analysis)
    assert row.analysis["special_chords"] == []


def test_owner_invariant(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    with pytest.raises(ValueError, match="owner_id"):
        add_analysis(db_session, sheet, owner_id="mallory")


def test_sheet_delete_cascades_to_analyses(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    first = add_analysis(db_session, sheet, transpose=3)
    second = add_analysis(db_session, sheet, transpose=5)
    db_session.delete(sheet)
    db_session.flush()
    remaining = db_session.scalars(
        select(SecondVoiceAnalysis).where(SecondVoiceAnalysis.id.in_([first.id, second.id]))
    ).all()
    assert remaining == []


def test_per_song_list_order_is_newest_first(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    base = datetime.now(UTC) - timedelta(days=1)
    old = add_analysis(db_session, sheet, transpose=0, created_at=base)
    new = add_analysis(db_session, sheet, transpose=5, created_at=base + timedelta(hours=1))
    rows = db_session.scalars(
        select(SecondVoiceAnalysis)
        .where(SecondVoiceAnalysis.sheet_id == sheet.id)
        .order_by(SecondVoiceAnalysis.created_at.desc())
    ).all()
    assert [r.id for r in rows] == [new.id, old.id]
    assert copy.deepcopy(rows[0].analysis) == valid_analysis()
