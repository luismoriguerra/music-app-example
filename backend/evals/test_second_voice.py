"""Agno eval scenarios for the second-voice theory agent (T028, Principle IV).

Behavior regression gates over the factory-built Agent
(`second_voice.build_agent`) on the Appendix A model. Live: run explicitly:

    (infisical run --env=dev --path=/backend -- .venv/bin/pytest evals/test_second_voice.py -v)

Skipped (not failed) without `OPENROUTER_API_KEY`. MUST be 6/6 green before
merge and re-run on any prompt / model / schema change (R6/R11).

Three gates are mechanical (string compare, degree recompute, emptiness
check) — they pin wrong-key theory and invented notes, the failure modes
schemas alone cannot catch. Fixtures are synthetic progressions with known
answers (four major-key, one natural-minor with a harmonic-minor V7) plus a
full-length public-domain lyric sheet (004 F3, 36 lines / 9 sections) that
proves the R7 single-call budget at real size; the suite asserts
consistency and honesty, not elegance.
"""

from __future__ import annotations

import os
import re
import time

import pytest

from agents.second_voice.analyze import (
    MODEL_TIMEOUT_S,
    SecondVoiceOut,
    run_analysis_with_metrics,
)
from evals.test_sheets_fallback import F3 as F3_LYRICS

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY") or not os.getenv("SECOND_VOICE_MODEL_ID"),
    reason="live eval gate: needs OPENROUTER_API_KEY + SECOND_VOICE_MODEL_ID in Infisical dev",
)

NOTE_RE = re.compile(r"^[A-G](?:#{1,2}|b{1,2})?$")

# Harmonization per mode: semitone offset from tonic -> (degree, quality).
# Quality heads: "" = major triad (or dominant 7th on V), "m" = minor, "dim" = diminished.
# Minor keys use the NATURAL minor set (T040): a major V/V7 is non-diatonic.
HARMONIZATION = {
    "major": {
        0: ("I", ""),
        2: ("ii", "m"),
        4: ("iii", "m"),
        5: ("IV", ""),
        7: ("V", ""),
        9: ("vi", "m"),
        11: ("vii°", "dim"),
    },
    "minor": {
        0: ("i", "m"),
        2: ("ii°", "dim"),
        3: ("III", ""),
        5: ("iv", "m"),
        7: ("v", "m"),
        8: ("VI", ""),
        10: ("VII", ""),
    },
}
PITCH = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def _root_pc(symbol: str) -> tuple[int, str]:
    """Parse a chord symbol root into (pitch class, quality head)."""
    match = re.match(r"^([A-G])(#{1,2}|b{1,2})?(.*)$", "".join(symbol.split()))
    assert match is not None, f"unparseable symbol {symbol!r}"
    root, accidental, tail = match.groups()
    pc = PITCH[root]
    if accidental:
        pc += accidental.count("#") - accidental.count("b")
    tail = tail or ""
    if tail.startswith("dim"):
        quality = "dim"
    elif tail.startswith(("m", "min")) and not tail.startswith("maj"):
        quality = "m"
    else:
        quality = ""
    return pc % 12, quality


def _expected_degree(tonic: str, symbol: str, mode: str = "major") -> str | None:
    """Independent degree recompute per mode; None when non-diatonic."""
    tonic_pc, _ = _root_pc(tonic)
    root_pc, quality = _root_pc(symbol)
    entry = HARMONIZATION[mode].get((root_pc - tonic_pc) % 12)
    if entry is None:
        return None
    degree, expected_quality = entry
    if quality != expected_quality:
        return None  # e.g. II instead of ii: not the diatonic chord
    return degree


def _body(lines: list[tuple[str, list[str]]], heading: str = "Verse 1") -> dict:
    """Synthetic stored body: original lyrics + ORIGINAL chords (pre-transpose)."""
    return {
        "sections": [
            {
                "heading": heading,
                "lines": [
                    {
                        "text": text,
                        "chords": [
                            {"offset": i * 10, "symbol": symbol} for i, symbol in enumerate(symbols)
                        ],
                    }
                    for text, symbols in lines
                ],
            }
        ]
    }


def _snapshot(symbols_per_line: list[list[str]]) -> list[dict]:
    return [
        {
            "section": 0,
            "line": li,
            "chords": [{"offset": i * 10, "symbol": symbol} for i, symbol in enumerate(symbols)],
        }
        for li, symbols in enumerate(symbols_per_line)
    ]


def _parse_sections(lyric_text: str) -> list[tuple[str, list[str]]]:
    """Split lyric text into (heading, lyric-lines); blanks are separators."""
    sections: list[tuple[str, list[str]]] = []
    heading: str | None = None
    lines: list[str] = []
    for raw in lyric_text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            if heading is not None:
                sections.append((heading, lines))
            heading = stripped[1:-1]
            lines = []
        else:
            lines.append(stripped)
    if heading is not None:
        sections.append((heading, lines))
    return sections


def _body_multi(sections: list[tuple[str, list[str], list[list[str]]]]) -> dict:
    """Stored body for a multi-section sheet (lyrics + ORIGINAL chords)."""
    return {
        "sections": [
            {
                "heading": heading,
                "lines": [
                    {
                        "text": lyric,
                        "chords": [
                            {"offset": i * 10, "symbol": symbol} for i, symbol in enumerate(symbols)
                        ],
                    }
                    for lyric, symbols in zip(lyrics, chord_grid, strict=True)
                ],
            }
            for heading, lyrics, chord_grid in sections
        ]
    }


def _snapshot_multi(sections: list[list[list[str]]]) -> list[dict]:
    """Flat snapshot with correct (section, line) indexes (DR-001 order)."""
    out: list[dict] = []
    for si, grid in enumerate(sections):
        for li, symbols in enumerate(grid):
            out.append(
                {
                    "section": si,
                    "line": li,
                    "chords": [
                        {"offset": i * 10, "symbol": symbol} for i, symbol in enumerate(symbols)
                    ],
                }
            )
    return out


# Full-length fixture: 004's public-domain F3 lyrics (36 lines / 9 sections)
# with a diatonic C/Am/F/G rotation per line. The 4-6-line synthetics prove
# theory; only this one proves the R7 single-call budget at real sheet size.
_DIATONIC_CYCLE = (("C",), ("Am",), ("F",), ("G",))


def _full_length_fixture() -> tuple[dict, list[dict]]:
    parsed = _parse_sections(F3_LYRICS)
    total = sum(len(lyrics) for _, lyrics in parsed)
    assert total == 36, f"F3 must stay 36 lines, got {total}"
    sections: list[tuple[str, list[str], list[list[str]]]] = []
    grids: list[list[list[str]]] = []
    cursor = 0
    for heading, lyrics in parsed:
        grid: list[list[str]] = []
        for _ in lyrics:
            grid.append(list(_DIATONIC_CYCLE[cursor % len(_DIATONIC_CYCLE)]))
            cursor += 1
        sections.append((heading, lyrics, grid))
        grids.append(grid)
    return _body_multi(sections), _snapshot_multi(grids)


F_FULL_LENGTH = _full_length_fixture()


F_DIATONIC = (
    _body(
        [
            ("Morning light upon the water", ["C"]),
            ("Silver birds are on the wing", ["Am"]),
            ("All the hills are green and golden", ["F"]),
            ("Hear the valley bells ring", ["G"]),
        ]
    ),
    _snapshot([["C"], ["Am"], ["F"], ["G"]]),
)

F_TRANSPOSED = (
    F_DIATONIC[0],  # same stored originals…
    _snapshot([["F"], ["Dm"], ["Bb"], ["C"]]),  # …analyzed at Tr. +5
)

F_NON_DIATONIC = (
    _body(
        [
            ("Morning light upon the water", ["C"]),
            ("Shadows dancing on the wall", ["E7"]),
            ("Silver birds are on the wing", ["Am"]),
            ("Rain is falling soft and gray", ["Fm"]),
            ("Hear the valley bells ring", ["G"]),
            ("Night will come to us all", ["C"]),
        ]
    ),
    _snapshot([["C"], ["E7"], ["Am"], ["Fm"], ["G"], ["C"]]),
)

# Minor key (T040): natural-minor diatonics with the harmonic-minor dominant
# E7 — the exact receipt shape that 502'd on Hallelujah (Em) before T040.
F_MINOR = (
    _body(
        [
            ("Cold wind over the harbor", ["Am"]),
            ("Lanterns swinging in the rain", ["Dm"]),
            ("Every sail is turning homeward", ["E7"]),
            ("Hear the bells again", ["F"]),
            ("Night is closing on the water", ["Am"]),
        ]
    ),
    _snapshot([["Am"], ["Dm"], ["E7"], ["F"], ["Am"]]),
)

FIXTURES = {
    "diatonic": F_DIATONIC,
    "transposed": F_TRANSPOSED,
    "non_diatonic": F_NON_DIATONIC,
    "full_length": F_FULL_LENGTH,
    "minor": F_MINOR,
}


@pytest.fixture(scope="module")
def results() -> dict[str, tuple[SecondVoiceOut, float, dict[str, int]]]:
    """Run each fixture ONCE through the real agent; gates assert over these.

    Token counts come from RunOutput.metrics (T031 budget evidence); the
    per-fixture budget line prints under `pytest -v -s`.
    """
    from agents.second_voice.analyze import build_agent

    model_id = os.getenv("SECOND_VOICE_MODEL_ID")
    assert model_id, "SECOND_VOICE_MODEL_ID must be set (see pytestmark skip)"
    agent = build_agent(model_id=model_id)
    out: dict[str, tuple[SecondVoiceOut, float, dict[str, int]]] = {}
    for name, (body, snapshot) in FIXTURES.items():
        started = time.monotonic()
        analysis, _, metrics = run_analysis_with_metrics(
            snapshot, body, agent=agent, model_id=model_id
        )
        latency = time.monotonic() - started
        out[name] = (SecondVoiceOut.model_validate(analysis), latency, metrics)
        print(
            f"[budget] {name}: {latency:.1f}s "
            f"in={metrics['input_tokens']} out={metrics['output_tokens']} "
            f"total={metrics['total_tokens']}"
        )
    return out


def _flat_snapshot(snapshot: list[dict]) -> list[str]:
    return [c["symbol"] for line in snapshot for c in line["chords"]]


def _flat_progression(out: SecondVoiceOut) -> list[str]:
    return [c for row in out.progression for c in row.chords]


def test_transpose_respected(results: dict) -> None:
    """Transposed input is what gets analyzed (string compare).

    Synthetics assert exact ordered equality — that is where the transpose
    signal lives (transposed F/Dm/Bb/C vs stored C/Am/F/G). full_length
    (36 lines / 9 identical I–vi–IV–V sections) asserts set equality +
    non-empty: models legitimately collapse identical sections into summary
    rows ("Verses 1–5: I–vi–IV–V"), so ordered-length equality would fail on
    enumeration granularity, not transposition. full_length runs at Tr. 0
    (stored set == expected set); its job is the R7 budget proof, not the
    transpose proof.
    """
    for name, (out, _, _) in results.items():
        expected = _flat_snapshot(FIXTURES[name][1])
        actual = _flat_progression(out)
        if name == "full_length":
            assert len(out.progression) >= 1, f"{name}: empty progression"
            assert set(actual) == set(expected), (
                f"{name}: progression set drifted {sorted(set(actual))} != {sorted(set(expected))}"
            )
        else:
            assert actual == expected, f"{name}: progression drifted"


def test_degrees_consistent(results: dict) -> None:
    """Diatonic degrees match an independent harmonization recompute.

    Major fixtures are fully diatonic (every chord must recompute). The
    minor fixture carries E7, non-diatonic by construction in natural minor,
    so its rows are checked only where the recompute has an answer; E7 is
    asserted in test_non_diatonic_flagged instead.
    """
    for name in ("diatonic", "transposed", "full_length", "minor"):
        out, _, _ = results[name]
        assert out.key.mode == ("minor" if name == "minor" else "major"), name
        for row in out.progression:
            for symbol, degree in zip(row.chords, row.degrees, strict=True):
                expected = _expected_degree(out.key.tonic, symbol, out.key.mode)
                if expected is None:
                    assert name == "minor", f"{name}: {symbol} should be diatonic"
                    continue
                normalized = degree.rstrip("7")  # V7 labels as V
                assert normalized == expected, f"{name}: {symbol} -> {degree}"
    minor, _, _ = results["minor"]
    assert minor.key.tonic == "A", f"minor: tonic {minor.key.tonic!r} (expected bare A)"


def test_non_diatonic_flagged(results: dict) -> None:
    """Secondary dominant + modal borrowing land in special_chords; in a
    minor key the harmonic-minor dominant is flagged, never listed as V."""
    out, _, _ = results["non_diatonic"]
    flagged = {entry.chord: entry.function for entry in out.special_chords}
    assert "E7" in flagged and flagged["E7"].strip(), "V7/vi missing"
    assert "Fm" in flagged and flagged["Fm"].strip(), "borrowed iv missing"
    minor, _, _ = results["minor"]
    flagged = {entry.chord: entry.function for entry in minor.special_chords}
    assert "E7" in flagged and flagged["E7"].strip(), "minor: harmonic-minor V7 missing"


def test_no_invented_melody(results: dict) -> None:
    """CRITICAL: no-melody fixtures yield strategy only, zero pitches."""
    for name, (out, _, _) in results.items():
        assert out.second_voice.melody_status == "missing", name
        assert out.second_voice.up is None, name
        assert out.second_voice.down is None, name
        assert out.second_voice.recommendation is None, name
        pitched = [r for r in out.note_table if r.second_voice is not None]
        assert pitched == [], f"{name}: invented pitches {pitched}"


def test_english_format_complete(results: dict) -> None:
    """Schema-valid, all sections present, Anglo names throughout, concise."""
    for name, (out, _, _) in results.items():
        assert len(out.diatonic_chords) == 7, name
        assert len(out.progression) >= 1, name
        assert len(out.section_feel) >= 1, name
        assert len(out.note_table) >= 1, name
        assert 1 <= len(out.singing_tips) <= 5, name
        assert out.second_voice.strategy.strip(), name
        # Concise caps (user: analysis too long): Pydantic enforces these,
        # the asserts below document the gist-not-essay contract per gate.
        assert len(out.key.justification) <= 600, name
        assert len(out.note_table) <= 60, name
        assert all(len(t) <= 320 for t in out.singing_tips), name
        assert all(len(e.feeling) <= 480 for e in out.section_feel), name
        for note in [out.key.tonic, *out.scale]:
            assert NOTE_RE.match(note), f"{name}: {note!r} not Anglo"
        for row in out.note_table:
            assert len(row.lyric_snippet) <= 120, name
            assert row.explanation.strip(), name
            assert len(row.explanation) <= 480, name


def test_latency_within_budget(results: dict) -> None:
    """Each analysis fits the 45 s inference budget (+harness slack)."""
    for name, (_, latency, _) in results.items():
        assert latency <= MODEL_TIMEOUT_S + 5, f"{name}: {latency:.1f}s"
