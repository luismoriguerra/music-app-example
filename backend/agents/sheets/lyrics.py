"""LRCLIB search/fetch + lyrics.ovh fallback client (T032, 004).

`search` is one throttled, 429-aware keyword query returning raw LRCLIB
rows; the R2 long→short ladder lives in `agents.sheets.candidates`.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

import httpx

LRCLIB_BASE = "https://lrclib.net"
OVH_BASE = "https://api.lyrics.ovh"
USER_AGENT = "music-app-example/004-lyrics-chords (private hobby)"
TIMEOUT_S = 10.0


class LyricsError(RuntimeError):
    """Transport-level lyrics failure (maps to PROVIDER_ERROR)."""


class LyricsMiss(RuntimeError):  # noqa: N818
    """No lyrics found anywhere (maps to NO_MATCH)."""


@dataclass(frozen=True)
class LyricResult:
    text: str
    source: str  # lrclib | lyrics_ovh
    url: str


def _retry_after_s(resp: httpx.Response) -> float:
    raw = resp.headers.get("Retry-After", "")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 1.0


class LyricsClient:
    """httpx lyrics client with UA, throttle, and 429 honor."""

    def __init__(self, client: httpx.Client | None = None, throttle_s: float = 0.3) -> None:
        self._http = client or httpx.Client(timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
        # Ensure the UA is present even on injected test clients.
        if "user-agent" not in {k.lower() for k in self._http.headers}:
            self._http.headers["User-Agent"] = USER_AGENT
        else:
            # Guarantee the music-app-example token without clobbering test UAs.
            if "music-app-example" not in self._http.headers.get("User-Agent", ""):
                self._http.headers["User-Agent"] = USER_AGENT
        self._throttle_s = throttle_s
        self._seen = False

    def _get(self, url: str, params: dict | None = None) -> httpx.Response:
        if self._throttle_s > 0 and self._seen:
            time.sleep(self._throttle_s)
        self._seen = True
        return self._http.get(url, params=params, timeout=TIMEOUT_S)

    def _get_with_429(self, url: str, params: dict | None = None) -> httpx.Response:
        try:
            resp = self._get(url, params=params)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            raise LyricsError(f"lyrics transport failed: {exc}") from exc
        if resp.status_code == 429:
            time.sleep(_retry_after_s(resp))
            try:
                resp = self._get(url, params=params)
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                raise LyricsError(f"lyrics transport failed: {exc}") from exc
            if resp.status_code == 429:
                raise LyricsError("lyrics rate limited")
        return resp

    def search(self, query: str) -> list[dict]:
        """One LRCLIB keyword query → raw rows (`[]` only on a real zero-hit).

        Raises LyricsError on transport failure, persistent 429, non-200, or
        an unparsable body — the caller must be able to tell "provider did
        not answer" from "answered with nothing" (FR-007 no-match vs error).
        """
        resp = self._get_with_429(f"{LRCLIB_BASE}/api/search", params={"q": query})
        if resp.status_code != 200:
            raise LyricsError(f"lrclib search HTTP {resp.status_code}")
        try:
            payload = json.loads(resp.text or "[]")
        except json.JSONDecodeError as exc:
            raise LyricsError("lrclib search: unparsable JSON") from exc
        if not isinstance(payload, list):
            raise LyricsError("lrclib search: unexpected payload shape")
        return [row for row in payload if isinstance(row, dict)]

    def fetch(self, title: str, artist: str, lrclib_id: int | None = None) -> LyricResult:
        """Exact LRCLIB fetch (track+artist, then id) with ovh fallback."""
        # 1. LRCLIB exact by track+artist.
        try:
            resp = self._get_with_429(
                f"{LRCLIB_BASE}/api/get",
                params={"track_name": title, "artist_name": artist},
            )
        except LyricsError:
            raise
        if resp.status_code == 200:
            try:
                payload = json.loads(resp.text or "{}")
            except json.JSONDecodeError:
                payload = {}
            got = self._lrclib_hit(payload)
            if got is not None:
                return got
        elif resp.status_code not in (404,):
            # Non-200 non-404 (e.g. 500) counts as miss for the fallback
            # chain only when it is not transport-level; transport already
            # raised. Fall through to id/ovh.
            pass
        # 2. LRCLIB by id when the candidate carries one.
        if lrclib_id is not None:
            try:
                resp = self._get_with_429(f"{LRCLIB_BASE}/api/get/{lrclib_id}")
            except LyricsError:
                raise
            if resp.status_code == 200:
                try:
                    payload = json.loads(resp.text or "{}")
                except json.JSONDecodeError:
                    payload = {}
                got = self._lrclib_hit(payload)
                if got is not None:
                    return got
        # 3. lyrics.ovh fallback.
        try:
            resp = self._get(f"{OVH_BASE}/v1/{artist}/{title}")
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            raise LyricsError(f"lyrics transport failed: {exc}") from exc
        if resp.status_code == 200:
            try:
                payload = json.loads(resp.text or "{}")
            except json.JSONDecodeError:
                payload = {}
            lyrics = payload.get("lyrics") if isinstance(payload, dict) else None
            if isinstance(lyrics, str) and lyrics.strip():
                return LyricResult(
                    text=lyrics.strip(),
                    source="lyrics_ovh",
                    url=f"https://api.lyrics.ovh/v1/{artist}/{title}",
                )
        raise LyricsMiss(f"no lyrics for {title!r} by {artist!r}")

    @staticmethod
    def _lrclib_hit(payload: object) -> LyricResult | None:
        if not isinstance(payload, dict):
            return None
        if payload.get("instrumental"):
            return None
        text = payload.get("plainLyrics")
        if not isinstance(text, str) or not text.strip():
            return None
        try:
            lyric_id = int(payload.get("id"))
        except (TypeError, ValueError):
            return None
        return LyricResult(
            text=text.strip(), source="lrclib", url=f"https://lrclib.net/api/get/{lyric_id}"
        )
