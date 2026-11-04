"""Analysis-agent tests (T011, 006, DR-003): Pydantic SecondVoiceOut +
prompt shaping + stubbed-agent run contract. No live calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from pydantic import ValidationError

from agents.second_voice.analyze import (
    INSTRUCTIONS,
    MODEL_MAX_TOKENS,
    MODEL_TIMEOUT_S,
    SecondVoiceOut,
    SkipAnalysis,
    build_agent,
    clamp_analysis_receipt,
    format_analysis_input,
    model_facing_schema,
    run_analysis,
    run_analysis_with_metrics,
)


def golden_out() -> dict[str, Any]:
    return {
        "key": {"tonic": "C", "mode": "major", "justification": "Uses C, Am, F and G."},
        "scale": ["C", "D", "E", "F", "G", "A", "B"],
        "diatonic_chords": [
            {"degree": "I", "chord": "C"},
            {"degree": "ii", "chord": "Dm"},
            {"degree": "iii", "chord": "Em"},
            {"degree": "IV", "chord": "F"},
            {"degree": "V", "chord": "G"},
            {"degree": "vi", "chord": "Am"},
            {"degree": "vii°", "chord": "Bdim"},
        ],
        "progression": [
            {
                "section": "Verse 1",
                "chords": ["C", "Am", "F", "G"],
                "degrees": ["I", "vi", "IV", "V"],
            },
        ],
        "special_chords": [{"chord": "E7", "function": "Secondary dominant V7/vi leading to Am."}],
        "cadences": [{"name": "V–I", "chords": ["G", "C"], "location": "End of the chorus."}],
        "section_feel": [{"section": "Verse 1", "feeling": "Stable and bright."}],
        "second_voice": {
            "melody_status": "missing",
            "strategy": "Use diatonic thirds above.",
            "up": None,
            "down": None,
            "recommendation": None,
        },
        "note_table": [
            {
                "section": "Verse 1",
                "lyric_snippet": "I've heard there was a secret chord",
                "chord": "C",
                "first_voice": None,
                "second_voice": None,
                "interval": None,
                "explanation": "No melody, so no exact pitch is proposed.",
            },
        ],
        "singing_tips": ["Sing softly and listen to the chord."],
    }


def stored_body() -> dict[str, Any]:
    return {
        "sections": [
            {
                "heading": "Verse 1",
                "lines": [
                    {"text": "I've heard there was a secret chord", "chords": []},
                    {"text": "That David played", "chords": []},
                ],
            }
        ]
    }


def snapshot_lines() -> list[dict[str, Any]]:
    return [
        {
            "section": 0,
            "line": 0,
            "chords": [
                {"offset": 0, "symbol": "F"},
                {"offset": 11, "symbol": "Dm"},
            ],
        },
        {"section": 0, "line": 1, "chords": []},
    ]


@dataclass
class _Run:
    content: object


@dataclass
class _Metrics:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass
class _RunWithMetrics:
    content: object
    metrics: _Metrics


class _StubAgent:
    def __init__(self, result: object = None, exc: BaseException | None = None) -> None:
        self.result = result
        self.exc = exc
        self.seen: list[str] = []

    def run(self, prompt: str) -> _Run:
        self.seen.append(prompt)
        if self.exc is not None:
            raise self.exc
        return _Run(self.result)


def test_second_voice_out_parses_golden_fixture() -> None:
    out = SecondVoiceOut.model_validate(golden_out())
    assert out.key.tonic == "C"
    assert [d.degree for d in out.diatonic_chords] == [
        "I",
        "ii",
        "iii",
        "IV",
        "V",
        "vi",
        "vii°",
    ]


MINOR_DIATONICS = [
    {"degree": "i", "chord": "Am"},
    {"degree": "ii°", "chord": "Bdim"},
    {"degree": "III", "chord": "C"},
    {"degree": "iv", "chord": "Dm"},
    {"degree": "v", "chord": "Em"},
    {"degree": "VI", "chord": "F"},
    {"degree": "VII", "chord": "G"},
]


def test_minor_key_uses_natural_minor_degree_set() -> None:
    """T040: a minor key validates against [i, ii°, III, iv, v, VI, VII];
    the major set on a minor key (and vice versa) fails closed."""
    minor = golden_out()
    minor["key"] = {"tonic": "A", "mode": "minor", "justification": "Resolves to Am."}
    minor["diatonic_chords"] = MINOR_DIATONICS
    out = SecondVoiceOut.model_validate(minor)
    assert [d.degree for d in out.diatonic_chords] == ["i", "ii°", "III", "iv", "v", "VI", "VII"]
    wrong_set = golden_out()
    wrong_set["key"]["mode"] = "minor"
    with pytest.raises(ValidationError, match="minor key"):
        SecondVoiceOut.model_validate(wrong_set)
    wrong_set = golden_out()
    wrong_set["diatonic_chords"] = MINOR_DIATONICS
    with pytest.raises(ValidationError, match="major key"):
        SecondVoiceOut.model_validate(wrong_set)


@pytest.mark.parametrize(
    ("tonic", "mode_in", "tonic_out", "mode_out"),
    [
        ("Em", "minor", "E", "minor"),
        ("Em", "major", "E", "minor"),  # suffix wins over a conflicting mode
        ("Bbm", "minor", "Bb", "minor"),
        ("F# min", "minor", "F#", "minor"),
        ("A minor", "minor", "A", "minor"),
        ("E", "major", "E", "major"),  # bare tonic untouched
        ("EM", "major", "EM", "major"),  # uppercase M is not a minor suffix -> fails later
        ("Cmaj", "major", "Cmaj", "major"),
    ],
)
def test_clamp_normalizes_tonic_suffix(
    tonic: str, mode_in: str, tonic_out: str, mode_out: str
) -> None:
    """T040: models bake the mode into the tonic ("Em"); the receipt clamp
    splits it so a correct minor-key answer never 502s."""
    payload = golden_out()
    payload["key"]["tonic"] = tonic
    payload["key"]["mode"] = mode_in
    clamped = clamp_analysis_receipt(payload)
    assert clamped["key"]["tonic"] == tonic_out
    assert clamped["key"]["mode"] == mode_out


def test_clamped_minor_tonic_validates_end_to_end() -> None:
    payload = golden_out()
    payload["key"]["tonic"] = "Am"
    payload["key"]["mode"] = "major"
    payload["diatonic_chords"] = MINOR_DIATONICS
    out = SecondVoiceOut.model_validate(clamp_analysis_receipt(payload))
    assert (out.key.tonic, out.key.mode) == ("A", "minor")


def test_second_voice_out_rejects_bad_theory_shape() -> None:
    bad = golden_out()
    bad["diatonic_chords"] = bad["diatonic_chords"][:6]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    bad["progression"] = [{"section": "Verse 1", "chords": ["C", "Am"], "degrees": ["I"]}]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    bad["note_table"][0]["lyric_snippet"] = "x" * 121
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)


def test_second_voice_out_rejects_overlong_prose_and_rows() -> None:
    """Concise caps (~2x prompt guidance): the schema stays strict — receipts
    that still overflow are clamped by clamp_analysis_receipt before this runs."""
    bad = golden_out()
    bad["key"]["justification"] = "x" * 601
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    bad["note_table"][0]["explanation"] = "x" * 481
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    bad["singing_tips"] = ["Sing."] * 6
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    bad["singing_tips"] = ["x" * 321]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)
    bad = golden_out()
    row = dict(bad["note_table"][0])
    bad["note_table"] = [dict(row) for _ in range(61)]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)


def test_clamp_analysis_receipt_cuts_lists_and_strings() -> None:
    """Cosmetic overflow clamps: trailing rows dropped, strings cut to caps."""
    payload = golden_out()
    payload["key"]["justification"] = "j" * 700
    payload["section_feel"][0]["feeling"] = "f" * 500
    payload["note_table"][0]["explanation"] = "e" * 500
    row = dict(payload["note_table"][0])
    payload["note_table"] = [dict(row) for _ in range(65)]
    payload["singing_tips"] = ["t" * 400 for _ in range(7)]
    clamped = clamp_analysis_receipt(payload)
    assert len(clamped["key"]["justification"]) == 600
    assert len(clamped["section_feel"][0]["feeling"]) == 480
    assert len(clamped["note_table"]) == 60
    assert len(clamped["note_table"][0]["explanation"]) == 480
    assert len(clamped["singing_tips"]) == 5
    assert len(clamped["singing_tips"][0]) == 320
    # Clamped receipts validate: no paid call becomes a 502 for overflow.
    SecondVoiceOut.model_validate(clamped)


def test_run_analysis_clamps_overflow_instead_of_skipping() -> None:
    """End to end: an overlong dict receipt still yields an analysis."""
    payload = golden_out()
    payload["key"]["justification"] = "j" * 700
    row = dict(payload["note_table"][0])
    payload["note_table"] = [dict(row) for _ in range(65)]
    agent = _StubAgent(payload)
    analysis, _ = run_analysis(snapshot_lines(), stored_body(), agent=agent, model_id="m")
    assert len(analysis["key"]["justification"]) == 600
    assert len(analysis["note_table"]) == 60


def test_run_analysis_still_skips_on_trust_violations() -> None:
    """Clamp never saves invented pitches: trust invariants fail closed."""
    payload = golden_out()
    payload["note_table"][0]["second_voice"] = "E"  # missing melody: invented
    agent = _StubAgent(payload)
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(snapshot_lines(), stored_body(), agent=agent, model_id="m")
    assert exc.value.reason == "unavailable"


@pytest.mark.parametrize(
    ("field", "pitch"),
    [("first_voice", "G"), ("second_voice", "E"), ("interval", "3rd")],
)
def test_second_voice_out_rejects_invented_pitches_when_missing(field: str, pitch: str) -> None:
    bad = golden_out()
    bad["note_table"][0][field] = pitch
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(bad)


@pytest.mark.parametrize("field", ["up", "down", "recommendation"])
def test_second_voice_out_rejects_proposal_when_missing(field: str) -> None:
    """Missing melody ⟹ up/down/recommendation stay null (FR-010, T031)."""
    bad = golden_out()
    bad["second_voice"][field] = "Sing a third above."
    with pytest.raises(ValidationError, match="proposal"):
        SecondVoiceOut.model_validate(bad)


def test_format_input_numbers_transposed_chords_with_lyrics() -> None:
    prompt = format_analysis_input(snapshot_lines(), stored_body())
    assert "Verse 1" in prompt
    assert "I've heard there was a secret chord" in prompt
    assert "F@0" in prompt and "Dm@11" in prompt
    assert "line 0" in prompt and "line 1" in prompt


def test_run_analysis_returns_dump_and_model_id() -> None:
    agent = _StubAgent(SecondVoiceOut.model_validate(golden_out()))
    analysis, model_id = run_analysis(
        snapshot_lines(), stored_body(), agent=agent, model_id="openrouter/test-model"
    )
    assert analysis["key"]["tonic"] == "C"
    assert model_id == "openrouter/test-model"
    assert len(agent.seen) == 1  # single attempt, no retries


def test_run_analysis_with_metrics_returns_token_counts() -> None:
    agent = _StubAgent(SecondVoiceOut.model_validate(golden_out()))
    agent.run = lambda prompt: _RunWithMetrics(  # type: ignore[method-assign]
        SecondVoiceOut.model_validate(golden_out()),
        _Metrics(input_tokens=965, output_tokens=1591, total_tokens=2556),
    )
    analysis, model_id, metrics = run_analysis_with_metrics(
        snapshot_lines(), stored_body(), agent=agent, model_id="openrouter/test-model"
    )
    assert analysis["key"]["tonic"] == "C"
    assert model_id == "openrouter/test-model"
    assert metrics == {"input_tokens": 965, "output_tokens": 1591, "total_tokens": 2556}


def test_run_analysis_with_metrics_zeroes_when_unreported() -> None:
    agent = _StubAgent(SecondVoiceOut.model_validate(golden_out()))  # no .metrics
    _, _, metrics = run_analysis_with_metrics(
        snapshot_lines(), stored_body(), agent=agent, model_id="openrouter/test-model"
    )
    assert metrics == {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}


def test_run_analysis_accepts_plain_dict_content() -> None:
    agent = _StubAgent(golden_out())
    analysis, _ = run_analysis(
        snapshot_lines(),
        stored_body(),
        agent=agent,
        model_id="openrouter/test-model",
    )
    assert analysis["scale"][0] == "C"


def test_run_analysis_rejects_schema_invalid_content() -> None:
    bad = golden_out()
    bad["progression"] = [{"section": "Verse 1", "chords": ["C", "Am"], "degrees": ["I"]}]
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(
            snapshot_lines(),
            stored_body(),
            agent=_StubAgent(bad),
            model_id="openrouter/test-model",
        )
    assert exc.value.reason == "unavailable"


def test_run_analysis_rejects_non_schema_content() -> None:
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(
            snapshot_lines(),
            stored_body(),
            agent=_StubAgent("nope"),
            model_id="openrouter/test-model",
        )
    assert exc.value.reason == "unavailable"


def test_run_analysis_timeout_maps_to_timeout() -> None:
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(
            snapshot_lines(),
            stored_body(),
            agent=_StubAgent(exc=TimeoutError("slow")),
            model_id="openrouter/test-model",
        )
    assert exc.value.reason == "timeout"


def test_run_analysis_provider_error_maps_to_unavailable() -> None:
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(
            snapshot_lines(),
            stored_body(),
            agent=_StubAgent(exc=RuntimeError("502")),
            model_id="openrouter/test-model",
        )
    assert exc.value.reason == "unavailable"


def test_build_agent_without_key_skips_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECOND_VOICE_MODEL_ID", "openrouter/test-model")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(SkipAnalysis) as exc:
        build_agent()
    assert exc.value.reason == "unavailable"


def test_build_agent_is_agno_agent_with_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    from agno.agent import Agent

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    agent = build_agent(model_id="openrouter/test-model")
    assert isinstance(agent, Agent)
    # Wire schema is a structure-only dict envelope (Gemini cannot serve
    # maxLength/maxItems); full SecondVoiceOut caps apply on receipt.
    assert agent.output_schema == model_facing_schema()


def test_model_facing_schema_strips_maxima_keeps_structure() -> None:
    """Wire envelope: strict name/schema shape, zero max* matchers."""
    import json

    envelope = model_facing_schema()
    assert envelope["type"] == "json_schema"
    assert envelope["json_schema"]["name"] == "SecondVoiceOut"
    assert envelope["json_schema"]["strict"] is True
    dumped = json.dumps(envelope["json_schema"]["schema"])
    assert "maxLength" not in dumped and "maxItems" not in dumped
    props = envelope["json_schema"]["schema"]["properties"]
    assert set(props) >= {"key", "progression", "note_table", "singing_tips"}


def test_build_agent_without_model_skips_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("SECOND_VOICE_MODEL_ID", raising=False)
    monkeypatch.setattr("agents.second_voice.analyze.MODEL_ID", None)
    with pytest.raises(SkipAnalysis) as exc:
        build_agent()
    assert exc.value.reason == "unavailable"


def test_run_analysis_without_model_skips_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SECOND_VOICE_MODEL_ID", raising=False)
    monkeypatch.setattr("agents.second_voice.analyze.MODEL_ID", None)
    with pytest.raises(SkipAnalysis) as exc:
        run_analysis(snapshot_lines(), stored_body(), agent=_StubAgent(golden_out()))
    assert exc.value.reason == "unavailable"


def test_budgets_match_r7() -> None:
    assert MODEL_TIMEOUT_S == 45.0
    assert MODEL_MAX_TOKENS >= 4000  # Agno's 1024 default truncates (004 lesson)


def test_clamp_drops_lyric_echoed_symbols_keeps_degrees_aligned() -> None:
    """Prod 502 (2026-09-18): the model promoted the lyric token 'Edis7'
    (Spanish shorthand in a UG chart, not Western notation) into the
    progression, special_chords, cadences, and note_table. The clamp drops
    the junk and keeps the parallel degrees aligned instead of 502ing."""
    payload = golden_out()
    payload["progression"] = [
        {
            "section": "Verse 1",
            "chords": ["C", "Edis7", "G"],
            "degrees": ["I", "III", "V"],
        },
    ]
    payload["special_chords"] = [
        {"chord": "Edis7", "function": "Borrowed diminished passing chord."},
        {"chord": "E7", "function": "Secondary dominant V7/vi leading to Am."},
    ]
    payload["cadences"] = [
        {
            "name": "V-I",
            "chords": ["G", "Edis7", "C"],
            "location": "End of the chorus.",
        },
        {"name": "Junk", "chords": ["Edis7"], "location": "Nowhere."},
    ]
    payload["note_table"] = [
        {
            "section": "Verse 1",
            "lyric_snippet": "Bdis7 E7",
            "chord": "Edis7",
            "first_voice": None,
            "second_voice": None,
            "interval": None,
            "explanation": "Transition bar with no parsed chords.",
        },
        {
            "section": "Verse 1",
            "lyric_snippet": "I've heard a secret chord",
            "chord": "C",
            "first_voice": None,
            "second_voice": None,
            "interval": None,
            "explanation": "No melody, so no exact pitch is proposed.",
        },
    ]
    clamped = clamp_analysis_receipt(payload)
    assert clamped["progression"] == [
        {"section": "Verse 1", "chords": ["C", "G"], "degrees": ["I", "V"]},
    ]
    assert clamped["special_chords"] == [
        {"chord": "E7", "function": "Secondary dominant V7/vi leading to Am."},
    ]
    assert clamped["cadences"] == [
        {"name": "V-I", "chords": ["G", "C"], "location": "End of the chorus."},
    ]
    assert [row["chord"] for row in clamped["note_table"]] == ["C"]
    out = SecondVoiceOut.model_validate(clamped)
    assert out.progression[0].chords == ["C", "G"]


def test_clamp_drops_empty_progression_row_but_keeps_min_one() -> None:
    """A progression row left with zero valid chords is dropped; a receipt
    whose ONLY row is junk still fails closed (progression min_length=1)."""
    payload = golden_out()
    payload["progression"] = [
        {"section": "Verse 1", "chords": ["Edis7"], "degrees": ["III"]},
        {"section": "Chorus", "chords": ["F", "G"], "degrees": ["IV", "V"]},
    ]
    clamped = clamp_analysis_receipt(payload)
    assert [row["section"] for row in clamped["progression"]] == ["Chorus"]
    SecondVoiceOut.model_validate(clamped)

    only_junk = golden_out()
    only_junk["progression"] = [
        {"section": "Verse 1", "chords": ["Edis7"], "degrees": ["III"]},
    ]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(clamp_analysis_receipt(only_junk))


def test_clamp_leaves_misaligned_progression_row_to_fail_closed() -> None:
    """chords/degrees length mismatch signals deeper model confusion than a
    lyric echo: the clamp must not re-align by truncation, so the receipt
    still fails closed."""
    payload = golden_out()
    payload["progression"] = [
        {"section": "Verse 1", "chords": ["C", "G"], "degrees": ["I"]},
    ]
    clamped = clamp_analysis_receipt(payload)
    assert clamped["progression"][0]["chords"] == ["C", "G"]
    with pytest.raises(ValidationError):
        SecondVoiceOut.model_validate(clamped)


def test_run_analysis_sanitizes_echoed_symbols_end_to_end() -> None:
    """Stubbed-agent contract: a receipt shaped like the prod 'Edis7'
    failure analyzes successfully once the clamp sanitizes echo fields."""
    receipt = golden_out()
    receipt["progression"] = [
        {"section": "Verse 1", "chords": ["Edis7", "C"], "degrees": ["III", "I"]},
    ]
    analysis, _ = run_analysis(
        snapshot_lines(), stored_body(), agent=_StubAgent(receipt), model_id="m"
    )
    assert analysis["progression"][0]["chords"] == ["C"]
    assert analysis["progression"][0]["degrees"] == ["I"]


def test_prompt_forbids_lyric_token_chords() -> None:
    """The verbatim rule names the failure mode: symbols come from the
    `chords:` lists only, never from chord-like lyric tokens."""
    assert "chords:` lists" in INSTRUCTIONS
    assert "Bdis7" in INSTRUCTIONS and "Edis7" in INSTRUCTIONS
