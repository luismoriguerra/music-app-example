"""Snapshot-vs-stored validation (T014, 006, DR-001).

The frontend POSTs the rendered transposed chords (`chords_by_line`) plus
`transpose` for provenance. This module verifies shape (counts, indexes,
offsets in range, FR-013 vocabulary) against the immutable stored sheet
and TRUSTS pitch — the single owner can only mislead themselves.

No lyric text crosses the wire, and no Python transpose code exists: pitch
math lives solely in `frontend/src/lib/chord-diagrams.ts`.
"""

from __future__ import annotations

from typing import Any

from agents.sheets.normalize import is_chord_symbol
from db_models import TRANSPOSE_MAX, TRANSPOSE_MIN


class SnapshotError(ValueError):  # noqa: N818
    """Typed snapshot rejection; the route maps it to 422 VALIDATION_ERROR."""


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def validate_snapshot(payload: Any, stored_body: dict[str, Any]) -> dict[str, Any]:
    """Validate the analyze snapshot; return it normalized.

    Raises SnapshotError on any shape mismatch. Pitch correctness is
    trusted (FR-003); shape correctness is verified.
    """
    if not isinstance(payload, dict):
        raise SnapshotError("snapshot must be {transpose, chords_by_line}")
    transpose = payload.get("transpose")
    if (
        not isinstance(transpose, int)
        or isinstance(transpose, bool)
        or not (TRANSPOSE_MIN <= transpose <= TRANSPOSE_MAX)
    ):
        raise SnapshotError(f"transpose must be an int in {TRANSPOSE_MIN}…{TRANSPOSE_MAX}")

    lines = payload.get("chords_by_line")
    if not isinstance(lines, list):
        raise SnapshotError("chords_by_line must be a list")

    stored_sections = stored_body.get("sections", [])
    expected = sum(len(section.get("lines", [])) for section in stored_sections)
    if len(lines) != expected:
        raise SnapshotError(
            f"snapshot line count ({len(lines)}) does not match stored sheet ({expected})"
        )

    cursor = 0
    normalized: list[dict[str, Any]] = []
    for si, section in enumerate(stored_sections):
        for li, stored_line in enumerate(section.get("lines", [])):
            entry = lines[cursor]
            cursor += 1
            if not isinstance(entry, dict):
                raise SnapshotError(f"snapshot entry {cursor - 1} must be an object")
            if entry.get("section") != si or entry.get("line") != li:
                raise SnapshotError(
                    f"snapshot index mismatch at position {cursor - 1}: "
                    f"expected section {si} line {li}"
                )
            entry_chords = entry.get("chords")
            if not isinstance(entry_chords, list):
                raise SnapshotError("snapshot chords must be a list")
            width = _utf16_len(stored_line.get("text", ""))
            clean: list[dict[str, Any]] = []
            for chord in entry_chords:
                if not isinstance(chord, dict):
                    raise SnapshotError("snapshot chord must be {offset, symbol}")
                offset = chord.get("offset")
                if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
                    raise SnapshotError("snapshot chord offset must be an int ≥0")
                if offset > width:
                    raise SnapshotError(
                        f"snapshot chord offset {offset} exceeds line width {width}"
                    )
                symbol = chord.get("symbol")
                if not is_chord_symbol(symbol):
                    raise SnapshotError(
                        f"snapshot symbol {symbol!r} is not standard Western notation"
                    )
                clean.append({"offset": offset, "symbol": "".join(str(symbol).split())})
            normalized.append({"section": si, "line": li, "chords": clean})
    return {"transpose": transpose, "chords_by_line": normalized}
