"""Chart/lyrics to shared body shape (T030, 004).

Pure domain: no web imports (Principle VIII). Semantics mirror db_models
validators (offset 0..width inclusive in UTF-16 code units, non-blank
line text, Western-notation symbols).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any


def fold_text(value: str) -> str:
    """Lowercase, strip accents/punctuation: identity + artist-match key."""
    normalized = unicodedata.normalize("NFD", value)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", stripped.lower())


# Standard Western chord vocabulary (FR-013). MUST stay textually identical
# to CHORD_SYMBOL_RE in backend/db_models.py and frontend/src/lib/sheets.ts.
# Tail includes degree sign (diminished shorthand, e.g. B degree) alongside +/()/slash-bass.
CHORD_SYMBOL_RE = re.compile(
    r"^[A-G](?:#{1,2}|b{1,2})?"
    r"(?:m(?!aj)|maj|min|dim|aug|sus|add|\d+(?:sus|add)?)?"
    r"[0-9#A-Gb()+\-/M°]*$"
)

_HEADING_RE = re.compile(r"^\s*\[(.+?)\]\s*$")
_BAR_TOKEN_RE = re.compile(r"^(?:[|:]+|%)$")
_TAB_STAFF_RE = re.compile(r"^[EADGBe]\s*\|")
_COUNT_LINE_RE = re.compile(r"^[\d\s&|/.,-]+$")
_FRET_DASHED_RE = re.compile(r"^[xX0-9](?:-[xX0-9]){3,}$")
_FRET_SOLID_RE = re.compile(r"^(?=.*[xX])[xX0-9]{4,8}$")
_ASTERISK_RUN_RE = re.compile(r"^\*+$")
# Chart-credit/playing-note markers (T043: live charts carry prose preambles
# that must not parse as lyric lines). Matched ONLY on leading chordless
# lines before any musical content, so genuine lyrics are never at risk.
_PREAMBLE_RES = tuple(
    re.compile(pat, re.IGNORECASE)
    for pat in (
        r"tabbed by",
        r"edited by",
        r"transcrib",
        r"@",
        r"transpose",
        r"tuned",
        r"original key",
        r"key of",
        r'^from "',
        r"\(\d{4}\)",
        r"https?://",
        r"www\.",
    )
)
_CAPO_RE = re.compile(r"^\s*capo\s*:?\s*(.+?)\s*$", re.IGNORECASE)
_TUNING_RE = re.compile(r"^\s*tuning\s*:\s*(.+?)\s*$", re.IGNORECASE)
_TOKEN_RE = re.compile(r"\S+")


def is_chord_symbol(symbol: Any) -> bool:
    """True when the value is a standard Western chord symbol (FR-013)."""
    if not isinstance(symbol, str):
        return False
    canonical = "".join(symbol.split())
    return bool(canonical) and CHORD_SYMBOL_RE.match(canonical) is not None


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def _chord_token(tok: str) -> tuple[int, str] | None:
    # Leading dashes are hold/continuation marks (`-A -B`, `G#m -G#m`), not
    # part of the symbol: return (dash count, symbol) so the offset lands on
    # the symbol itself. Trailing `-` stays (CHORD_SYMBOL_RE tail, e.g. C-).
    symbol = tok.lstrip("-")
    if not is_chord_symbol(symbol):
        return None
    return len(tok) - len(symbol), symbol


def _is_chord_line(stripped: str) -> bool:
    # Bar lines / repeat markers (|, ||, |:, :|, %) are transparent: a line
    # whose remaining tokens are all chord symbols is a chord line.
    tokens = [tok for tok in stripped.split() if not _BAR_TOKEN_RE.match(tok)]
    return bool(tokens) and all(_chord_token(tok) is not None for tok in tokens)


def _is_formatting_only(stripped: str) -> bool:
    tokens = stripped.split()
    return bool(tokens) and all(_BAR_TOKEN_RE.match(tok) for tok in tokens)


def _is_tab_fragment(stripped: str) -> bool:
    if _TAB_STAFF_RE.match(stripped):
        return True
    return "&" in stripped and len(stripped) > 8 and _COUNT_LINE_RE.match(stripped) is not None


def _is_fingering_line(stripped: str) -> bool:
    # Chord-shape legends (C x-3-2-0-1-0 / xx321x) and prose carrying a
    # fret token: reference material, never sung lyrics. A lyric line
    # containing a 4+ position fret run is inconceivable.
    return any(
        _FRET_DASHED_RE.match(tok.strip("().,;:")) or _FRET_SOLID_RE.match(tok.strip("().,;:"))
        for tok in stripped.split()
    )


def _is_legend_line(stripped: str) -> bool:
    # Separator runs and tab-legend rows (| h Hammer-on). Caller MUST run
    # this after the chord-line check: bar-prefixed chord lines (| G C)
    # take precedence via _is_chord_line's bar tolerance.
    if _ASTERISK_RUN_RE.match(stripped):
        return True
    return stripped.startswith("|")


def _is_capo_or_tuning(stripped: str) -> bool:
    low = stripped.lower()
    return low.startswith("capo") or low.startswith("tuning")


def parse_chart_to_body(chart_text: str) -> dict[str, Any]:
    """Parse a plain-text chord chart into the shared body shape."""
    if not isinstance(chart_text, str) or not chart_text.strip():
        raise ValueError("chart text must be non-blank")

    sections: list[dict[str, Any]] = [{"heading": None, "lines": []}]
    pending: list[dict[str, Any]] | None = None
    seen_musical = False
    # Preamble paragraph latch: once a leading chordless line matches a
    # preamble marker, the rest of that contiguous prose block is preamble
    # too (live charts wrap playing notes across several lines, only some
    # of which carry a marker). A blank line or any musical content ends it.
    in_preamble = False
    # Structural preamble: when the chart carries any [heading], every
    # chordless text line before the FIRST heading is preamble, no regex
    # needed (charts open with credits / playing notes, never lyrics). The
    # regex + block heuristic below stays for heading-less charts.
    has_headings = any(_HEADING_RE.match(ln.strip()) for ln in chart_text.splitlines())
    seen_heading = False

    for raw in chart_text.splitlines():
        stripped = raw.strip()
        if not stripped:
            in_preamble = False
            continue
        if _is_formatting_only(stripped):
            continue  # transparent: pending chords still attach below
        heading_match = _HEADING_RE.match(raw.strip())
        if heading_match:
            pending = None
            seen_musical = True
            seen_heading = True
            heading = heading_match.group(1).strip()
            if len(sections) == 1 and sections[0]["heading"] is None and not sections[0]["lines"]:
                sections = []
            sections.append({"heading": heading, "lines": []})
            continue
        if _is_capo_or_tuning(stripped):
            pending = None
            continue
        if _is_chord_line(stripped):
            chords: list[dict[str, Any]] = []
            for match in _TOKEN_RE.finditer(raw.rstrip("\n")):
                if _BAR_TOKEN_RE.match(match.group()):
                    continue
                token = _chord_token(match.group())
                if token is None:
                    continue
                lead, symbol = token
                chords.append({"offset": match.start() + lead, "symbol": symbol})
            pending = chords
            seen_musical = True
            continue
        if _is_tab_fragment(stripped) or _is_fingering_line(stripped) or _is_legend_line(stripped):
            continue  # transparent: pending chords still attach below
        text = stripped
        if has_headings and not seen_heading and not pending:
            continue  # structural preamble (before the first heading)
        if not seen_musical:
            if in_preamble or any(rx.search(text) for rx in _PREAMBLE_RES):
                in_preamble = True
                continue
        chords_out: list[dict[str, Any]] = []
        if pending:
            width = len(text)
            for chord in pending:
                offset = chord["offset"]
                if offset > width:
                    offset = width
                chords_out.append({"offset": offset, "symbol": chord["symbol"]})
        sections[-1]["lines"].append({"text": text, "chords": chords_out})
        pending = None
        if chords_out:
            seen_musical = True

    total_lines = sum(len(section["lines"]) for section in sections)
    if total_lines < 1:
        raise ValueError("chart text must carry >=1 lyric line")
    return {"sections": sections}


def split_lyric_sections(lyrics_text: str) -> list[tuple[str | None, list[str]]]:
    """Fetched lyrics -> (heading, lines). The ONE splitter for every
    non-chart body (lyrics-only and model-aligned): `[Heading]` markers open a
    named section; a blank line closes the current one so the next lyric line
    opens a heading-less stanza. Empty sections are dropped, so a heading right
    after a blank never yields a stray. Headings/blanks are never lyric lines,
    so a flat enumerate over the returned lines is stable."""
    out: list[tuple[str | None, list[str]]] = []
    open_section = False
    for raw in lyrics_text.splitlines():
        s = raw.strip()
        if not s:
            open_section = False
            continue
        if s.startswith("[") and s.endswith("]") and len(s) > 2:
            out.append((s[1:-1].strip() or None, []))
            open_section = True
            continue
        if not open_section:
            out.append((None, []))
            open_section = True
        out[-1][1].append(s)
    return [(h, ls) for h, ls in out if ls]


def plain_lyrics_to_body(lyrics_text: str) -> dict[str, Any]:
    """Plain lyrics -> zero-chord body via `split_lyric_sections`."""
    if not isinstance(lyrics_text, str) or not lyrics_text.strip():
        raise ValueError("lyrics text must be non-blank")
    sections = [
        {"heading": h, "lines": [{"text": t, "chords": []} for t in ls]}
        for h, ls in split_lyric_sections(lyrics_text)
    ]
    if not sections:
        raise ValueError("lyrics text must carry >=1 lyric line")
    return {"sections": sections}


def validate_body(body: Any) -> dict[str, Any]:
    """Validate the shared body shape (data-model rule 1); return it."""
    if not isinstance(body, dict) or not isinstance(body.get("sections"), list):
        raise ValueError("body must be {sections: [...]}")
    sections = body["sections"]
    if not sections:
        raise ValueError("body must carry >=1 section")
    line_count = 0
    for section in sections:
        if not isinstance(section, dict) or not isinstance(section.get("lines"), list):
            raise ValueError("body section must be {heading, lines: [...]}")
        heading = section.get("heading")
        if heading is not None and not isinstance(heading, str):
            raise ValueError("body section heading must be a string or null")
        if not section["lines"]:
            raise ValueError("body section must carry >=1 lyric line")
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
                    raise ValueError("body chord offset must be an int >=0")
                if offset > width:
                    raise ValueError(f"body chord offset {offset} exceeds line width {width}")
                if not is_chord_symbol(chord.get("symbol")):
                    raise ValueError(
                        f"symbol {chord.get('symbol')!r} is not standard Western notation"
                    )
            line_count += 1
    if line_count < 1:
        raise ValueError("body must carry >=1 lyric line")
    return body


def extract_capo(chart_text: str) -> str | None:
    """Extract a capo marking (Capo: 2nd fret / CAPO 3) or None."""
    if not isinstance(chart_text, str):
        return None
    for raw in chart_text.splitlines():
        match = _CAPO_RE.match(raw)
        if not match:
            continue
        value = match.group(1).strip()
        if not value or "no capo" in value.lower():
            return None
        return value
    return None


def extract_tuning_note(chart_text: str) -> str | None:
    """Extract a tuning note (Tuning: GCEA) or None."""
    if not isinstance(chart_text, str):
        return None
    for raw in chart_text.splitlines():
        match = _TUNING_RE.match(raw)
        if not match:
            continue
        value = match.group(1).strip()
        return value or None
    return None
