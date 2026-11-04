"""Fixture tests for keyless candidate parsing, orientation, and dedupe (T008, DR-001, US1)."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from agents.sheets.enrich.candidates_free import (
    clean_search_title,
    parse_candidate_title_artist,
)
from agents.sheets.enrich.candidates_free import (
    search as search_candidates_free,
)

# Real DDG hit titles captured live for "amohada - jose jose" (user-reported defect).
ALMOHADA_HITS = [
    "Jose Jose - Almohada - YouTube José José - Almohada (Letra / Lyrics) - YouTube "
    "ALMOHADA - José José - LETRAS.COM",
    "José José - Almohada (Letra / Lyrics) - YouTube",
    "Almohada - song and lyrics by José José | Spotify",
    "ALMOHADA - José José - LETRAS.COM",
    "José José – Almohada Lyrics | Genius Lyrics",
    "Almohada - YouTube Music",
    "Stream Jose Jose - Almohada by BERNARDINA | Listen online for free on SoundCloud",
    "Jose Jose - Almohada with Lyrics - YouTube",
]

# Real DDG hit titles captured live for "Creep Radiohead".
CREEP_HITS = [
    "RadioHead - Creep , chords , lyrics, gtp, video",
    "CREEP CHORDS by Radiohead @ Ultimate-Guitar.Com",
    "Creep Chords by Radiohead | Songsterr Tabs with Rhythm",
    "Creep (Radiohead song) - Wikipedia",
]


def _mock_search(hits):
    tools = MagicMock()
    tools.web_search.return_value = json.dumps([{"title": t, "href": "https://x"} for t in hits])
    return patch("agents.sheets.enrich.candidates_free.WebSearchTools", return_value=tools)


def test_clean_search_title_strips_site_and_format_noise():
    assert clean_search_title("Radiohead - Creep (Official Audio) - YouTube") == "Radiohead - Creep"
    assert (
        clean_search_title("Creep by Radiohead - Chords and Lyrics - Ultimate Guitar")
        == "Creep by Radiohead"
    )
    assert clean_search_title("CREEP Chords - Radiohead | E-Chords") == "CREEP - Radiohead"
    assert clean_search_title("Radiohead - Creep Lyrics | Genius Lyrics") == "Radiohead - Creep"
    assert clean_search_title("ALMOHADA - José José - LETRAS.COM") == "ALMOHADA - José José"
    assert (
        clean_search_title("José José - Almohada (Letra / Lyrics) - YouTube")
        == "José José - Almohada"
    )


def test_parse_shapes_and_confidence():
    assert parse_candidate_title_artist("Radiohead - Creep") == ("Creep", "Radiohead", 0.7)
    assert parse_candidate_title_artist("Creep by Radiohead") == ("Creep", "Radiohead", 0.8)
    assert parse_candidate_title_artist("Creep (Radiohead song)") == ("Creep", "Radiohead", 0.85)
    # Last ' by ' wins.
    assert parse_candidate_title_artist("Stand by Me by Ben E. King") == (
        "Stand by Me",
        "Ben E. King",
        0.8,
    )
    # Dash shape runs before the by-shape: ' by ' inside a title is not the credit.
    assert parse_candidate_title_artist("Ben E. King - Stand By Me")[:2] == (
        "Stand By Me",
        "Ben E. King",
    )
    assert parse_candidate_title_artist("Red Hot Chili Peppers - By the Way")[:2] == (
        "By the Way",
        "Red Hot Chili Peppers",
    )
    # Streaming-store shape keeps working through the dash branch.
    assert parse_candidate_title_artist("Almohada - song and lyrics by José José | Spotify") == (
        "Almohada",
        "José José",
        0.8,
    )
    assert parse_candidate_title_artist("Creep") is None


def test_interior_words_are_preserved():
    assert parse_candidate_title_artist("The Beatles - Yesterday")[:2] == (
        "Yesterday",
        "The Beatles",
    )
    assert parse_candidate_title_artist("U2 - With or Without You")[:2] == (
        "With or Without You",
        "U2",
    )
    assert parse_candidate_title_artist("Lana Del Rey - Video Games")[:2] == (
        "Video Games",
        "Lana Del Rey",
    )
    # Leading title words that are also trailing-noise words must survive.
    assert parse_candidate_title_artist("Blur - Song 2")[:2] == ("Song 2", "Blur")
    assert parse_candidate_title_artist("Metallica - For Whom the Bell Tolls")[:2] == (
        "For Whom the Bell Tolls",
        "Metallica",
    )
    # Titles starting with a connector keep it.
    assert parse_candidate_title_artist("The Beatles - And I Love Her")[:2] == (
        "And I Love Her",
        "The Beatles",
    )
    assert parse_candidate_title_artist("By Your Side (Sade song)")[:2] == ("By Your Side", "Sade")
    assert parse_candidate_title_artist(
        "Riptide with - Vance Joy for guitar and ...", query="Riptde"
    )[:2] == (
        "Riptide",
        "Vance Joy",
    )


def test_query_orients_dash_shape_both_ways():
    q = "Somewhere Over the Rainbow"
    a = parse_candidate_title_artist("Somewhere Over The Rainbow - Israel Kamakawiwoʻole", query=q)
    b = parse_candidate_title_artist("Israel Kamakawiwoʻole - Somewhere Over The Rainbow", query=q)
    assert a[:2] == b[:2] == ("Somewhere Over The Rainbow", "Israel Kamakawiwoʻole")
    # A dashed query is NOT a role signal (both sides match -> default + majority).
    t, a2, _ = parse_candidate_title_artist("Jose Jose - Almohada", query="amohada - jose jose")
    assert (t, a2) == ("Almohada", "Jose Jose")


def test_artist_first_dashed_query_does_not_invert_roles():
    # Learner typed "Artist - Title". Real hit shapes both ways + one store "by" hit.
    q = "jose jose - almohada"
    assert parse_candidate_title_artist("José José - Almohada", query=q)[:2] == (
        "Almohada",
        "José José",
    )
    with _mock_search(ALMOHADA_HITS):
        cands = search_candidates_free(q, deadline_s=3.0)
    assert [(c.title.lower(), c.artist.lower()) for c in cands] == [("almohada", "josé josé")]


def test_noise_only_dash_segment_falls_through_to_by_shape():
    # "- Guitar Tutorial" is not an artist; the by-shape must win.
    assert parse_candidate_title_artist(
        "Hallelujah by Leonard Cohen - Guitar Tutorial", query="hallelujah"
    ) == ("Hallelujah", "Leonard Cohen", 0.8)
    assert parse_candidate_title_artist("Creep by Radiohead - Official Video")[:2] == (
        "Creep",
        "Radiohead",
    )


def test_one_word_titles_that_are_noise_words_survive():
    # The noise-only rule applies only next to a by-credit; these are real songs.
    assert parse_candidate_title_artist("Commodores - Easy")[:2] == ("Easy", "Commodores")
    assert parse_candidate_title_artist("Easy (Commodores song)")[:2] == ("Easy", "Commodores")
    assert parse_candidate_title_artist("India.Arie - Video")[:2] == ("Video", "India.Arie")


def test_query_without_dash_only_orients_on_a_decisive_signal():
    # Both sides match the query -> no signal -> keep the 'Artist - Title' default.
    q = "otherside red hot chili peppers"
    assert parse_candidate_title_artist("Red Hot Chili Peppers - Otherside", query=q) == (
        "Otherside",
        "Red Hot Chili Peppers",
        0.7,
    )


def test_search_resolves_orientation_ties_by_majority_not_hit_order():
    # Dash-free query, so every dash hit is a tie; the lone inverted hit comes FIRST.
    hits = [
        "Almohada - José José",  # default -> title "José José" (inverted)
        "José José - Almohada",
        "Jose Jose - Almohada - YouTube",
    ]
    with _mock_search(hits):
        cands = search_candidates_free("amohada jose jose", deadline_s=3.0)
    assert [(c.title.lower(), c.artist.lower()) for c in cands] == [("almohada", "josé josé")]


def test_search_dedupes_accents_and_noise_to_one_candidate():
    with _mock_search(ALMOHADA_HITS):
        cands = search_candidates_free("amohada - jose jose", deadline_s=3.0)
    assert len(cands) == 1
    assert cands[0].title.lower() == "almohada"
    assert cands[0].artist.lower() in ("josé josé", "jose jose")


def test_search_dedupes_creep_variants_to_one_candidate():
    with _mock_search(CREEP_HITS):
        cands = search_candidates_free("creep radiohead", deadline_s=3.0)
    assert [(c.title.lower(), c.artist.lower()) for c in cands] == [("creep", "radiohead")]
    assert cands[0].confidence == 0.85
    assert cands[0].origin == "duckduckgo"


def test_search_drops_junk_and_unrelated_hits():
    hits = [
        "Vance Joy Download or Listen Free JioSaavn - Riptide Full Song",
        "Scribd - Children's Songs and Guide",
        # Captured live for "amohada - jose jose": stream re-upload listing.
        "Stream Jose Jose - Almohada by BERNARDINA | Listen online for free on SoundCloud",
        "Riptide (Vance Joy song) - Wikipedia",
    ]
    with _mock_search(hits):
        cands = search_candidates_free("Riptde", deadline_s=3.0)
    assert [(c.title, c.artist) for c in cands] == [("Riptide", "Vance Joy")]


def test_search_never_raises_and_respects_zero_deadline():
    tools = MagicMock()
    tools.web_search.side_effect = RuntimeError("ratelimit")
    with patch("agents.sheets.enrich.candidates_free.WebSearchTools", return_value=tools):
        assert search_candidates_free("creep", deadline_s=3.0) == []
    assert search_candidates_free("creep", deadline_s=0) == []


def test_fixture_file_still_parses():
    fixture = json.loads(
        (Path(__file__).parent / "fixtures" / "enrich" / "ddg_candidates.json").read_text()
    )
    with _mock_search([h["title"] for h in fixture]):
        cands = search_candidates_free("creep radiohead", deadline_s=3.0)
    assert cands and cands[0].title.lower() == "creep" and cands[0].artist.lower() == "radiohead"
