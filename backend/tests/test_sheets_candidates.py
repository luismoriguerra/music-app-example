"""Candidate tests (T021): Genius-primary merge + LRCLIB-only fallback.

Principle III: defines the `agents.sheets.candidates` API before T033 —
merge rule (Genius rank first, then LRCLIB-only extras deduped by
normalized title+artist), no-token mode, zero-results → [].
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from agents.sheets.candidates import (
    CandidatesUnavailableError,
    merge_candidates,
    normalize_identity,
    search,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _genius_hits() -> list:
    payload = json.loads((FIXTURES / "genius_search.json").read_text())
    return payload["response"]["hits"]


def _lrclib_rows() -> list:
    return json.loads((FIXTURES / "lrclib_search.json").read_text())


def test_normalize_identity_folds_case_punct_space() -> None:
    assert normalize_identity("Riptide", "Vance Joy") == normalize_identity(
        "  riptide! ", "vance...joy"
    )
    assert normalize_identity("Riptide", "Vance Joy") != normalize_identity(
        "Riptide", "Sick Puppies"
    )


def test_merge_genius_first_then_lrclib_extras() -> None:
    merged = merge_candidates(_genius_hits(), _lrclib_rows())
    # Genius rank order first, with artwork + ids.
    assert [c["title"] for c in merged[:2]] == ["Riptide", "Riptide"]
    assert merged[0]["artist"] == "Vance Joy"
    assert merged[0]["artwork_url"] == "https://images.genius.com/thumb.jpg"
    assert merged[0]["provider_refs"] == {"genius_id": 123456}
    # LRCLIB dup (Riptide/Vance Joy) skipped; acoustic extra appended.
    assert merged[2]["title"] == "Riptide Acoustic"
    assert merged[2]["artwork_url"] is None
    assert merged[2]["provider_refs"] == {"lrclib_id": 969430}
    assert len(merged) == 3


def test_merge_empty_both_is_empty() -> None:
    assert merge_candidates([], []) == []


def test_merge_lrclib_only_shapes_candidates() -> None:
    merged = merge_candidates([], _lrclib_rows())
    assert merged[0]["album"] == "Dream Your Life Away"
    assert merged[0]["artwork_url"] is None
    for cand in merged:
        assert cand["title"] and cand["artist"]
        assert cand["provider_refs"]


def _client_for(handler):
    seen: list = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    return httpx.Client(transport=httpx.MockTransport(wrapped)), seen


def test_search_with_token_merges_both_sources() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.genius.com":
            assert request.headers["authorization"] == "Bearer tok"
            return httpx.Response(200, text=(FIXTURES / "genius_search.json").read_text())
        return httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())

    http, seen = _client_for(handler)
    cands = search("Riptide", genius_token="tok", client=http)
    assert len(cands) == 3
    assert cands[0]["provider_refs"] == {"genius_id": 123456}
    assert any(r.url.host == "api.genius.com" for r in seen)


def test_search_no_token_is_lrclib_only() -> None:
    http, seen = _client_for(
        lambda req: httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())
    )
    cands = search("Riptide", genius_token=None, client=http)
    assert len(cands) == 2
    assert all(c["artwork_url"] is None for c in cands)
    assert not any(r.url.host == "api.genius.com" for r in seen)


def test_search_genius_failure_degrades_to_lrclib() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.genius.com":
            return httpx.Response(403, text="bad token")
        return httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())

    http, _ = _client_for(handler)
    cands = search("Riptide", genius_token="bogus", client=http)
    assert len(cands) == 2


def test_search_zero_results_is_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("agents.sheets.enrich.candidates_free.search", lambda q: [])
    http, _ = _client_for(lambda req: httpx.Response(200, text="[]"))
    assert search("xyz-gibberish", genius_token=None, client=http) == []


def test_search_falls_back_to_free_candidates_when_configured_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from agents.sheets.enrich import EnrichedCandidate

    monkeypatch.setattr(
        "agents.sheets.enrich.candidates_free.search",
        lambda q: [EnrichedCandidate(title="Creep", artist="Radiohead")],
    )
    http, _ = _client_for(lambda req: httpx.Response(200, text="[]"))
    cands = search("creep", genius_token=None, client=http)
    assert len(cands) == 1
    assert cands[0]["title"] == "Creep"
    assert cands[0]["provider_refs"] == {"duckduckgo": "creep|radiohead"}


def test_search_title_artist_query_retries_title_only() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("q") == "Riptide - Vance Joy":
            return httpx.Response(200, text="[]")
        return httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())

    http, seen = _client_for(handler)
    cands = search("Riptide - Vance Joy", genius_token=None, client=http)
    assert cands != []
    assert [r.url.params["q"] for r in seen] == ["Riptide - Vance Joy", "Riptide"]


def test_search_long_plain_query_drops_trailing_words(monkeypatch) -> None:
    # R2 long→short on the LIVE path (no " - " to split on): the exact
    # quickstart V4 query. Bounded: at most 2 retries; the polite gap is the
    # LyricsClient throttle (T020), not a candidates-local sleep.
    sleeps: list = []
    monkeypatch.setattr("agents.sheets.lyrics.time.sleep", sleeps.append)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("q") == "Somewhere Over The Rainbow":
            return httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())
        return httpx.Response(200, text="[]")

    http, seen = _client_for(handler)
    cands = search("Somewhere Over The Rainbow Israel Kamakawiwole", genius_token=None, client=http)
    assert cands != []
    assert [r.url.params["q"] for r in seen] == [
        "Somewhere Over The Rainbow Israel Kamakawiwole",
        "Somewhere Over The Rainbow Israel",
        "Somewhere Over The Rainbow",
    ]
    assert sleeps == [0.3, 0.3]


def test_search_fallback_is_bounded_and_keeps_two_words() -> None:
    http, seen = _client_for(lambda req: httpx.Response(200, text="[]"))
    assert search("aaa bbb ccc ddd eee", genius_token=None, client=http) == []
    assert [r.url.params["q"] for r in seen] == [
        "aaa bbb ccc ddd eee",
        "aaa bbb ccc ddd",
        "aaa bbb ccc",
    ]
    http, seen = _client_for(lambda req: httpx.Response(200, text="[]"))
    assert search("Hurt", genius_token=None, client=http) == []
    assert len(seen) == 1  # single word: nothing to drop
    http, seen = _client_for(lambda req: httpx.Response(200, text="[]"))
    assert search("Hey Jude", genius_token=None, client=http) == []
    assert len(seen) == 1  # never retry below two words


def test_search_honors_lrclib_429_instead_of_no_match(monkeypatch) -> None:
    # T020 on the live path: a throttled 429 is retried after Retry-After,
    # never swallowed into an empty candidate list.
    sleeps: list = []
    monkeypatch.setattr("agents.sheets.lyrics.time.sleep", sleeps.append)
    calls: list = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, text="slow", headers={"Retry-After": "2"})
        return httpx.Response(200, text=(FIXTURES / "lrclib_search.json").read_text())

    http, seen = _client_for(handler)
    assert search("Riptide", genius_token=None, client=http) != []
    assert len(seen) == 2
    assert 2.0 in sleeps


def test_search_persistent_lrclib_429_with_no_other_provider_is_unavailable(monkeypatch) -> None:
    # LRCLIB is the only configured provider here: its persistent 429 means
    # the search never ran, which must surface as a provider failure (FR-007
    # error-with-retry) rather than an empty list the UI renders as no-match.
    monkeypatch.setattr("agents.sheets.lyrics.time.sleep", lambda _s: None)
    http, _ = _client_for(lambda req: httpx.Response(429, text="slow"))
    with pytest.raises(CandidatesUnavailableError):
        search("Riptide", genius_token=None, client=http)


def test_search_provider_failure_falls_back_to_keyless_candidates(monkeypatch) -> None:
    # LRCLIB `503 ServerOverloaded` is the only attempted provider and it never
    # answered: keyless enrichment must supply candidates instead of a provider
    # error (009 FR-001).
    from agents.sheets.enrich import EnrichedCandidate

    monkeypatch.setattr(
        "agents.sheets.enrich.candidates_free.search",
        lambda q: [EnrichedCandidate(title="Riptide", artist="Vance Joy")],
    )
    http, _ = _client_for(lambda req: httpx.Response(503, text="busy"))
    cands = search("Riptide", genius_token=None, client=http)
    assert [(c["title"], c["artist"]) for c in cands] == [("Riptide", "Vance Joy")]
    assert all("duckduckgo" in c["provider_refs"] for c in cands)


def test_search_provider_failure_with_no_keyless_hits_is_unavailable(monkeypatch) -> None:
    monkeypatch.setattr("agents.sheets.enrich.candidates_free.search", lambda q: [])
    http, _ = _client_for(lambda req: httpx.Response(503, text="busy"))
    with pytest.raises(CandidatesUnavailableError):
        search("Riptide", genius_token=None, client=http)


def test_search_provider_hits_never_mix_in_keyless_candidates(monkeypatch) -> None:
    # A provider that answered with hits is authoritative: keyless web candidates
    # only fill zero-hit or all-failed searches, never pad a Genius result list.
    from agents.sheets.enrich import EnrichedCandidate

    monkeypatch.setattr(
        "agents.sheets.enrich.candidates_free.search",
        lambda q: [EnrichedCandidate(title="Creep", artist="Radiohead")],
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.genius.com":
            return httpx.Response(200, text=(FIXTURES / "genius_search.json").read_text())
        return httpx.Response(503, text="busy")

    http, _ = _client_for(handler)
    cands = search("Riptide", genius_token="tok", client=http)
    assert cands
    assert not any("duckduckgo" in c["provider_refs"] for c in cands)


def test_search_lrclib_failure_degrades_to_genius_candidates() -> None:
    # The Genius token is the second provider: with LRCLIB down, Genius hits are the
    # candidates, and keyless enrichment is not needed (009 FR-001 applies only when
    # no provider answered with hits).
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.genius.com":
            return httpx.Response(200, text=(FIXTURES / "genius_search.json").read_text())
        return httpx.Response(503, text="busy")

    http, _ = _client_for(handler)
    cands = search("Riptide", genius_token="tok", client=http)
    assert cands
    assert all("genius_id" in c["provider_refs"] for c in cands)
