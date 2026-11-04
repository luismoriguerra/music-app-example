"""Feature tables: song_sheets + history_entries (T005, 004) + second_voice_analyses (T008, 006).

SQLAlchemy models on the existing Postgres beside `db.py` (AgentOS keeps
owning sessions/memory; these are domain records). Row rules from
data-model.md are enforced twice: Python mapper-event validation raises
ValueError (fires first, single error type for tests), and SQL
CheckConstraints mirror the cheap rules as defense in depth.

Table creation: `init_db()` — called from app startup (lifespan in
`app/main.py`, skipped when no DB is configured) and from tests
(`tests/conftest.py` on the transient test database).
"""

from __future__ import annotations

import os
import re
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    create_engine,
    event,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

OWNER_ID_DEFAULT = "owner"

LYRIC_SOURCES = ("chart", "lrclib", "lyrics_ovh")
CHORD_SOURCES = ("chart", "model-generated", "none")
SOURCE_KINDS = ("lyrics", "chords", "video", "context")
DEGRADED_PARTS = ("video", "chords", "enrichment")
DEGRADED_REASONS = ("quota", "timeout", "unavailable")

MAX_QUERY_LEN = 200
MAX_IDENTITY_LEN = 200
MAX_SOURCE_LINKS = 8

TRANSPOSE_MIN = -11
TRANSPOSE_MAX = 11
DIATONIC_DEGREES_BY_MODE = {
    "major": ("I", "ii", "iii", "IV", "V", "vi", "vii°"),
    "minor": ("i", "ii°", "III", "iv", "v", "VI", "VII"),
}
MAX_SNIPPET_LEN = 120
MAX_MODEL_ID_LEN = 200
# Concise caps (006): mirror analyze.py so over-verbose model output fails
# closed at insert. See Pydantic SecondVoiceOut for the source of truth.
# Receipts are clamped to these caps in analyze.py before insert, so a DB
# rejection here is a programmer error (direct insert), never a paid call.
MAX_JUSTIFICATION_LEN = 600
MAX_SECTION_LABEL_LEN = 80
MAX_FUNCTION_LEN = 600
MAX_CADENCE_NAME_LEN = 80
MAX_LOCATION_LEN = 160
MAX_FEELING_LEN = 480
MAX_STRATEGY_LEN = 600
MAX_VOICE_OPTION_LEN = 600
MAX_EXPLANATION_LEN = 480
MAX_TIP_LEN = 320
MAX_PROGRESSION_ROWS = 20
MAX_SPECIAL_ROWS = 12
MAX_CADENCE_ROWS = 12
MAX_FEEL_ROWS = 20
MAX_NOTE_ROWS = 60
MAX_TIPS = 5

# Anglo note names with explicit sharps/flats (FR-009). Mirrors NOTE_NAME_RE
# in frontend/src/lib/sheets/schemas.ts.
NOTE_NAME_RE = re.compile(r"^[A-G](?:#{1,2}|b{1,2})?$")

# Standard Western chord vocabulary (FR-013): root A-G, optional
# double/single accidental, one quality head (m/maj/min/dim/aug/sus/add),
# then extensions/alterations/slash-bass tail. Whitespace is stripped
# before matching (charts are inconsistent with spaces).
# MUST stay textually identical to CHORD_SYMBOL_RE in
# frontend/src/lib/sheets.ts.
CHORD_SYMBOL_RE = re.compile(
    r"^[A-G](?:#{1,2}|b{1,2})?"
    r"(?:m(?!aj)|maj|min|dim|aug|sus|add|\d+(?:sus|add)?)?"
    r"[0-9#A-Gb()+\-/M°]*$"
)


def owner_id() -> str:
    """Synthetic single-owner identity (FR-011); env override permitted."""
    return os.getenv("OWNER_ID", OWNER_ID_DEFAULT)


def validate_chord_symbol(symbol: Any) -> str:
    """Return the canonical symbol or raise ValueError (data-model rule 1)."""
    if not isinstance(symbol, str):
        raise ValueError(f"symbol must be a string, got {type(symbol).__name__}")
    canonical = "".join(symbol.split())
    if not canonical or not CHORD_SYMBOL_RE.match(canonical):
        raise ValueError(f"symbol {symbol!r} is not standard Western notation")
    return canonical


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def _require_text(value: Any, field: str, max_len: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-blank string")
    if value != value.strip():
        raise ValueError(f"{field} must be trimmed")
    if len(value) > max_len:
        raise ValueError(f"{field} must be ≤{max_len} chars")
    return value


def _require_https(url: Any, field: str) -> str:
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError(f"{field} must be an https URL")
    if not urlparse(url).netloc:
        raise ValueError(f"{field} must be an https URL")
    return url


def count_body_chords(body: dict[str, Any]) -> int:
    """Total chord symbols across all lines (body must be valid first)."""
    return sum(len(line["chords"]) for section in body["sections"] for line in section["lines"])


def validate_body(body: Any) -> dict[str, Any]:
    """Validate the shared sheet body shape (data-model rule 1)."""
    if not isinstance(body, dict) or not isinstance(body.get("sections"), list):
        raise ValueError("body must be {sections: [...]}")
    sections = body["sections"]
    if not sections:
        raise ValueError("body must carry ≥1 section")
    line_count = 0
    for section in sections:
        if not isinstance(section, dict) or not isinstance(section.get("lines"), list):
            raise ValueError("body section must be {heading, lines: [...]}")
        heading = section.get("heading")
        if heading is not None and not isinstance(heading, str):
            raise ValueError("body section heading must be a string or null")
        if not section["lines"]:
            raise ValueError("body section must carry ≥1 lyric line")
        for line in section["lines"]:
            if not isinstance(line, dict):
                raise ValueError("body line must be {text, chords}")
            text = line.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError("body line text must be non-blank")
            chords = line.get("chords")
            if not isinstance(chords, list):
                raise ValueError("body line chords must be a list")
            width = _utf16_len(text)
            for chord in chords:
                if not isinstance(chord, dict):
                    raise ValueError("body chord must be {offset, symbol}")
                offset = chord.get("offset")
                if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
                    raise ValueError("body chord offset must be an int ≥0")
                if offset > width:
                    raise ValueError(f"body chord offset {offset} exceeds line width {width}")
                validate_chord_symbol(chord.get("symbol"))
            line_count += 1
    if line_count < 1:
        raise ValueError("body must carry ≥1 lyric line")
    return body


def validate_source_links(links: Any, attribution_urls: set[str]) -> None:
    """Validate the FR-016 list (data-model rule 4)."""
    if not isinstance(links, list):
        raise ValueError("source_links must be a list")
    if len(links) > MAX_SOURCE_LINKS:
        raise ValueError(f"source_links must carry ≤{MAX_SOURCE_LINKS} items")
    seen: set[str] = set()
    for link in links:
        if not isinstance(link, dict):
            raise ValueError("source_links items must be {label, url, kind}")
        label = link.get("label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError("source_links label must be non-blank")
        url = link.get("url")
        _require_https(url, "source_links url")
        if link.get("kind") not in SOURCE_KINDS:
            raise ValueError(f"source_links kind must be one of {SOURCE_KINDS}")
        if url in seen:
            raise ValueError("source_links urls must be unique")
        if url in attribution_urls:
            raise ValueError("source_links must dedupe against attribution URLs")
        seen.add(url)


def validate_degraded(degraded: Any) -> list[dict[str, str]]:
    """Validate the degraded array (data-model rule 9)."""
    if not isinstance(degraded, list):
        raise ValueError("degraded must be a list")
    for entry in degraded:
        if not isinstance(entry, dict):
            raise ValueError("degraded entries must be {part, reason}")
        if entry.get("part") not in DEGRADED_PARTS:
            raise ValueError(f"degraded part must be one of {DEGRADED_PARTS}")
        if entry.get("reason") not in DEGRADED_REASONS:
            raise ValueError(f"degraded reason must be one of {DEGRADED_REASONS}")
    return degraded


def validate_song_context(context: Any) -> dict[str, str] | None:
    """Validate nullable context field on song_sheets (DR-006, data-model rule 3)."""
    if context is None:
        return None
    if not isinstance(context, dict):
        raise ValueError("context must be null or a dict with {text, source, source_url}")
    txt = context.get("text")
    if not isinstance(txt, str) or not txt.strip():
        raise ValueError("context.text must be a non-blank string")
    if len(txt) > 600:
        raise ValueError("context.text must be ≤600 characters")
    source = context.get("source")
    if not isinstance(source, str) or not source.strip():
        raise ValueError("context.source must be a non-blank string")
    source_url = context.get("source_url")
    _require_https(source_url, "context.source_url")
    return context


def validate_song_sheet(sheet: SongSheet) -> None:
    """Full-row validation (data-model rules 1, 2, 4, 6, 9)."""
    if sheet.owner_id != owner_id():
        raise ValueError(f"owner_id must equal {owner_id()!r}")
    _require_text(sheet.query, "query", MAX_QUERY_LEN)
    _require_text(sheet.matched_title, "matched_title", MAX_IDENTITY_LEN)
    _require_text(sheet.matched_performer, "matched_performer", MAX_IDENTITY_LEN)
    if not isinstance(sheet.provider_refs, dict) or not sheet.provider_refs:
        raise ValueError("provider_refs must carry at least the lyric ref")
    if sheet.lyric_source not in LYRIC_SOURCES:
        raise ValueError(f"lyric_source must be one of {LYRIC_SOURCES}")
    _require_https(sheet.lyric_source_url, "lyric_source_url")

    chord_source = sheet.chord_source
    if chord_source not in CHORD_SOURCES:
        raise ValueError(f"chord_source must be one of {CHORD_SOURCES}")
    has_model = isinstance(sheet.model_id, str) and bool(sheet.model_id.strip())
    has_url = sheet.chord_source_url is not None
    if has_url:
        _require_https(sheet.chord_source_url, "chord_source_url")
    if chord_source == "model-generated":
        if not (has_model and not has_url):
            raise ValueError("chord_source 'model-generated' ⟺ model_id present AND url NULL")
    elif chord_source == "chart":
        if not (has_url and not has_model):
            raise ValueError("chord_source 'chart' ⟺ url present AND model_id NULL")
    else:  # 'none' — lyrics-only, first-class per H1 + deadline skip
        if has_model or has_url:
            raise ValueError("chord_source 'none' ⟺ model_id AND url both NULL")

    validate_body(sheet.body)
    validate_degraded(sheet.degraded)
    validate_song_context(sheet.context)
    total_chords = count_body_chords(sheet.body)
    if chord_source == "none":
        if total_chords != 0:
            raise ValueError("chord_source 'none' requires a zero-chord body")
        if not any(
            entry.get("part") == "chords" and entry.get("reason") in ("timeout", "unavailable")
            for entry in sheet.degraded
        ):
            raise ValueError("chord_source 'none' requires a degraded chords entry")
    elif total_chords < 1:
        raise ValueError("a zero-chord body is legal only as chord_source 'none'")

    attribution = {sheet.lyric_source_url}
    if has_url and sheet.chord_source_url is not None:
        attribution.add(sheet.chord_source_url)
    validate_source_links(sheet.source_links, attribution)

    for field in ("capo", "tuning_note"):
        value = getattr(sheet, field)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ValueError(f"{field} must be null or a non-blank string")


def validate_history_entry(entry: HistoryEntry) -> None:
    """Full-row validation (data-model rules 5, 6)."""
    if entry.owner_id != owner_id():
        raise ValueError(f"owner_id must equal {owner_id()!r}")
    _require_text(entry.query, "query", MAX_QUERY_LEN)
    _require_text(entry.matched_title, "matched_title", MAX_IDENTITY_LEN)
    _require_text(entry.matched_performer, "matched_performer", MAX_IDENTITY_LEN)
    if entry.sheet_id is None:
        raise ValueError("sheet_id must reference a song sheet")


def _require_prose(value: Any, field: str, max_len: int | None = None) -> str:
    """Non-blank model prose (mirrors Zod .min(1); no trim rule)."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-blank string")
    if max_len is not None and len(value) > max_len:
        raise ValueError(f"{field} must be ≤{max_len} chars (concise)")
    return value


def _require_note_name(value: Any, field: str) -> str:
    """Anglo note name with explicit sharps/flats (FR-009)."""
    if not isinstance(value, str) or not NOTE_NAME_RE.match(value.strip()):
        raise ValueError(f"{field} must be an Anglo note name")
    return value


def _require_nullable_str(value: Any, field: str, max_len: int | None = None) -> None:
    if value is not None and not isinstance(value, str):
        raise ValueError(f"{field} must be a string or null")
    if isinstance(value, str) and max_len is not None and len(value) > max_len:
        raise ValueError(f"{field} must be ≤{max_len} chars (concise)")


def validate_second_voice_out(analysis: Any) -> dict[str, Any]:
    """Validate the SecondVoiceOut JSON (006 data-model rules 1, 2, 4)."""
    required = (
        "key",
        "scale",
        "diatonic_chords",
        "progression",
        "special_chords",
        "cadences",
        "section_feel",
        "second_voice",
        "note_table",
        "singing_tips",
    )
    if not isinstance(analysis, dict):
        raise ValueError("analysis must be a SecondVoiceOut object")
    for field in required:
        if field not in analysis:
            raise ValueError(f"analysis is missing {field!r}")

    key = analysis["key"]
    if not isinstance(key, dict):
        raise ValueError("analysis key must be {tonic, mode, justification}")
    _require_note_name(key.get("tonic"), "key.tonic")
    if key.get("mode") not in ("major", "minor"):
        raise ValueError("key.mode must be 'major' or 'minor'")
    _require_prose(key.get("justification"), "key.justification", MAX_JUSTIFICATION_LEN)

    scale = analysis["scale"]
    if not isinstance(scale, list) or not scale:
        raise ValueError("scale must carry ≥1 note")
    for note in scale:
        _require_note_name(note, "scale note")

    diatonics = analysis["diatonic_chords"]
    if not isinstance(diatonics, list):
        raise ValueError("diatonic_chords must be a list")
    degrees = [entry.get("degree") if isinstance(entry, dict) else None for entry in diatonics]
    expected = DIATONIC_DEGREES_BY_MODE[key["mode"]]
    if list(degrees) != list(expected):
        raise ValueError(
            f"diatonic_chords for a {key['mode']} key must be exactly [{', '.join(expected)}]"
        )
    for entry in diatonics:
        validate_chord_symbol(entry.get("chord"))

    progression = analysis["progression"]
    if not isinstance(progression, list) or not progression:
        raise ValueError("progression must carry ≥1 row")
    if len(progression) > MAX_PROGRESSION_ROWS:
        raise ValueError(f"progression must carry ≤{MAX_PROGRESSION_ROWS} rows (concise)")
    for row in progression:
        if not isinstance(row, dict):
            raise ValueError("progression rows must be {section, chords, degrees}")
        _require_prose(row.get("section"), "progression section", MAX_SECTION_LABEL_LEN)
        chords = row.get("chords")
        if not isinstance(chords, list) or not chords:
            raise ValueError("progression chords must carry ≥1 symbol")
        for symbol in chords:
            validate_chord_symbol(symbol)
        row_degrees = row.get("degrees")
        if not isinstance(row_degrees, list) or not row_degrees:
            raise ValueError("progression degrees must carry ≥1 degree")
        for degree in row_degrees:
            _require_prose(degree, "progression degree")
        if len(row_degrees) != len(chords):
            raise ValueError("each progression row needs len(degrees) == len(chords)")

    specials = analysis["special_chords"]
    if not isinstance(specials, list):
        raise ValueError("special_chords must be a list")
    if len(specials) > MAX_SPECIAL_ROWS:
        raise ValueError(f"special_chords must carry ≤{MAX_SPECIAL_ROWS} rows (concise)")
    for entry in specials:
        if not isinstance(entry, dict):
            raise ValueError("special_chords entries must be {chord, function}")
        validate_chord_symbol(entry.get("chord"))
        _require_prose(entry.get("function"), "special chord function", MAX_FUNCTION_LEN)

    cadences = analysis["cadences"]
    if not isinstance(cadences, list):
        raise ValueError("cadences must be a list")
    if len(cadences) > MAX_CADENCE_ROWS:
        raise ValueError(f"cadences must carry ≤{MAX_CADENCE_ROWS} rows (concise)")
    for entry in cadences:
        if not isinstance(entry, dict):
            raise ValueError("cadences entries must be {name, chords, location}")
        _require_prose(entry.get("name"), "cadence name", MAX_CADENCE_NAME_LEN)
        cadence_chords = entry.get("chords")
        if not isinstance(cadence_chords, list) or not cadence_chords:
            raise ValueError("cadence chords must carry ≥1 symbol")
        for symbol in cadence_chords:
            validate_chord_symbol(symbol)
        _require_prose(entry.get("location"), "cadence location", MAX_LOCATION_LEN)

    feels = analysis["section_feel"]
    if not isinstance(feels, list) or not feels:
        raise ValueError("section_feel must carry ≥1 row")
    if len(feels) > MAX_FEEL_ROWS:
        raise ValueError(f"section_feel must carry ≤{MAX_FEEL_ROWS} rows (concise)")
    for entry in feels:
        if not isinstance(entry, dict):
            raise ValueError("section_feel rows must be {section, feeling}")
        _require_prose(entry.get("section"), "section_feel section", MAX_SECTION_LABEL_LEN)
        _require_prose(entry.get("feeling"), "section_feel feeling", MAX_FEELING_LEN)

    voice = analysis["second_voice"]
    if not isinstance(voice, dict):
        raise ValueError("second_voice must be {melody_status, strategy, ...}")
    melody_status = voice.get("melody_status")
    if melody_status not in ("missing", "present"):
        raise ValueError("melody_status must be 'missing' or 'present'")
    strategy = voice.get("strategy")
    if not isinstance(strategy, str):
        raise ValueError("second_voice strategy must be a string")
    if len(strategy) > MAX_STRATEGY_LEN:
        raise ValueError(f"second_voice strategy must be ≤{MAX_STRATEGY_LEN} chars (concise)")
    for field in ("up", "down", "recommendation"):
        _require_nullable_str(voice.get(field), f"second_voice.{field}", MAX_VOICE_OPTION_LEN)

    table = analysis["note_table"]
    if not isinstance(table, list):
        raise ValueError("note_table must be a list")
    if len(table) > MAX_NOTE_ROWS:
        raise ValueError(f"note_table must carry ≤{MAX_NOTE_ROWS} rows (concise)")
    for row in table:
        if not isinstance(row, dict):
            raise ValueError("note_table rows must be {section, lyric_snippet, ...}")
        _require_prose(row.get("section"), "note_table section", MAX_SECTION_LABEL_LEN)
        snippet = row.get("lyric_snippet")
        if not isinstance(snippet, str) or not snippet:
            raise ValueError("note_table lyric_snippet must be a non-empty string")
        if len(snippet) > MAX_SNIPPET_LEN:
            raise ValueError(f"note_table lyric_snippet must be ≤{MAX_SNIPPET_LEN} chars")
        validate_chord_symbol(row.get("chord"))
        for field in ("first_voice", "second_voice", "interval"):
            _require_nullable_str(row.get(field), f"note_table.{field}")
        _require_prose(row.get("explanation"), "note_table explanation", MAX_EXPLANATION_LEN)

    tips = analysis["singing_tips"]
    if not isinstance(tips, list) or not tips:
        raise ValueError("singing_tips must carry ≥1 tip")
    if len(tips) > MAX_TIPS:
        raise ValueError(f"singing_tips must carry ≤{MAX_TIPS} tips (concise)")
    for tip in tips:
        _require_prose(tip, "singing tip", MAX_TIP_LEN)

    if melody_status == "missing" and any(
        row.get("second_voice") is not None
        or row.get("first_voice") is not None
        or row.get("interval") is not None
        for row in table
    ):
        raise ValueError("melody_status 'missing' forbids note_table pitches (FR-010)")
    if melody_status == "missing" and any(
        voice.get(field) is not None for field in ("up", "down", "recommendation")
    ):
        raise ValueError("melody_status 'missing' forbids proposal fields (FR-010)")
    if not table and not strategy.strip():
        raise ValueError("an empty note_table needs a non-empty strategy")
    return analysis


def validate_second_voice_analysis(row: SecondVoiceAnalysis) -> None:
    """Full-row validation (006 data-model rules 1, 2, 3)."""
    if row.owner_id != owner_id():
        raise ValueError(f"owner_id must equal {owner_id()!r}")
    if row.sheet_id is None:
        raise ValueError("sheet_id must reference a song sheet")
    transpose = row.transpose
    if (
        not isinstance(transpose, int)
        or isinstance(transpose, bool)
        or not (TRANSPOSE_MIN <= transpose <= TRANSPOSE_MAX)
    ):
        raise ValueError(f"transpose must be an int in {TRANSPOSE_MIN}…{TRANSPOSE_MAX}")
    _require_text(row.model_id, "model_id", MAX_MODEL_ID_LEN)
    validate_second_voice_out(row.analysis)


class Base(DeclarativeBase):
    pass


class SongSheet(Base):
    __tablename__ = "song_sheets"
    __table_args__ = (
        CheckConstraint("char_length(query) BETWEEN 1 AND 200", name="ck_sheet_query_len"),
        CheckConstraint(
            "char_length(matched_title) BETWEEN 1 AND 200",
            name="ck_sheet_title_len",
        ),
        CheckConstraint(
            "char_length(matched_performer) BETWEEN 1 AND 200",
            name="ck_sheet_performer_len",
        ),
        CheckConstraint(
            "lyric_source IN ('chart', 'lrclib', 'lyrics_ovh')",
            name="ck_sheet_lyric_source",
        ),
        CheckConstraint(
            "chord_source IN ('chart', 'model-generated', 'none')",
            name="ck_sheet_chord_source",
        ),
        CheckConstraint("lyric_source_url LIKE 'https://%'", name="ck_sheet_lyric_url"),
        CheckConstraint(
            "(chord_source = 'model-generated') = "
            "(model_id IS NOT NULL AND chord_source_url IS NULL)",
            name="ck_sheet_three_way_model",
        ),
        CheckConstraint(
            "(chord_source = 'chart') = (model_id IS NULL AND chord_source_url IS NOT NULL)",
            name="ck_sheet_three_way_chart",
        ),
        CheckConstraint(
            "(chord_source = 'none') = (model_id IS NULL AND chord_source_url IS NULL)",
            name="ck_sheet_three_way_none",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[str] = mapped_column(Text, nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    matched_title: Mapped[str] = mapped_column(Text, nullable=False)
    matched_performer: Mapped[str] = mapped_column(Text, nullable=False)
    provider_refs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    lyric_source: Mapped[str] = mapped_column(Text, nullable=False)
    lyric_source_url: Mapped[str] = mapped_column(Text, nullable=False)
    chord_source: Mapped[str] = mapped_column(Text, nullable=False)
    chord_source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    source_links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    degraded: Mapped[list[dict[str, str]]] = mapped_column(JSONB, nullable=False, default=list)
    context: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, default=None)
    capo: Mapped[str | None] = mapped_column(Text, nullable=True)
    tuning_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class HistoryEntry(Base):
    __tablename__ = "history_entries"
    __table_args__ = (
        CheckConstraint("char_length(query) BETWEEN 1 AND 200", name="ck_entry_query_len"),
        CheckConstraint(
            "char_length(matched_title) BETWEEN 1 AND 200",
            name="ck_entry_title_len",
        ),
        CheckConstraint(
            "char_length(matched_performer) BETWEEN 1 AND 200",
            name="ck_entry_performer_len",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[str] = mapped_column(Text, nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    matched_title: Mapped[str] = mapped_column(Text, nullable=False)
    matched_performer: Mapped[str] = mapped_column(Text, nullable=False)
    sheet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("song_sheets.id", ondelete="RESTRICT"), nullable=False
    )
    favorite: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SecondVoiceAnalysis(Base):
    __tablename__ = "second_voice_analyses"
    __table_args__ = (
        CheckConstraint("transpose BETWEEN -11 AND 11", name="ck_analysis_transpose_range"),
        CheckConstraint("char_length(model_id) BETWEEN 1 AND 200", name="ck_analysis_model_len"),
        Index("ix_analyses_sheet_created", "sheet_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[str] = mapped_column(Text, nullable=False)
    sheet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("song_sheets.id", ondelete="CASCADE"), nullable=False
    )
    transpose: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    model_id: Mapped[str] = mapped_column(Text, nullable=False)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


@event.listens_for(SongSheet, "before_insert")
@event.listens_for(SongSheet, "before_update")
def _validate_sheet_event(mapper: Any, connection: Any, target: SongSheet) -> None:
    validate_song_sheet(target)


@event.listens_for(HistoryEntry, "before_insert")
@event.listens_for(HistoryEntry, "before_update")
def _validate_entry_event(mapper: Any, connection: Any, target: HistoryEntry) -> None:
    validate_history_entry(target)


@event.listens_for(SecondVoiceAnalysis, "before_insert")
@event.listens_for(SecondVoiceAnalysis, "before_update")
def _validate_analysis_event(mapper: Any, connection: Any, target: SecondVoiceAnalysis) -> None:
    validate_second_voice_analysis(target)


_engine: Engine | None = None


def get_engine() -> Engine:
    """Process-wide engine from the app DB config (lazy; needs Postgres)."""
    global _engine
    if _engine is None:
        from db import load_db_config

        _engine = create_engine(load_db_config().url, pool_pre_ping=True)
    return _engine


def init_db(engine: Engine | None = None) -> None:
    """Create feature tables (idempotent; app startup + tests)."""
    eng = engine or get_engine()
    Base.metadata.create_all(eng)
    if eng.dialect.name == "postgresql":
        with eng.begin() as conn:
            conn.execute(text("ALTER TABLE song_sheets ADD COLUMN IF NOT EXISTS context JSONB;"))
            conn.execute(
                text(
                    "ALTER TABLE history_entries "
                    "ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;"
                )
            )


@contextmanager
def session_scope() -> Iterator[Session]:
    """Request-scoped session with commit/rollback (routes use this)."""
    session = sessionmaker(bind=get_engine())()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
