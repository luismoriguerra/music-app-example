# Contract: Game Content Entry + Route (delta on 001)

**Feature**: `004-lyrics-chords-generator` | **Date**: 2026-09-16
**Spec**: [../spec.md](../spec.md) | **Research**: R11 in [../research.md](../research.md) |
**Base contract**: [001 routes](../../../001-music-course-catalog/contracts/routes.md)

Phase 1 output. The 001 routes contract is unchanged; this file is the delta
that activates the reserved game route for exactly one entry. Enforcement is
the same `content.config.ts` (per-entry Zod) + `check-content.ts` `prebuild`
gate (cross-collection rules) — no new content tooling.

## `games/lyrics-chords.json` (new — the only content change)

```jsonc
{ "title": "Lyrics + Chords",      // → slug "lyrics-chords", FR-002
  "slug": "lyrics-chords",
  "kind": "game",                  // explicitly declared (FR-001)
  "courseSlug": "ukulele",
  "description": "…",              // 1–280 chars (FR-001 card text)
  "rules": "…",                    // usage text; REQUIRED before any game ships (001 data-model)
  "order": 10 }                    // after the Chords/Harmonic Circles topics
```

Rules covered by existing validators: slug shape + per-course uniqueness
(rules 1–2), `courseSlug` resolves to ukulele (rule 3), `kind` literal
(schema). Contract tests: one valid + one invalid fixture for the games
entry (invalid asserts Zod throws / `validateCollections()` names it).

## Route activation (no pattern change)

| Route | File | Params | Content source |
|---|---|---|---|
| `/courses/ukulele/games/lyrics-chords` | `src/pages/courses/[course]/games/[game].astro` | `course` = `ukulele`, `game` = `lyrics-chords` | game entry + `SheetGenerator` island (this feature, FR-002) |
| `/courses/ukulele/games/lyrics-chords/<uuid>` | `src/pages/courses/[course]/games/lyrics-chords/entry.astro` (static shell, `/…/lyrics-chords/entry`) served for every `/courses/:course/games/lyrics-chords/:id` via a host rewrite (`public/serve.json` in prod; dev-server middleware in `astro.config.mjs`) | `id` = history entry id (last path segment) | `SheetEntry` island fetches `GET /api/v1/history/{entry_id}`, renders breadcrumb `Courses / Ukulele / Lyrics + Chords / {title}` + the stored sheet; unknown/malformed id → island-rendered not-found view (FR-015, SC-007) |
| `/courses/ukulele/games/lyrics-chords?entry=<uuid>` | `[game].astro` | legacy | island redirects (`location.replace`) to `/courses/ukulele/games/lyrics-chords/<uuid>` |
| other `/courses/[course]/games/[game]` | same file | — | unchanged coming-soon empty state (no other game ships) |

`gameStaticPaths()` already enumerates from the `games` collection, so adding
the JSON entry is what creates the route — no router change. Unknown game
slugs still fall through to `404.astro` (FR-015, SC-007). Sheet pages are
per-user ids, so they cannot be prerendered: one static shell is rewritten
for every id and the `SheetEntry` island owns the mapping: API `NOT_FOUND`
(or a malformed id, validated client-side without fetching) renders the
not-found view defined below, satisfying FR-015/SC-007's "history address"
branch.

## View-state contract (FR-014 — generator views)

The game page shell (breadcrumb + title + description) is static. All dynamic
states live in the `SheetGenerator` island (`client:load`, runtime fetches
only — no SSR fetch, R11):

| View | `loading` | `ready` | `empty` | `error` |
|---|---|---|---|---|
| generator input | — (static) | input + action (FR-003) | — | inline guidance on empty submit (FR-003) |
| candidates | indicator (FR-007) | rows; pick → generate (FR-006) | merges into no-match | message + retry, input preserved (FR-007) |
| sheet | indicator (FR-007) | identity + lyrics + chords + per-part attribution (FR-005/012) + sources (FR-016) | n/a (no-match instead) | message + retry, input preserved (FR-007) |
| history | indicator | newest-first rows, 10 per page with prev/next + "Page N of M"; favorite star per row; favorites-only + name filters; select → sheet page; regenerate affordance (FR-009/010/018) | friendly "no searches yet" (Story 3 #4); "no matching songs" when filters exclude all | message + retry; one unrestorable entry degrades to unavailable, list intact (edge case) |
| sheet page (`/lyrics-chords/<uuid>`) | indicator | breadcrumb with title + stored sheet + favorite/regenerate/delete actions, zero re-query (FR-009/010/018) | — | island-rendered not-found view on unknown/malformed id: message + link to `/` + link back to the generator (FR-015, SC-007) |

Notes:

- Backend base URL is `PUBLIC_API_URL` (default `http://localhost:8000`),
  read by the island only; missing/unreachable backend surfaces the `error`
  state, never a blank page or crash.
- History re-open renders the stored sheet response verbatim (rest-api.md:
  zero re-query); regenerate shows `loading` until the fresh sheet arrives.
- History entries are deep-linkable via `/courses/ukulele/games/lyrics-chords/<uuid>`
  (shareable within the single-owner app); generate, re-open, and regenerate
  navigate to it; deleting from the sheet page returns to the generator.
- The search page mirrors its history view into its own query string
  (`?page=N&q=<name>&fav=1`, defaults omitted) and restores it on load, so
  Back from a sheet page returns to the same page and filters.
- Outbound source links open outside the app (`target="_blank"`,
  `rel="noopener"`); dead links MUST NOT break the sheet (edge case).
- Reachability preserved: Home → course → generator card in ≤3 selections
  (SC-001); sheet/history within the game view (SC-004).
