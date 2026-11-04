"""Normalize tests (T018): chart/lyrics text → shared body shape.

Principle III: these tests define the `agents.sheets.normalize` API before
T030 implements it — chart/lyrics text → body `sections`/`lines`/`chords`
with `offset` as UTF-16 code-unit index into `text` + `symbol` in standard
Western notation (full FR-013 vocabulary). Semantics mirror db_models
validators (offset 0..width inclusive, non-blank line text).
"""

from __future__ import annotations

import pytest

from agents.sheets.normalize import (
    extract_capo,
    extract_tuning_note,
    is_chord_symbol,
    parse_chart_to_body,
    plain_lyrics_to_body,
    validate_body,
)


@pytest.mark.parametrize(
    "symbol",
    [
        "Am",
        "G",
        "C",
        "D",
        "Em",
        "Dadd9",
        "Em7",
        "Fmaj7",
        "G7",
        "Asus4",
        "Bsus2",
        "A7sus4",
        "A7sus",
        "D9sus4",
        "G13sus4",
        "Bdim",
        "Caug",
        "F#m7b5",
        "Bb",
        "Eb9",
        "C##",
        "Dbb",
        "G/B",
        "Am/G",
        "Cmaj9",
        "Dm6",
        "A+",
        "B°",
        "C#m",
        "F#",
        "Gm7",
        "  Am  ",
    ],
)
def test_is_chord_symbol_accepts_full_fr013_vocabulary(symbol: str) -> None:
    assert is_chord_symbol(symbol)


@pytest.mark.parametrize(
    "symbol",
    ["", "   ", "H", "hello", "yesterday", "Am I", "Riptide", "C major", "N.C.x1"],
)
def test_is_chord_symbol_rejects_non_symbols(symbol: str) -> None:
    assert not is_chord_symbol(symbol)


def test_is_chord_symbol_rejects_non_strings() -> None:
    assert not is_chord_symbol(None)  # type: ignore[arg-type]
    assert not is_chord_symbol(42)  # type: ignore[arg-type]


CHART = """[Verse 1]
Am      G       C
I was scared of dentists and the dark
Am      G       C
I was scared of pretty girls and starting conversations

[Chorus]
Am      G       C
Lady, runnin' down to the riptide
Taken away to the dark side
"""


def test_parse_chart_sections_and_pairing() -> None:
    body = parse_chart_to_body(CHART)
    assert [s["heading"] for s in body["sections"]] == ["Verse 1", "Chorus"]
    verse = body["sections"][0]["lines"]
    assert verse[0]["text"] == "I was scared of dentists and the dark"
    assert verse[0]["chords"] == [
        {"offset": 0, "symbol": "Am"},
        {"offset": 8, "symbol": "G"},
        {"offset": 16, "symbol": "C"},
    ]
    # Lyric line without a chord line above carries zero chords (legal).
    chorus = body["sections"][1]["lines"]
    assert chorus[0]["text"] == "Lady, runnin' down to the riptide"
    assert len(chorus[0]["chords"]) == 3
    assert chorus[1] == {"text": "Taken away to the dark side", "chords": []}


def test_parse_chart_lines_before_first_heading_get_null_heading() -> None:
    body = parse_chart_to_body("Am G C\nJust lyrics here\n")
    assert body["sections"][0]["heading"] is None
    assert body["sections"][0]["lines"][0]["text"] == "Just lyrics here"


def test_parse_chart_heading_preserved_verbatim() -> None:
    body = parse_chart_to_body("[Verse 1: repeat 2x!]\nLa la la\n")
    assert body["sections"][0]["heading"] == "Verse 1: repeat 2x!"


def test_plain_lyrics_blank_lines_split_stanzas_and_headings_are_not_lyrics() -> None:
    body = plain_lyrics_to_body("line one\nline two\n\n\nline three\n\n[Chorus]\nline four\n")
    assert [s["heading"] for s in body["sections"]] == [None, None, "Chorus"]
    assert [[ln["text"] for ln in s["lines"]] for s in body["sections"]] == [
        ["line one", "line two"],
        ["line three"],
        ["line four"],
    ]
    assert all(ln["chords"] == [] for s in body["sections"] for ln in s["lines"])


def test_parse_chart_orphan_chord_line_is_dropped() -> None:
    # v1 rule: a chord line with no lyric line after it is dropped (line text
    # must stay non-blank per data-model rule 1; no invented lyric text).
    body = parse_chart_to_body("[Intro]\nAm G C\n[Verse]\nLa la la\nAm G\n")
    assert body["sections"][0]["lines"] == []
    verse_lines = body["sections"][1]["lines"]
    assert verse_lines == [{"text": "La la la", "chords": []}]


def test_parse_chart_offsets_clamped_to_line_width() -> None:
    # Chord columns past the lyric end clamp to the line end (insertion
    # point), never an out-of-range offset.
    body = parse_chart_to_body("Am              G\nHi\n")
    chords = body["sections"][0]["lines"][0]["chords"]
    assert chords[0] == {"offset": 0, "symbol": "Am"}
    assert chords[1]["symbol"] == "G"
    assert chords[1]["offset"] == 2  # clamped to len("Hi")


def test_parse_chart_blank_input_raises() -> None:
    with pytest.raises(ValueError):
        parse_chart_to_body("   \n\n  ")


def test_plain_lyrics_blank_input_raises() -> None:
    with pytest.raises(ValueError):
        plain_lyrics_to_body("\n  \n")


def test_validate_body_accepts_parsed_chart() -> None:
    assert validate_body(parse_chart_to_body(CHART)) is not None


def _line(text, offset, symbol=None):
    chord = {"offset": offset} if symbol is None else {"offset": offset, "symbol": symbol}
    return {"text": text, "chords": [chord]}


def _body(line):
    return {"sections": [{"heading": None, "lines": [line]}]}


def test_validate_body_accepts_utf16_offsets() -> None:
    # "Riptide \U0001f30a": 8 ASCII units + 2-unit emoji = width 10.
    good = _body(_line("Riptide \U0001f30a", 10, "C"))
    assert validate_body(good) is not None
    with pytest.raises(ValueError):
        validate_body(_body(_line("Riptide \U0001f30a", 11, "C")))


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"sections": []},
        {"sections": [{"heading": None, "lines": []}]},
        {"sections": [{"heading": 42, "lines": [{"text": "x", "chords": []}]}]},
        {"sections": [{"heading": None, "lines": [{"text": "  ", "chords": []}]}]},
        {"sections": [{"heading": None, "lines": [{"text": "x"}]}]},
        {"sections": [{"heading": None, "lines": [_line("hey", 4, "C")]}]},
        {"sections": [{"heading": None, "lines": [_line("hey", -1, "C")]}]},
        {"sections": [{"heading": None, "lines": [_line("hey", True, "C")]}]},
        {"sections": [{"heading": None, "lines": [_line("hey", 0, "H")]}]},
        {"sections": [{"heading": None, "lines": [_line("hey", 0)]}]},
    ],
)
def test_validate_body_rejects_malformed(body: object) -> None:
    with pytest.raises(ValueError):
        validate_body(body)


def test_extract_capo() -> None:
    assert extract_capo("[Verse]\nCapo: 2nd fret\nLa\n") == "2nd fret"
    assert extract_capo("CAPO 3\nLa\n") == "3"
    assert extract_capo("Capo: no capo\nLa\n") is None
    assert extract_capo("La la la\n") is None


def test_extract_tuning_note() -> None:
    assert extract_tuning_note("Tuning: GCEA\nLa\n") == "GCEA"
    assert extract_tuning_note("tuning : D G B E\nLa\n") == "D G B E"
    assert extract_tuning_note("La la la\n") is None


def test_parse_chart_seventh_sus_lines_pair() -> None:
    # T043 live find: A7sus4-class symbols must lex, or whole chord lines
    # (and their lyric pairing) are lost — see Wonderwall SC-005 sample.
    body = parse_chart_to_body("Dsus4 A7sus4\nThat they will throw it back\n")
    line = body["sections"][0]["lines"][0]
    assert [c["symbol"] for c in line["chords"]] == ["Dsus4", "A7sus4"]


def test_parse_chart_bar_tokens_are_transparent_to_chords() -> None:
    body = parse_chart_to_body("C Dsus2 | A ||\nAbout you now.\n")
    line = body["sections"][0]["lines"][0]
    assert line["text"] == "About you now."
    assert [c["symbol"] for c in line["chords"]] == ["C", "Dsus2", "A"]


def test_parse_chart_pure_bar_line_is_skipped() -> None:
    body = parse_chart_to_body("Am G\n|: :|\nLa la la\n")
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["La la la"]
    assert [c["symbol"] for c in lines[0]["chords"]] == ["Am", "G"]


def test_parse_chart_tab_staff_and_count_lines_dropped() -> None:
    chart = "[Intro]\nB|----0---|\nG|0---0---|\n1 & 2 & 3 & 4 & 1 & 2 & 3 & 4\nC F\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Hello there"]
    assert [c["symbol"] for c in lines[0]["chords"]] == ["C", "F"]


def test_parse_chart_leading_preamble_notes_dropped() -> None:
    chart = (
        "Tabbed by somebody@example.com\n"
        "Chords in the original key of F\n"
        "[Verse]\nC G\nHello there\n"
    )
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Hello there"]


def test_parse_chart_preamble_paragraph_dropped_whole() -> None:
    # Live UG "Yesterday" chart: a 5-line playing note where only some lines
    # carry a marker. Once a leading chordless block is identified as
    # preamble, the rest of that contiguous prose block is preamble too.
    chart = (
        "Chords in the original key of F. McCartney plays it in G but uses \n"
        "a guitar that is tuned down one full step (D-G-C-F-A-d), that's \n"
        "why the song sounds in the key of F. Transposed +2 to G (the way \n"
        "McCartney played it in the studio and plays it live until today)\n"
        "the song is much easier to play.\n"
        "\n"
        "[Intro]\nF  F \n\n[Verse 1]\nF         Em7\nYesterday, all my troubles\n"
    )
    body = parse_chart_to_body(chart)
    # No headingless preamble section survives; the only lyric line is real.
    assert all(s["heading"] is not None for s in body["sections"])
    texts = [ln["text"] for s in body["sections"] for ln in s["lines"]]
    assert texts == ["Yesterday, all my troubles"]


def test_parse_chart_preamble_latch_resets_on_blank_line() -> None:
    # A blank line ends the prose block: a lyric-looking line after it (and
    # still before any chords) survives, matching the innocuous-line rule.
    chart = "Tabbed by x@y\nsome more notes here\n\nJohn Lennon\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["John Lennon", "Hello there"]


def test_parse_chart_unmarked_preamble_before_first_heading_dropped() -> None:
    # Structural rule: with any [heading] present, chordless text before the
    # first heading is preamble even when no marker regex matches it.
    chart = "Hey all, my first tab - enjoy!\nPlay the intro twice.\n\n[Intro]\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    assert [s["heading"] for s in body["sections"]] == ["Intro"]
    assert [ln["text"] for ln in body["sections"][0]["lines"]] == ["Hello there"]


def test_parse_chart_chorded_lyric_before_first_heading_survives() -> None:
    # A chord line pairs with the text below it even before any heading.
    body = parse_chart_to_body("C G\nOpening line\n[Verse]\nAm\nNext line\n")
    texts = [ln["text"] for s in body["sections"] for ln in s["lines"]]
    assert texts == ["Opening line", "Next line"]


def test_parse_chart_lyrics_do_not_match_preamble() -> None:
    # Guard: ordinary lyric lines survive even before any chords appear.
    body = parse_chart_to_body("Yesterday, all my troubles\nC G\nSeemed so far away\n")
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Yesterday, all my troubles", "Seemed so far away"]
    assert lines[0]["chords"] == []
    assert [c["symbol"] for c in lines[1]["chords"]] == ["C", "G"]


def test_parse_chart_fingering_legends_dropped() -> None:
    chart = "[Verse]\nC x-3-2-0-1-0 G 3-x-0-0-0-3\nxx321x\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Hello there"]
    assert [c["symbol"] for c in lines[0]["chords"]] == ["C", "G"]


def test_parse_chart_prose_with_fret_token_dropped() -> None:
    chart = "All C chords are Cadd9 (x-3-2-0-3-0).\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Hello there"]


def test_parse_chart_separator_and_legend_rows_dropped() -> None:
    chart = "[Chorus]\n*************************\n| h  Hammer-on\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["Hello there"]


def test_parse_chart_bar_prefixed_chord_line_still_pairs() -> None:
    # Precedence: chord lines win over the leading-pipe legend rule.
    body = parse_chart_to_body("| G C\nHello there\n")
    line = body["sections"][0]["lines"][0]
    assert [c["symbol"] for c in line["chords"]] == ["G", "C"]


def test_parse_chart_innocuous_leading_line_does_not_arm_preamble() -> None:
    chart = "John Lennon\nTabbed by x@y\nC G\nHello there\n"
    body = parse_chart_to_body(chart)
    lines = body["sections"][0]["lines"]
    assert [ln["text"] for ln in lines] == ["John Lennon", "Hello there"]


def test_parse_chart_leading_dash_hold_marks_still_chord_lines() -> None:
    # Live chart hold/continuation marks ("G#m -G#m", "-A -B") must still
    # lex as their underlying symbol: previously the whole chord line was
    # dropped, silently hiding tooltips for every chord on it (missing-hover
    # bug, entry cd1fc7bb-28b3-4f53-ad87-2fdae108999b).
    body = parse_chart_to_body("[V]\nG#m -G#m\nThat this old dog\n-A -B\nKicked up\n")
    lines = body["sections"][0]["lines"]
    assert lines[0]["text"] == "That this old dog"
    assert [(c["symbol"], c["offset"]) for c in lines[0]["chords"]] == [
        ("G#m", 0),
        ("G#m", 5),
    ]
    assert lines[1]["text"] == "Kicked up"
    assert [(c["symbol"], c["offset"]) for c in lines[1]["chords"]] == [
        ("A", 1),
        ("B", 4),
    ]


def test_parse_chart_dash_only_tokens_stay_lyrics() -> None:
    # Guard: a lone "-" (or any token that never resolves to a real symbol
    # once its leading dashes are stripped) must not arm chord-line
    # detection, else prose gets mistaken for a chord line.
    body = parse_chart_to_body("[V]\n- oh yeah -\n-hey\nLa la la\n")
    lines = body["sections"][0]["lines"]
    assert lines[0] == {"text": "- oh yeah -", "chords": []}
    assert lines[1] == {"text": "-hey", "chords": []}


def test_parse_chart_trailing_dash_chord_keeps_full_symbol() -> None:
    # Trailing "-" is CHORD_SYMBOL_RE's tail class (jazz minor shorthand,
    # e.g. "C-"), not a hold mark: must not be stripped like a leading one.
    body = parse_chart_to_body("C- G\nHello there\n")
    line = body["sections"][0]["lines"][0]
    assert [(c["symbol"], c["offset"]) for c in line["chords"]] == [
        ("C-", 0),
        ("G", 3),
    ]
