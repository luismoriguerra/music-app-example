"""R0 sheet-generation orchestration (T035, 004)."""

from __future__ import annotations

import time as _time
from collections.abc import Callable
from typing import Any

from agents.sheets.charts import ChartError, pick_best
from agents.sheets.enrich import SEARCH_MIN_S, STAGE_TIMEOUT_S, make_degraded_entry
from agents.sheets.enrich.context_free import fetch as fetch_context_free
from agents.sheets.enrich.links_free import discover as discover_links_free
from agents.sheets.fallback import SkipModel
from agents.sheets.lyrics import LyricsError, LyricsMiss
from agents.sheets.normalize import (
    extract_capo,
    extract_tuning_note,
    parse_chart_to_body,
    plain_lyrics_to_body,
    validate_body,
)
from agents.sheets.sources import assemble_source_links, page_links_for


class NoMatch(RuntimeError):  # noqa: N818
    """No lyrics or charts found (maps to NO_MATCH 404)."""


class ProviderFailure(RuntimeError):  # noqa: N818
    """Upstream failed after fallbacks (maps to PROVIDER_ERROR 502)."""


def _owner() -> str:
    try:
        from db_models import owner_id as _oid

        return _oid()
    except Exception:
        import os

        return os.getenv("OWNER_ID", "owner")


def _total_chords(body: dict[str, Any]) -> int:
    return sum(
        len(line.get("chords", [])) for s in body.get("sections", []) for line in s.get("lines", [])
    )


def _drop_empty_sections(body: dict[str, Any]) -> dict[str, Any]:
    sections = [s for s in body.get("sections", []) if s.get("lines")]
    return {"sections": sections}


def generate_sheet(
    query: str,
    candidate: dict[str, Any],
    *,
    charts: Any,
    lyrics: Any,
    video_links: Callable[[str], tuple[list[dict], dict | None]],
    align: Callable[..., tuple[dict[str, Any], str]],
    persist: Callable[[dict[str, Any], dict[str, Any]], tuple[str, str]],
    deadline_s: float | None = None,
    clock: Callable[[], float] | None = None,
) -> dict[str, Any]:
    now = clock or _time.monotonic
    start = now()
    q = (query or "").strip()
    title = str(candidate.get("title", "") or "").strip()
    artist = str(candidate.get("artist", "") or "").strip()
    refs = dict(candidate.get("provider_refs") or {})

    def _tick() -> None:
        if deadline_s is None:
            return
        try:
            now()
        except IndexError:
            pass

    def _expired() -> bool:
        if deadline_s is None:
            return False
        try:
            return (now() - start) >= deadline_s
        except IndexError:
            return True

    # --- Chart attempt ---
    chart_url: str | None = None
    chart_text: str | None = None
    best = None
    try:
        results = charts.search(title, artist)
    except (ChartError, TimeoutError):
        results = []
    _tick()  # after chart search
    if results:
        best = pick_best(results, artist=artist, title=title)
        if best is not None:
            try:
                chart_text = charts.fetch(best.url)
                chart_url = best.url
            except (ChartError, TimeoutError):
                chart_text = None
                chart_url = None

    lyric_source: str
    lyric_url: str
    chord_source: str
    chord_url: str | None
    model_id: str | None
    body: dict[str, Any]
    capo: str | None = None
    tuning_note: str | None = None
    degraded: list[dict[str, str]] = []

    chart_hit = False
    if chart_text is not None and chart_url is not None:
        try:
            parsed = _drop_empty_sections(parse_chart_to_body(chart_text))
            validate_body(parsed)
        except ValueError:
            parsed = {}
        if parsed and _total_chords(parsed) > 0:
            lyric_source = "chart"
            lyric_url = chart_url
            chord_source = "chart"
            chord_url = chart_url
            model_id = None
            body = parsed
            capo = extract_capo(chart_text)
            tuning_note = extract_tuning_note(chart_text)
            chart_hit = True
            # FR-005 "performer as found": on a hit the whole sheet IS this
            # chart, so attribute its performer/title (pick_best may have
            # fallen back to another artist's chart when the picked one
            # has none, e.g. "Yesterday — Matt Monro" -> The Beatles chart).
            if best is not None:
                if best.artist.strip():
                    artist = best.artist.strip()
                if best.title.strip():
                    title = best.title.strip()

    if not chart_hit:
        if _expired():
            raise ProviderFailure("lyrics stage skipped: deadline expired")
        lrclib_id = refs.get("lrclib_id")
        try:
            got = lyrics.fetch(title, artist, lrclib_id=lrclib_id)
        except LyricsMiss as exc:
            raise NoMatch(str(exc)) from exc
        except TimeoutError as exc:
            raise ProviderFailure(f"lyrics timed out: {exc}") from exc
        except LyricsError as exc:
            raise ProviderFailure(str(exc)) from exc
        if _expired():
            degraded.append({"part": "chords", "reason": "timeout"})
            body = plain_lyrics_to_body(got.text)
            lyric_source = got.source
            lyric_url = got.url
            chord_source = "none"
            chord_url = None
            model_id = None
        else:
            try:
                aligned, mid = align(got.text)
                validate_body(aligned)
            except SkipModel as exc:
                reason = getattr(exc, "reason", None) or str(exc) or "unavailable"
                low = reason.lower()
                if reason not in ("timeout", "unavailable"):
                    reason = (
                        "unavailable"
                        if "unavail" in low
                        else "timeout"
                        if "timeout" in low
                        else "unavailable"
                    )
                degraded.append({"part": "chords", "reason": reason})
                body = plain_lyrics_to_body(got.text)
                lyric_source = got.source
                lyric_url = got.url
                chord_source = "none"
                chord_url = None
                model_id = None
            except TimeoutError:
                degraded.append({"part": "chords", "reason": "timeout"})
                body = plain_lyrics_to_body(got.text)
                lyric_source = got.source
                lyric_url = got.url
                chord_source = "none"
                chord_url = None
                model_id = None
            except ValueError:
                degraded.append({"part": "chords", "reason": "unavailable"})
                body = plain_lyrics_to_body(got.text)
                lyric_source = got.source
                lyric_url = got.url
                chord_source = "none"
                chord_url = None
                model_id = None
            else:
                lyric_source = got.source
                lyric_url = got.url
                chord_source = "model-generated"
                chord_url = None
                model_id = mid
                body = aligned
        _tick()  # after align
    else:
        _tick()
        _tick()
        _tick()

    # --- Sources ---
    video_query = f"{title} {artist}".strip() or q
    video_list: list[dict] = []
    if _expired():
        degraded.append({"part": "video", "reason": "timeout"})
    else:
        try:
            video_list, video_degraded = video_links(video_query)
        except TimeoutError:
            degraded.append({"part": "video", "reason": "timeout"})
            video_list = []
        else:
            if video_degraded:
                degraded.append(
                    {
                        "part": video_degraded.get("part", "video"),
                        "reason": video_degraded.get("reason", "unavailable"),
                    }
                )

    # --- Keyless enrichment (009): links stage. One marker per sheet (FR-008). ---
    def _mark_enrichment(reason: str) -> None:
        if not any(d.get("part") == "enrichment" for d in degraded):
            degraded.append(make_degraded_entry(reason=reason, part="enrichment"))

    def _enrich_budget() -> float:
        """Seconds available to one enrichment stage; <= 0 means skip."""
        if STAGE_TIMEOUT_S <= 0:
            return 0.0
        rem = (start + deadline_s) - now() if deadline_s is not None else STAGE_TIMEOUT_S
        return min(STAGE_TIMEOUT_S, rem)

    lyric_pages_extra: list[dict] = []
    if not video_list:
        if STAGE_TIMEOUT_S <= 0:
            _mark_enrichment("unavailable")
        elif _expired() or _enrich_budget() < SEARCH_MIN_S:
            _mark_enrichment("timeout")
        else:
            extra_pages, extra_videos = discover_links_free(
                title, artist, deadline_s=_enrich_budget()
            )
            if extra_videos:
                video_list = [v.to_dict() for v in extra_videos]
                degraded = [d for d in degraded if d.get("part") != "video"]
            lyric_pages_extra = [p.to_dict() for p in extra_pages]

    lyric_pages, chord_pages = page_links_for(title, artist, refs, chart_url=chart_url)
    if lyric_pages_extra:
        lyric_pages = [*lyric_pages, *lyric_pages_extra]
    attribution = {lyric_url}
    if chord_url:
        attribution.add(chord_url)
    source_links = assemble_source_links(lyric_pages, chord_pages, video_list, attribution)

    # --- Keyless enrichment (009): song context stage (US3, FR-006, DR-002). ---
    context_data: dict[str, str] | None = None
    if STAGE_TIMEOUT_S <= 0:
        _mark_enrichment("unavailable")
    elif _expired() or _enrich_budget() <= 0.5:
        _mark_enrichment("timeout")
    else:
        ctx = fetch_context_free(title, artist, deadline_s=_enrich_budget())
        if ctx:
            context_data = ctx.to_dict()
    owner = _owner()
    provider_refs = dict(refs)
    if chart_url:
        provider_refs.setdefault("chart_url", chart_url)
    sheet_row = {
        "owner_id": owner,
        "query": q,
        "matched_title": title,
        "matched_performer": artist,
        "provider_refs": provider_refs,
        "lyric_source": lyric_source,
        "lyric_source_url": lyric_url,
        "chord_source": chord_source,
        "chord_source_url": chord_url,
        "model_id": model_id,
        "body": body,
        "source_links": source_links,
        "degraded": degraded,
        "context": context_data,
        "capo": capo,
        "tuning_note": tuning_note,
    }
    entry_partial = {
        "owner_id": owner,
        "query": q,
        "matched_title": title,
        "matched_performer": artist,
    }
    sheet_id, entry_id = persist(sheet_row, entry_partial)
    sheet = dict(sheet_row)
    sheet.pop("owner_id", None)
    sheet["id"] = sheet_id
    return {"entry_id": entry_id, "sheet": sheet}
