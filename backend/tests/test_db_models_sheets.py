"""SQLAlchemy model tests for song_sheets + history_entries (T004).

Runs against transient Postgres via the Compose `db` service (conftest
`db_session`: per-test rollback). No SQLite anywhere (Principle VII).
Row-rule violations raise ValueError from mapper-event validation;
structural DB violations (FK, RESTRICT) raise IntegrityError.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db_models import HistoryEntry, SongSheet, owner_id


def valid_body() -> dict[str, Any]:
    return {
        "sections": [
            {
                "heading": "Verse 1",
                "lines": [
                    {
                        "text": "Lady, runnin' down to the riptide",
                        "chords": [
                            {"offset": 0, "symbol": "Am"},
                            {"offset": 11, "symbol": "G"},
                        ],
                    },
                    {"text": "taken away to the dark side", "chords": []},
                ],
            }
        ]
    }


def valid_sheet_kwargs(**overrides: Any) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "owner_id": "owner",
        "query": "Riptide",
        "matched_title": "Riptide",
        "matched_performer": "Vance Joy",
        "provider_refs": {"lrclib_id": 969429},
        "lyric_source": "lrclib",
        "lyric_source_url": "https://lrclib.net/api/get/969429",
        "chord_source": "model-generated",
        "chord_source_url": None,
        "model_id": "openrouter/test-model",
        "body": valid_body(),
        "source_links": [
            {
                "label": "LRCLIB",
                "url": "https://lrclib.net/search/Riptide",
                "kind": "lyrics",
            }
        ],
        "degraded": [],
        "capo": None,
        "tuning_note": None,
    }
    kwargs.update(overrides)
    return kwargs


def add_sheet(db_session: Session, **overrides: Any) -> SongSheet:
    sheet = SongSheet(**valid_sheet_kwargs(**overrides))
    db_session.add(sheet)
    db_session.flush()
    return sheet


def test_owner_id_defaults_to_single_owner() -> None:
    assert owner_id() == "owner"


def test_insert_valid_sheet_generates_id_and_timestamp(
    db_session: Session,
) -> None:
    sheet = add_sheet(db_session)
    assert isinstance(sheet.id, uuid.UUID)
    assert sheet.id.version == 4
    assert sheet.created_at is not None
    assert sheet.owner_id == "owner"


def test_owner_id_must_equal_owner_id(db_session: Session) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(owner_id="mallory")))
    with pytest.raises(ValueError, match="owner_id"):
        db_session.flush()


@pytest.mark.parametrize("query", ["", "   ", "x" * 201])
def test_query_length_and_blank_rejected(db_session: Session, query: str) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(query=query)))
    with pytest.raises(ValueError, match="query"):
        db_session.flush()


def test_query_must_be_trimmed(db_session: Session) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(query="  Riptide ")))
    with pytest.raises(ValueError, match="query"):
        db_session.flush()


@pytest.mark.parametrize("field", ["matched_title", "matched_performer"])
@pytest.mark.parametrize("value", ["", "x" * 201])
def test_matched_identity_length(db_session: Session, field: str, value: str) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(**{field: value})))
    with pytest.raises(ValueError, match=field):
        db_session.flush()


def test_provider_refs_requires_at_least_the_lyric_ref(
    db_session: Session,
) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(provider_refs={})))
    with pytest.raises(ValueError, match="provider_refs"):
        db_session.flush()


def test_lyric_source_enum(db_session: Session) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(lyric_source="musixmatch")))
    with pytest.raises(ValueError, match="lyric_source"):
        db_session.flush()


@pytest.mark.parametrize("url", ["http://example.com/x", "not-a-url", "", None])
def test_lyric_source_url_https_link_back_required(db_session: Session, url: str | None) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(lyric_source_url=url)))
    with pytest.raises(ValueError, match="lyric_source_url"):
        db_session.flush()


def test_chord_source_chart_shape(db_session: Session) -> None:
    sheet = add_sheet(
        db_session,
        lyric_source="chart",
        lyric_source_url="https://tabs.example.com/tab/1",
        chord_source="chart",
        chord_source_url="https://tabs.example.com/tab/1",
        model_id=None,
        provider_refs={"chart_url": "https://tabs.example.com/tab/1"},
    )
    assert sheet.chord_source == "chart"


def test_chord_source_none_shape_requires_degraded_chords_entry(
    db_session: Session,
) -> None:
    body = valid_body()
    for section in body["sections"]:
        for line in section["lines"]:
            line["chords"] = []
    sheet = add_sheet(
        db_session,
        chord_source="none",
        chord_source_url=None,
        model_id=None,
        body=body,
        degraded=[{"part": "chords", "reason": "unavailable"}],
    )
    assert sheet.chord_source == "none"


@pytest.mark.parametrize(
    "kwargs",
    [
        # model-generated ⟺ model_id present AND url NULL
        {"chord_source": "model-generated", "model_id": None},
        {
            "chord_source": "model-generated",
            "chord_source_url": "https://example.com/x",
        },
        # chart ⟺ url present AND model_id NULL
        {"chord_source": "chart", "model_id": "openrouter/x"},
        {"chord_source": "chart", "chord_source_url": None, "model_id": None},
        # none ⟺ BOTH NULL
        {
            "chord_source": "none",
            "model_id": "openrouter/x",
            "degraded": [{"part": "chords", "reason": "timeout"}],
        },
        {
            "chord_source": "none",
            "chord_source_url": "https://example.com/x",
            "degraded": [{"part": "chords", "reason": "timeout"}],
        },
        # none requires the degraded chords entry ...
        {"chord_source": "none", "model_id": None, "degraded": []},
        # ... and a zero-chord body
        {
            "chord_source": "none",
            "model_id": None,
            "degraded": [{"part": "chords", "reason": "timeout"}],
        },
    ],
)
def test_chord_source_three_way_rule(db_session: Session, kwargs: dict[str, Any]) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(**kwargs)))
    with pytest.raises(ValueError, match="chord_source|degraded|body"):
        db_session.flush()


@pytest.mark.parametrize(
    "body",
    [
        {"sections": []},
        {"sections": [{"heading": None, "lines": []}]},
        {"sections": [{"heading": "V", "lines": [{"text": "", "chords": []}]}]},
        {"sections": [{"heading": "V", "lines": "not-a-list"}]},
        {"nope": True},
        "not-a-dict",
    ],
)
def test_body_requires_section_and_lyric_line(db_session: Session, body: Any) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(body=body)))
    with pytest.raises(ValueError, match="body"):
        db_session.flush()


def test_body_rejects_out_of_range_offset(db_session: Session) -> None:
    body = valid_body()
    body["sections"][0]["lines"][0]["chords"] = [{"offset": 999, "symbol": "Am"}]
    db_session.add(SongSheet(**valid_sheet_kwargs(body=body)))
    with pytest.raises(ValueError, match="offset"):
        db_session.flush()


@pytest.mark.parametrize("symbol", ["H", "C maj7!", "", "   ", "Z#m"])
def test_body_rejects_unparsable_symbol(db_session: Session, symbol: str) -> None:
    body = valid_body()
    body["sections"][0]["lines"][0]["chords"] = [{"offset": 0, "symbol": symbol}]
    db_session.add(SongSheet(**valid_sheet_kwargs(body=body)))
    with pytest.raises(ValueError, match="symbol"):
        db_session.flush()


@pytest.mark.parametrize(
    "symbol",
    ["Em", "Dadd9", "Am7", "F#m", "Bbsus4", "Cmaj7", "G/B", "C7(#9)", "Eaug"],
)
def test_body_accepts_full_vocabulary_symbols(db_session: Session, symbol: str) -> None:
    body = valid_body()
    body["sections"][0]["lines"][0]["chords"] = [{"offset": 0, "symbol": symbol}]
    sheet = add_sheet(db_session, body=body)
    assert sheet.body["sections"][0]["lines"][0]["chords"][0]["symbol"] == symbol


def test_zero_chord_lines_legal_but_not_zero_chord_body_on_chorded_sheet(
    db_session: Session,
) -> None:
    body = valid_body()
    for section in body["sections"]:
        for line in section["lines"]:
            line["chords"] = []
    db_session.add(SongSheet(**valid_sheet_kwargs(body=body)))
    with pytest.raises(ValueError, match="body"):
        db_session.flush()


def test_source_links_capped_at_eight(db_session: Session) -> None:
    links = [
        {"label": f"L{i}", "url": f"https://example.com/{i}", "kind": "lyrics"} for i in range(9)
    ]
    db_session.add(SongSheet(**valid_sheet_kwargs(source_links=links)))
    with pytest.raises(ValueError, match="source_links"):
        db_session.flush()


def test_source_links_must_be_https_unique_and_not_attribution(
    db_session: Session,
) -> None:
    base = "https://example.com/"
    bad_lists = [
        [{"label": "x", "url": "http://example.com/x", "kind": "lyrics"}],
        [
            {"label": "a", "url": base + "1", "kind": "lyrics"},
            {"label": "b", "url": base + "1", "kind": "chords"},
        ],
        [
            {
                "label": "same",
                "url": "https://lrclib.net/api/get/969429",
                "kind": "lyrics",
            }
        ],
        [{"label": "x", "url": base + "1", "kind": "tabs"}],
    ]
    for links in bad_lists:
        db_session.add(SongSheet(**valid_sheet_kwargs(source_links=links)))
        with pytest.raises(ValueError, match="source_links"):
            db_session.flush()
        db_session.rollback()


@pytest.mark.parametrize(
    "degraded",
    [
        [{"part": "video", "reason": "quota"}],
        [{"part": "chords", "reason": "timeout"}],
        [
            {"part": "video", "reason": "unavailable"},
            {"part": "chords", "reason": "quota"},
        ],
    ],
)
def test_degraded_entries_valid(db_session: Session, degraded: list[dict[str, str]]) -> None:
    sheet = add_sheet(db_session, degraded=degraded)
    assert sheet.degraded == degraded


@pytest.mark.parametrize(
    "degraded",
    [
        [{"part": "lyrics", "reason": "quota"}],
        [{"part": "video", "reason": "missing"}],
        [{"part": "video"}],
        "not-a-list",
    ],
)
def test_degraded_entries_invalid(db_session: Session, degraded: Any) -> None:
    db_session.add(SongSheet(**valid_sheet_kwargs(degraded=degraded)))
    with pytest.raises(ValueError, match="degraded"):
        db_session.flush()


def test_history_entry_links_sheet_and_denormalizes_identity(
    db_session: Session,
) -> None:
    sheet = add_sheet(db_session)
    entry = HistoryEntry(
        owner_id="owner",
        query="Riptide",
        matched_title="Riptide",
        matched_performer="Vance Joy",
        sheet_id=sheet.id,
    )
    db_session.add(entry)
    db_session.flush()
    assert isinstance(entry.id, uuid.UUID)
    assert entry.sheet_id == sheet.id
    assert entry.created_at is not None


def test_history_entry_requires_existing_sheet(
    db_session: Session,
) -> None:
    db_session.add(
        HistoryEntry(
            owner_id="owner",
            query="Riptide",
            matched_title="Riptide",
            matched_performer="Vance Joy",
            sheet_id=uuid.uuid4(),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_history_entry_owner_must_equal_owner_id(
    db_session: Session,
) -> None:
    sheet = add_sheet(db_session)
    db_session.add(
        HistoryEntry(
            owner_id="mallory",
            query="Riptide",
            matched_title="Riptide",
            matched_performer="Vance Joy",
            sheet_id=sheet.id,
        )
    )
    with pytest.raises(ValueError, match="owner_id"):
        db_session.flush()


def test_sheets_are_restrict_protected(db_session: Session) -> None:
    sheet = add_sheet(db_session)
    db_session.add(
        HistoryEntry(
            owner_id="owner",
            query="Riptide",
            matched_title="Riptide",
            matched_performer="Vance Joy",
            sheet_id=sheet.id,
        )
    )
    db_session.flush()
    db_session.delete(sheet)
    with pytest.raises(IntegrityError):
        db_session.flush()
