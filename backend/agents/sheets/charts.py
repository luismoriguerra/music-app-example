"""Ultimate Guitar chart client (T031, 004)."""

from __future__ import annotations

import html
import json
import re
import time
from dataclasses import dataclass

import httpx

from agents.sheets.normalize import fold_text

SEARCH_URL = "https://www.ultimate-guitar.com/search.php"
_UKULELE = "Ukulele Chords"
_ALLOWED = {_UKULELE, "Chords"}


class ChartError(RuntimeError):
    """Raised when chart transport fails persistently."""


@dataclass(frozen=True)
class ChartResult:
    title: str
    artist: str
    url: str
    rating: float
    votes: int
    category: str


def _artist_matches(chart_artist: str, picked: str) -> bool:
    a, b = fold_text(chart_artist), fold_text(picked)
    return bool(a and b) and (a in b or b in a)


_QUALIFIER_RE = re.compile(r"\s*[\(\[][^\)\]]*[\)\]]\s*$")


def _strip_qualifiers(title: str) -> str:
    """Drop trailing UG qualifiers: "Yesterday (ver 2)", "Hurt [Acoustic]"."""
    prev = None
    while prev != title:
        prev, title = title, _QUALIFIER_RE.sub("", title)
    return title


def _title_matches(chart_title: str, picked: str, *, loose: bool) -> bool:
    """Exact folded title after stripping qualifiers. `loose` (containment
    either way) is only for charts by the picked artist — an artist match
    makes "Hallelujah" vs "Hallelujah (Live)" safe, while without it
    "Yesterday" ⊂ "Yesterday Once More" would relabel the sheet as another
    song (FR-005 re-stamps identity from a chart hit)."""
    a, b = fold_text(_strip_qualifiers(chart_title)), fold_text(_strip_qualifiers(picked))
    if not (a and b):
        return False
    return a == b or (loose and (a in b or b in a))


def pick_best(
    results: list[ChartResult], artist: str | None = None, title: str | None = None
) -> ChartResult | None:
    """Pick the top chord chart for the picked song (FR-006).

    UG search is fuzzy and ignores the artist param (verified live, T053), so
    both filters happen here. Charts by the picked artist win when any exist
    (title may match loosely); otherwise covers qualify only on an exact
    folded title after stripping "(ver 2)"-style qualifiers — a chart hit
    re-stamps identity per FR-005, so a loose cover title would relabel the
    sheet as another song. Within the pool: ukulele preferred, then rating x
    votes. None -> caller falls through to the lyrics + model path.
    """
    chorded = [r for r in results if r.category in _ALLOWED]
    if not chorded:
        return None
    by_artist = [r for r in chorded if _artist_matches(r.artist, artist)] if artist else []
    if title:
        # Artist-matched charts may use loose title matching; covers (no
        # artist match) need the exact folded title.
        by_artist = [r for r in by_artist if _title_matches(r.title, title, loose=True)]
        chorded = [r for r in chorded if _title_matches(r.title, title, loose=False)]
    chorded = by_artist or chorded
    if not chorded:
        return None
    ukulele = [r for r in chorded if r.category == _UKULELE]
    pool = ukulele or chorded
    return max(pool, key=lambda r: (r.rating * r.votes, r.votes))


def _extract_store(html_text: str) -> dict:
    """Extract the js-store JSON payload from UG HTML."""
    marker = "data-content="
    idx = html_text.find(marker)
    if idx == -1:
        raise ChartError("js-store payload missing")
    start = html_text.find("{", idx)
    if start == -1:
        raise ChartError("js-store payload missing")
    blob = html.unescape(html_text[start:])
    try:
        payload, _ = json.JSONDecoder().raw_decode(blob)
    except json.JSONDecodeError as exc:
        raise ChartError(f"js-store JSON unparsable: {exc}") from exc
    if not isinstance(payload, dict):
        raise ChartError("js-store payload missing")
    return payload


def _parse_results(payload: dict) -> list[ChartResult]:
    try:
        rows = payload["store"]["page"]["data"]["results"]
    except (KeyError, TypeError):
        return []
    if not isinstance(rows, list):
        return []
    out: list[ChartResult] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            out.append(
                ChartResult(
                    title=str(row.get("song_name", "")),
                    artist=str(row.get("artist_name", "")),
                    url=str(row.get("tab_url", "")),
                    rating=float(row.get("rating") or 0.0),
                    votes=int(row.get("votes") or 0),
                    category=str(row.get("type", "")),
                )
            )
        except (ValueError, TypeError):
            continue
    return [r for r in out if r.url and r.title]


def _parse_tab(payload: dict) -> str:
    try:
        content = payload["store"]["page"]["data"]["tab_view"]["wiki_tab"]["content"]
    except (KeyError, TypeError) as exc:
        raise ChartError(f"tab content missing: {exc}") from exc
    if not isinstance(content, str) or not content.strip():
        raise ChartError("tab content missing")
    for tag in ("[ch]", "[/ch]", "[tab]", "[/tab]"):
        content = content.replace(tag, "")
    return content


class ChartClient:
    """httpx UG client with polite throttle and 10s timeouts."""

    TIMEOUT_S = 10.0

    def __init__(self, client: httpx.Client | None = None, throttle_s: float = 1.5) -> None:
        self._http = client or httpx.Client(timeout=self.TIMEOUT_S)
        self._throttle_s = throttle_s
        self._seen_request = False

    def _get(self, url: str, params: dict | None = None) -> httpx.Response:
        if self._throttle_s > 0 and self._seen_request:
            time.sleep(self._throttle_s)
        self._seen_request = True
        return self._http.get(url, params=params, timeout=self.TIMEOUT_S)

    def search(self, title: str, artist: str) -> list[ChartResult]:
        """Search UG: exact-artist first, title-only fallback on empty/error."""
        attempts = [
            {"title": title, "artist": artist, "view_state": "advanced"},
            {"title": title, "view_state": "advanced"},
        ]
        transport_errors = 0
        for params in attempts:
            try:
                resp = self._get(SEARCH_URL, params=params)
            except (httpx.TransportError, httpx.TimeoutException):
                transport_errors += 1
                continue
            if resp.status_code != 200:
                continue
            try:
                payload = _extract_store(resp.text)
            except ChartError:
                continue
            results = _parse_results(payload)
            if results:
                return results
        if transport_errors == len(attempts):
            raise ChartError("chart search transport failed")
        return []

    def fetch(self, tab_url: str) -> str:
        """Fetch a tab page and return plain-text chart content."""
        try:
            resp = self._get(tab_url)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            raise ChartError(f"chart fetch failed: {exc}") from exc
        if resp.status_code != 200:
            raise ChartError(f"chart fetch HTTP {resp.status_code}")
        payload = _extract_store(resp.text)
        return _parse_tab(payload)
