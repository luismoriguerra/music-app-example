"""Snapshot-validation tests (T010, 006, DR-001).

The frontend POSTs the rendered transposed chords; the backend verifies
shape/count/vocabulary against the immutable stored sheet and trusts pitch
(single-owner). No Python transpose code exists anywhere.
"""

from __future__ import annotations

from typing import Any

import pytest

from agents.second_voice.validate import SnapshotError, validate_snapshot


def stored_body() -> dict[str, Any]:
    return {
        "sections": [
            {
                "heading": "Verse 1",
                "lines": [
                    {
                        "text": "I've heard there was a secret chord",
                        "chords": [
                            {"offset": 0, "symbol": "C"},
                            {"offset": 11, "symbol": "Am"},
                        ],
                    },
                    {"text": "That David played", "chords": []},
                ],
            },
            {
                "heading": None,
                "lines": [
                    {
                        "text": "Hallelujah",
                        "chords": [{"offset": 0, "symbol": "F"}],
                    }
                ],
            },
        ]
    }


def snapshot(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "transpose": 5,
        "chords_by_line": [
            {
                "section": 0,
                "line": 0,
                "chords": [
                    {"offset": 0, "symbol": "F"},
                    {"offset": 11, "symbol": "Dm"},
                ],
            },
            {"section": 0, "line": 1, "chords": []},
            {
                "section": 1,
                "line": 0,
                "chords": [{"offset": 0, "symbol": "Bb"}],
            },
        ],
    }
    payload.update(overrides)
    return payload


def test_happy_path_returns_normalized_snapshot() -> None:
    out = validate_snapshot(snapshot(), stored_body())
    assert out["transpose"] == 5
    assert len(out["chords_by_line"]) == 3
    assert out["chords_by_line"][0]["chords"][1] == {"offset": 11, "symbol": "Dm"}


def test_transpose_out_of_range_rejected() -> None:
    for bad in (-12, 12, 2.5, "5", True):
        with pytest.raises(SnapshotError):
            validate_snapshot(snapshot(transpose=bad), stored_body())


def test_line_count_mismatch_rejected() -> None:
    payload = snapshot()
    payload["chords_by_line"] = payload["chords_by_line"][:2]
    with pytest.raises(SnapshotError, match="count"):
        validate_snapshot(payload, stored_body())


def test_section_line_index_mismatch_rejected() -> None:
    payload = snapshot()
    payload["chords_by_line"][2] = {
        "section": 1,
        "line": 1,
        "chords": [{"offset": 0, "symbol": "Bb"}],
    }
    with pytest.raises(SnapshotError, match="index"):
        validate_snapshot(payload, stored_body())


def test_offset_past_line_width_rejected() -> None:
    payload = snapshot()
    payload["chords_by_line"][2]["chords"] = [{"offset": 99, "symbol": "Bb"}]
    with pytest.raises(SnapshotError, match="offset"):
        validate_snapshot(payload, stored_body())


def test_negative_offset_rejected() -> None:
    payload = snapshot()
    payload["chords_by_line"][0]["chords"] = [{"offset": -1, "symbol": "F"}]
    with pytest.raises(SnapshotError, match="offset"):
        validate_snapshot(payload, stored_body())


def test_non_western_symbol_rejected() -> None:
    payload = snapshot()
    payload["chords_by_line"][0]["chords"] = [{"offset": 0, "symbol": "H"}]
    with pytest.raises(SnapshotError, match="symbol"):
        validate_snapshot(payload, stored_body())


def test_missing_chords_by_line_rejected() -> None:
    with pytest.raises(SnapshotError):
        validate_snapshot({"transpose": 0}, stored_body())


def test_pitch_tamper_passes_shape_verification() -> None:
    """Trust posture (FR-003): valid shape with wrong pitches still passes.

    The single owner can only mislead themselves; the backend verifies
    shape (counts/offsets/vocabulary), never pitch correctness.
    """
    payload = snapshot()
    payload["chords_by_line"][0]["chords"] = [
        {"offset": 0, "symbol": "F#maj7"},
        {"offset": 11, "symbol": "Bbm6"},
    ]
    out = validate_snapshot(payload, stored_body())
    assert out["chords_by_line"][0]["chords"][0]["symbol"] == "F#maj7"
