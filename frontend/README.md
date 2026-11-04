# frontend — Music Course Catalog (Astro 7)

Static Astro 7 site with React islands (Chords + Circles explorers, Lyrics + Chords
generator). Tailwind CSS v4 via `@tailwindcss/vite`, shadcn/ui primitives
(`src/components/ui/`), Zod-validated JSON content collections.

## One-liners

```bash
npm install
npm run dev            # http://localhost:4321 (API base: PUBLIC_API_URL, default http://localhost:8000)
PUBLIC_API_URL=https://api.example.com npm run build   # point the island at a non-local API
npm run build          # runs `prebuild` → check-content first
npm run preview
npm test               # vitest run
npm run check-content  # content integrity gate (also runs as prebuild)
npm run check          # astro check (type-check every file, incl. unimported ui/ seeds)
npm run lint           # eslint .
npm run format:check   # prettier --check .   (npm run format to fix)
```

## Architecture (constitution Principle VIII — dependency direction ↓)

```
pages/            thin routes: fetch content, compose components, no business logic
  ↓
components/       presentational (.astro cards/partials, React islands) + shadcn ui/
  ↓
lib/              pure domain logic + Zod schemas — ZERO astro imports
  ├─ notes.ts               canonical spellings + pitch lookups (zero-import leaf)
  ├─ content/schemas.ts     Zod schemas + refines (imports zod + ../notes)
  ├─ content/validate.ts    validateCollections() cross-collection checks
  ├─ chords.ts              filterChords / sortChords / FILTER_GROUPS (Chord via z.infer)
  ├─ lessons.ts             resolveLessonChords / renderProse / slugifyHeading / sectionSlugs
  ├─ circles.ts             collectLessonCircles / resolveCircleChords / filterCircles / sortCircles
  ├─ slug.ts                slugify + uniqueSlugs
  └─ utils.ts               shadcn cn()
  ↓
content/          curated JSON (courses, topics, games, chords)
```

`src/content.config.ts` is thin wiring only: `defineCollection({ loader, schema })`
importing the pure schemas. Cross-collection checks (dangling refs, slug
uniqueness, exactly 24 chords, every filter spelling matched, lesson chord
refs resolve — rule 15, unique progression names per course — rule 18) run
in `scripts/check-content.ts` via `tsx` as the `prebuild` gate — a broken
entry fails the build by name.

## Lyrics + Chords island (004)

Route `/courses/ukulele/games/lyrics-chords` (from `content/games/lyrics-chords.json`)
mounts the `SheetGenerator` island (`client:load`, runtime fetches only — never SSR).
Presentational children: `CandidateList`, `SheetView`, `SourceLinks`, `HistoryList`.
Wire shapes live in `src/lib/sheets/schemas.ts` (Zod mirrors of
`specs/004-lyrics-chords-generator/contracts/rest-api.md`); pure helpers in
`src/lib/sheets.ts` (zero Astro imports). History entries deep-link via
`?entry=<uuid>` (same static file; the island owns the lookup + not-found view).

Deploy note: Astro inlines `PUBLIC_API_URL` at build time, so the production
bundle bakes whatever value is present during `npm run build` (default
`http://localhost:8000`). `frontend/Dockerfile` declares `ARG PUBLIC_API_URL`,
so on Railway set the variable on the **frontend** service (Railway forwards
service variables as build args for declared `ARG`s) and redeploy; locally use
`docker build --build-arg PUBLIC_API_URL=https://api.example.com`. The backend
must list the frontend origin in `CORS_ORIGINS` or every browser call fails
preflight.

## Tests

`tests/` — Vitest. Default environment is `node`: `.astro` components render
through `experimental_AstroContainer` (`astro/container`), which needs the SSR
transform (a jsdom default makes `.astro` imports compile to the client stub and
`renderToString` throws `NoMatchingRenderer`). React island tests opt into jsdom
per file with `// @vitest-environment jsdom` and use Testing Library
(`selectOptions` on the native `<select>` filter). `vitest.config.ts` is built
with `getViteConfig()` from `astro/config`.

## Gotcha: stale collection entries

The Content Layer data store lives in `node_modules/.astro/data-store.json`. When
a collection directory becomes empty, the glob loader warns and skips syncing, so
deleted entries keep building pages. After removing the last entry of a
collection: `rm -rf node_modules/.astro && npm run build`.
