"""Evaluation gates for free search enrichment (US1, US2, US3, DR-001, DR-005).

Evaluates:
- FR-001/FR-002: Fallback candidates rank below primary, deduplicated against them.
- FR-003: Never auto-generate on ambiguous enriched candidates.
- FR-008: Timeout or error in candidate fallback degrades gracefully to today's behavior.
"""

from unittest.mock import MagicMock, patch

import httpx

from agents.sheets.candidates import search as search_candidates
from agents.sheets.enrich import dedup_and_rank_candidates


def test_eval_candidate_fallback_ranking_and_dedup():
    """Eval gate: Enriched candidates rank strictly below primary and dedup by folded identity."""
    primary = [
        {"title": "Yellow", "artist": "Coldplay", "provider_refs": {"genius_id": 101}},
    ]
    enriched = [
        {"title": "yellow", "artist": "coldplay", "origin": "duckduckgo"},
        {"title": "Fix You", "artist": "Coldplay", "origin": "duckduckgo"},
    ]

    combined = dedup_and_rank_candidates(primary, enriched)

    assert len(combined) == 2
    # Primary stays #1
    assert combined[0]["title"] == "Yellow"
    assert "genius_id" in combined[0]["provider_refs"]
    # Non-duplicate enriched appended at #2
    assert combined[1]["title"] == "Fix You"
    assert combined[1]["origin"] == "duckduckgo"


def test_eval_never_auto_generate_on_candidate_list():
    """Eval gate: Candidate search produces a list for learner choice; never auto-picks."""
    with (
        patch("agents.sheets.candidates._genius_search", return_value=[]),
        patch("agents.sheets.lyrics.LyricsClient.search", return_value=[]),
        patch("agents.sheets.enrich.candidates_free.WebSearchTools") as mock_ddg_cls,
    ):
        mock_ddg = MagicMock()
        mock_ddg.web_search.return_value = (
            '[{"title": "Radiohead - Creep", "href": "https://example.com"}]'
        )
        mock_ddg_cls.return_value = mock_ddg

        results = search_candidates("creep", genius_token="fake_token")

        # Results must be returned as a list of candidates for user selection
        assert isinstance(results, list)
        assert len(results) == 1
        # System returns candidate envelope, learner must pick
        assert results[0]["title"] == "Creep"
        assert results[0]["artist"] == "Radiohead"


def test_eval_fallback_timeout_degrades_gracefully():
    """Eval gate: When enrichment times out or fails, search degrades cleanly without 500."""
    with (
        patch("agents.sheets.candidates._genius_search", return_value=[]),
        patch("agents.sheets.lyrics.LyricsClient.search", return_value=[]),
        patch("agents.sheets.enrich.candidates_free.WebSearchTools") as mock_ddg_cls,
    ):
        mock_ddg = MagicMock()
        mock_ddg.web_search.side_effect = TimeoutError("DDG timed out")
        mock_ddg_cls.return_value = mock_ddg

        # Timeout in enrichment does not raise; degrades to 0 candidates
        results = search_candidates("obscure song title", genius_token="fake")
        assert results == []


def test_eval_video_link_discovery_fills_empty_video():
    """Eval gate: When video key is absent, free enrichment fills video link."""
    from agents.sheets.enrich.links_free import discover as discover_links_free

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/oembed"
        return httpx.Response(200, json={"title": "Radiohead - Creep", "author_name": "Radiohead"})

    with patch("agents.sheets.enrich.links_free.WebSearchTools") as mock_ddg:
        mock_ddg.return_value.web_search.return_value = '[{"title": "Radiohead - Creep", "href": "https://www.youtube.com/watch?v=XFkzRNyygfk"}]'
        pages, videos = discover_links_free(
            "Creep",
            "Radiohead",
            deadline_s=3.0,
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )
        assert len(videos) == 1
        assert videos[0].kind == "video"
        assert "youtube.com" in videos[0].url


def test_eval_wikipedia_context_miss_and_no_lyrics():
    """Eval gate (US3, FR-006, FR-007): Context returns None on miss; contains no lyrics."""
    import httpx

    from agents.sheets.enrich.context_free import fetch as fetch_context_free

    def client_for(search_titles, pages):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.params.get("list") == "search":
                return httpx.Response(
                    200, json={"query": {"search": [{"title": t} for t in search_titles]}}
                )
            return httpx.Response(200, json={"query": {"pages": pages}})

        return httpx.Client(transport=httpx.MockTransport(handler))

    # Miss returns None cleanly
    assert (
        fetch_context_free("Nonexistent Song 12345", "Unknown", client=client_for([], [])) is None
    )

    # Context text must be encyclopedic, <= 600 chars, not lyric lines
    page = {
        "title": "Creep (Radiohead song)",
        "extract": "Creep is the debut single by English rock band Radiohead, released in 1992.",
        "fullurl": "https://en.wikipedia.org/wiki/Creep_(Radiohead_song)",
    }
    ctx = fetch_context_free(
        "Creep", "Radiohead", client=client_for(["Creep (Radiohead song)"], [page])
    )
    assert ctx is not None
    assert len(ctx.text) <= 600
    assert ctx.source_url.startswith("https://")
    assert "\n[" not in ctx.text
    assert "Verse 1" not in ctx.text
