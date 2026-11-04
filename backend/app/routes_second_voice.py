"""Second-voice REST routes (T017, 006): analyze + per-song history.

Covers `contracts/rest-api.md`: the analyze route validates the rendered
transposed snapshot against the immutable stored sheet (DR-001), runs the
19-step theory agent once (R2/R7), and persists the structured JSON row
(DR-002/DR-003). Error taxonomy reuses the 004 codes (no new codes).
"""

from __future__ import annotations

import logging
import uuid as _uuid

from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agents.second_voice import analyze as analyze_mod
from agents.second_voice import validate as validate_mod
from db_models import SecondVoiceAnalysis, SongSheet, owner_id, session_scope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["second-voice"])


class SnapshotChord(BaseModel):
    offset: int
    symbol: str


class SnapshotLine(BaseModel):
    section: int
    line: int
    chords: list[SnapshotChord]


class AnalyzeRequest(BaseModel):
    transpose: int
    chords_by_line: list[SnapshotLine]


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def _iso_z(value: object) -> str:
    """Format a DB timestamp as ISO-8601 Zulu (wire `created_at`)."""
    text = "" if value is None else str(getattr(value, "isoformat", lambda: value)())
    text = text.replace("+00:00", "Z")
    if "T" in text and not text.endswith("Z"):
        text += "Z"
    return text


def _wire_summary(row: SecondVoiceAnalysis) -> dict:
    """Summary projection for the newest-first list (never the full JSON)."""
    return {
        "id": str(row.id),
        "sheet_id": str(row.sheet_id),
        "transpose": row.transpose,
        "model_id": row.model_id,
        "created_at": _iso_z(row.created_at),
    }


def _wire_analysis(row: SecondVoiceAnalysis) -> dict:
    """Wire subset of a stored analysis (no owner_id on the wire)."""
    return {
        "id": str(row.id),
        "sheet_id": str(row.sheet_id),
        "transpose": row.transpose,
        "model_id": row.model_id,
        "analysis": row.analysis,
        "created_at": _iso_z(row.created_at),
    }


@router.post("/sheets/{sheet_id}/second-voice", response_model=None)
def analyze_second_voice(sheet_id: _uuid.UUID, payload: AnalyzeRequest) -> dict | JSONResponse:
    """Analyze the transposed snapshot + persist the row (FR-002–005)."""
    with session_scope() as session:
        sheet = session.get(SongSheet, sheet_id)
        if sheet is None:
            return _error("NOT_FOUND", "Unknown sheet.", 404)
        stored_body = dict(sheet.body)
    try:
        snapshot = validate_mod.validate_snapshot(payload.model_dump(), stored_body)
    except validate_mod.SnapshotError as exc:
        return _error("VALIDATION_ERROR", str(exc), 422)
    try:
        analysis, model_id = analyze_mod.run_analysis(snapshot["chords_by_line"], stored_body)
    except analyze_mod.SkipAnalysis as exc:
        logger.warning(
            "second-voice analyze %s degraded to 502: reason=%s cause=%r",
            sheet_id,
            exc.reason,
            exc.__cause__,
        )
        message = (
            "Analysis timed out; try again."
            if exc.reason == "timeout"
            else "Analysis is temporarily unavailable; try again."
        )
        return _error("PROVIDER_ERROR", message, 502)
    try:
        with session_scope() as session:
            row = SecondVoiceAnalysis(
                owner_id=owner_id(),
                sheet_id=sheet_id,
                transpose=snapshot["transpose"],
                model_id=model_id,
                analysis=analysis,
            )
            session.add(row)
            session.flush()
            return {"analysis": _wire_analysis(row)}
    except ValueError:
        # Mapper validation rejected the model JSON: fail closed (FR-014).
        return _error("PROVIDER_ERROR", "Analysis failed validation; try again.", 502)


@router.get("/sheets/{sheet_id}/second-voice", response_model=None)
def list_analyses(
    sheet_id: _uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict | JSONResponse:
    """Newest-first per-song history (FR-006); Postgres only, zero providers."""
    with session_scope() as session:
        sheet = session.get(SongSheet, sheet_id)
        if sheet is None:
            return _error("NOT_FOUND", "Unknown sheet.", 404)
        base = session.query(SecondVoiceAnalysis).filter(SecondVoiceAnalysis.sheet_id == sheet_id)
        total = base.count()
        rows = (
            base.order_by(SecondVoiceAnalysis.created_at.desc()).offset(offset).limit(limit).all()
        )
        return {"analyses": [_wire_summary(row) for row in rows], "total": total}


@router.get("/second-voice/{analysis_id}", response_model=None)
def get_analysis(analysis_id: _uuid.UUID) -> dict | JSONResponse:
    """Re-open a stored analysis (FR-006); ZERO provider re-querying (FR-013)."""
    with session_scope() as session:
        row = session.get(SecondVoiceAnalysis, analysis_id)
        if row is None:
            return _error("NOT_FOUND", "Unknown analysis.", 404)
        return {"analysis": _wire_analysis(row)}


@router.delete("/second-voice/{analysis_id}", status_code=204, response_model=None)
def delete_analysis(analysis_id: _uuid.UUID) -> Response | JSONResponse:
    """Delete one analysis row (FR-007); sheet + siblings untouched."""
    with session_scope() as session:
        row = session.get(SecondVoiceAnalysis, analysis_id)
        if row is None:
            return _error("NOT_FOUND", "Unknown analysis.", 404)
        session.delete(row)
    return Response(status_code=204)
