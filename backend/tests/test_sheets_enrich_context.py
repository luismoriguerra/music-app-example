"""Fixture tests for keyless Wikipedia song context via the MediaWiki API (T016, DR-010, US3)."""

import json
import time
from pathlib import Path

import httpx

from agents.sheets.enrich.context_free import fetch as fetch_context_free
from agents.sheets.enrich.context_free import truncate_summary

_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "enrich" / "wikipedia_context.json").read_text()
)


def _client(search_titles, pages, *, delay_s: float = 0.0, seen: list | None = None):
    """MockTransport serving MediaWiki `list=search` and `prop=extracts` responses."""

    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        if delay_s:
            time.sleep(delay_s)
            raise httpx.ReadTimeout("slow upstream", request=request)
        params = request.url.params
        if params.get("list") == "search":
            return httpx.Response(
                200, json={"query": {"search": [{"title": t} for t in search_titles]}}
            )
        return httpx.Response(200, json={"query": {"pages": pages}})

    return httpx.Client(transport=httpx.MockTransport(handler))


def _page(title, extract, url, **extra):
    return {"title": title, "extract": extract, "fullurl": url, **extra}


def test_truncate_summary_bounds_to_600():
    short_text = "A short encyclopedic summary."
    assert truncate_summary(short_text) == short_text

    snippet = "Radiohead was an English rock band formed in Abingdon, Oxfordshire, in 1985. "
    long_text = (snippet * 10).strip()
    assert len(long_text) > 600
    truncated = truncate_summary(long_text)
    assert len(truncated) <= 600
    assert truncated.endswith("...") or truncated.endswith(".")


def test_truncate_summary_never_exceeds_limit_with_ellipsis():
    # No sentence break, a space at index 598: the old fallback returned 601 chars,
    # which validate_song_context rejects (<=600) and would 500 the generate.
    text = "a" * 598 + " " + "b" * 50
    out = truncate_summary(text)
    assert len(out) <= 600
    assert out.endswith("...")


def test_fetch_context_from_mediawiki_api_with_identified_user_agent():
    data = _FIXTURE["page_data"]
    seen: list = []
    client = _client(
        _FIXTURE["search_hits"],
        [_page(data["title"], data["summary"], data["url"])],
        seen=seen,
    )
    ctx = fetch_context_free("Creep", "Radiohead", deadline_s=3.0, client=client)

    assert ctx is not None
    assert ctx.source == "wikipedia"
    assert ctx.source_url == "https://en.wikipedia.org/wiki/Creep_(Radiohead_song)"
    assert "Creep" in ctx.text and len(ctx.text) <= 600
    assert len(seen) == 2  # one search + one batched page read
    assert all("music-app-example" in r.headers["user-agent"] for r in seen)


def test_fetch_skips_disambiguation_and_missing_pages_in_rank_order():
    client = _client(
        ["Stay", "Stay (Rihanna song)"],
        [
            {"title": "Stay", "pageprops": {"disambiguation": ""}, "extract": "Stay may refer to"},
            _page(
                "Stay (Rihanna song)",
                "Stay is a song by Rihanna.",
                "https://en.wikipedia.org/wiki/Stay_(Rihanna_song)",
            ),
        ],
    )
    ctx = fetch_context_free("Stay", "Rihanna", deadline_s=3.0, client=client)
    assert ctx is not None and ctx.text == "Stay is a song by Rihanna."


def test_fetch_returns_none_on_miss():
    client = _client([], [])
    assert fetch_context_free("Unknown Song", "Unknown Artist", client=client) is None


def test_fetch_is_bounded_and_never_raises_on_timeout():
    # A stalled upstream must not hang the pipeline: every call carries a timeout.
    client = _client(["X"], [], delay_s=0.05)
    started = time.monotonic()
    assert fetch_context_free("Creep", "Radiohead", deadline_s=1.0, client=client) is None
    assert time.monotonic() - started < 1.0


def test_fetch_skips_calls_when_budget_is_below_minimum():
    seen: list = []
    client = _client(["X"], [], seen=seen)
    assert fetch_context_free("Creep", "Radiohead", deadline_s=0.1, client=client) is None
    assert seen == []


def test_trickling_mediawiki_response_stops_at_the_stage_deadline():
    # httpx read timeouts reset per chunk; the JSON read must honour the stage clock.
    def trickle():
        for _ in range(50):
            time.sleep(0.1)
            yield b'{"query": ' + b" " * 16

    transport = httpx.MockTransport(lambda r: httpx.Response(200, content=trickle()))
    started = time.monotonic()
    assert (
        fetch_context_free(
            "Creep", "Radiohead", deadline_s=1.0, client=httpx.Client(transport=transport)
        )
        is None
    )
    assert time.monotonic() - started < 1.5  # 5 s without the clock check
