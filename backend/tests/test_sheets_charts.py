"""Chart client tests (T019): Python UG client over httpx.

Principle III: defines the `agents.sheets.charts` API before T031 —
search js-store parse (incl. ukulele form) → pick top Chords/Ukulele
Chords by rating × votes (ukulele preferred) → fetch tab_url →
wiki_tab.content with [ch]/[tab] tags stripped. Hermetic: MockTransport
serves recorded fixtures wrapped in js-store HTML.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from agents.sheets.charts import ChartClient, ChartError, ChartResult, pick_best

FIXTURES = Path(__file__).parent / "fixtures"


def _store_html(payload: dict) -> str:
    blob = json.dumps(payload)
    return f"<html><body><div class='js-store' data-content='{blob}'></div></body></html>"


def _search_store() -> dict:
    return json.loads((FIXTURES / "chart_search.json").read_text())


def _tab_store() -> dict:
    return json.loads((FIXTURES / "chart_tab.json").read_text())


def _client_for(handler) -> tuple[ChartClient, list]:
    seen: list = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    transport = httpx.MockTransport(wrapped)
    return ChartClient(client=httpx.Client(transport=transport), throttle_s=0), seen


def test_pick_best_prefers_ukulele_category() -> None:
    results = [
        ChartResult("R", "V", "https://u/c", 4.79, 3456, "Chords"),
        ChartResult("R", "V", "https://u/k", 4.89, 1234, "Ukulele Chords"),
    ]
    assert pick_best(results).url == "https://u/k"


def test_pick_best_orders_by_rating_times_votes() -> None:
    low = ChartResult("R", "V", "https://u/low", 4.50, 100, "Chords")
    high = ChartResult("R", "V", "https://u/high", 4.60, 5000, "Chords")
    assert pick_best([low, high]) == high


def test_pick_best_filters_non_chord_types() -> None:
    tabs = [ChartResult("R", "V", "https://u/t", 5.0, 9999, "Tabs")]
    assert pick_best(tabs) is None
    assert pick_best([]) is None


def test_pick_best_prefers_picked_artist_over_higher_rated_collision() -> None:
    # Title collision: same title, different songs. The learner picked NIN
    # (FR-006); the Aguilera chart outranks it on rating x votes.
    nin = ChartResult("Hurt", "Nine Inch Nails", "https://u/nin", 4.5, 500, "Chords")
    xtina = ChartResult("Hurt", "Christina Aguilera", "https://u/xt", 4.9, 9000, "Chords")
    assert pick_best([xtina, nin], artist="Nine Inch Nails") == nin


def test_pick_best_artist_match_folds_punctuation_and_articles() -> None:
    iz = ChartResult(
        "Over The Rainbow", "Israel Kamakawiwoʻole", "https://u/iz", 4.8, 100, "Chords"
    )
    eva = ChartResult("Over The Rainbow", "Eva Cassidy", "https://u/eva", 4.9, 9000, "Chords")
    assert pick_best([eva, iz], artist="Israel Kamakawiwo'ole") == iz
    beatles = ChartResult("Yesterday", "The Beatles", "https://u/b", 4.8, 100, "Chords")
    other = ChartResult("Yesterday", "Someone", "https://u/o", 4.9, 9000, "Chords")
    assert pick_best([other, beatles], artist="Beatles") == beatles


def test_pick_best_falls_back_to_any_artist_when_none_match() -> None:
    # Cover with no chart under the picked performer keeps today's behavior.
    beatles = ChartResult("Yesterday", "The Beatles", "https://u/b", 4.9, 9000, "Chords")
    assert pick_best([beatles], artist="Matt Monro") == beatles
    assert pick_best([beatles], artist="") == beatles


def test_pick_best_rejects_fuzzy_title_mismatch() -> None:
    # Live (2026-09-16): pick "Lily tree" / Mili -> UG fuzzy search returned
    # "Lily Dudgeon - Jacaranda Tree" / Misc Originals and we shipped it.
    # With FR-005 re-stamping identity from the chart that relabels the sheet
    # as another song, so a title guard is mandatory.
    wrong = ChartResult(
        "Lily Dudgeon - Jacaranda Tree", "Misc Originals", "https://u/w", 4.9, 9000, "Chords"
    )
    assert pick_best([wrong], artist="Mili", title="Lily tree") is None
    # Cover (no artist match): qualifiers stripped, then EXACT folded title.
    ver2 = ChartResult("Yesterday (ver 2)", "The Beatles", "https://u/b", 4.8, 100, "Chords")
    assert pick_best([ver2], artist="Matt Monro", title="Yesterday") == ver2
    once_more = ChartResult("Yesterday Once More", "Carpenters", "https://u/c", 4.9, 9000, "Chords")
    assert pick_best([once_more], artist="Matt Monro", title="Yesterday") is None
    assert pick_best([once_more, ver2], artist="Matt Monro", title="Yesterday") == ver2
    # Artist-matched chart may match the title loosely (live variants).
    live = ChartResult(
        "Hallelujah (Live at Glastonbury)", "Leonard Cohen", "https://u/l", 4.9, 10, "Chords"
    )
    assert pick_best([live], artist="Leonard Cohen", title="Hallelujah") == live
    helpless = ChartResult("Helpless", "The Beatles", "https://u/h", 4.9, 9000, "Chords")
    assert pick_best([helpless], artist="The Beatles", title="Help") == helpless  # loose, by artist
    assert pick_best([helpless], artist="Someone", title="Help") is None  # cover: exact only
    # No title given -> legacy behavior (no title filter).
    assert pick_best([wrong], artist="Mili") == wrong


def test_search_parses_js_store_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/search.php"
        assert request.url.params["title"] == "Riptide"
        return httpx.Response(200, text=_store_html(_search_store()))

    client, _ = _client_for(handler)
    results = client.search("Riptide", "Vance Joy")
    assert len(results) >= 2
    top = pick_best(results)
    assert top.title == "Riptide" and top.artist == "Vance Joy"
    assert top.category == "Ukulele Chords"
    assert top.url.startswith("https://tabs.ultimate-guitar.com/tab/")


def test_search_exact_artist_empty_falls_back_to_title_only() -> None:
    empty = {"store": {"page": {"data": {"results": []}}}}

    def handler(request: httpx.Request) -> httpx.Response:
        if "artist" in request.url.params:
            return httpx.Response(200, text=_store_html(empty))
        return httpx.Response(200, text=_store_html(_search_store()))

    client, seen = _client_for(handler)
    results = client.search("Riptide", "Vance Joy")
    assert len(seen) == 2
    assert "artist" not in seen[1].url.params
    assert results != []


def test_search_http_error_falls_back_to_title_only() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "artist" in request.url.params:
            return httpx.Response(500, text="boom")
        return httpx.Response(200, text=_store_html(_search_store()))

    client, seen = _client_for(handler)
    assert client.search("Riptide", "Vance Joy") != []
    assert len(seen) == 2


def test_search_both_attempts_empty_is_miss_not_error() -> None:
    empty = {"store": {"page": {"data": {"results": []}}}}
    client, _ = _client_for(lambda req: httpx.Response(200, text=_store_html(empty)))
    assert client.search("Riptide", "Vance Joy") == []


def test_search_persistent_transport_error_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    client, _ = _client_for(handler)
    with pytest.raises(ChartError):
        client.search("Riptide", "Vance Joy")


def test_fetch_strips_ch_and_tab_tags() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "riptide" in str(request.url)
        return httpx.Response(200, text=_store_html(_tab_store()))

    client, _ = _client_for(handler)
    text = client.fetch("https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-ukulele-1")
    assert "[ch]" not in text and "[/ch]" not in text
    assert "[tab]" not in text and "[/tab]" not in text
    assert "[Verse 1]" in text and "Am" in text


def test_fetch_http_error_raises() -> None:
    client, _ = _client_for(lambda req: httpx.Response(404, text="nope"))
    with pytest.raises(ChartError):
        client.fetch("https://tabs.ultimate-guitar.com/tab/x")


def test_default_timeout_is_10s() -> None:
    assert ChartClient.TIMEOUT_S == 10.0
    assert ChartClient()._http.timeout == httpx.Timeout(10.0)


def test_polite_throttle_between_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list = []
    monkeypatch.setattr("agents.sheets.charts.time.sleep", sleeps.append)
    transport = httpx.MockTransport(
        lambda req: httpx.Response(200, text=_store_html(_search_store()))
    )
    client = ChartClient(client=httpx.Client(transport=transport), throttle_s=1.5)
    client.search("Riptide", "Vance Joy")
    client.search("Riptide", "Vance Joy")
    assert sleeps == [1.5]
