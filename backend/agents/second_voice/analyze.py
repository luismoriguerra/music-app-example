"""Second-voice theory analysis (T015/T016, 006, DR-003): an Agno Agent.

Encodes the owner's 19-step English curriculum as `INSTRUCTIONS` plus the
`SecondVoiceOut` output contract. Model input per run: numbered
transposed-chords-by-line + section headings + stored lyric lines (R2).
Output carries lyric snippets only (R8).

Budgets: single attempt, 45 s inference inside the 60 s SC-002 wall (R7).
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from agents.sheets.normalize import is_chord_symbol

# Model config (Principle V): NO hardcoded model ID on this path. The gated
# T009 `openrouter-model-eval` records the winner in research.md Appendix A and
# the operator exports it as SECOND_VOICE_MODEL_ID. Unset/blank → build_agent
# and run_analysis raise SkipAnalysis("unavailable") (route → 502, nothing
# stored), so un-evaluated inference can never run.
MODEL_ID_ENV_VAR = "SECOND_VOICE_MODEL_ID"
MODEL_ID: str | None = os.getenv(MODEL_ID_ENV_VAR) or None
MODEL_TIMEOUT_S = 45.0  # R7 budget inside the 60 s SC-002 wall
MODEL_MAX_TOKENS = 16000  # measured 10.9k out on a 13-line real song (Agno default 1024 truncates)

NOTE_NAME_RE = re.compile(r"^[A-G](?:#{1,2}|b{1,2})?$")
# Tonic receipt drift: models bake the mode into the tonic ("Em", "Bbm",
# "A minor"). Note+accidental first, then an optional case-sensitive minor
# suffix -- `EM`/`maj` never parse as minor, `Bbm` keeps its flat.
TONIC_SUFFIX_RE = re.compile(r"^([A-G](?:#{1,2}|b{1,2})?)\s*(m|min|minor)?$")
# Diatonic degree set per mode (T040): natural minor for minor keys; a
# major V/V7 in a minor song is out-of-key and belongs in special_chords.
DIATONIC_DEGREES_BY_MODE: dict[str, tuple[str, ...]] = {
    "major": ("I", "ii", "iii", "IV", "V", "vi", "vii°"),
    "minor": ("i", "ii°", "III", "iv", "v", "VI", "VII"),
}
# Concise caps (006): the model was verbose (10.9k out on 13 lines). These
# maxima + the prompt's 1-sentence rules bound output so full-length songs
# stay inside the token budget and read as gist, not essay. Mirrored in
# Zod (schemas.ts) and the DB validator (db_models.py).
# String caps sit at ~2x the prompt guidance (40 words ~= 240-280 chars):
# prompt-compliant prose must never fail receipt validation. Whatever still
# overflows is clamped by clamp_analysis_receipt before SecondVoiceOut runs,
# so cosmetic overflow can never turn a paid call into a 502 -- only trust
# invariants (pitches, symbols, degrees, diatonics) fail closed.
JUSTIFICATION_MAX = 600
SECTION_LABEL_MAX = 80
FUNCTION_MAX = 600
CADENCE_NAME_MAX = 80
LOCATION_MAX = 160
FEELING_MAX = 480
STRATEGY_MAX = 600
VOICE_OPTION_MAX = 600
EXPLANATION_MAX = 480
TIP_MAX = 320
PROGRESSION_ROWS_MAX = 20
SPECIAL_MAX = 12
CADENCES_MAX = 12
FEEL_ROWS_MAX = 20
NOTE_ROWS_MAX = 60
TIPS_MAX = 5

INSTRUCTIONS = (
    "You are a music theory teacher helping a ukulele beginner "
    "understand a song's harmony and build a second voice. Analyze "
    "the transposed chords you receive (the ones the student sees on "
    "screen) together with the lyrics and sections. Follow this process, in this "
    "order:\n"
    "1. Identify every chord that appears in the song.\n"
    "2. Determine the most likely key and briefly explain why.\n"
    "3. Write the complete scale of that key.\n"
    "4. Write the diatonic chords of that key with their degrees. "
    "Major keys: I, ii, iii, IV, V, vi, vii°. Minor keys use the NATURAL "
    "minor set: i, ii°, III, iv, v, VI, VII.\n"
    "5. Convert the song's full chord progression to Roman numerals.\n"
    "6. Flag any chord that does not belong naturally to the key.\n"
    "7. For each out-of-key chord, explain its function: "
    "secondary dominant, modal borrowing, modulation, etc.\n"
    "8. Point out important cadences or resolutions, e.g. V–I, IV–I, "
    "V7/vi–vi, etc.\n"
    "9. Explain in simple terms what harmonic feeling each section creates: "
    "verse, pre-chorus, chorus, bridge, etc.\n"
    "Then analyze the second voice:\n"
    "10. First identify the main melody notes, if available.\n"
    "11. If you only get chords and lyrics but no melody notes, do not "
    "invent an exact second voice. Tell me what information is missing.\n"
    "12. If you can infer or you have the melody, draft a second-voice proposal.\n"
    "13. Start by trying diatonic thirds above or below.\n"
    "14. Check every second-voice note against the chord that is sounding.\n"
    "15. Do not force thirds if that creates an unmusical note. "
    "You may use thirds, sixths, common chord tones, or contrary motion.\n"
    "16. Prioritize a second voice that: stays in key when possible, "
    "fits the chord, has a singable melodic line, avoids awkward leaps, "
    "and does not cross unnecessarily with the lead voice.\n"
    "17. If there are several options, give: second voice above, second voice below, "
    "which sounds most natural and why.\n"
    "18. For each important phrase show: chord, first-voice note, "
    "recommended second-voice note, interval between them, brief explanation.\n"
    "19. Close with practical, song-specific tips for singing the second voice: "
    "name the two vocal lanes (upper 3rd above vs lower harmony below), "
    "specific color/leading notes to target on transition chords, and how to resolve them.\n"
    "Output rules (mandatory):\n"
    "- All text in English, beginner-friendly teaching tone. Keep it SHORT: "
    "every explanation is 1-2 short sentences, under 40 words. Gist, not essay.\n"
    "- Note names in Anglo system (C, D, E, F, G, A, B); clarify "
    "sharps (#) and flats (b) whenever they appear.\n"
    "- Roman numerals: uppercase for major chords (I, IV, V), lowercase "
    "for minor (ii, iii, vi), ° for diminished (vii°).\n"
    "- `key.tonic` is the bare note name only (E, not Em); `key.mode` "
    "carries major/minor.\n"
    "- In a minor key a major V or V7 (e.g. E7 in A minor) is out of key: "
    "keep `v` minor in `diatonic_chords` and list the dominant in "
    "`special_chords` as the harmonic-minor dominant.\n"
    "- Chord symbols must be copied verbatim from the `chords:` lists "
    "in the input (standard Western notation); do not rewrite them. "
    "Lyric text may contain chord-like tokens (e.g. Bdis7, Edis7) that are "
    "NOT chords - never copy them into any chord field.\n"
    "- `progression`: one row per section; collapse exact repeats "
    "(e.g. 'Verses 1-3: I-vi-IV-V') instead of duplicating rows.\n"
    "- `special_chords` may be empty if the song is fully diatonic; "
    "distinct items only, one sentence each.\n"
    "- `cadences`: distinct items only, one short location each; "
    "empty is fine when nothing stands out.\n"
    "- `section_feel`: one row per section, one short sentence.\n"
    "- `note_table`: at most 60 rows total and at most 1 row per lyric line; "
    "for repeated sections prefer 1 representative row and say it repeats. "
    "Each `explanation` is 1 sentence.\n"
    "- `singing_tips`: at most 5 tips, 1 sentence each. Provide song-specific "
    "vocal harmony tips (e.g. upper 3rd lane, lower harmony lane, specific color "
    "or leading notes to target on key chords and where they resolve). Never generic "
    "filler like 'listen carefully' or 'practice diction'.\n"
    "- `justification`, `strategy`, `up`, `down`, `recommendation`: "
    "1-2 short sentences each.\n"
    "- Each `lyric_snippet` is a ≤120-character anchor, never the full lyrics.\n"
    "- CRITICAL RULE: if you do not receive the melody notes (melody_status "
    "missing), set `melody_status: missing`, explain what is missing in "
    "`strategy` ONLY, set `up`, `down`, and `recommendation` to null, and "
    "leave ALL of `first_voice`, `second_voice`, and `interval` in every "
    "`note_table` row as null. Never invent melody or second-voice notes. "
    "Still fill `note_table` with at least 1 row per important phrase: "
    "`chord`, `lyric_snippet`, and an `explanation` of that chord's role in "
    "the phrase — no note names anywhere until the melody is known.\n"
    "- Respond ONLY with the schema JSON; no prologue or markdown."
)


class SkipAnalysis(RuntimeError):  # noqa: N818
    """Analysis unavailable → route degrades to 502 PROVIDER_ERROR (fail closed)."""

    def __init__(self, reason: str = "unavailable") -> None:
        super().__init__(reason)
        self.reason = reason


def _check_symbol(symbol: Any) -> str:
    if not is_chord_symbol(symbol):
        raise ValueError(f"symbol {symbol!r} is not standard Western notation")
    return str(symbol)


def _check_note(name: Any) -> str:
    if not isinstance(name, str) or not NOTE_NAME_RE.match(name.strip()):
        raise ValueError(f"note {name!r} must be an Anglo note name")
    return name


class AnalysisKey(BaseModel):
    tonic: str
    mode: Literal["major", "minor"]
    justification: str = Field(min_length=1, max_length=600)

    @field_validator("tonic")
    @classmethod
    def _tonic_valid(cls, tonic: str) -> str:
        return _check_note(tonic)


class DiatonicChord(BaseModel):
    degree: str = Field(min_length=1)
    chord: str

    @field_validator("chord")
    @classmethod
    def _chord_valid(cls, chord: str) -> str:
        return _check_symbol(chord)


class ProgressionRow(BaseModel):
    section: str = Field(min_length=1, max_length=80)
    chords: list[str] = Field(min_length=1)
    degrees: list[str] = Field(min_length=1)

    @field_validator("chords")
    @classmethod
    def _chords_valid(cls, chords: list[str]) -> list[str]:
        return [_check_symbol(symbol) for symbol in chords]

    @field_validator("degrees")
    @classmethod
    def _degrees_nonblank(cls, degrees: list[str]) -> list[str]:
        for degree in degrees:
            if not isinstance(degree, str) or not degree.strip():
                raise ValueError("progression degree must be non-blank")
        return degrees


class SpecialChord(BaseModel):
    chord: str
    function: str = Field(min_length=1, max_length=600)

    @field_validator("chord")
    @classmethod
    def _chord_valid(cls, chord: str) -> str:
        return _check_symbol(chord)


class Cadence(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    chords: list[str] = Field(min_length=1)
    location: str = Field(min_length=1, max_length=160)

    @field_validator("chords")
    @classmethod
    def _chords_valid(cls, chords: list[str]) -> list[str]:
        return [_check_symbol(symbol) for symbol in chords]


class SectionFeel(BaseModel):
    section: str = Field(min_length=1, max_length=80)
    feeling: str = Field(min_length=1, max_length=480)


class SecondVoiceProposal(BaseModel):
    melody_status: Literal["missing", "present"]
    strategy: str = Field(max_length=600)
    up: str | None = Field(default=None, max_length=600)
    down: str | None = Field(default=None, max_length=600)
    recommendation: str | None = Field(default=None, max_length=600)


class NoteTableRow(BaseModel):
    section: str = Field(min_length=1, max_length=80)
    lyric_snippet: str = Field(min_length=1, max_length=120)
    chord: str
    first_voice: str | None = None
    second_voice: str | None = None
    interval: str | None = None
    explanation: str = Field(min_length=1, max_length=480)

    @field_validator("chord")
    @classmethod
    def _chord_valid(cls, chord: str) -> str:
        return _check_symbol(chord)


class SecondVoiceOut(BaseModel):
    """Output schema: the 9-section analysis as structured JSON (R1/DR-003)."""

    key: AnalysisKey
    scale: list[str] = Field(min_length=1)
    diatonic_chords: list[DiatonicChord]
    progression: list[ProgressionRow] = Field(min_length=1, max_length=20)
    special_chords: list[SpecialChord] = Field(max_length=12)
    cadences: list[Cadence] = Field(max_length=12)
    section_feel: list[SectionFeel] = Field(min_length=1, max_length=20)
    second_voice: SecondVoiceProposal
    note_table: list[NoteTableRow] = Field(max_length=60)
    singing_tips: list[str] = Field(min_length=1, max_length=5)

    @field_validator("scale")
    @classmethod
    def _scale_notes(cls, scale: list[str]) -> list[str]:
        return [_check_note(note) for note in scale]

    @field_validator("singing_tips")
    @classmethod
    def _tips_nonblank(cls, tips: list[str]) -> list[str]:
        for tip in tips:
            if not isinstance(tip, str) or not tip.strip():
                raise ValueError("singing tip must be non-blank")
            if len(tip) > 320:
                raise ValueError("singing tip must be ≤320 chars (concise)")
        return tips

    @model_validator(mode="after")
    def _theory_shape(self) -> SecondVoiceOut:
        degrees = [entry.degree for entry in self.diatonic_chords]
        expected = DIATONIC_DEGREES_BY_MODE[self.key.mode]
        if degrees != list(expected):
            raise ValueError(
                f"diatonic_chords for a {self.key.mode} key must be exactly [{', '.join(expected)}]"
            )
        for row in self.progression:
            if len(row.degrees) != len(row.chords):
                raise ValueError("each progression row needs len(degrees) == len(chords)")
        if self.second_voice.melody_status == "missing" and any(
            row.second_voice is not None or row.first_voice is not None or row.interval is not None
            for row in self.note_table
        ):
            raise ValueError("melody_status 'missing' forbids note_table pitches (FR-010)")
        if self.second_voice.melody_status == "missing" and any(
            field is not None
            for field in (
                self.second_voice.up,
                self.second_voice.down,
                self.second_voice.recommendation,
            )
        ):
            raise ValueError("melody_status 'missing' forbids proposal fields (FR-010)")
        if not self.note_table and not self.second_voice.strategy.strip():
            raise ValueError("an empty note_table needs a non-empty strategy")
        return self


def _resolve_model_id(explicit: str | None) -> str:
    """Resolve the model ID: explicit arg wins, else the env config.

    Raises SkipAnalysis("unavailable") when neither yields a non-blank ID —
    fail closed (FR-014) so un-evaluated inference can never run.
    """
    candidate = (
        (explicit or "").strip()
        or (os.getenv(MODEL_ID_ENV_VAR) or "").strip()
        or (MODEL_ID or "").strip()
    )
    if not candidate:
        raise SkipAnalysis("unavailable")
    return candidate


def _strip_max_constraints(node: Any) -> None:
    """Recursively drop maxLength/maxItems from the model-facing schema.

    Gemini's constrained decoder (via OpenRouter) rejects schemas whose
    maxima explode the serving automaton ("too many states for serving"),
    so the wire schema carries structure only. The concise caps stay
    enforced server-side: run_analysis* clamps cosmetic overflow with
    clamp_analysis_receipt, then validates with SecondVoiceOut.model_validate
    (trust invariants fail closed, FR-014).
    """
    if isinstance(node, dict):
        node.pop("maxLength", None)
        node.pop("maxItems", None)
        for value in node.values():
            _strip_max_constraints(value)
    elif isinstance(node, list):
        for item in node:
            _strip_max_constraints(item)


def model_facing_schema() -> dict[str, Any]:
    """Wire envelope for the Agent: Agno's OpenAI sanitize minus maxima.

    Mirrors exactly what the Pydantic path previously sent (name/schema/
    strict envelope, strict=True), so the provider sees the same contract
    shape — only the unservable max* matchers are gone. Agno passes dict
    output_schemas through untouched and parses receipts to dict, which
    run_analysis* then clamps (caps on) and validates as SecondVoiceOut.
    """
    from agno.utils.models.openai_responses import sanitize_response_schema

    schema = SecondVoiceOut.model_json_schema()
    sanitize_response_schema(schema)
    _strip_max_constraints(schema)
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "SecondVoiceOut",
            "schema": schema,
            "strict": True,
        },
    }


def build_agent(*, model_id: str | None = None, api_key: str | None = None) -> Any:
    """Factory for the R2 theory Agent. Raises SkipAnalysis when no model/key.

    The wire schema is structure-only (model_facing_schema: Agno sanitize
    minus maxLength/maxItems — Gemini cannot serve maxima); receipts are
    clamped to the concise caps then validated (FR-014).
    """
    resolved = _resolve_model_id(model_id)
    key = api_key or os.getenv("OPENROUTER_API_KEY") or None
    if not key:
        raise SkipAnalysis("unavailable")
    from agno.agent import Agent
    from agno.models.openrouter import OpenRouter

    return Agent(
        model=OpenRouter(
            id=resolved,
            api_key=key,
            timeout=MODEL_TIMEOUT_S,
            max_tokens=MODEL_MAX_TOKENS,
        ),
        instructions=INSTRUCTIONS,
        output_schema=model_facing_schema(),
        markdown=False,
        retries=0,
    )


def format_analysis_input(snapshot_lines: list[dict[str, Any]], stored_body: dict[str, Any]) -> str:
    """What the model sees: numbered transposed chords + headings + lyrics.

    Chords are the TRANSPOSED symbols from the validated snapshot (what the
    learner sees); lyrics come from our immutable stored sheet (DR-001).
    """
    out: list[str] = [
        "Song sections with numbered lines. Chords are the transposed symbols "
        "as played (SYMBOL@offset, offsets are 0-based indexes into the lyric line):",
    ]
    cursor = 0
    for si, section in enumerate(stored_body.get("sections", [])):
        heading = section.get("heading") or "(no heading)"
        out.append(f"[Section {si}] {heading}")
        for li, line in enumerate(section.get("lines", [])):
            entry = snapshot_lines[cursor] if cursor < len(snapshot_lines) else None
            cursor += 1
            chords = (entry or {}).get("chords", []) if entry else []
            rendered = (
                ", ".join(f"{c['symbol']}@{c['offset']}" for c in chords)
                if chords
                else "(no chords)"
            )
            out.append(f"line {li}: {line.get('text', '')} | chords: {rendered}")
    return "\n".join(out)


def _extract_metrics(result: Any) -> dict[str, int]:
    """Token counts from Agno RunOutput.metrics (T031 budget evidence).

    Stubs and providers without usage passthrough yield zeros -- never fail.
    """
    metrics = getattr(result, "metrics", None)
    if metrics is None:
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    def _int(value: Any) -> int:
        try:
            return int(value or 0)
        except (TypeError, ValueError):
            return 0

    return {
        "input_tokens": _int(getattr(metrics, "input_tokens", 0)),
        "output_tokens": _int(getattr(metrics, "output_tokens", 0)),
        "total_tokens": _int(getattr(metrics, "total_tokens", 0)),
    }


def _clamp_text(value: Any, limit: int) -> Any:
    """Truncate an overlong string to the cap; pass anything else through."""
    if isinstance(value, str) and len(value) > limit:
        return value[:limit]
    return value


def _clamp_rows(rows: Any, limit: int) -> Any:
    """Drop trailing list rows past the cap; pass non-lists through."""
    if isinstance(rows, list) and len(rows) > limit:
        return rows[:limit]
    return rows


def _sanitize_echo_symbols(payload: dict[str, Any]) -> None:
    """Drop malformed chord symbols the model echoed from lyric text.

    Lyric lines can carry chord-like tokens that are not Western notation
    ("Bdis7" in a UG chart = Spanish shorthand for Bdim7). The prompt tells
    the model to copy symbols verbatim from the `chords:` lists only, but
    receipts still drift: the model promotes lyric tokens into `progression`,
    `special_chords`, `cadences`, and `note_table` (prod 502, 2026-09-18:
    'Edis7'). Those fields echo SONG content, so a malformed symbol is junk
    to drop, not a trust invariant to fail closed on:

    - progression rows: drop invalid chords AND their same-index degrees
      (parallel arrays must stay aligned for the len==len invariant); drop
      the row when nothing valid remains. Rows whose chords/degrees are
      already misaligned are left untouched to fail closed (deeper confusion).
    - special_chords entries / note_table rows with an invalid chord: dropped.
    - cadences entries: invalid chords filtered; entry dropped when empty.
    - diatonic_chords + scale stay STRICT: theory-deterministic fields where
      drift means the receipt is untrustworthy.

    Mutates the payload in place.
    """
    progression = payload.get("progression")
    if isinstance(progression, list):
        kept_rows: list[Any] = []
        for row in progression:
            if not isinstance(row, dict):
                kept_rows.append(row)
                continue
            chords = row.get("chords")
            degrees = row.get("degrees")
            if (
                isinstance(chords, list)
                and isinstance(degrees, list)
                and len(chords) == len(degrees)
            ):
                pairs = [
                    (chord, degree)
                    for chord, degree in zip(chords, degrees, strict=True)
                    if is_chord_symbol(chord)
                ]
                if not pairs:
                    continue
                row["chords"] = [chord for chord, _ in pairs]
                row["degrees"] = [degree for _, degree in pairs]
            kept_rows.append(row)
        payload["progression"] = kept_rows
    special = payload.get("special_chords")
    if isinstance(special, list):
        payload["special_chords"] = [
            entry
            for entry in special
            if not isinstance(entry, dict) or is_chord_symbol(entry.get("chord"))
        ]
    cadences = payload.get("cadences")
    if isinstance(cadences, list):
        kept_cadences: list[Any] = []
        for entry in cadences:
            if isinstance(entry, dict) and isinstance(entry.get("chords"), list):
                entry["chords"] = [chord for chord in entry["chords"] if is_chord_symbol(chord)]
                if not entry["chords"]:
                    continue
            kept_cadences.append(entry)
        payload["cadences"] = kept_cadences
    note_table = payload.get("note_table")
    if isinstance(note_table, list):
        payload["note_table"] = [
            row
            for row in note_table
            if not isinstance(row, dict) or is_chord_symbol(row.get("chord"))
        ]


def clamp_analysis_receipt(payload: dict[str, Any]) -> dict[str, Any]:
    """Clamp cosmetic overflow on a model receipt BEFORE validation.

    The wire schema is structure-only (Gemini cannot serve maxLength/maxItems),
    so the model can return prompt-compliant prose past the char caps (40 words
    is ~240-280 chars) or a per-line note table past NOTE_ROWS_MAX on 60+ line
    songs. Rejecting those receipts would turn a paid call into a 502 for a
    cosmetic overflow — instead drop trailing rows and cut strings to the caps,
    drop malformed chord symbols echoed from lyric text (see
    `_sanitize_echo_symbols`), then let SecondVoiceOut judge the remaining
    trust invariants (pitches, degrees, diatonics, non-blank prose), which
    still fail closed. The DB
    validator stays strict on purpose: by the time a row reaches it the receipt
    is already clamped, so a DB rejection is a programmer error, not a paid call.

    Mutates and returns the same dict (receipts are fresh objects).
    """
    key = payload.get("key")
    if isinstance(key, dict):
        key["justification"] = _clamp_text(key.get("justification"), JUSTIFICATION_MAX)
        tonic = key.get("tonic")
        match = TONIC_SUFFIX_RE.match(tonic.strip()) if isinstance(tonic, str) else None
        if match:
            key["tonic"] = match.group(1)
            # A minor suffix wins over a conflicting mode: the suffix is the
            # model's stronger signal and the diatonic set is checked against it.
            if match.group(2):
                key["mode"] = "minor"
    payload["progression"] = _clamp_rows(payload.get("progression"), PROGRESSION_ROWS_MAX)
    if isinstance(payload.get("progression"), list):
        for row in payload["progression"]:
            if isinstance(row, dict):
                row["section"] = _clamp_text(row.get("section"), SECTION_LABEL_MAX)
    payload["special_chords"] = _clamp_rows(payload.get("special_chords"), SPECIAL_MAX)
    if isinstance(payload.get("special_chords"), list):
        for entry in payload["special_chords"]:
            if isinstance(entry, dict):
                entry["function"] = _clamp_text(entry.get("function"), FUNCTION_MAX)
    payload["cadences"] = _clamp_rows(payload.get("cadences"), CADENCES_MAX)
    if isinstance(payload.get("cadences"), list):
        for entry in payload["cadences"]:
            if isinstance(entry, dict):
                entry["name"] = _clamp_text(entry.get("name"), CADENCE_NAME_MAX)
                entry["location"] = _clamp_text(entry.get("location"), LOCATION_MAX)
    payload["section_feel"] = _clamp_rows(payload.get("section_feel"), FEEL_ROWS_MAX)
    if isinstance(payload.get("section_feel"), list):
        for entry in payload["section_feel"]:
            if isinstance(entry, dict):
                entry["section"] = _clamp_text(entry.get("section"), SECTION_LABEL_MAX)
                entry["feeling"] = _clamp_text(entry.get("feeling"), FEELING_MAX)
    voice = payload.get("second_voice")
    if isinstance(voice, dict):
        voice["strategy"] = _clamp_text(voice.get("strategy"), STRATEGY_MAX)
        for field in ("up", "down", "recommendation"):
            voice[field] = _clamp_text(voice.get(field), VOICE_OPTION_MAX)
    payload["note_table"] = _clamp_rows(payload.get("note_table"), NOTE_ROWS_MAX)
    if isinstance(payload.get("note_table"), list):
        for row in payload["note_table"]:
            if isinstance(row, dict):
                row["section"] = _clamp_text(row.get("section"), SECTION_LABEL_MAX)
                row["lyric_snippet"] = _clamp_text(row.get("lyric_snippet"), 120)
                row["explanation"] = _clamp_text(row.get("explanation"), EXPLANATION_MAX)
    tips = _clamp_rows(payload.get("singing_tips"), TIPS_MAX)
    if isinstance(tips, list):
        tips = [_clamp_text(tip, TIP_MAX) for tip in tips]
    payload["singing_tips"] = tips
    _sanitize_echo_symbols(payload)
    return payload


def run_analysis_with_metrics(
    snapshot_lines: list[dict[str, Any]],
    stored_body: dict[str, Any],
    *,
    agent: Any = None,
    model_id: str | None = None,
) -> tuple[dict[str, Any], str, dict[str, int]]:
    """Run one analysis. Returns (analysis dict, model_id, token metrics).

    Same fail-closed contract as run_analysis; metrics come from
    RunOutput.metrics (zeros when the provider reports no usage).
    Evals use this for T031 budget evidence; the route stores no counts.

    Raises SkipAnalysis("timeout" | "unavailable") -- fail closed (FR-014).
    """
    resolved = _resolve_model_id(model_id)
    agent = agent if agent is not None else build_agent(model_id=resolved)
    try:
        result = agent.run(format_analysis_input(snapshot_lines, stored_body))
    except SkipAnalysis:
        raise
    except TimeoutError as exc:
        raise SkipAnalysis("timeout") from exc
    except Exception as exc:  # provider/transport errors -> degrade
        low = str(exc).lower()
        raise SkipAnalysis(
            "timeout" if "timeout" in low or "timed out" in low else "unavailable"
        ) from exc
    metrics = _extract_metrics(result)
    content = getattr(result, "content", result)
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            raise SkipAnalysis("unavailable") from None
    if isinstance(content, SecondVoiceOut):
        return content.model_dump(), resolved, metrics
    if isinstance(content, dict):
        try:
            clamped = clamp_analysis_receipt(content)
            return SecondVoiceOut.model_validate(clamped).model_dump(), resolved, metrics
        except ValidationError as exc:
            raise SkipAnalysis("unavailable") from exc
    raise SkipAnalysis("unavailable")


def run_analysis(
    snapshot_lines: list[dict[str, Any]],
    stored_body: dict[str, Any],
    *,
    agent: Any = None,
    model_id: str | None = None,
) -> tuple[dict[str, Any], str]:
    """Run one analysis. Returns (analysis dict, model_id).

    Thin wrapper over run_analysis_with_metrics; the route stores no
    token counts (provenance is model_id only).

    Raises SkipAnalysis("timeout" | "unavailable") — fail closed (FR-014).
    """
    analysis, resolved, _ = run_analysis_with_metrics(
        snapshot_lines, stored_body, agent=agent, model_id=model_id
    )
    return analysis, resolved
