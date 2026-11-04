"""Keyless web-search candidate fallback for weak-metadata queries (US1, DR-001, FR-001).

Pipeline per search hit: clean site/format noise from the result title, parse a
(title, artist, confidence) triple from one of three recognizable shapes, score it
against the learner's query (typo-tolerant), then deduplicate by accent-folded core
token set keeping the highest-confidence variant. Never raises.
"""

from __future__ import annotations

import difflib
import json
import logging
import re
import unicodedata

from agno.tools.websearch import WebSearchTools

from agents.sheets.enrich import (
    SEARCH_BACKENDS,
    STAGE_TIMEOUT_S,
    EnrichedCandidate,
    compute_deadline,
    is_expired,
    search_timeout,
)

logger = logging.getLogger(__name__)

# --- Cleaning -----------------------------------------------------------------

# Everything after the first " | " or " @ " is a site tail.
_SITE_TAIL_RE = re.compile(r"\s*[@|]\s*.*$")
# " - <known site / domain>" and everything after it.
_SITE_DASH_RE = re.compile(
    r"\s*[-|–—]\s*(?:youtube(?:\s+music)?|apple\s+music|spotify|genius(?:\s+lyrics)?|"
    r"ultimate[\s-]*guitar|e-chords|songsterr|chordie|wikipedia|azlyrics|musixmatch|"
    r"jiosaavn|gaana|shazam|deezer|soundcloud|[\w-]+\.(?:com|net|org|io|tv|fm))\b.*$",
    re.I,
)
# " - Chords and Lyrics", " - Lyrics", " - Tabs" ... and everything after.
_TRAILING_DASH_NOISE_RE = re.compile(
    r"\s*[-|–—]\s*(?:chords?|lyrics?|letras?|tabs?|acordes)(?:\s*(?:and|&|/|y)\s*"
    r"(?:chords?|lyrics?|letras?|tabs?|acordes))*\b.*$",
    re.I,
)
# Parenthetical / bracketed format noise: (Official Video), [Lyrics], (Letra / Lyrics) ...
_BRACKET_NOISE_RE = re.compile(
    r"\s*[\(\[][^\)\]]*\b(?:official|lyrics?|letras?|audio|video|remaster(?:ed)?|live|"
    r"visualizer|hd|hq|4k)\b[^\)\]]*[\)\]]",
    re.I,
)
# Words that are never part of a title/artist wherever they appear.
_GLOBAL_NOISE_RE = re.compile(r"\b(?:chords?|lyrics?|letras?|tabs?|gtp|acordes)\b", re.I)
# Words that are noise only at the END of a segment. Nothing is stripped from the start:
# titles legitimately begin with And/By/With/For/Video/Song ("By the Way", "Song 2").
_END_NOISE_RE = re.compile(
    r"\s+(?:song|and|the|with|for|guitar|video|audio|official|arranged(?:\s+by)?|single|"
    r"album|full|version|cover|tutorial|easy)$",
    re.I,
)
# Streaming-store shape after cleaning: "<Title> - song and by <Artist>".
_STORE_BY_SEGMENT_RE = re.compile(r"^(?:song|track)\b.*?\bby\s+(.+)$", re.I)
_DANGLING_RE = re.compile(r"^[\s,;.:/\-–—|]+|[\s,;.:/\-–—|]+$")
_EMPTY_BRACKETS_RE = re.compile(r"\s*[\(\[]\s*[/\-–—|,]*\s*[\)\]]")
# Store/aggregator listings and other junk that must never become a candidate.
_JUNK_RE = re.compile(
    r"\b(?:download|listen\s+free|listen\s+online|stream|free\s+mp3|mp3|ringtone|full\s+song|"
    r"jiosaavn|gaana|letras\.?com|spotify|apple\s+music|youtube|reaction|karaoke)\b",
    re.I,
)
_STOPWORDS = frozenset(
    {"by", "the", "and", "song", "chords", "music", "official", "lyrics", "letra", "letras"}
)
_MAX_SEGMENT_TOKENS = 6


def clean_search_title(raw: str) -> str:
    """Strip site tails, dash-noise suffixes and bracketed format noise from a hit title."""
    cleaned = (raw or "").strip()
    cleaned = _SITE_TAIL_RE.sub("", cleaned).strip()
    for _ in range(3):
        cleaned = _SITE_DASH_RE.sub("", cleaned).strip()
        cleaned = _TRAILING_DASH_NOISE_RE.sub("", cleaned).strip()
    cleaned = _BRACKET_NOISE_RE.sub("", cleaned).strip()
    cleaned = _GLOBAL_NOISE_RE.sub("", cleaned)
    cleaned = _EMPTY_BRACKETS_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return _DANGLING_RE.sub("", cleaned).strip()


_NOISE_ONLY_WORDS = frozenset(
    {
        "song",
        "and",
        "the",
        "with",
        "for",
        "guitar",
        "video",
        "audio",
        "official",
        "arranged",
        "by",
        "single",
        "album",
        "full",
        "version",
        "cover",
        "tutorial",
        "easy",
        "lesson",
        "music",
        "hd",
        "chords",
        "chord",
        "lyrics",
        "lyric",
        "tabs",
        "tab",
    }
)


def _clean_segment(s: str) -> str:
    """Clean one title/artist side: interior words intact, only end noise removed."""
    res = _GLOBAL_NOISE_RE.sub("", s)
    res = _EMPTY_BRACKETS_RE.sub("", res)
    res = re.sub(r"\s+", " ", res).strip()
    for _ in range(3):
        res = _DANGLING_RE.sub("", res).strip()
        res = _END_NOISE_RE.sub("", res).strip()
    return re.sub(r"\s+", " ", res).strip()


def _is_noise_only(s: str) -> bool:
    """True for segments like "Guitar Tutorial" / "Official Video". Only consulted when the
    other dash side carries a "Title by Artist" credit: one-word titles such as "Easy",
    "Video" or "Guitar" are real songs everywhere else."""
    words = re.findall(r"\w+", s.lower())
    return bool(words) and all(w in _NOISE_ONLY_WORDS for w in words)


# --- Matching -----------------------------------------------------------------


def _fold(word: str) -> str:
    normalized = unicodedata.normalize("NFD", word)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()


def _token_set(text: str) -> frozenset[str]:
    """Accent-folded, stopword-free token set (dedupe / relevance key)."""
    words = (_fold(w) for w in re.findall(r"\w+", text or ""))
    return frozenset(w for w in words if len(w) > 1 and w not in _STOPWORDS)


def _tokens_match(q: str, c: str) -> bool:
    if q == c:
        return True
    if min(len(q), len(c)) >= 4 and (q in c or c in q):
        return True
    return difflib.SequenceMatcher(None, q, c).ratio() >= 0.8


def _match_score(query_tokens: frozenset[str], candidate_tokens: frozenset[str]) -> int:
    """Number of query tokens fuzzy-matched by the candidate tokens."""
    return sum(1 for q in query_tokens if any(_tokens_match(q, c) for c in candidate_tokens))


def _matches_query(query_tokens: frozenset[str], candidate_tokens: frozenset[str]) -> bool:
    """Relevance bar (spec edge case :64): typo/prefix tolerant, rejects unrelated junk."""
    return not query_tokens or _match_score(query_tokens, candidate_tokens) > 0


def _orient(p1: str, p2: str, query: str) -> tuple[str, str, float]:
    """Decide which dash side is the title.

    The only trusted signal is exactly one side matching the query (the search field asks
    for a song name). Query word order is NOT a role signal: learners type both
    "Title - Artist" and "Artist - Title". Otherwise keep the music-search convention
    'Artist - Title'; `search()` then lets higher-confidence shapes (Wikipedia, "by",
    store) and the majority orientation across hits decide.
    """
    q_tokens = _token_set(query)
    m1 = _matches_query(q_tokens, _token_set(p1))
    m2 = _matches_query(q_tokens, _token_set(p2))
    if q_tokens and m1 and not m2:
        return p1, p2, 0.75
    if q_tokens and m2 and not m1:
        return p2, p1, 0.75
    return p2, p1, 0.7


def parse_candidate_title_artist(text: str, query: str = "") -> tuple[str, str, float] | None:
    """Extract (title, artist, confidence) from a search-hit title, or None.

    Order: Wikipedia shape, then dash shape (so ' by ' inside a title like
    'Stand By Me' or 'By the Way' is never mistaken for the credit), then 'Title by Artist'.
    """
    cleaned = clean_search_title(text)
    if not cleaned:
        return None

    # Wikipedia: "Creep (Radiohead song)"
    m_wiki = re.match(r"^(.+?)\s*\((.+?)\s+song\)$", cleaned, re.I)
    if m_wiki:
        t, a = _clean_segment(m_wiki.group(1)), _clean_segment(m_wiki.group(2))
        if t and a:
            return t, a, 0.85

    # "Artist - Title" / "Title - Artist" (first two segments only).
    for sep in (" - ", " – ", " — "):
        if sep in cleaned:
            seg1, seg2 = (x.strip() for x in cleaned.split(sep)[:2])
            store = _STORE_BY_SEGMENT_RE.match(seg2)
            if store:  # "Almohada - song and lyrics by José José" (Spotify)
                t, a = _clean_segment(seg1), _clean_segment(store.group(1))
                if t and a:
                    return t, a, 0.8
            p1, p2 = _clean_segment(seg1), _clean_segment(seg2)
            by_side = " by " in seg1.lower() or " by " in seg2.lower()
            if by_side and (_is_noise_only(p1) or _is_noise_only(p2)):
                break  # "Hallelujah by Leonard Cohen - Guitar Tutorial": use the by-shape
            if p1 and p2:
                return _orient(p1, p2, query)
            break  # a side cleaned to nothing: try the by-shape

    # "Title by Artist" — split on the LAST ' by ' ("Stand by Me by Ben E. King").
    if " by " in cleaned.lower():
        idx = cleaned.lower().rfind(" by ")
        t, a = _clean_segment(cleaned[:idx]), _clean_segment(cleaned[idx + 4 :])
        if t and a:
            return t, a, 0.8

    return None


def _is_junk(title: str, artist: str) -> bool:
    if _JUNK_RE.search(title) or _JUNK_RE.search(artist):
        return True
    return len(title.split()) > _MAX_SEGMENT_TOKENS or len(artist.split()) > _MAX_SEGMENT_TOKENS


# --- Search -------------------------------------------------------------------


def search(
    query: str,
    *,
    deadline_s: float = STAGE_TIMEOUT_S,
) -> list[EnrichedCandidate]:
    """Bounded keyless web search mapped to ranked, deduplicated song candidates.

    Never raises: network, rate-limit and parsing failures return [].
    """
    q = (query or "").strip()
    if not q or deadline_s <= 0:
        return []

    deadline = compute_deadline(deadline_s)
    if is_expired(deadline):
        return []

    timeout_s = search_timeout(deadline)
    if timeout_s is None:
        return []

    try:
        tools = WebSearchTools(
            backend=SEARCH_BACKENDS,
            enable_search=True,
            enable_news=False,
            fixed_max_results=6,
            timeout=timeout_s,
        )
        raw_result = tools.web_search(f"{q} song")
        # One bounded ddgs round (two engines, one wait(timeout)); parsing fetched hits
        # is pure CPU, so results are never discarded once fetched.
        if not raw_result:
            return []
        hits = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
        if not isinstance(hits, list):
            return []

        query_tokens = _token_set(q)
        # core token set -> {(folded title, folded artist): [votes, best candidate]}
        groups: dict[frozenset[str], dict[tuple[str, str], list]] = {}

        for hit in hits:
            if not isinstance(hit, dict):
                continue
            parsed = parse_candidate_title_artist(str(hit.get("title") or ""), query=q)
            if not parsed:
                continue
            title, artist, confidence = parsed
            if _is_junk(title, artist):
                continue
            core = _token_set(f"{title} {artist}")
            if not core or not _matches_query(query_tokens, core):
                continue
            cand = EnrichedCandidate(
                title=title, artist=artist, origin="duckduckgo", confidence=confidence
            )
            key = (" ".join(sorted(_token_set(title))), " ".join(sorted(_token_set(artist))))
            slot = groups.setdefault(core, {}).get(key)
            if slot is None:
                groups[core][key] = [1, cand]
            else:
                slot[0] += 1
                if (confidence, -len(title) - len(artist)) > (
                    slot[1].confidence,
                    -len(slot[1].title) - len(slot[1].artist),
                ):
                    slot[1] = cand

        # One candidate per song: highest confidence, then majority orientation, then shortest.
        return [
            max(
                variants.values(),
                key=lambda s: (s[1].confidence, s[0], -len(s[1].title) - len(s[1].artist)),
            )[1]
            for variants in groups.values()
        ]
    except Exception as exc:
        logger.warning("keyless candidate fallback failed: %s", exc)
        return []
