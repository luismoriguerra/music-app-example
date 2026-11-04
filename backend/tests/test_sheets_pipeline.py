"""Pipeline tests (T023): R0 orchestration, no cross-source merging.

Principle III: defines the `agents.sheets.pipeline` API before T035 —
generate_sheet(query, candidate, charts=, lyrics=, video_links=, align=,
persist=, deadline_s=, clock=). Clients are duck-typed seams (real
clients land in T031/T032/T034); `align` is fallback.align
(SkipModel→lyrics-only stub in T035, real Agno Agent in T036);
`persist(sheet_row, entry_partial)` -> (sheet_id, entry_id).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

import pytest

from agents.sheets.charts import ChartError, ChartResult
from agents.sheets.fallback import SkipModel
from agents.sheets.lyrics import LyricResult, LyricsError, LyricsMiss
from agents.sheets.pipeline import NoMatch, ProviderFailure, generate_sheet

CHART_TEXT = """[Verse 1]
Am      G       C
I was scared of dentists and the dark

[Chorus]
Am      G       C
Lady, runnin' down to the riptide

Capo: 2
"""

LYRIC_TEXT = "I was scared of dentists and the dark\nLady, runnin' down to the riptide"

TAB_URL = "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-ukulele-1"

CANDIDATE = {
    "title": "Riptide",
    "artist": "Vance Joy",
    "album": None,
    "artwork_url": None,
    "provider_refs": {"lrclib_id": 969429},
}


def _chart_results() -> list:
    return [
        ChartResult("Riptide", "Vance Joy", TAB_URL, 4.89, 1234, "Ukulele Chords"),
        ChartResult("Riptide", "Vance Joy", "https://tabs.ug/c", 4.79, 3456, "Chords"),
    ]


@dataclass
class StubCharts:
    results: list = field(default_factory=list)
    text: str = ""
    search_mode: str = "ok"  # ok | timeout
    fetch_mode: str = "ok"  # ok | error | timeout
    calls: list = field(default_factory=list)

    def search(self, title: str, artist: str):
        self.calls.append(("search", title, artist))
        if self.search_mode == "timeout":
            raise TimeoutError("chart search timed out")
        return list(self.results)

    def fetch(self, url: str):
        self.calls.append(("fetch", url))
        if self.fetch_mode == "error":
            raise ChartError("fetch failed")
        if self.fetch_mode == "timeout":
            raise TimeoutError("chart fetch timed out")
        return self.text


@dataclass
class StubLyrics:
    result: LyricResult | None = None
    mode: str = "ok"  # ok | miss | timeout | error
    calls: list = field(default_factory=list)

    def fetch(self, title: str, artist: str, lrclib_id=None):
        self.calls.append(("fetch", title, artist, lrclib_id))
        if self.mode == "miss":
            raise LyricsMiss("no lyrics")
        if self.mode == "timeout":
            raise TimeoutError("lyrics timed out")
        if self.mode == "error":
            raise LyricsError("lyrics transport down")
        assert self.result is not None
        return self.result


def _lrclib_result() -> LyricResult:
    return LyricResult(LYRIC_TEXT, "lrclib", "https://lrclib.net/api/get/969429")


def _aligned_body() -> dict:
    return {
        "sections": [
            {
                "heading": None,
                "lines": [
                    {
                        "text": "I was scared of dentists and the dark",
                        "chords": [{"offset": 0, "symbol": "Am"}],
                    },
                    {
                        "text": "Lady, runnin' down to the riptide",
                        "chords": [{"offset": 0, "symbol": "G"}],
                    },
                ],
            }
        ]
    }


class _Persist:
    def __init__(self) -> None:
        self.rows: list = []

    def __call__(self, sheet_row: dict, entry_partial: dict):
        self.rows.append((sheet_row, entry_partial))
        return str(uuid.uuid4()), str(uuid.uuid4())


def _video_ok(query: str):
    links = [{"label": "vid", "url": "https://www.youtube.com/watch?v=a", "kind": "video"}]
    return links, None


def _run(charts=None, lyrics=None, video=_video_ok, align=None, persist=None, **kwargs):
    charts = charts if charts is not None else StubCharts()
    lyrics = lyrics if lyrics is not None else StubLyrics(result=_lrclib_result())
    align_calls: list = []

    def _align(text: str, **kw):
        align_calls.append(text)
        if align is None:
            raise AssertionError("align must not run on this path")
        return align(text, **kw)

    persist = persist if persist is not None else _Persist()
    envelope = generate_sheet(
        "Riptide",
        CANDIDATE,
        charts=charts,
        lyrics=lyrics,
        video_links=video,
        align=_align,
        persist=persist,
        **kwargs,
    )
    return envelope, persist, align_calls


def test_chart_hit_attributes_the_charts_performer_not_the_pick() -> None:
    # Live case: learner picks "Yesterday — Matt Monro"; UG only carries the
    # Beatles arrangement, so pick_best falls back to it. The whole sheet
    # (lyrics + chords) IS the Beatles chart — FR-005 "performer as found"
    # means the sheet and its history entry MUST say The Beatles, not Monro.
    beatles = [
        ChartResult("Yesterday", "The Beatles", TAB_URL, 4.9, 12978, "Ukulele Chords"),
    ]
    charts = StubCharts(results=beatles, text=CHART_TEXT)
    persist = _Persist()
    envelope = generate_sheet(
        "Yesterday",
        {**CANDIDATE, "title": "Yesterday", "artist": "Matt Monro"},
        charts=charts,
        lyrics=StubLyrics(result=_lrclib_result()),
        video_links=_video_ok,
        align=lambda *a, **k: (_ for _ in ()).throw(AssertionError("no align on hit")),
        persist=persist,
    )
    sheet = envelope["sheet"]
    assert sheet["matched_performer"] == "The Beatles"
    assert sheet["matched_title"] == "Yesterday"
    assert sheet["query"] == "Yesterday"  # the learner's query is preserved verbatim
    assert persist.rows[0][1]["matched_performer"] == "The Beatles"


def test_chart_title_mismatch_falls_through_to_lyrics_path() -> None:
    wrong = [ChartResult("Rip Current Blues", "Someone Else", TAB_URL, 4.9, 9000, "Ukulele Chords")]
    charts = StubCharts(results=wrong, text=CHART_TEXT)

    def align(text: str, **kw):
        return _aligned_body(), "openrouter/test-model"

    envelope, _persist, align_calls = _run(charts=charts, align=align)
    sheet = envelope["sheet"]
    assert sheet["chord_source"] == "model-generated"
    assert sheet["matched_title"] == "Riptide"  # pick kept on a chart miss
    assert sheet["matched_performer"] == "Vance Joy"
    assert len(align_calls) == 1


def test_chart_hit_whole_sheet_from_chart() -> None:
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    envelope, persist, align_calls = _run(charts=charts)
    assert align_calls == []
    sheet = envelope["sheet"]
    assert envelope["entry_id"] and sheet["id"]
    assert sheet["query"] == "Riptide"
    assert sheet["matched_title"] == "Riptide"
    assert sheet["matched_performer"] == "Vance Joy"
    assert sheet["lyric_source"] == "chart"
    assert sheet["lyric_source_url"] == TAB_URL
    assert sheet["chord_source"] == "chart"
    assert sheet["chord_source_url"] == TAB_URL
    assert sheet["model_id"] is None
    assert [s["heading"] for s in sheet["body"]["sections"]] == ["Verse 1", "Chorus"]
    assert sheet["body"]["sections"][0]["lines"][0]["chords"][0] == {
        "offset": 0,
        "symbol": "Am",
    }
    assert sheet["capo"] == "2"
    assert sheet["degraded"] == []
    assert len(sheet["source_links"]) <= 8
    assert TAB_URL not in [link["url"] for link in sheet["source_links"]]
    assert len(persist.rows) == 1


def test_chart_hit_skips_lyrics_fetch() -> None:
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    lyrics = StubLyrics(result=_lrclib_result())
    _run(charts=charts, lyrics=lyrics)
    assert lyrics.calls == []


def test_chart_miss_runs_lyrics_plus_fallback() -> None:
    def align(text: str, **kw):
        assert text == LYRIC_TEXT
        return _aligned_body(), "openrouter/test-model"

    envelope, persist, _ = _run(align=align)
    sheet = envelope["sheet"]
    assert sheet["lyric_source"] == "lrclib"
    assert sheet["lyric_source_url"] == "https://lrclib.net/api/get/969429"
    assert sheet["chord_source"] == "model-generated"
    assert sheet["chord_source_url"] is None
    assert sheet["model_id"] == "openrouter/test-model"
    assert sheet["body"] == _aligned_body()
    assert sheet["degraded"] == []
    assert len(persist.rows) == 1


def test_lyrics_miss_everywhere_is_no_match_no_rows() -> None:
    persist = _Persist()
    with pytest.raises(NoMatch):
        _run(lyrics=StubLyrics(mode="miss"), persist=persist)
    assert persist.rows == []


def test_chart_fetch_error_falls_through_to_miss_path() -> None:
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT, fetch_mode="error")

    def align(text: str, **kw):
        return _aligned_body(), "openrouter/test-model"

    envelope, _, _ = _run(charts=charts, align=align)
    assert envelope["sheet"]["chord_source"] == "model-generated"


def test_chart_search_timeout_continues_down_miss_path() -> None:
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT, search_mode="timeout")

    def align(text: str, **kw):
        return _aligned_body(), "openrouter/test-model"

    envelope, _, _ = _run(charts=charts, align=align)
    assert envelope["sheet"]["chord_source"] == "model-generated"
    assert envelope["sheet"]["degraded"] == []


def test_skip_model_unavailable_yields_lyrics_only() -> None:
    def align(text: str, **kw):
        raise SkipModel("unavailable")

    envelope, persist, _ = _run(align=align)
    sheet = envelope["sheet"]
    assert sheet["chord_source"] == "none"
    assert sheet["chord_source_url"] is None
    assert sheet["model_id"] is None
    for section in sheet["body"]["sections"]:
        for line in section["lines"]:
            assert line["chords"] == []
    assert LYRIC_TEXT.splitlines()[0] in [
        line["text"] for s in sheet["body"]["sections"] for line in s["lines"]
    ]
    assert sheet["degraded"] == [{"part": "chords", "reason": "unavailable"}]
    assert len(persist.rows) == 1  # ready sheet, still persisted


def test_skip_model_timeout_records_timeout_reason() -> None:
    def align(text: str, **kw):
        raise SkipModel("timeout")

    envelope, _, _ = _run(align=align)
    assert envelope["sheet"]["degraded"] == [{"part": "chords", "reason": "timeout"}]


def test_video_timeout_skips_video_pages_intact() -> None:
    def video(query: str):
        raise TimeoutError("video timed out")

    envelope, _, _ = _run(video=video, align=lambda text, **kw: (_aligned_body(), "m"))
    sheet = envelope["sheet"]
    assert all(link["kind"] != "video" for link in sheet["source_links"])
    assert any(link["kind"] == "lyrics" for link in sheet["source_links"])
    assert sheet["degraded"] == [{"part": "video", "reason": "timeout"}]


def test_video_degraded_entry_passes_through() -> None:
    def video(query: str):
        return [], {"part": "video", "reason": "quota"}

    envelope, _, _ = _run(video=video, align=lambda text, **kw: (_aligned_body(), "m"))
    assert envelope["sheet"]["degraded"] == [{"part": "video", "reason": "quota"}]


def test_lyrics_timeout_is_provider_error_no_rows() -> None:
    persist = _Persist()
    with pytest.raises(ProviderFailure):
        _run(lyrics=StubLyrics(mode="timeout"), persist=persist)
    assert persist.rows == []


def test_lyrics_transport_error_is_provider_error() -> None:
    persist = _Persist()
    with pytest.raises(ProviderFailure):
        _run(lyrics=StubLyrics(mode="error"), persist=persist)
    assert persist.rows == []


def test_deadline_expired_before_video_skips_video() -> None:
    ticks = [0.0] * 5 + [1000.0] * 5
    clock = lambda: ticks.pop(0)  # noqa: E731
    video_calls: list = []

    def video(query: str):
        video_calls.append(query)
        return _video_ok(query)

    envelope, _, _ = _run(
        video=video,
        align=lambda text, **kw: (_aligned_body(), "m"),
        deadline_s=25,
        clock=clock,
    )
    assert video_calls == []
    assert envelope["sheet"]["degraded"] == [
        {"part": "video", "reason": "timeout"},
        {"part": "enrichment", "reason": "timeout"},
    ]


def test_persist_receives_owner_stamped_rows() -> None:
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    _, persist, _ = _run(charts=charts)
    sheet_row, entry_partial = persist.rows[0]
    assert sheet_row["owner_id"] == "owner"
    assert entry_partial["owner_id"] == "owner"
    assert entry_partial["query"] == "Riptide"
    assert entry_partial["matched_title"] == "Riptide"
    assert entry_partial["matched_performer"] == "Vance Joy"
    assert "sheet_id" not in entry_partial  # persist assigns the linkage


def test_enrichment_disabled_marks_unavailable_and_skips_calls(monkeypatch) -> None:
    """ENRICH_TIMEOUT_S=0 kill-switch (quickstart step 4): one `unavailable` marker, no calls."""
    import agents.sheets.pipeline as pipeline_mod

    monkeypatch.setattr(pipeline_mod, "STAGE_TIMEOUT_S", 0.0)
    monkeypatch.setattr(pipeline_mod, "discover_links_free", lambda *a, **kw: _boom())
    monkeypatch.setattr(pipeline_mod, "fetch_context_free", lambda *a, **kw: _boom())
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    envelope, _, _ = _run(charts=charts, video=lambda q: ([], None))
    assert envelope["sheet"]["degraded"] == [{"part": "enrichment", "reason": "unavailable"}]
    assert envelope["sheet"]["context"] is None


def test_budget_below_search_floor_marks_links_timeout(monkeypatch) -> None:
    """FR-008: with < 1 s the links search can't run; that is a `timeout`, not a silent empty."""
    import agents.sheets.pipeline as pipeline_mod

    monkeypatch.setattr(pipeline_mod, "STAGE_TIMEOUT_S", 0.8)
    monkeypatch.setattr(pipeline_mod, "discover_links_free", lambda *a, **kw: _boom())
    monkeypatch.setattr(pipeline_mod, "fetch_context_free", lambda *a, **kw: None)
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    envelope, _, _ = _run(charts=charts, video=lambda q: ([], None))
    assert {"part": "enrichment", "reason": "timeout"} in envelope["sheet"]["degraded"]


def test_keyless_video_gap_filled_by_enrichment_and_context_persisted(monkeypatch) -> None:
    """FR-004/FR-006: enriched video replaces the video-degraded marker; context stored."""
    import agents.sheets.pipeline as pipeline_mod
    from agents.sheets.enrich import EnrichedLink, SongContext

    monkeypatch.setattr(
        pipeline_mod,
        "discover_links_free",
        lambda *a, **kw: (
            [],
            [EnrichedLink("Riptide - Vance Joy", "https://www.youtube.com/watch?v=x", "video")],
        ),
    )
    monkeypatch.setattr(
        pipeline_mod,
        "fetch_context_free",
        lambda *a, **kw: SongContext(
            "Riptide is a song.", "wikipedia", "https://en.wikipedia.org/w"
        ),
    )
    charts = StubCharts(results=_chart_results(), text=CHART_TEXT)
    envelope, _, _ = _run(charts=charts, video=lambda q: ([], {"part": "video", "reason": "quota"}))
    sheet = envelope["sheet"]
    assert sheet["degraded"] == []
    assert [x["url"] for x in sheet["source_links"] if x["kind"] == "video"] == [
        "https://www.youtube.com/watch?v=x"
    ]
    assert sheet["context"] == {
        "text": "Riptide is a song.",
        "source": "wikipedia",
        "source_url": "https://en.wikipedia.org/w",
    }


def _boom():
    raise AssertionError("enrichment must not run when disabled")
