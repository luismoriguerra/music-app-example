"""Unit tests for core enrichment helpers (DR-005, T004, T005, T006)."""

import time

import httpx
import pytest

from agents.sheets.enrich import (
    EnrichedCandidate,
    EnrichedLink,
    SongContext,
    bounded_get,
    compute_deadline,
    dedup_and_append_links,
    dedup_and_rank_candidates,
    fold_identity,
    is_expired,
    make_degraded_entry,
    read_body,
    remaining_time,
)


def test_fold_identity_matches_004_identity_key():
    from agents.sheets.candidates import normalize_identity

    assert fold_identity("Creep", "Radiohead") == "creep|radiohead"
    assert fold_identity("Don't Look Back In Anger!", "Oasis...") == "dontlookbackinanger|oasis"
    # Accents fold, so enriched "José José" dedupes against a configured "Jose Jose".
    assert fold_identity("Almohada", "José José") == fold_identity("Almohada", "Jose Jose")
    assert fold_identity("Almohada", "José José") == normalize_identity("Almohada", "Jose Jose")


def test_fold_identity_preserves_non_latin_scripts():
    from agents.sheets.enrich import dedup_and_rank_candidates

    # Cyrillic / Japanese must not fold to '' (which would collapse every such song).
    assert fold_identity("Группа крови", "Кино") == "группакрови|кино"
    assert fold_identity("紅蓮華", "LiSA") != fold_identity("炎", "LiSA")
    ranked = dedup_and_rank_candidates(
        [{"title": "紅蓮華", "artist": "LiSA", "provider_refs": {"lrclib_id": 1}}],
        [
            EnrichedCandidate(title="炎", artist="LiSA"),
            EnrichedCandidate(title="Кукушка", artist="Кино"),
        ],
    )
    assert [c["title"] for c in ranked] == ["紅蓮華", "炎", "Кукушка"]


def test_dedup_and_rank_candidates():
    primary = [
        {"title": "Creep", "artist": "Radiohead", "provider_refs": {"genius_id": 123}},
        {"title": "Karma Police", "artist": "Radiohead", "provider_refs": {"genius_id": 456}},
    ]
    enriched = [
        EnrichedCandidate(title="Creep", artist="Radiohead", origin="duckduckgo", confidence=0.8),
        EnrichedCandidate(
            title="High and Dry", artist="Radiohead", origin="duckduckgo", confidence=0.7
        ),
        {"title": "karma police", "artist": "radiohead", "origin": "duckduckgo"},
        EnrichedCandidate(
            title="No Surprises", artist="Radiohead", origin="duckduckgo", confidence=0.6
        ),
    ]

    ranked = dedup_and_rank_candidates(primary, enriched)

    # Primary candidates stay at the front unchanged
    assert ranked[0]["title"] == "Creep"
    assert ranked[0]["provider_refs"] == {"genius_id": 123}
    assert ranked[1]["title"] == "Karma Police"

    # Enriched duplicate "Creep" and "karma police" are dropped; remaining appended
    titles = [c["title"] for c in ranked]
    assert titles == ["Creep", "Karma Police", "High and Dry", "No Surprises"]
    assert ranked[2]["origin"] == "duckduckgo"
    assert ranked[2]["provider_refs"] == {"duckduckgo": "highanddry|radiohead"}


def test_dedup_and_append_links():
    existing = [
        {"label": "Genius", "url": "https://genius.com/Radiohead-creep-lyrics", "kind": "lyrics"},
        {"label": "UG", "url": "https://tabs.ultimate-guitar.com/creep", "kind": "chords"},
    ]
    new_links = [
        EnrichedLink(
            label="Duplicate UG",
            url="https://tabs.ultimate-guitar.com/creep",
            kind="chords",
        ),
        EnrichedLink(label="Attribution URL", url="https://lrclib.net/api/get/999", kind="lyrics"),
        EnrichedLink(
            label="Official Video",
            url="https://www.youtube.com/watch?v=XFkzRNyygfk",
            kind="video",
        ),
        {
            "label": "Songfacts",
            "url": "https://www.songfacts.com/facts/radiohead/creep",
            "kind": "lyrics",
        },
    ]
    attribution = {"https://lrclib.net/api/get/999"}

    result = dedup_and_append_links(existing, new_links, attribution_urls=attribution, max_links=4)

    assert len(result) == 4
    urls = [link_item["url"] for link_item in result]
    assert urls == [
        "https://genius.com/Radiohead-creep-lyrics",
        "https://tabs.ultimate-guitar.com/creep",
        "https://www.youtube.com/watch?v=XFkzRNyygfk",
        "https://www.songfacts.com/facts/radiohead/creep",
    ]


def test_deadline_helpers():
    deadline = compute_deadline(0.05)
    assert not is_expired(deadline)
    assert remaining_time(deadline, max_s=1.0) > 0.0

    time.sleep(0.06)
    assert is_expired(deadline)
    assert remaining_time(deadline, max_s=1.0) == 0.0


def test_make_degraded_entry():
    d1 = make_degraded_entry(reason="timeout")
    assert d1 == {"part": "enrichment", "reason": "timeout"}

    d2 = make_degraded_entry(reason="quota", part="enrichment")
    assert d2 == {"part": "enrichment", "reason": "quota"}

    d3 = make_degraded_entry(reason="unknown_error")
    assert d3 == {"part": "enrichment", "reason": "unavailable"}


def test_dataclass_conversions():
    c = EnrichedCandidate(title="Yesterday", artist="The Beatles")
    d_c = c.to_dict()
    assert d_c["title"] == "Yesterday"
    assert d_c["artist"] == "The Beatles"
    assert d_c["origin"] == "duckduckgo"
    assert d_c["provider_refs"] == {"duckduckgo": "yesterday|thebeatles"}

    link = EnrichedLink(label="YouTube", url="https://youtube.com/watch?v=123", kind="video")
    d_l = link.to_dict()
    assert d_l == {"label": "YouTube", "url": "https://youtube.com/watch?v=123", "kind": "video"}

    ctx = SongContext(
        text="Context text", source="wikipedia", source_url="https://en.wikipedia.org/wiki/Song"
    )
    d_ctx = ctx.to_dict()
    assert d_ctx == {
        "text": "Context text",
        "source": "wikipedia",
        "source_url": "https://en.wikipedia.org/wiki/Song",
    }


def test_validate_song_context():
    import pytest

    from db_models import validate_song_context

    assert validate_song_context(None) is None

    valid = {
        "text": "Pablo Honey is the debut studio album by Radiohead.",
        "source": "wikipedia",
        "source_url": "https://en.wikipedia.org/wiki/Pablo_Honey",
    }
    assert validate_song_context(valid) == valid

    # Not a dict
    with pytest.raises(ValueError, match="context must be null or a dict"):
        validate_song_context("not a dict")

    # Blank text
    with pytest.raises(ValueError, match="context.text must be a non-blank string"):
        validate_song_context(
            {"text": "  ", "source": "wikipedia", "source_url": "https://example.com"}
        )

    # Text too long (>600)
    with pytest.raises(ValueError, match="context.text must be ≤600 characters"):
        validate_song_context(
            {"text": "x" * 601, "source": "wikipedia", "source_url": "https://example.com"}
        )

    # Insecure URL
    with pytest.raises(ValueError, match="context.source_url must be an https URL"):
        validate_song_context(
            {"text": "Valid text", "source": "wikipedia", "source_url": "http://example.com"}
        )


def test_validate_degraded_allows_enrichment():
    from db_models import validate_degraded

    entries = [{"part": "enrichment", "reason": "timeout"}]
    assert validate_degraded(entries) == entries


def _redirect_forever(delay_s: float, seen: list):
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.extensions.get("timeout"))
        time.sleep(delay_s)
        return httpx.Response(302, headers={"Location": f"/hop{len(seen)}"})

    return httpx.MockTransport(handler)


def _client(transport: httpx.MockTransport) -> httpx.Client:
    return httpx.Client(transport=transport)


def test_bounded_get_caps_redirect_hops():
    # httpx follows 20 redirects by default; enrichment follows at most 3.
    seen: list = []
    with pytest.raises(httpx.TooManyRedirects):
        bounded_get(
            _client(_redirect_forever(0.0, seen)),
            "https://slow.example/",
            compute_deadline(5.0),
            max_bytes=1024,
            partial_ok=True,
        )
    assert len(seen) == 4  # original request + 3 redirects


def test_bounded_get_skips_hops_without_budget_and_clamps_timeouts():
    # Each hop gets min(2 s, remaining); a hop with < 0.3 s left is never sent.
    seen: list = []
    started = time.monotonic()
    with pytest.raises(httpx.TimeoutException):
        bounded_get(
            _client(_redirect_forever(0.3, seen)),
            "https://slow.example/",
            compute_deadline(0.5),
            max_bytes=1024,
            partial_ok=True,
        )
    assert time.monotonic() - started < 0.6
    assert len(seen) == 1
    assert all(v <= 0.5 for v in seen[0].values())


def test_bounded_get_never_reads_redirect_bodies():
    # httpx's own redirect loop reads 3xx bodies with no clock or size cap.
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return httpx.Response(302, headers={"Location": "/final"}, content=_trickle())
        return httpx.Response(200, content=b"<title>ok</title>")

    started = time.monotonic()
    resp, body = bounded_get(
        _client(httpx.MockTransport(handler)),
        "https://slow.example/",
        compute_deadline(3.0),
        max_bytes=1024,
        partial_ok=True,
    )
    assert (resp.status_code, body) == (200, b"<title>ok</title>")
    assert time.monotonic() - started < 0.5  # the 3xx body trickles for 5 s


def _trickle(chunks: int = 50, delay_s: float = 0.1):
    for _ in range(chunks):
        time.sleep(delay_s)
        yield b'{"k": "' + b"x" * 16


def test_read_body_stops_trickling_json_at_the_deadline():
    # Read timeouts reset per chunk; the stage clock must end the read.
    transport = httpx.MockTransport(lambda r: httpx.Response(200, content=_trickle()))
    client = httpx.Client(transport=transport)
    started = time.monotonic()
    with client.stream("GET", "https://slow.example/") as resp:
        with pytest.raises(httpx.TimeoutException):
            read_body(resp, compute_deadline(0.3), 1 << 20, partial_ok=False)
    assert time.monotonic() - started < 0.6
