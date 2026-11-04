"""Fallback tests (T036): Agno Agent factory + align() contract.

Principle III: defines the `agents.sheets.fallback` API — `build_agent()`
returns a real Agno Agent on the Appendix A model with a chords-only
output schema (no bare SDK calls); `align(lyrics)` zips the model's
per-line chords onto the fetched lyrics and returns `(body_dict,
model_id)`; the model never sees a way to rewrite lyrics. Degrades via
SkipModel, never a hard error. Unit tests inject a stub agent — no
network; live behaviour is gated in `evals/`.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from agents.sheets import fallback
from agents.sheets.fallback import (
    MODEL_ID,
    ChordAt,
    ChordsOut,
    LineChords,
    SkipModel,
    align,
    build_agent,
    number_lyrics,
)

LYRICS = """[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

[Chorus]
Swing low, sweet chariot"""


def _out(*lines: tuple[int, list[tuple[int, str]]]) -> ChordsOut:
    return ChordsOut(
        lines=[
            LineChords(line=i, chords=[ChordAt(offset=o, symbol=s) for o, s in cs])
            for i, cs in lines
        ]
    )


@dataclass
class _Run:
    content: object


class _StubAgent:
    def __init__(self, result: object = None, exc: BaseException | None = None) -> None:
        self.result, self.exc, self.calls = result, exc, []

    def run(self, input: str, **kw: object) -> _Run:  # noqa: A002 - Agno's name
        self.calls.append(input)
        if self.exc:
            raise self.exc
        return _Run(self.result)


def test_build_agent_is_agno_agent_on_appendix_a_model(monkeypatch: pytest.MonkeyPatch) -> None:
    from agno.agent import Agent
    from agno.models.openrouter import OpenRouter

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    agent = build_agent()
    assert isinstance(agent, Agent)
    assert isinstance(agent.model, OpenRouter)
    assert agent.model.id == MODEL_ID == "openai/gpt-5.6-luna"
    assert agent.model.max_tokens == 4000  # Agno default 1024 truncates real songs
    assert agent.model.reasoning_effort == "none"
    assert agent.output_schema is ChordsOut


def test_build_agent_without_key_skips_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(SkipModel) as exc:
        build_agent()
    assert exc.value.reason == "unavailable"


def test_number_lyrics_indexes_lyric_lines_only() -> None:
    assert number_lyrics(LYRICS) == (
        "0: Amazing grace how sweet the sound\n"
        "1: That saved a wretch like me\n"
        "2: Swing low, sweet chariot"
    )


def test_align_blank_lines_split_unheaded_stanzas_indices_flat() -> None:
    # Chart-miss lyrics are mostly heading-less; blank lines must survive as
    # stanza breaks (heading None) while the model still sees one flat index.
    lyrics = "line a\nline b\n\n\nline c\n\n[Bridge]\nline d\n"
    assert number_lyrics(lyrics) == "0: line a\n1: line b\n2: line c\n3: line d"
    agent = _StubAgent(_out((2, [(0, "Am")]), (3, [(0, "F")])))
    body, _ = align(lyrics, agent=agent)
    assert [s["heading"] for s in body["sections"]] == [None, None, "Bridge"]
    assert [[ln["text"] for ln in s["lines"]] for s in body["sections"]] == [
        ["line a", "line b"],
        ["line c"],
        ["line d"],
    ]
    assert body["sections"][1]["lines"][0]["chords"] == [{"offset": 0, "symbol": "Am"}]
    assert body["sections"][2]["lines"][0]["chords"] == [{"offset": 0, "symbol": "F"}]


def test_align_zips_chords_onto_fetched_lyrics_keeping_sections() -> None:
    agent = _StubAgent(
        _out((0, [(23, "D7"), (0, "G"), (8, "C")]), (1, [(0, "G7")]), (2, [(0, "C")]))
    )
    body, mid = align(LYRICS, agent=agent)
    assert mid == MODEL_ID
    assert agent.calls == [number_lyrics(LYRICS)]  # model sees numbered lines, never returns text
    assert [s["heading"] for s in body["sections"]] == ["Verse 1", "Chorus"]
    v1 = body["sections"][0]["lines"]
    assert v1[0]["text"] == "Amazing grace how sweet the sound"
    assert v1[0]["chords"] == [  # sorted by offset
        {"offset": 0, "symbol": "G"},
        {"offset": 8, "symbol": "C"},
        {"offset": 23, "symbol": "D7"},
    ]
    assert v1[1]["chords"] == [{"offset": 0, "symbol": "G7"}]
    assert body["sections"][1]["lines"][0]["chords"] == [{"offset": 0, "symbol": "C"}]


def test_align_lyrics_are_untouched_by_construction() -> None:
    # The wire shape carries no text: whatever the model does, lyrics are ours.
    agent = _StubAgent(_out((0, [(0, "G")])))
    body, _ = align(LYRICS, agent=agent)
    got = [ln["text"] for s in body["sections"] for ln in s["lines"]]
    assert got == [
        "Amazing grace how sweet the sound",
        "That saved a wretch like me",
        "Swing low, sweet chariot",
    ]


def test_align_clamps_past_end_offsets_like_the_chart_parser() -> None:
    # Appendix A GLM failure: `offset 38 > width 37` — an end-of-line chord.
    # Chart parser precedent (normalize.py) clamps to width; keep the chord.
    agent = _StubAgent(_out((0, [(0, "G"), (99, "C")]), (1, [(3, "hello"), (10, "Em7")])))
    body, _ = align(LYRICS, agent=agent)
    lines = [ln for s in body["sections"] for ln in s["lines"]]
    assert lines[0]["chords"] == [{"offset": 0, "symbol": "G"}, {"offset": 33, "symbol": "C"}]
    assert lines[1]["chords"] == [{"offset": 10, "symbol": "Em7"}]  # non-FR-013 symbol dropped


def test_align_ignores_unknown_line_indexes_and_duplicates() -> None:
    agent = _StubAgent(
        _out((0, [(0, "G")]), (0, [(5, "C")]), (7, [(0, "Am")]), (-1 + 3, [(0, "F")]))
    )
    body, _ = align(LYRICS, agent=agent)
    lines = [ln for s in body["sections"] for ln in s["lines"]]
    assert lines[0]["chords"] == [
        {"offset": 0, "symbol": "G"},
        {"offset": 5, "symbol": "C"},
    ]  # merged
    assert lines[1]["chords"] == []
    assert lines[2]["chords"] == [{"offset": 0, "symbol": "F"}]


def test_align_no_chords_at_all_skips() -> None:
    agent = _StubAgent(_out((0, []), (1, [])))
    with pytest.raises(SkipModel):
        align(LYRICS, agent=agent)


def test_align_non_schema_content_skips() -> None:
    agent = _StubAgent("not a ChordsOut")
    with pytest.raises(SkipModel) as exc:
        align(LYRICS, agent=agent)
    assert exc.value.reason == "unavailable"


def test_align_timeout_maps_to_timeout_reason() -> None:
    agent = _StubAgent(exc=TimeoutError("slow"))
    with pytest.raises(SkipModel) as exc:
        align(LYRICS, agent=agent)
    assert exc.value.reason == "timeout"


def test_align_provider_error_maps_to_unavailable() -> None:
    agent = _StubAgent(exc=RuntimeError("502 from upstream"))
    with pytest.raises(SkipModel) as exc:
        align(LYRICS, agent=agent)
    assert exc.value.reason == "unavailable"


def test_align_builds_agent_lazily_only_when_called(monkeypatch: pytest.MonkeyPatch) -> None:
    built: list = []

    def fake_build(**kw: object) -> _StubAgent:
        built.append(kw)
        return _StubAgent(_out((0, [(0, "G")])))

    monkeypatch.setattr(fallback, "build_agent", fake_build)
    align(LYRICS)
    assert len(built) == 1
