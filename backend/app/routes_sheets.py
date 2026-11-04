"""Sheets REST routes: song-search + sheets (T038, 004)."""

from __future__ import annotations

import os
import uuid as _uuid

import httpx
from fastapi import APIRouter, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StrictBool, field_validator
from sqlalchemy import func, or_

from agents.sheets import candidates as candidates_mod
from agents.sheets import fallback as fallback_mod
from agents.sheets.charts import ChartClient
from agents.sheets.lyrics import LyricsClient
from agents.sheets.pipeline import NoMatch, ProviderFailure, generate_sheet
from agents.sheets.sources import fetch_video_links
from db_models import HistoryEntry, SongSheet, owner_id, session_scope

router = APIRouter(prefix="/api/v1")


def _throttle_scale() -> float:
    """Multiplier on provider throttles; 1.0 default, 0 in tests."""
    try:
        return max(0.0, float(os.getenv("PROVIDER_THROTTLE_SCALE", "1")))
    except ValueError:
        return 1.0


def build_http_client() -> httpx.Client:
    """Shared provider HTTP client (monkeypatchable seam for tests)."""
    return httpx.Client(
        timeout=10.0, headers={"User-Agent": "music-app-example/004-lyrics-chords (private hobby)"}
    )


def _trimmed_1_200(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    trimmed = value.strip()
    if not trimmed or len(trimmed) > 200:
        raise ValueError(f"{field} must be 1-200 chars, trimmed")
    return trimmed


class SongSearchRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def _v_query(cls, v: object) -> str:
        return _trimmed_1_200(v, "query")


class ProviderRefs(BaseModel):
    genius_id: int | None = None
    lrclib_id: int | None = None
    duckduckgo: str | None = None

    model_config = {"extra": "allow"}

    @field_validator("genius_id", "lrclib_id")
    @classmethod
    def _v_ids(cls, v: object) -> int | None:
        if v is None:
            return None
        if isinstance(v, bool) or not isinstance(v, int) or v <= 0:
            raise ValueError("provider ref ids must be positive ints")
        return v


class CandidateIn(BaseModel):
    title: str
    artist: str
    album: str | None = None
    artwork_url: str | None = None
    provider_refs: dict

    @field_validator("title")
    @classmethod
    def _v_title(cls, v: object) -> str:
        return _trimmed_1_200(v, "title")

    @field_validator("artist")
    @classmethod
    def _v_artist(cls, v: object) -> str:
        return _trimmed_1_200(v, "artist")

    @field_validator("album", "artwork_url")
    @classmethod
    def _v_nullable(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str) or not v.strip():
            raise ValueError("nullable fields must be null or non-blank")
        return v

    @field_validator("provider_refs")
    @classmethod
    def _v_refs(cls, v: object) -> dict:
        if not isinstance(v, dict) or not v:
            raise ValueError("at least one provider ref must be present")
        # Must carry at least a usable lyric ref (genius/lrclib id) or duckduckgo origin.
        gid = v.get("genius_id")
        lid = v.get("lrclib_id")
        ddg = v.get("duckduckgo")
        ok = False
        for candidate in (gid, lid):
            if isinstance(candidate, int) and not isinstance(candidate, bool) and candidate > 0:
                ok = True
        if isinstance(ddg, str) and ddg.strip():
            ok = True
        if not ok:
            raise ValueError("at least one provider ref must be present")
        return dict(v)


class SheetsRequest(BaseModel):
    query: str
    candidate: CandidateIn

    @field_validator("query")
    @classmethod
    def _v_query(cls, v: object) -> str:
        return _trimmed_1_200(v, "query")


class HistoryPatchRequest(BaseModel):
    favorite: StrictBool


# Lowercase accented letters folded to ASCII for the FR-018 name filter
# (Postgres `translate`, no `unaccent` extension needed). Same map both sides.
_ACCENTED = "áàâäãåéèêëíìîïóòôöõúùûüñçý"
_PLAIN = "aaaaaaeeeeiiiiooooouuuuncy"
_FOLD = str.maketrans(_ACCENTED, _PLAIN)


def _fold_sql(column):  # noqa: ANN001, ANN202 - SQLAlchemy column expression
    return func.translate(func.lower(column), _ACCENTED, _PLAIN)


def _like_pattern(term: str) -> str:
    escaped = term.lower().translate(_FOLD)
    for ch in ("\\", "%", "_"):
        escaped = escaped.replace(ch, "\\" + ch)
    return f"%{escaped}%"


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return _error("VALIDATION_ERROR", "Request validation failed.", 422)


@router.post("/song-search", response_model=None)
def song_search(payload: SongSearchRequest) -> dict | JSONResponse:
    http = build_http_client()
    try:
        token = os.getenv("GENIUS_ACCESS_TOKEN") or None
        try:
            cands = candidates_mod.search(payload.query, genius_token=token, client=http)
        except candidates_mod.CandidatesUnavailableError:
            # Every provider failed and keyless enrichment found nothing: FR-007 error-with-retry.
            return _error("PROVIDER_ERROR", "Song search is temporarily unavailable.", 502)
    finally:
        try:
            http.close()
        except Exception:
            pass
    return {"candidates": cands}


@router.post("/sheets", response_model=None)
def create_sheet(payload: SheetsRequest) -> dict | JSONResponse:
    candidate = {
        "title": payload.candidate.title,
        "artist": payload.candidate.artist,
        "album": payload.candidate.album,
        "artwork_url": payload.candidate.artwork_url,
        "provider_refs": dict(payload.candidate.provider_refs),
    }
    return _run_pipeline(payload.query, candidate)


def _iso_z(value: object) -> str:
    """Format a DB timestamp as ISO-8601 Zulu (wire `created_at`)."""
    text = "" if value is None else str(getattr(value, "isoformat", lambda: value)())
    text = text.replace("+00:00", "Z")
    if "T" in text and not text.endswith("Z"):
        text += "Z"
    return text


def _wire_entry(entry: HistoryEntry) -> dict:
    return {
        "id": str(entry.id),
        "query": entry.query,
        "matched_title": entry.matched_title,
        "matched_performer": entry.matched_performer,
        "sheet_id": str(entry.sheet_id),
        "favorite": bool(entry.favorite),
        "created_at": _iso_z(entry.created_at),
    }


def _wire_sheet_row(row: SongSheet) -> dict:
    """Wire subset of a stored sheet (no owner_id/provider_refs on the wire)."""
    return {
        "id": str(row.id),
        "query": row.query,
        "matched_title": row.matched_title,
        "matched_performer": row.matched_performer,
        "lyric_source": row.lyric_source,
        "lyric_source_url": row.lyric_source_url,
        "chord_source": row.chord_source,
        "chord_source_url": row.chord_source_url,
        "model_id": row.model_id,
        "body": row.body,
        "source_links": row.source_links,
        "degraded": row.degraded,
        "context": row.context,
        "capo": row.capo,
        "tuning_note": row.tuning_note,
        "created_at": _iso_z(row.created_at),
    }


def _run_pipeline(query: str, candidate: dict) -> dict | JSONResponse:
    """Shared R0 run for POST /sheets + POST regenerate (T038/T047)."""
    http = build_http_client()
    try:
        # Polite provider clients (R8 ToS mitigation; T031 1-2 s UG gaps,
        # T020 200-500 ms LRCLIB throttle). 2-3 UG calls at 1.5 s fit the
        # 25 s budget. PROVIDER_THROTTLE_SCALE=0 (tests only) disables.
        scale = _throttle_scale()
        charts = ChartClient(client=http, throttle_s=1.5 * scale)
        lyrics = LyricsClient(client=http, throttle_s=0.3 * scale)
        youtube_key = os.getenv("YOUTUBE_API_KEY") or None

        def _video(q: str) -> tuple[list[dict], dict | None]:
            return fetch_video_links(q, api_key=youtube_key, client=http)

        def _align(text: str, **kw: object) -> tuple[dict, str]:
            return fallback_mod.align(text, **kw)

        def _persist(sheet_row: dict, entry_partial: dict) -> tuple[str, str]:
            with session_scope() as session:
                sheet = SongSheet(
                    owner_id=sheet_row["owner_id"],
                    query=sheet_row["query"],
                    matched_title=sheet_row["matched_title"],
                    matched_performer=sheet_row["matched_performer"],
                    provider_refs=sheet_row["provider_refs"],
                    lyric_source=sheet_row["lyric_source"],
                    lyric_source_url=sheet_row["lyric_source_url"],
                    chord_source=sheet_row["chord_source"],
                    chord_source_url=sheet_row["chord_source_url"],
                    model_id=sheet_row["model_id"],
                    body=sheet_row["body"],
                    source_links=sheet_row["source_links"],
                    degraded=sheet_row["degraded"],
                    context=sheet_row.get("context"),
                    capo=sheet_row["capo"],
                    tuning_note=sheet_row["tuning_note"],
                )
                session.add(sheet)
                session.flush()
                sheet_id = str(sheet.id)
                entry = HistoryEntry(
                    owner_id=entry_partial["owner_id"],
                    query=entry_partial["query"],
                    matched_title=entry_partial["matched_title"],
                    matched_performer=entry_partial["matched_performer"],
                    sheet_id=sheet.id,
                )
                session.add(entry)
                session.flush()
                return sheet_id, str(entry.id)

        try:
            envelope = generate_sheet(
                query,
                candidate,
                charts=charts,
                lyrics=lyrics,
                video_links=_video,
                align=_align,
                persist=_persist,
                deadline_s=25,
            )
        except NoMatch as exc:
            return _error("NO_MATCH", str(exc) or "No songs matched.", 404)
        except ProviderFailure as exc:
            return _error("PROVIDER_ERROR", str(exc) or "Upstream song service failed.", 502)
        except (TimeoutError, httpx.TransportError) as exc:
            return _error("PROVIDER_ERROR", f"Upstream song service failed: {exc}", 502)

        # Attach the DB timestamp for the wire envelope (pipeline is clock-free).
        sheet_id = envelope["sheet"]["id"]
        created_at = ""
        with session_scope() as session:
            row = session.get(SongSheet, _uuid.UUID(str(sheet_id)))
            if row is not None and row.created_at is not None:
                created_at = row.created_at.isoformat().replace("+00:00", "Z")
                if not created_at.endswith("Z"):
                    created_at = f"{created_at}Z" if "T" in created_at else created_at
        sheet = dict(envelope["sheet"])
        sheet.pop("provider_refs", None)
        sheet.pop("owner_id", None)
        sheet["created_at"] = created_at
        return {"entry_id": envelope["entry_id"], "sheet": sheet}
    finally:
        try:
            http.close()
        except Exception:
            pass


@router.get("/history")
def list_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=200),
    favorite: bool | None = Query(default=None),
) -> dict:
    """Newest-first history page (FR-009/018); Postgres only, zero providers.

    `q` filters by name (query/title/performer, case- and accent-insensitive);
    `favorite=true` lists favorites only. `total` counts the filtered set.
    """
    with session_scope() as session:
        base = session.query(HistoryEntry).filter(HistoryEntry.owner_id == owner_id())
        if favorite is not None:
            base = base.filter(HistoryEntry.favorite.is_(favorite))
        term = (q or "").strip()
        if term:
            pattern = _like_pattern(term)
            base = base.filter(
                or_(
                    *(
                        _fold_sql(col).like(pattern, escape="\\")
                        for col in (
                            HistoryEntry.query,
                            HistoryEntry.matched_title,
                            HistoryEntry.matched_performer,
                        )
                    )
                )
            )
        total = base.count()
        rows = base.order_by(HistoryEntry.created_at.desc()).offset(offset).limit(limit).all()
        return {"entries": [_wire_entry(row) for row in rows], "total": total}


@router.patch("/history/{entry_id}", response_model=None)
def patch_history_entry(entry_id: _uuid.UUID, body: HistoryPatchRequest) -> dict | JSONResponse:
    """Mark/unmark a favorite (FR-018): the only UPDATE path (data-model rule 7)."""
    with session_scope() as session:
        entry = session.get(HistoryEntry, entry_id)
        if entry is None or entry.owner_id != owner_id():
            return _error("NOT_FOUND", "Unknown history entry.", 404)
        entry.favorite = body.favorite
        session.flush()
        return _wire_entry(entry)


@router.get("/history/{entry_id}", response_model=None)
def get_history_entry(entry_id: _uuid.UUID) -> dict | JSONResponse:
    """Re-open a stored sheet (FR-009); ZERO provider re-querying (R7)."""
    with session_scope() as session:
        entry = session.get(HistoryEntry, entry_id)
        if entry is None:
            return _error("NOT_FOUND", "Unknown history entry.", 404)
        sheet = session.get(SongSheet, entry.sheet_id)

        if sheet is None:  # dangling sheet_id = DB corruption only (FK RESTRICT)
            return _error("NOT_FOUND", "Stored sheet is missing.", 404)
        return {
            "entry_id": str(entry.id),
            "favorite": bool(entry.favorite),
            "sheet": _wire_sheet_row(sheet),
        }


@router.post("/history/{entry_id}/regenerate", response_model=None)
def regenerate_history_entry(entry_id: _uuid.UUID) -> dict | JSONResponse:
    """Fresh sheet for a stored entry (FR-010): full R0 re-run (H4).

    The ONLY history op that queries providers (R7). Inserts a NEW sheet +
    NEW entry (append-only, data-model rule 7); the prior entry is untouched.
    """
    with session_scope() as session:
        entry = session.get(HistoryEntry, entry_id)
        if entry is None:
            return _error("NOT_FOUND", "Unknown history entry.", 404)
        sheet = session.get(SongSheet, entry.sheet_id)
        if sheet is None:
            return _error("NOT_FOUND", "Stored sheet is missing.", 404)
        query = entry.query
        candidate = {
            "title": entry.matched_title,
            "artist": entry.matched_performer,
            "album": None,
            "artwork_url": None,
            "provider_refs": dict(sheet.provider_refs),
        }
    return _run_pipeline(query, candidate)


@router.delete("/history/{entry_id}", status_code=204, response_model=None)
def delete_history_entry(entry_id: _uuid.UUID) -> Response | JSONResponse:
    """Delete a history entry + its orphaned sheet (FR-009).

    Removes the entry first (FK RESTRICT on sheet_id), then the sheet it
    pointed at when no other entry references it (1:1 in v1, so normally
    always). Postgres only, zero providers (R7).
    """
    with session_scope() as session:
        entry = session.get(HistoryEntry, entry_id)
        if entry is None:
            return _error("NOT_FOUND", "Unknown history entry.", 404)
        sheet_id = entry.sheet_id
        session.delete(entry)
        session.flush()
        refs = session.query(HistoryEntry).filter(HistoryEntry.sheet_id == sheet_id).count()
        if refs == 0:
            sheet = session.get(SongSheet, sheet_id)
            if sheet is not None:
                session.delete(sheet)
    return Response(status_code=204)
