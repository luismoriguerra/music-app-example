"""Live evaluation gate for free search enrichment (Constitution IV, SC-002, T021).

Requires network access and ENRICH_LIVE_EVALS=1 to run.
Hermetic CI runs skip this test automatically.
"""

import os
import time

import pytest

from agents.sheets.enrich.context_free import fetch as fetch_context_free
from agents.sheets.enrich.links_free import discover as discover_links_free

pytestmark = pytest.mark.skipif(
    not os.getenv("ENRICH_LIVE_EVALS"),
    reason="Requires live network access and ENRICH_LIVE_EVALS=1",
)

SAMPLE_SONGS = [
    ("Creep", "Radiohead"),
    ("Yellow", "Coldplay"),
    ("Yesterday", "The Beatles"),
    ("Wonderwall", "Oasis"),
    ("Riptide", "Vance Joy"),
    ("Hallelujah", "Leonard Cohen"),
    ("Hotel California", "Eagles"),
    ("Let It Be", "The Beatles"),
    ("Someone Like You", "Adele"),
    ("Stand By Me", "Ben E. King"),
]


def test_live_sc002_sample_quality_gate() -> None:
    """SC-002: At least 8 out of 10 well-known songs show >=1 page and >=1 video link."""
    successes = 0
    for title, artist in SAMPLE_SONGS:
        pages, videos = discover_links_free(title, artist, deadline_s=4.0)
        fetch_context_free(title, artist, deadline_s=3.0)

        has_page = len(pages) >= 1
        has_video = len(videos) >= 1
        if has_page and has_video:
            successes += 1
        time.sleep(1.0)  # polite spacing

    assert successes >= 8, (
        f"SC-002 gate failed: only {successes}/10 songs had both page and video links"
    )
