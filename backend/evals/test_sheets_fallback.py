"""Agno eval scenarios for the R6 chord-alignment fallback (T037, Principle IV).

Behavior regression gates over the factory-built Agent (`fallback.build_agent`)
on the Appendix A model. These call the live model — run explicitly:

    (infisical run --env=dev --path=/backend -- .venv/bin/pytest evals/)

Skipped (not failed) without `OPENROUTER_API_KEY`. MUST be green before
merge and re-run on any prompt / model / schema change (research.md R12).
The four gates encode exactly what discriminated in the Appendix A eval:
coverage, valid vocabulary, verbatim lyrics, and provenance; plus the
latency budget that eliminated two candidates.
"""

from __future__ import annotations

import os
import re
import time

import pytest

from agents.sheets.fallback import MODEL_ID, MODEL_TIMEOUT_S, align, build_agent
from agents.sheets.normalize import is_chord_symbol, validate_body

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="live eval gate: needs OPENROUTER_API_KEY (Infisical dev /backend) to run",
)

# Public-domain fixtures (same as the Appendix A eval): F1 short hymn/folk,
# F2 20 lines / 5 sections with apostrophes + commas to stress offsets.
F1 = """[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

[Chorus]
Swing low, sweet chariot
Coming for to carry me home
Swing low, sweet chariot
Coming for to carry me home"""

F2 = """[Verse 1]
Oh Danny boy, the pipes, the pipes are calling
From glen to glen, and down the mountain side
The summer's gone, and all the roses falling
'Tis you, 'tis you must go and I must bide

[Chorus]
But come ye back when summer's in the meadow
Or when the valley's hushed and white with snow
'Tis I'll be here in sunshine or in shadow
Oh Danny boy, oh Danny boy, I love you so

[Verse 2]
But when ye come, and all the flowers are dying
If I am dead, as dead I well may be
Ye'll come and find the place where I am lying
And kneel and say an Ave there for me

[Bridge]
Oh Shenandoah, I long to see you
Away, you rolling river
Oh Shenandoah, I long to see you
Away, I'm bound away, 'cross the wide Missouri

[Outro]
And I shall hear, though soft you tread above me
And all my grave will warmer, sweeter be
For you will bend and tell me that you love me
And I shall sleep in peace until you come to me"""


# F3 = 36 lines / 9 sections (Amazing Grace 5 verses + Swing Low): realistic
# sheet length — the latency gate on F1/F2 alone would not prove the budget.
F3 = """[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Verse 3]
Through many dangers, toils and snares
I have already come
'Tis grace hath brought me safe thus far
And grace will lead me home

[Verse 4]
The Lord has promised good to me
His word my hope secures
He will my shield and portion be
As long as life endures

[Verse 5]
When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we first begun

[Chorus]
Swing low, sweet chariot
Coming for to carry me home
Swing low, sweet chariot
Coming for to carry me home

[Verse 6]
I looked over Jordan, and what did I see
Coming for to carry me home
A band of angels coming after me
Coming for to carry me home

[Verse 7]
If you get there before I do
Coming for to carry me home
Tell all my friends I'm coming too
Coming for to carry me home

[Chorus]
Swing low, sweet chariot
Coming for to carry me home
Swing low, sweet chariot
Coming for to carry me home"""


def _lyric_lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("[")]


@pytest.fixture(scope="module")
def runs() -> dict[str, dict]:
    """One live call per fixture, shared across gates (cost + time)."""
    agent = build_agent()
    out: dict[str, dict] = {}
    for name, lyrics in (("F1", F1), ("F2", F2), ("F3", F3)):
        t0 = time.time()
        body, model_id = align(lyrics, agent=agent)
        out[name] = {"lyrics": lyrics, "body": body, "model_id": model_id, "sec": time.time() - t0}
    return out


def test_chord_coverage_at_least_80_percent(runs: dict[str, dict]) -> None:
    for name, r in runs.items():
        lines = [ln for s in r["body"]["sections"] for ln in s["lines"]]
        chorded = sum(1 for ln in lines if ln["chords"])
        assert chorded / len(lines) >= 0.8, f"{name}: {chorded}/{len(lines)} lines carry chords"


def test_vocabulary_valid(runs: dict[str, dict]) -> None:
    # R12: every emitted symbol parses as FR-013 notation (incl. 7ths/sus/
    # dim/aug when the model chooses them). Richer voicings are a quality
    # nicety, not a gate — asserting one would pin model taste and flake.
    for name, r in runs.items():
        validate_body(r["body"])  # offsets in range, shape, symbols (DB rules)
        symbols = {
            c["symbol"] for s in r["body"]["sections"] for ln in s["lines"] for c in ln["chords"]
        }
        bad = sorted(s for s in symbols if not is_chord_symbol(s))
        assert not bad, f"{name}: non-FR-013 symbols {bad}"


def test_lyrics_untouched(runs: dict[str, dict]) -> None:
    # Structural since T036's chords-only wire shape; the live gate still
    # pins that the zipped sheet reproduces every line and heading in order.
    for name, r in runs.items():
        got = [ln["text"] for s in r["body"]["sections"] for ln in s["lines"]]
        assert got == _lyric_lines(r["lyrics"]), f"{name}: lyric text drifted"
        headings = [s["heading"] for s in r["body"]["sections"]]
        expected = re.findall(r"^\[(.+?)\]$", r["lyrics"], flags=re.M)
        assert headings == expected, f"{name}: section headings {headings} != {expected}"


def test_attribution_present(runs: dict[str, dict]) -> None:
    for name, r in runs.items():
        assert r["model_id"] == MODEL_ID, f"{name}: provenance model id {r['model_id']!r}"


def test_latency_within_budget(runs: dict[str, dict]) -> None:
    for name, r in runs.items():
        assert r["sec"] <= MODEL_TIMEOUT_S, f"{name}: {r['sec']:.1f}s exceeds {MODEL_TIMEOUT_S}s"
