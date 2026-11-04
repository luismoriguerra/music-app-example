# Research: Ukulele Lyrics + Chords Generator

**Feature**: `004-lyrics-chords-generator` | **Date**: 2026-09-16
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. This file supersedes the
specify-phase pre-plan seed (R1–R7 + live probe): seed content is preserved
below, upgraded from provisional to final, with the accepted H1–H5 review
decisions (user-accepted 2026-09-16) and the REQUIRED provider research the
spec mandates. No NEEDS CLARIFICATION remains. No model ID is chosen here —
R6 records why and defines the mandatory pre-wiring gate (Principle V).

Context: private single-user hobby app, personal practice only. No login;
all history belongs to the synthetic single-owner identity (FR-011). Sheets
reproduce found lyrics with aligned chords and carry per-part attribution
(`lyrics:` / `chords:` labels with link-back; model chords labeled
`chords: model-generated`, FR-012) plus an outbound sources list incl. video
(FR-016). No redistribution, publishing, sharing, or embedded playback. All
hosted fetching and inference go through `backend/`; the browser never holds
provider keys (Principles VI, VII).

---

## R0. Sheet-source precedence + pipeline shape (H1 — accepted: chart-takes-all)

- **Decision**: Chart hit takes all. The generate pipeline is strictly
  ordered with no cross-source merging:
  1. Resolve the learner-picked candidate to title + artist (R2/R3).
  2. Fetch the top-rated chord chart for title + artist (R5). On hit, the
     whole sheet — lyrics AND chords — comes from the chart, with single
     per-part attribution (`lyrics: <chart>` / `chords: <chart>`, same
     link-back).
  3. On chart miss only, fetch lyrics (R1) and align chords with the
     model fallback (R6), attributed `lyrics: <provider>` /
     `chords: model-generated`.
  4. On lyrics miss too, return the no-match state (FR-007); never emit a
     sheet with neither lyrics nor chords. Lyrics without chords render as
     a ready sheet with a chords-missing notice (spec edge case).
- **Rationale**: Chart text (verified probe shape: `[Intro]/[Verse]/[Chorus]`
  sections, capo lines, chord-above-lyric lines) and lyric-API text (plain
  paragraphs) are different documents — chord positions cannot be
  deterministically transplanted across them (line breaks, repeat markers,
  section labels all differ). Chart-takes-all yields one coherent text per
  sheet, two independently testable paths, and honest per-part attribution
  on both. The candidate pick supplies the artist that chart search needs,
  so song-name-only input (FR-003) still resolves exactly.
- **Alternatives considered**:
  - UG deep-link-only + lyrics-API + model-chords-primary (standing
    fallback, ranked #2): charts appear only as FR-016 outbound links
    (UG's literal "link, don't replicate" policy); every sheet is LRCLIB
    lyrics + model-aligned chords. Honestly evaluated: it dissolves this
    decision (one lyric text, no precedence question), makes attribution
    uniform, removes the scraping dependency and its ToS risk entirely, and
    needs the same Principle IV/V gates already budgeted for the fallback.
    The real trade is human-voted ukulele charts (probe: ratings 4.6–4.9,
    thousands of votes, zero inference cost on hits) vs model chords on
    every sheet (quality variance everywhere + cents per sheet). The user
    accepted chart-takes-all with eyes open; this alternative becomes the
    plan if any trigger fires: Python chart fetching proves unviable
    (persistent Cloudflare blocks), UG sends any enforcement signal, or the
    app gains a second user. Switching cost is low (one pipeline branch +
    R8 posture already documents it).
  - Lyrics-canonical + chord overlay (rejected): consistent lyric text but
    index-based transplant breaks on any structural difference; silent
    chord drift is worse than a clean miss path.
  - Fuzzy positional merge (rejected): most scope, untestable, silently
    corrupts alignment — the failure mode (wrong chords, confidently) is
    the worst of all options.
  - Dual-track user pick (rejected): punts a system decision to the learner
    on every search and doubles fetch cost/quota.
  - Lyrics-only fallback instead of model chords (rejected): concedes
    SC-005, whose "every sheet … 80% of lines carry chords" gate fails
    outright on any chordless sheet — see R6.

## R1. Lyrics provider strategy (final)

- **Decision**: LRCLIB primary, lyrics.ovh fallback. lrcmux deferred.
- **Rationale**: LRCLIB is free with no key, returns plain + synced lyrics,
  publishes clear polite-client rules (`User-Agent` identification,
  sequential requests, 200–500 ms throttle, honor `429` + `Retry-After`),
  and hit 7/8 probe songs with correct top results (see probe section).
  lyrics.ovh is the simplest keyless fallback (`GET /v1/{artist}/{title}`).
  lrcmux (one integration over Genius/KuGou/LRCLIB/YT Music, free tier
  60 req/min) stays deferred: it adds a dependency and a stricter rate
  limit to save wiring that is only two providers deep — revisit only if
  direct wiring proves painful.
- **Alternatives considered**:
  - Genius as lyric text source (rejected): the official API returns search
    + metadata only; full text needs page scraping, which violates Genius
    ToS. Genius is used for disambiguation metadata only (R3).
  - Musixmatch as lyrics source (rejected — see R4): licensed catalog but
    Basic/Scale terms forbid the persistence FR-008 requires.
  - LRCLIB-only, no fallback (rejected): community-sourced coverage has
    gaps (1 miss in n=8); a fallback protects the SC-002/SC-005 samples.

## R2. Song-name-only input → resolution flow (final)

- **Decision**: Two-step resolve, then fetch. (1) Keyword search
  `GET /api/search?q=` (max 20 results, no pagination — verified) feeds the
  FR-006 candidate list together with Genius metadata (R3). (2) The
  learner-picked candidate (title + artist) drives exact fetches:
  `GET /api/get?track_name=&artist_name=` (both required) or
  `GET /api/get/{id}`, plus chart search with title + artist (R5).
  Long→short query fallback is REQUIRED: on zero results, retry with the
  title only (probe: long query 0 results → short query 20).
- **Rationale**: LRCLIB exact-match REQUIRES `track_name` + `artist_name`,
  so a bare song name cannot fetch directly; the candidate pick is what
  supplies the artist. This maps exactly onto FR-003 (single input) →
  FR-006 (pick one) → FR-004 (generate).
- **Alternatives considered**:
  - Single-call exact fetch from song name (rejected): impossible without
    artist; guessing the performer misattributes sheets.
  - Optional artist input field (rejected for v1): song-name-only input
    plus candidate disambiguation resolves exactly; a second field adds UX
    weight for no measured gain. Revisit if no-match rates are high.
  - Client-side fan-out (rejected): keys/quota live server-side per
    Principle VI.

## R3. Candidate-list sourcing + merge rule (final)

- **Decision**: Genius API primary for disambiguation metadata (title,
  artist, album, artwork, song URL), LRCLIB `/api/search` as secondary
  signal and as the no-token fallback. Merge rule: Genius rank order first,
  then LRCLIB-only extras deduped by normalized `title + artist`
  (lowercase, punctuation/whitespace folded). `GENIUS_ACCESS_TOKEN` is
  OPTIONAL: when absent, candidates come from LRCLIB alone (no artwork)
  and the flow still satisfies FR-006.
- **Rationale**: Genius has the best search coverage and metadata quality
  for "which song did you mean" — exactly FR-006. Only its official
  search/metadata endpoints are used (no lyric scraping, R1). LRCLIB-only
  mode keeps the feature working with zero keys.
- **Alternatives considered**:
  - LRCLIB-only always (rejected as primary): weaker metadata (no artwork,
    sparser catalog); kept as secondary + fallback, not primary.
  - Songsterr for search metadata (rejected): legacy API with flakiness
    reports; metadata + deep-link IDs only. Usable as an FR-016 link
    target, not a candidate source.

## R4. Musixmatch posture (final: excluded)

- **Decision**: Musixmatch is NOT used in this feature — neither as a
  persisted source nor real-time-only.
- **Rationale**: The only fully licensed catalog (14M+ songs), but Basic
  ("up to 500 lyrics calls daily, no caching allowed") and Scale ("up to
  2,000 lyrics & sync calls daily, no caching allowed") state: "Caching or
  storing lyrics data is not permitted … Lyrics must be fetched in
  real-time via API calls … regular compliance audits … violations may
  result in service suspension" ([pricing terms](https://about.musixmatch.com/api-pricing),
  verified 2026-09-16). FR-008 REQUIRES storing every sheet — a direct
  conflict with no hobby exemption. Enterprise (the only tier with "Cache
  lyrics (licensed only)") needs sales engagement plus per-lyric
  `region_restriction` serving ([content restrictions](https://docs.musixmatch.com/enterprise-integration/content-restrictions))
  — disproportionate for a hobby app, and real-time-only use would still
  need an FR-008/009 amendment for re-fetch-on-reopen.
- **Alternatives considered**:
  - Enterprise with caching rights (deferred): revisit only if the app
    outgrows the hobby tier or needs licensed guarantees.
  - Real-time-only + query/chords-only history (rejected): guts FR-008/009
    and SC-006 for the most-sourced path; worse than exclusion.
  - Ignoring the clause for private use (rejected): audits and suspension
    apply regardless of audience size.

## R5. Chart fetching from the Python backend (final)

- **Decision**: A small Python chart client in `backend/agents/sheets/`
  replicating the `ultimate-guitar@4.0.1` flow over plain httpx —
  `search(title, artist[, category])` → pick top `Chords`/`Ukulele Chords`
  result by rating × votes → `fetch(tab_url)` → plain-text chart —
  preferring the ukulele category. Transport verified live via httpx on
  2026-09-16 (this plan session, not just the Node probe): both search URL
  forms return 200 with parseable `js-store` results JSON (`?title=Riptide&
  view_state=advanced` → 56 results; `?title=Riptide&type=800` → 21), and
  tab fetch returns 200 with `store.page.data.tab_view.wiki_tab.content`
  identical to the Node probe (5295 chars, `[ch]/[tab]` tags stripped the
  same way). No Cloudflare block observed from plain httpx — the
  `got-scraping` bypass is NOT required at this time. Required behaviors:
  exact-artist → title-only fallback on empty/error (Node probe: one
  artist-spelling-sensitive status 500); polite sequential requests with
  1–2 s gaps; 10 s per-call timeout; recorded fixtures from the live probes
  for unit/contract tests so CI never hits UG. If httpx becomes
  persistently Cloudflare-blocked in the future, the fallback is a
  self-hosted `tablatures-api` (Node) sidecar called over localhost —
  evaluated then, not wired preemptively. If chart fetching proves
  unviable entirely, the R0 standing fallback (deep-link-only + model
  chords) activates via `/speckit-converge`.
- **Rationale**: Two probes verified two different things: the Node probe
  verified data shape and catalog depth (7/8 songs status 200, 4–20
  responses, top ratings 4.6–4.9 with thousands of votes, fetch returns
  the exact FR-004/005 shape, ~450–700 ms per search); the httpx probe
  verified the Python transport + parsing path end to end (200s,
  `js-store` JSON, identical chart bytes). Python-native fetching keeps
  the Principle VII/VIII layering clean (no Node runtime inside
  `backend/`); the fixtures keep tests hermetic per Principle III.
- **Alternatives considered**:
  - Shelling out to the Node `ultimate-guitar` client (rejected): drags a
    Node runtime + npm dependency into the Python service image and breaks
    backend layering for what is one search + one fetch.
  - Paid UG Parse API (rejected): cost + key management for a hobby app
    when the direct flow is verified working.
  - Wiring `tablatures-api` up front (rejected): extra service to deploy
    and maintain before knowing it's needed; kept as the named fallback.
  - Songsterr notation (rejected): free keyless API returns metadata + IDs
    only, no raw notation — link target only (FR-016).

## R6. LLM fallback role + model selection gate (H2 — accepted: fallback-on-chart-miss)

- **Decision**: The model aligns/generates chords onto fetched lyrics ONLY
  on the chart-miss path (R0 step 3). It never rewrites lyrics, never
  generates lyrics from memory (hallucinated lyrics would violate FR-012
  attribution), and never runs on chart hits. Output contract: the same
  structured line/chord-position shape the chart parser produces (see
  data-model.md), full vocabulary per FR-013, every sheet labeled
  `chords: model-generated` with the exact model ID stored for provenance.
  Implementation shape (Principle IV consistency): the fallback is an Agno
  `Agent(model=OpenRouter(id=<Appendix A model>), output_schema=ChordsOut)`
  built by a factory in `agents/sheets/fallback.py` — NOT a bare OpenAI SDK
  call — so the R12 eval gates target a real Agent. *Amended 2026-09-16
  (T036):* the wire schema is per-line chord changes keyed by an explicit
  line index (`ChordsOut`), zipped by the factory onto the fetched lyrics
  into the body shape above — not the body shape itself. Rationale in
  Appendix A "Budget evidence": ~30% lower latency, half the output tokens,
  and lyric text can no longer drift because it never crosses the wire.
  The persisted body contract is unchanged; only the model's I/O is leaner.
  The pipeline instantiates it lazily per
  request on the chart-miss path only (preserving missing-key →
  lyrics-only degradation at request time); it is NOT registered in
  `AgentOS(agents=[...])`, which stays empty per R10.
  **No model is chosen in this plan.** The `openrouter` MCP was not
  callable from the plan session (no MCP tools in this client), and
  Principle V forbids choosing from training data — so model selection is
  a mandatory tasks-phase gate: run `openrouter-model-eval` with live MCP
  BEFORE wiring the fallback, and record requirements / candidates / test
  results / winner + rationale / exact model ID + provider route in the
  research appendix below. Hardcoded model IDs without that record remain
  forbidden. Agno eval gates for the fallback (Principle IV) are defined
  in R12 and MUST be green before merge.
- **Rationale**: The probe found 1 chart miss in n=8 popular songs — and a
  personal repertoire will miss more often, which strengthens (not
  weakens) the fallback case either way. Fallback-scoped inference keeps
  cost/latency near zero on hits while making SC-005 ("every sheet …
  80% of lines carry chords") achievable instead of betting it on one
  unofficial scraper. Constraining the model to chord alignment over
  provided lyrics (not lyric generation) bounds hallucination risk to
  chord choice, which the eval gates measure directly.
- **Alternatives considered**:
  - Deterministic-only v1 (rejected): simplest, zero inference cost — but
    the chords half of FR-004/005 then rests solely on an unofficial,
    bot-protected scraper whose ToS textually prohibits the use (R8). One
    chart miss in the SC-005 sample fails the criterion outright. Viable
    only with an SC-005 amendment, which the user did not take.
  - Model-always (rejected): consistent pipeline but pays cost/latency/
    variance on every sheet including the majority with human-voted
    charts — wasteful with no quality gain demonstrated.
  - Query-assist / rerank-only model use (rejected): helps recall or
    ranking, does nothing for chord coverage — the actual gap.
- **Model requirements for the gated eval** (inputs to the skill run):
  task = structured chord alignment over provided lyrics (JSON out);
  quality bar = ≥80% of lyric lines carry plausible chords (SC-005),
  full FR-013 vocabulary incl. 7ths/sus/dim/aug; latency budget = ≤20 s
  within the SC-002 30 s envelope; cost ceiling = hobby-trivial per sheet;
  context = one song's lyrics (small); route = OpenRouter-hosted via
  `backend/` only.

## R7. Video + outbound sources (FR-016) with quota safety (final)

- **Decision**: YouTube Data API v3 `search.list` constrained to
  `type=video&videoEmbeddable=true` (key in `YOUTUBE_API_KEY`; when absent,
  sheets ship with page links only and the video part shows its empty
  state) plus `videos.list` (1 unit) for metadata top-ups. Quota rule:
  10,000 units/day, `search.list` = 100 units (~100 searches/day) — safe
  for one user ONLY because sheets persist their FR-016 links at
  generation time, history re-open (FR-009) serves the stored sheet with
  ZERO re-querying, and only generate/regenerate query providers. No
  per-keystroke search anywhere. Sources-list composition (plan detail):
  lyric pages, then chord/tab pages (UG, Songsterr), then video; dedup
  against the FR-012 attribution URL; cap 8 links.
- **Rationale**: The user explicitly requested video links. Persisting
  links on the immutable sheet (rather than caching with TTL) is simpler
  AND quota-safe: re-open is free, regenerate is the only re-query path,
  matching FR-010 semantics ("fresh sheet").
- **Alternatives considered**:
  - No video (rejected): explicitly requested.
  - TTL-cached video results independent of sheets (rejected): strictly
    more machinery than immutable per-sheet links for identical UX.
  - Unofficial YouTube scraping / Piped gateways (rejected): ToS risk and
    worse reliability than the official API inside single-user quota.

## R8. History persistence vs provider terms (H5 — accepted: persist-everything minus Musixmatch)

- **Decision**: FR-008 stands as written — every completed search persists
  its full sheet server-side in Postgres (FR-011). Musixmatch is excluded
  (R4). LRCLIB (no explicit license/ToS, openly invites clients, offers
  cached API + DB dumps), lyrics.ovh (no API ToS; MIT code, scraped
  upstream), and UG charts (ToS prohibits circumventing protection,
  unauthorized collection, and reproducing/redistributing; "link, don't
  replicate"; personal noncommercial use) are persisted with mitigations:
  private single-owner store, no redistribution surface (spec Out of
  Scope), per-part attribution + link-back on every sheet (FR-012),
  deep links to every source (FR-016), polite throttled clients. The UG
  "link, don't replicate" clause is the strongest counter-signal in the
  feature and is accepted explicitly as residual risk: enforcement targets
  redistribution and commercial scale, and no source offers a hobby
  persistence license, so allowlisting would gut FR-008/009 and SC-006 for
  theoretical protection. Revisit triggers (any one): second user,
  enforcement signal, or chart fetching proves unviable → then R0
  deep-link-only fallback + history redesign via `/speckit-converge`.
- **Alternatives considered**:
  - Persist-allowlist / real-time-only history (rejected): nothing in the
    source set affirmatively permits persistence, so allowlisting empties
    history and destroys FR-008/009 + SC-006.
  - Query-plus-chords-only for UG sheets (rejected): re-fetch-on-reopen
    breaks the R7 no-requery invariant and doubles quota exposure; kept
    only as the documented `/speckit-converge` compromise if UG risk must
    be shed without abandoning charts.
  - TTL cache + takedown hygiene (rejected as theatre): real mitigation
    for multi-user services; meaningless in a one-person app with no
    request channel. Sheets are immutable records instead.

## R9. Attribution shape (H4 — spec amended, rendering is plan detail)

- **Decision**: FR-012 now requires separate `lyrics:` and `chords:`
  labels, each with link-back where the source is external; model chords
  are labeled `chords: model-generated` (Song Sheet entity + SC-005
  updated to "per-part source attribution"). Rendering plan detail: a
  compact attribution block atop the sheet (two labeled lines); the full
  FR-016 sources list stays separate below the sheet. Stored per sheet:
  lyric source id + URL, chord source id + URL (nullable for model), and
  the exact model ID when the fallback ran.
- **Rationale**: Split-provenance sheets (chart lyrics + chart chords on
  hits; API lyrics + model chords on misses) cannot be labeled honestly
  with one source string. Per-part labels make every path truthful and
  keep FR-012/SC-005 testable per path.
- **Alternatives considered**:
  - Single source label (rejected): misattributes or omits the chords
    origin on fallback sheets.
  - Per-section provenance (rejected): visual noise, overkill for v1.
  - Folding attribution into the FR-016 list (rejected): conflates "where
    this text came from" with "other places to look"; weakens FR-012.

## R10. Backend architecture (Principles VII + VIII)

- **Decision**: AgentOS/FastAPI composition in `app/` (new
  `app/routes_sheets.py` — REST first, AgentOS mount unchanged) over a new
  domain package `agents/sheets/` (pure pipeline: search → chart/lyrics
  fetch → fallback align → normalize → persist) over Postgres via SQLAlchemy
  models in `db_models.py` beside `db.py` (AgentOS `PostgresDb` keeps
  owning sessions/memory; feature tables are plain SQLAlchemy on the same
  database — one Postgres, two access styles, no new service). The R6 fallback Agent is pipeline-internal
  (factory-built per request, never a servable AgentOS agent), so
  `AgentOS(agents=[])` stays empty — evals target the factory-built Agent
  directly, no registration needed. Synthetic
  owner (plan default): domain constant `OWNER_ID = "owner"` stored on
  every row (env override `OWNER_ID` permitted); no owners table — the
  column keeps the multi-user door open without building accounts. Error
  taxonomy shared by all routes: `NO_MATCH`, `PROVIDER_ERROR`,
  `VALIDATION_ERROR`, `NOT_FOUND`; provider failures (no 429 in v1 — quota/timeout degrade to a 200 sheet with a `degraded` entry per contracts/rest-api.md)
  surface FR-007 error-with-retry, never stack traces. CORS: `CORSMiddleware` in `app/main.py` from the `CORS_ORIGINS` env (comma-separated, default `http://localhost:4321,http://127.0.0.1:4321` — both loopback spellings, since `astro dev --host 127.0.0.1` advertises the latter) — without it every browser POST fails preflight into the FR-007 error state. Backend timeout
  budget 25 s inside the SC-002 30 s envelope (R7): the 25 s pipeline deadline is propagated to each stage (per-call timeouts are caps, not additive budgets) with skip-vs-fail short-circuit — skip video sourcing → sheet without video; skip model fallback → lyrics-only sheet + chords-missing notice; lyrics-stage timeout → PROVIDER_ERROR with retry and no partial rows (bulk clarify 2026-09-16, spec Edge Cases; each skip records a `degraded` entry per contracts/rest-api.md so re-open renders the same notice). Secrets exclusively
  from environment: `OPENROUTER_API_KEY` (fallback path),
  `YOUTUBE_API_KEY` (video links), `GENIUS_ACCESS_TOKEN` (optional,
  R3); all degrade gracefully when absent: missing YouTube/Genius keys
  reduce sources/candidates; missing OpenRouter key on the chart-miss path
  yields a lyrics-only sheet with chords-missing notice (never a hard
  error) until the gated skill run + key land.
- **Rationale**: Follows the established `app/ → domain → db` layering;
  REST-first keeps the Astro island integration simple (contracts in
  `contracts/rest-api.md`); SQLAlchemy for feature tables avoids
  overloading AgentOS session storage with domain records. Graceful
  degradation keeps local dev working with zero keys (LRCLIB-only
  candidates, page-links-only sources).
- **Alternatives considered**:
  - AgentOS agents + MCP tools as the only interface (rejected): heavier
    than REST for CRUD-shaped fetch/persist flows; MCP Apps views are
    unwarranted when Astro renders natively. AgentOS stays mounted for
    sessions/evals per Principle VII.
  - Feature tables inside AgentOS session storage (rejected): wrong
    abstraction — history entries are domain records with their own
    lifecycle, not agent session state.
  - JWT/RBAC now (deferred, same justification as 001 R5): single-owner,
    no login per FR-011, no network-exposed deployment in this feature;
    enforced before any exposed deployment per Principle VII.

## R11. Frontend architecture (Principle VIII)

- **Decision**: First-class Game, zero framework changes. Content: new
  `games/lyrics-chords.json` entry (title "Lyrics + Chords", kind game,
  courseSlug ukulele, description, `rules` usage text, order after
  topics) — this activates the reserved `[game].astro` route via the
  existing `gameStaticPaths` (no route-pattern change). The game page
  stays a thin shell: breadcrumb + title + description, then a
  `SheetGenerator` React island (`client:load`) that owns input →
  candidates → sheet → history UI and fetches the backend REST contract
  (R10) with `PUBLIC_API_URL` (default `http://localhost:8000`, no SSR
  fetch — pages stay fully static, satisfying the static-output
  constraint and keeping SC-002 meaningful end-to-end). New pure
  `lib/sheets.ts` (sheet normalization/selection helpers, zero Astro
  imports) + `lib/chord-diagrams.ts` (M2 amendment: pure FR-013 symbol
  parse + GCEA voicing search for off-catalog chords + semitone transpose
  helpers (transpose amendment 2026-09-16)) + Zod response
  schemas beside them; presentational components
  (`SheetView` + `TransposeControl`, `CandidateList`, `HistoryList`, `SourceLinks`) under
  `components/`; ViewStates reused for FR-014. Chord symbols render as
  text; every voiceable inline symbol reveals its diagram in a hover/tap
  popover (`ChordPopover.tsx`, disclosure semantics; inline-diagrams
  amendment 2026-09-16 — inline symbols no longer link to the Chords topic);
  every unique song chord appears with its diagram (catalog or generated)
  in a "Chords in this song" reference rail beside the lyrics (M2 as
  amended 2026-09-16); a display-only transpose stepper above the lyrics shifts every shown chord (inline + rail) by semitones with reset and key-aware accidental spelling from the transposed tonic (most-frequent root; transpose amendment 2026-09-16; key-aware spelling per the FR-017 amendment of the same date); chart section markers/headings preserved as-is; history renders as a
  newest-first horizontal snap carousel with paging, each card offering
  delete behind a confirm dialog (history amendment 2026-09-16).
- **Rationale**: Follows the 001-established pattern (thin pages →
  presentational components → pure lib → content) and proves the Game
  kind end to end without new frameworks. Runtime-only fetching keeps the
  build hermetic (no provider calls at build time — the `prebuild`
  content gate stays purely local).
- **Alternatives considered**:
  - SSR/prerendered sheets (rejected): sheets are per-query dynamic data;
    prerendering buys nothing and breaks static output.
  - shadcn/Radix Select for candidates (rejected per 001 R9 precedent):
    native controls where text-only suffices; custom rendering only if
    artwork rows demand it later.
  - MCP-UI AppRenderer for sheets (rejected): sheets are first-party Astro
    UI, not backend MCP Apps views; no `ui://` resources in this feature.

## R12. Testing + eval strategy (Principles III + IV)

- **Decision**:
  - Frontend (Vitest, `frontend/tests/`): Zod response-schema tests (valid
    + invalid fixtures per REST shape), `lib/sheets.ts` pure-function
    tests (candidate selection, chord-position normalization, catalog
    cross-link matching), `lib/chord-diagrams.ts` generator tests (M2
    amendment: symbol parse + GCEA voicing incl. unvoiceable rejection + semitone transpose),
    island behavior tests (input validation, loading/
    no-match/error states, candidate pick → sheet render, history list +
    re-open + regenerate affordances), game-entry content integrity
    (extends the existing check-content gate: games entry references
    ukulele, slug unique).
  - Backend (pytest, `backend/tests/`): route tests with httpx
    `TestClient` (search/candidates, generate both paths, history order +
    re-open-serves-stored, regenerate-creates-new, error taxonomy
    mapping, validation errors), domain tests with recorded provider
    fixtures (chart parse → structured lines, LRCLIB exact-fetch mapping,
    fallback output validation, attribution assembly), SQLAlchemy model
    tests against a transient Postgres (Compose `db` service — no SQLite
    anywhere, Principle VII).
  - Evals (Agno test-scenarios, `backend/evals/`, Principle IV — REQUIRED
    for the fallback path, targeting the factory-built R6 Agent): `chord_coverage` (≥80% of lyric lines carry
    chords on fixture songs), `attribution_present` (`chords:
    model-generated` + model ID stored), `vocabulary_valid` (every emitted
    symbol parses as standard Western notation incl. 7ths/sus/dim/aug),
    `lyrics_untouched` (output lyric text == input lyric text exactly).
    Gates MUST be green before merge, same as unit tests; re-run on any
    prompt/tool/model change.
- **Rationale**: Mirrors the 001 test split (idiomatic runner per runtime)
  and adds the missing piece this feature introduces: behavior gates for
  the only nondeterministic step. Fixtures from the verified probe keep
  CI hermetic; the live re-probe is a manual quickstart step, not CI.
- **Alternatives considered**:
  - Playwright E2E (deferred, same as 001 R7): unit + contract + scenario
    + quickstart validation covers the risk surface without flake/CI cost.
  - Live-provider CI tests (rejected): flaky, quota-burning, ToS-noisy;
    recorded fixtures + manual quickstart probe instead.

---

## Clarify-phase live probe (2026-09-16, n=8 popular songs — not a rate)

Measured with polite sequential clients on 8 well-known songs (Riptide,
Count on Me, Let It Be, Hallelujah, Stand By Me, Yesterday, Over the
Rainbow, Wonderwall). Reported as counts, NOT a projected hit rate — a
personal repertoire will miss more often.

- **LRCLIB** (`/api/search?q="Title Artist"` then `/api/get` exact): 7/8
  long queries → 20 results each, correct top hit, plain lyrics present
  (626–1917 chars). 1/8 (long "Somewhere Over The Rainbow Israel
  Kamakawiwole") → 0 results; short query "Over the Rainbow" → 20.
  `/api/get?track_name=Riptide&artist_name=Vance Joy` → id 969429, plain
  len 1816. Terms: no explicit license/ToS and no explicit storage grant —
  but the API openly invites third-party clients and offers `/api/get-cached`
  + DB dumps; lyrics remain copyrighted. Private single-user caching:
  lowest-risk gray, no explicit prohibition.
- **lyrics.ovh** (`GET /v1/{artist}/{title}`): Riptide → len 1756. Viable
  fallback. MIT code but first-wins scraped lyrics; historically flaky
  (404s, IP bans).
- **UG client** (`ultimate-guitar@4.0.1`, `guitar().search(title, artist)`):
  7/8 → status 200, 4–20 responses, top ratings 4.6–4.9 with thousands of
  votes. 1/8 (Over Rainbow) → status 500 + empty responses:
  artist-spelling-sensitive; title-only fallback REQUIRED but untested
  (tasks-phase live re-probe). Early `searchSong(q)` → `[]` was wrong-API
  usage, not a miss. `category.UKULELE` filter works (Riptide → 4
  "Ukulele Chords", top 4.89). `fetch(top)` returns complete plain-text
  chart (`[sections]`, chords-above-lyrics, Capo) — exactly FR-004/005.
  ~450–700 ms per search. Transport re-verified with plain httpx in the
  plan session (same date): search 200 + results JSON on both URL forms,
  tab fetch 200 + identical `wiki_tab.content` bytes — no Cloudflare
  block, `got-scraping` not required (see R5). Terms: UG ToS prohibits
  circumventing protection, unauthorized collection, and
  reproducing/redistributing; policy is "link, don't replicate"; personal
  noncommercial use. Persisting chart text is textually prohibited —
  accepted residual risk per R8 with documented triggers.
- **Implications locked in**: query fallbacks REQUIRED on both LRCLIB
  (long→short) and charts (exact-artist→title-only); candidate pick
  supplies the artist for exact fetches; SC-005's "every sheet" gate fails
  on any chordless sheet, which is why deterministic-only was rejected
  (R6).

## T043 live-validation addendum (2026-09-16, frozen SC-005 n=10)

Validated via in-process TestClient against real providers + dev Postgres
(no detached server on this box; TestClient overhead negligible vs the 30 s
SC-002 budget). Key-less mode: no Genius (LRCLIB-only candidates), no
YouTube (every sheet carries `degraded {part: video, reason: unavailable}`),
no OpenRouter (T036 stub). Candidate pick per song used artist hints
(Vance Joy, Bruno Mars, Beatles, …) to emulate the learner's FR-006 pick —
first-result picking lands on same-title covers (grandson/Riptide).

| song | sec | chord_src | cover | result |
|---|---|---|---|---|
| Riptide | 1.0 | chart | 39/41 95% | PASS |
| Count on Me | 1.5 | chart | 42/49 86% | PASS |
| Let It Be | 0.9 | chart | 27/29 93% | PASS |
| Hallelujah | 0.8 | chart | 35/35 100% | PASS |
| Stand By Me | 2.4 | chart | 48/49 98% | PASS |
| Yesterday | 1.1 | chart | 13/15 87% | PASS |
| Over the Rainbow | 1.1 | chart | 30/31 97% | PASS |
| Wonderwall | 0.9 | chart | 37/44 84% | PASS |
| Imagine | 0.8 | chart | 27/33 82% | PASS |
| Hey Jude | 1.0 | chart | 27/27 100% | PASS |

10/10 PASS (aggregate 370/383 = 96.6%), every sheet ≤2.4 s (SC-002),
identity + per-part attribution on all. V2 steps 2–4: Hallelujah →
18 candidates (ambiguous FR-006); gibberish → `[]`; empty → 422
VALIDATION_ERROR. V3 API: list newest-first, get 0.01 s, regenerate 1.1 s
with NEW entry (31→32, append-only), unknown id → NOT_FOUND. First run was
7/10; the three FAILs traced to parser defects (not data), fixed same
session with regression tests: (1) FR-013 regex rejected digits-first
quality (`A7sus4`) — whole chord lines lost (`normalize.py`, `db_models.py`,
`sheets.ts` widened identically + fixtures); (2) bar tokens (`|`) broke
chord-line detection; (3) tab staves, fret-fingering legends, separators,
and credit preambles parsed as lyric lines (now dropped; preamble latch
arms only on headings/chord lines/chord-bearing lines). Residual: Wonderwall
84% / Imagine 82% have thin margins against future UG chart edits — the
sample is point-in-time, not CI. UG Python client reachable, no Cloudflare
block (supports T053's premise). Live-browser checks (game card render,
backend-stopped island error, `?entry=` deep link incl. all-zero UUID)
remain owner steps under SC-003/T050.

## T053 live re-probe addendum (2026-09-16, V4 — R5/R2 fallback triggers)

Run from the backend venv against live providers, instrumenting each client's
`_get` to record every attempt (not just the final result).

- **LRCLIB long→short (R2): REQUIRED fallback was DEAD on the live path —
  found and fixed.** `LyricsClient.search(short_query=)` implemented it but
  had zero production callers; the route goes `candidates.search()` →
  `_lrclib_search`, which only shortened on a `" - "` split. Live
  `POST /api/v1/song-search` with the exact V4 query "Somewhere Over The
  Rainbow Israel Kamakawiwole" returned `0` candidates → no-match state for
  the learner. The bare `_lrclib_search` also swallowed `429` into `[]`
  (false no-match), violating T020's throttle + Retry-After rule. Fix:
  `candidates.search` runs a bounded R2 ladder — title before `" - "` when
  present, else drop trailing words one at a time (never below two words),
  ≤2 retries — with every LRCLIB call going through the throttled (0.3 s),
  429-aware `LyricsClient.search` (now one single-query raw-rows method);
  persistent 429/transport degrades to no LRCLIB rows at the candidates
  boundary. `_lrclib_search` deleted — one LRCLIB implementation, the
  well-behaved one, on the live path. Live after fix: same query → `200`
  with 4 candidates (top: Somewhere Over The Rainbow — Israel
  Kamakawiwo'ole), ~2 s; direct hits unchanged (~0.3 s); gibberish bounded
  at 3 requests.
- **UG title-only (R5): fallback is unreachable via artist misspelling — UG
  `search.php` ignores the `artist` param.** `title+"Israel Kamakawiwoole"`,
  `title+"Metallica"`, `title+"xqzvplk"`, and title-only all return the same
  57 rows (Clapton, Cassidy, Kamakawiwoʻole, The Blanks, …). Attempt 2 is
  still reached on transport/HTTP failure: nonsense title → `404` on both
  attempts → `[]` with no exception (T019 unit tests cover the code path).
  Python client reachable, no Cloudflare block — `tablatures-api` sidecar
  not needed; R0 standing fallback not triggered.
- **Defect found and fixed (FR-006):** because UG returns every same-title
  chart, `pick_best` chose by rating × votes alone and ignored the learner's
  picked performer — a title collision (e.g. "Hurt": NIN vs Aguilera) would
  ship the other song's lyrics+chords under the picked performer's label.
  `pick_best(results, artist=)` now prefers charts whose folded artist
  matches the pick (accent/punctuation-insensitive containment, so
  `Kamakawiwoʻole`≈`Kamakawiwo'ole`, `Beatles`⊂`The Beatles`), falling back
  to any same-title chart when none match (covers keep working: Matt Monro
  "Yesterday" → Beatles chart, as before; since the FR-005 clarification of
  2026-09-16 such a chart hit re-stamps the sheet's title/performer from the
  chart — the Monro pick yields a sheet labelled The Beatles, query kept).
  Live: "Hallelujah" picked as
  Leonard Cohen now yields the Cohen chart (7823 votes) instead of Buckley's
  ukulele chart. SC-005 sample re-run after the fix: 10/10, coverage
  unchanged. `fold_text` moved from `candidates.py` to `normalize.py` (pure
  text util shared by both).
- **Live generate path ran unthrottled** (`routes_sheets.py` built
  `ChartClient`/`LyricsClient` with `throttle_s=0`; only the candidates route
  honored R8/T020/T031). Fixed 2026-09-16: production defaults (UG 1.5 s,
  LRCLIB 0.3 s) scaled by `PROVIDER_THROTTLE_SCALE` (1.0 default; the test
  conftest sets 0 so hermetic route tests stay fast). Live regenerate with
  throttles on: 2.8 s wall, well inside the 25 s budget.
- **Unmarked chart preambles leaked as lyrics** (UG "Yesterday": 5 playing
  notes, only 3 matched `_PREAMBLE_RES`). Fixed structurally: when a chart
  carries any `[heading]`, every chordless text line before the first heading
  is preamble (no regex); the regex + contiguous-block heuristic remains for
  heading-less charts. Verified live on the regenerated entry.
- **Chart-miss sheets rendered as one wall of text** (`plain_lyrics_to_body`
  collapsed blank lines). Fixed: blank lines split stanzas into heading-less
  sections, which SheetView already spaces.
  Same rule applied to `fallback._sections` (the model-aligned path, where
  the live 67-line wall actually came from; `number_lyrics` stays a flat
  enumerate so model indices are unchanged). Live: "Lily tree" chart-miss →
  7 stanzas. Evals 5/5 after.
- **Fuzzy UG title accepted as a chart hit** (live: pick "Lily tree" / Mili
  → UG returned "Lily Dudgeon - Jacaranda Tree" / Misc Originals, and with
  FR-005 re-stamping the sheet was relabelled as that other song).
  `pick_best(..., title=)` now gates on title: covers (no artist match)
  need the EXACT folded title after stripping "(ver 2)"/"[Acoustic]"
  qualifiers (so "Yesterday" ≠ "Yesterday Once More", "Help" ≠ "Helpless");
  charts by the picked artist may match loosely (live variants). No
  qualifying chart → lyrics + model path with the pick's identity kept.
  Re-probe: correct song, LRCLIB lyrics, model chords; Yesterday cover still
  hits The Beatles chart.
- **Fully failed candidate search rendered as no-match** (live: the dev
  container has no Genius token, so LRCLIB was the only attempted provider;
  one non-200 blip → `LyricsClient.search` returned `[]` → 200 `[]` → FR-007
  *no-match* instead of *error-with-retry*, and nothing was logged).
  `LyricsClient.search` now raises `LyricsError` on non-200 / unparsable
  body (only a real 200 `[]` is a miss); `candidates.search` logs each
  provider degradation and raises `CandidatesUnavailableError` when EVERY
  *attempted* provider failed (one failing still degrades to the other's
  rows; LRCLIB-only zero hits stay a legitimate no-match); the route maps it
  to the existing `PROVIDER_ERROR` 502 envelope, which the island already
  renders as error-with-retry. The old "persistent LRCLIB 429 → []" and
  "non-200 → []" tests pinned the masked failure and were re-pinned to the
  raise.
- **Two lyric splitters diverged** (`plain_lyrics_to_body` emitted
  `[Heading]` markers as lyric text; `fallback._sections` dropped blanks).
  One `normalize.split_lyric_sections` now feeds `plain_lyrics_to_body`,
  `number_lyrics`, and `_zip_body`; headings/blanks were never numbered so
  model indices are unchanged (evals 5/5).
- **Live JSON → Zod seam (previously untested — island tests use mocks,
  backend tests assert dicts):** against the compose-built api, real
  responses were run through the exported Zod schemas with `.parse` (not
  `safeParse`): `POST /song-search`, `POST /sheets` (`chord_source: none` +
  two `degraded` entries), `GET /history` (total 44), `GET /history/{id}`
  (8 stored sheets, 6 distinct `chord_source: chart` incl. Wonderwall's
  free-text capo), `POST …/regenerate` (new `entry_id`), and both error
  envelopes (`404 NOT_FOUND` all-zero UUID, `422 VALIDATION_ERROR` empty
  query). All parsed — no Pydantic/Zod drift.

## T036/T037 live-validation addendum (2026-09-16, post-Appendix A)

- `fallback.build_agent()` returns an Agno `Agent(model=OpenRouter(id=
  "openai/gpt-5.6-luna", reasoning_effort="none", timeout=20 s,
  max_tokens=4000), output_schema=ChordsOut)`. The model receives the
  fetched lyrics as numbered lines and returns only per-line chord changes;
  `align()` zips them onto our lyrics (sections/headings preserved), clamps
  past-end offsets to line width (chart-parser precedent), drops non-FR-013
  symbols, maps timeouts → `timeout` and everything else → `unavailable`.
  Lyrics cannot drift (FR-012) because no lyric text crosses the wire.
  Missing key → SkipModel("unavailable") at request time; the Agent is
  never registered in AgentOS (R10). See Appendix A "Budget evidence" for
  why this shape was chosen over echoing the body.
- Eval gates (`backend/evals/test_sheets_fallback.py`, live, skip without
  key): coverage ≥80%, every symbol FR-013-valid, lyrics + headings
  reproduced in order, provenance model id, latency ≤20 s — **5/5 green**
  on F1 (8 lines) + F2 (20) + F3 (36) in 21 s total.
- Real-route chart miss through the compose-built api (`POST /api/v1/sheets`
  with the "Hallelujah - Karaoke Version" LRCLIB-only candidate, which UG
  404s): `200` in 13.6 s (SC-002), `chord_source: model-generated`,
  `model_id: openai/gpt-5.6-luna`, `lyric_source: lrclib`, 67/67 lines
  chorded (Am C F G), `degraded` = video only, response parsed by the Zod
  `generateSheetResponseSchema`. With the stub this same candidate had
  produced `chord_source: none` + `degraded chords/unavailable`.
- Full gates: backend 246 unit (+5 evals live), ruff clean, frontend 189,
  compose api + db healthy, key propagated to the container. The frozen
  SC-005 10-song sample is all chart hits and unaffected by the fallback.

## Spec REQUIRED research — resolution checklist

- [x] Coverage: probe counts above (n=8 popular songs) + fallback chains
  per provider (R1, R2, R5).
- [x] Reliability: timeouts (10 s/call, 25 s backend budget), graceful key
  absence, fixtures for CI (R5, R10, R12).
- [x] Rate limits: LRCLIB polite-client rules, YouTube quota math + no-requery
  rule (R1, R7).
- [x] Licensing/terms fit for private personal use: R4 (excluded),
  R8 (accepted posture + triggers), R0 (standing fallback).
- [x] History-storage compatibility: R8 decision (persist minus Musixmatch).
- [x] Sourcing strategy recommendation: R0 pipeline (chart-takes-all →
  lyrics + model fallback → no-match).
- [x] Model decision: `openai/gpt-5.6-luna` via live `openrouter-model-eval`
  (Appendix A below, 2026-09-16); wired in `fallback.py` with 5/5 eval
  gates green (T036/T037 addendum above).

## Appendix A — Model decision record (Principle V)

STATUS: DECIDED 2026-09-16 — `openrouter-model-eval` run against the live
`openrouter` MCP (server `OpenRouterMcp 0.0.2`, 22 tools; auth = the
owner's own OpenRouter key from the local gitignored `.env`, never in the
repo). Every number below is from in-session MCP calls, not training data.

### Requirements (from R6)

Structured chord alignment over provided lyrics, JSON out in the exact
data-model body shape (`sections[].lines[].{text, chords[].{offset,
symbol}}`), lyric text copied verbatim (never rewritten), every symbol valid
per FR-013 (`is_chord_symbol`), ≥80% lyric-line coverage (SC-005), latency
≤20 s inside the 25 s pipeline deadline, hobby-trivial cost per sheet, one
song of context, `structured_outputs` support (Agno `output_schema`),
OpenRouter-hosted via `backend/` only.

### Live catalog filter

`list-models` with `supported_parameters=structured_outputs`,
`max_output_price=$2/M`, `context≥16k`, sorted `most-popular` (60 rows).
Shortlisted on Artificial Analysis intelligence index vs price:

| Model | Default route | Ctx | $/M in / out | AA intel | Reasoning |
|---|---|---|---|---|---|
| `z-ai/glm-5.3-flash` | GMICloud | 1.05M | 0.075 / 0.25 | 41.9 | mandatory (cannot disable) |
| `google/gemini-3.8-flash` | Google AI Studio | 1.05M | 0.375 / 1.875 | 41.2 | mandatory (cannot disable) |
| `openai/gpt-5.6-luna` | OpenAI | 1.05M | 0.10 / 0.60 | 37.5 | optional (`none` OK) |
| `deepseek/deepseek-v4-flash-0731` | — | 1.05M | 0.04 / 0.10 | 34.5 | optional |

### Test prompts + results

System prompt = the R6 contract (JSON-only, exact shape, verbatim lyrics,
0-based `offset`, Western notation incl. 7ths/sus/dim/aug, beginner ukulele
key). Scoring used the real backend validators (`validate_body` for
offsets/shape, `is_chord_symbol` for FR-013) plus a verbatim-lyrics check.
Fixtures are public-domain text: F1 = 8 lines (Amazing Grace v1 + Swing Low
chorus); F2 = 20 lines / 5 sections (Danny Boy + Shenandoah), with
apostrophes and commas to stress offsets. `max_tokens=4000`,
`timeout_ms=40000`; reasoning `none` where allowed, else `minimal`.

| Model | F1 | F2 run 1 | F2 run 2 | $/sheet (F2) | Verdict |
|---|---|---|---|---|---|
| `openai/gpt-5.6-luna` | 2.9 s · 8/8 · 24 ch · D7 | 6.7 s · 20/20 · 67 ch · G7 | 6.4 s · 20/20 · 65 ch · Em7 G7 | $0.0013 (OpenAI, 129 tok/s) | **3/3 clean, fastest** |
| `google/gemini-3.8-flash` | 14.0 s · 8/8 · 24 ch · C7 G7 | 9.7 s · 20/20 · 97 ch · C7 D7 Dm7 G7 | 12.8 s · 20/20 · 88 ch · C7 G7 | $0.0050 (Google, 78 tok/s) | 3/3 clean, richest vocab, 2× latency, 4× cost |
| `z-ai/glm-5.3-flash` | 4.9 s · 8/8 · 20 ch · G7 | 10.4 s · **offset 38 > width 37** (validator reject) | 8.6 s · 20/20 · 72 ch · G7 | $0.0004 (GMICloud, 101 tok/s) | 2/3 — one contract violation |
| `deepseek/deepseek-v4-flash-0731` | 15.8 s · 8/8 · 34 ch · C7 G7 | **client timeout at 40 s** | — | — | fails ≤20 s budget |

All completed runs: lyrics verbatim, 100% line coverage (bar = 80%), zero
invalid FR-013 symbols. Coverage/vocab therefore did not discriminate;
latency, cost, and contract reliability did.

### Decision

- **Winner: `openai/gpt-5.6-luna`** via the OpenRouter default route
  (OpenAI, $0.10/$0.60 per M, 99.3% 30-min uptime; Azure/Bedrock at 2× are
  automatic fallbacks). Rationale: the only finalist that was contract-clean
  on 3/3 runs AND under half the latency budget on the 20-line song
  (6.4–6.7 s vs 20 s); ~$0.0013 per fallback sheet (1,000 chart-miss sheets
  ≈ $1.30); reasoning can be disabled, which keeps latency deterministic and
  avoids the reasoning-token cost the other two cannot switch off. Vocab was
  the thinnest of the four (7ths only) — acceptable: the bar is "as songs
  require", and richer voicings are a quality nicety, not a gate.
- **Runner-up: `google/gemini-3.8-flash`** — also 3/3 clean and the richest
  harmonic vocabulary. Revisit trigger: if owner review of model-generated
  sheets finds Luna's chord choices too plain, or Luna's latency drifts past
  ~12 s on 20-line songs, switch and re-run the T037 eval gates.
- **Rejected:** `z-ai/glm-5.3-flash` — cheapest by 3× ($0.0004/sheet), but
  reasoning cannot be disabled on its endpoint (latency variance + reasoning
  tokens billed on every call) and it was slower on the 20-line fixture
  (8.6–10.4 s vs Luna 6.4–6.7 s). Its one contract failure at eval time
  (`offset 38 > width 37`) is *no longer disqualifying*: T036 clamps
  past-end offsets to line width (chart-parser precedent), so that run
  would now ship. GLM is therefore the **cheap-revisit candidate**: if
  fallback volume ever makes Luna's cost matter, re-run the T037 gates on
  GLM with `reasoning_effort="minimal"` and switch if latency holds.
  `deepseek/deepseek-v4-flash-0731` — 15.8 s on the short fixture and a
  40 s timeout on the long one; fails the budget outright.

### Configure

- Model ID: **`openai/gpt-5.6-luna`**; provider route: OpenRouter default
  (no provider pin — variance is acceptable for a hobby fallback; pin
  `OpenAI` only if reproducing an eval). Agno:
  `Agent(model=OpenRouter(id="openai/gpt-5.6-luna", reasoning_effort="none",
  max_tokens=4000, timeout=20), output_schema=ChordsOut)` — per-line chord
  changes keyed by explicit line index, zipped onto the fetched lyrics (see
  "Budget evidence" below); the pipeline's 25 s deadline is the hard stop.
  Stored on every model sheet as `model_id` for provenance (FR-012
  `chords: model-generated`).
- T037 eval gates (R12) MUST encode exactly what discriminated here:
  verbatim lyrics, offsets within line width, FR-013-valid symbols, ≥80%
  coverage, and a latency ceiling.

### Budget evidence on the shipped path (Agent, not the MCP client)

The table above was measured through the MCP `send-message` client. The
shipped path is Agno `Agent.run()` with native structured outputs, which
adds overhead (8-line F1: 6.5 s via Agent vs 2.9 s via MCP). Re-measured
through `build_agent()` on a 36-line / 9-section public-domain fixture
(F3, realistic sheet length), two runs each:

| Wire shape | Luna F3 | Gemini F3 (runner-up) |
|---|---|---|
| Echo body (model returns lyrics + chords) | 14.4 s / 12.6 s | **20.3 s** / 11.1 s |
| **Chords-only** (model returns per-line chord lists; we zip onto our lyrics) | **9.7 s / 8.6 s** (1,151–1,255 out tokens) | not needed |

Decision consequences, both implemented in T036:
- **Chords-only wire shape** (`ChordsOut`): ~30% faster, roughly halves
  output tokens, and makes `lyrics_untouched` true by construction — the
  model never receives a way to alter lyric text. Persisted body shape is
  unchanged. Gemini's 20.3 s run confirms the runner-up would sit at the
  budget edge on real songs even before Agent overhead.
- **`max_tokens=4000`** explicitly — Agno's `OpenRouter` default is 1024,
  which would silently truncate a 20-line song's JSON into a lyrics-only
  sheet that looks like a model failure. Throughput projection: Luna ≈
  120–150 tok/s → a 50-line song (~1,700 chords-only tokens) ≈ 12–14 s,
  inside the 20 s budget with margin.
- **Past-end offsets are clamped to line width** (chart-parser precedent,
  `normalize.py`) rather than dropped — the exact GLM failure above
  (`offset 38 > width 37`) is an end-of-line chord worth keeping.
- T037 latency gate runs F1 + F2 + F3 through the real Agent (observed
  F2 6.5–11.5 s, F3 10.1–11.1 s; 5/5 green in 21 s total).

## Toolchain pins (verified 2026-09-16)

- Node v22.19.0, npm 10.9.3, Python 3.12.11, Docker 29.4.0 (all present).
- Frontend pins unchanged from scaffold: `astro@7.3.2`, `@astrojs/react@6`,
  React 19, `tailwindcss` v4, `zod` v4, Vitest 5 (+ Testing Library, jsdom),
  `tsx`, ESLint 9 + Prettier (+ astro plugins). No new frontend deps.
- Backend adds: `httpx` (promoted dev → main: provider HTTP), `openai>=1,<2`
  (runtime required by Agno's OpenRouter provider — verified 2026-09-16:
  `agno[os]` does NOT pull `openai`, and `agno.models.openrouter` imports
  `openai.types.chat` at module load, so the pin stays; our code makes no
  bare SDK calls, all inference goes through the R6 Agent; configured only
  after Appendix A is filled). Rest unchanged: `agno[os]`, `fastapi`,
  `uvicorn`, `psycopg[binary]`, `sqlalchemy`, `pgvector`, pytest, ruff.
