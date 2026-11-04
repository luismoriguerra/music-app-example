"""Model chord-alignment fallback (R6, T036): an Agno Agent, not a bare SDK call.

Chart-miss path ONLY (pipeline R0 step 3). The model receives the fetched
lyrics as numbered lines and returns ONLY per-line chord changes; this
module zips them back onto the lyrics we already hold. The wire shape
carries no lyric text, so the model cannot rewrite or generate lyrics
(FR-012 `lyrics_untouched` holds by construction) and output tokens —
hence latency — roughly halve versus echoing the sheet (Appendix A).
Model per research.md Appendix A (Principle V decision record).

Pure domain: no web imports (Principle VIII). The Agent is built lazily per
request so a missing key degrades at request time, and it is NOT registered
in AgentOS (R10).
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

from agents.sheets.normalize import is_chord_symbol, split_lyric_sections

# research.md Appendix A — DECIDED 2026-09-16 via live openrouter-model-eval.
MODEL_ID = "openai/gpt-5.6-luna"
MODEL_TIMEOUT_S = 20.0  # R6 budget inside the 25 s pipeline deadline
MODEL_MAX_TOKENS = 4000  # Agno's OpenRouter default (1024) truncates real songs

INSTRUCTIONS = (
    "You align ukulele chords onto numbered song lyric lines. For each line index, "
    "return its chord changes. Do NOT return lyric text.\n"
    '- "offset" = 0-based character index within that line\'s text where the chord '
    'change lands; "symbol" = standard Western chord notation (e.g. G, G7, C, D7, Am, '
    "Em7, Bb, F#m, Dsus4, Cmaj7, Bdim, Aaug). Use richer chords (7ths, sus, dim, aug) "
    "where the harmony calls for them.\n"
    "- Every line should carry at least one chord unless it is a pure repeat you "
    "intentionally leave to the previous change.\n"
    "- Choose a beginner-friendly ukulele key."
)


class SkipModel(RuntimeError):  # noqa: N818
    """Model chords unavailable → pipeline degrades to lyrics-only."""

    def __init__(self, reason: str = "unavailable") -> None:
        super().__init__(reason)
        self.reason = reason


class ChordAt(BaseModel):
    offset: int = Field(ge=0)
    symbol: str


class LineChords(BaseModel):
    line: int = Field(ge=0, description="0-based index of the numbered lyric line")
    chords: list[ChordAt]


class ChordsOut(BaseModel):
    """Output schema: per-line chord changes only — no lyric text on the wire."""

    lines: list[LineChords]


def build_agent(*, model_id: str = MODEL_ID, api_key: str | None = None) -> Any:
    """Factory for the R6 alignment Agent. Raises SkipModel when no key."""
    key = api_key or os.getenv("OPENROUTER_API_KEY") or None
    if not key:
        raise SkipModel("unavailable")
    from agno.agent import Agent
    from agno.models.openrouter import OpenRouter

    return Agent(
        model=OpenRouter(
            id=model_id,
            api_key=key,
            timeout=MODEL_TIMEOUT_S,
            max_tokens=MODEL_MAX_TOKENS,
            reasoning_effort="none",  # Appendix A: disabled keeps latency flat
        ),
        instructions=INSTRUCTIONS,
        output_schema=ChordsOut,
        markdown=False,
        retries=0,
    )


def number_lyrics(lyrics_text: str) -> str:
    """What the model sees: `i: text` per lyric line (headings excluded)."""
    lines = [ln for _, ls in split_lyric_sections(lyrics_text) for ln in ls]
    return "\n".join(f"{i}: {t}" for i, t in enumerate(lines))


def _zip_body(out: ChordsOut, lyrics_text: str) -> dict[str, Any]:
    """Zip model chords onto our lyrics. Clamp past-end offsets to line width
    (chart-parser precedent, normalize.py); drop non-FR-013 symbols."""
    by_line: dict[int, list[dict[str, Any]]] = {}
    for lc in out.lines:
        by_line.setdefault(lc.line, []).extend(
            {"offset": c.offset, "symbol": c.symbol.strip()}
            for c in lc.chords
            if is_chord_symbol(c.symbol.strip())
        )
    sections: list[dict[str, Any]] = []
    total = 0
    idx = 0
    for heading, texts in split_lyric_sections(lyrics_text):
        lines: list[dict[str, Any]] = []
        for text in texts:
            width = len(text.encode("utf-16-le")) // 2
            chords = sorted(
                (
                    {"offset": min(c["offset"], width), "symbol": c["symbol"]}
                    for c in by_line.get(idx, [])
                ),
                key=lambda c: c["offset"],
            )
            total += len(chords)
            lines.append({"text": text, "chords": chords})
            idx += 1
        sections.append({"heading": heading, "lines": lines})
    if not sections or total == 0:
        raise SkipModel("unavailable")
    return {"sections": sections}


def align(
    lyrics_text: str, *, agent: Any = None, model_id: str = MODEL_ID
) -> tuple[dict[str, Any], str]:
    """Align chords onto `lyrics_text`. Returns (body, model_id).

    Raises SkipModel("timeout" | "unavailable"); never a hard error.
    """
    agent = agent if agent is not None else build_agent(model_id=model_id)
    try:
        result = agent.run(number_lyrics(lyrics_text))
    except SkipModel:
        raise
    except TimeoutError as exc:
        raise SkipModel("timeout") from exc
    except Exception as exc:  # provider/transport/schema errors → degrade
        low = str(exc).lower()
        raise SkipModel(
            "timeout" if "timeout" in low or "timed out" in low else "unavailable"
        ) from exc
    content = getattr(result, "content", result)
    if not isinstance(content, ChordsOut):
        raise SkipModel("unavailable")
    return _zip_body(content, lyrics_text), model_id
