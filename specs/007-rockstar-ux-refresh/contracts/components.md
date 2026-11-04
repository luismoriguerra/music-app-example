# Contract: Refreshed Components (props, behavior, a11y, performance)

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
**Spec**: [../spec.md](../spec.md) | **Research**: R3–R8, R12 in [../research.md](../research.md)

## Discovery (`CourseCard`, `TopicGameCard`, `Hero`, `UkuleleBadge`)

- `CourseCard` / `TopicGameCard` keep their props; the card becomes ONE
  link via a stretched anchor (`after:absolute after:inset-0`, card
  `relative`): pointer selection anywhere opens the destination
  (FR-007); keyboard: single Tab stop, Enter/Space activates, visible
  focus ring. Kind labels (Topic/Game) + descriptions unchanged.
- `Hero.astro` props: `eyebrow: string`, `title: string`,
  `subcopy: string`, optional `art: "stage" | "none"` (default
  `"stage"`). Static, zero JS.
- `UkuleleBadge.astro` props: `title: string` (for `aria-label`).
  Renders the inline-SVG ukulele mark. `CourseCard` maps
  `cover === "ukulele"` → badge; all other values keep today's
  emoji/initial rendering (FR-004).
- Grids: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr`,
  cards `h-full` (FR-008 — even rows for uneven counts; single column
  on phones, no page sideways scroll).

## Explorer filters (`FilterPills` + `ChordList`/`CircleList`/`ScaleList`)

```text
FilterPills props:
  groups: readonly FilterGroup[]   # from the owning lib's FILTER_GROUPS (unchanged shape)
  value: string                    # current filter value (valid option of the owning explorer)
  counts: ReadonlyMap<string, number>  # value → matching entries ("All" = full size)
  onChange: (value: string) => void
  id?: string                      # a11y label wiring
```

- Renders `role="radiogroup"` + pills `role="radio"`
  `aria-checked`; arrow keys move, Tab enters/exits (FR-020).
- Layout: wrapping row on `sm+`; `overflow-x-auto snap-x` scroll row
  on phones with an accessible label (FR-012).
- Owning islands replace `<select>` with `FilterPills` (same values,
  same `filterX`/`sortX`, same "All restores default order"); detail
  open/close + back-preserves-filter semantics unchanged (FR-013/FR-014).
- Entry rows + pills are 44px+ targets (FR-018).

## Game (`SheetGenerator` + starters)

- `STARTER_SONGS: readonly string[]` (≥4, unique, 1–200 chars) from
  pure `lib/sheets/starter-songs.ts` (T1).
- Quick-start section (rendered when no sheet/candidates are showing):
  explanation + starter chips; chip selection calls the existing
  `submit(query)` path (FR-009) — no new fetch logic.
- Layout: `lg:grid lg:grid-cols-[1fr_320px]` (input/results +
  history/tips); stacked on phones (FR-010). Input + actions 44px+
  (FR-018). Candidate/sheet/history/error sub-views: DEVIATION owner-directed 2026-09-18 — history auto-open + vertical list (supersedes 004 carousel), candidates focus mode (search form + aside hidden) with Back to search, per-row generating; converge pending against FR-010/T022.

## Lesson + neck (`LessonReader`, `NeckFrame`, `ScaleNeck` call sites)

- `LessonReader.astro`: renders BOTH `<details class="lg:hidden">`
  (collapsed chapter control, `<summary>` "In this chapter — N
  sections", links to `#introduction`/`#slugs`/`#summary`) AND
  `<aside class="hidden lg:block">` (existing sticky desktop index).
  Current section: `:target` highlight + `aria-current="true"` on the
  matching link after navigation (FR-015). Live scrollspy deferred per R6.
  Measure `max-w-[65ch]` retained; figures `grid-cols-2 sm:4` no-overlap (FR-016);
  `scroll-mt` clears the sticky header.
- `NeckFrame.astro` props: none (slot wrapper). Frame:
  `overflow-x-auto`, child `min-w-[640px]`, `tabindex="0"`
  `role="region"` + `aria-label`, visible swipe hint on coarse
  pointers (FR-017). `CircleList` + `ScaleList` focus views render
  `ScaleNeck` inside it; `ScaleNeck` SVG untouched.
- Audio/diagram/transpose controls: 44px+ targets (FR-018).

## Shared states (`ViewStates`, 404)

- Same props/states (`empty`/`loading`/`error` + retry); rockstar
  styling only (FR-022).

## Performance (hydration, prefetch, reserved space)

- Hydration (FR-024): explorer islands + `SheetGenerator` use
  on-visible hydration at their route call sites (`[topic].astro`,
  `[game].astro`); `ThemeToggle` uses on-idle hydration in
  `Layout.astro`. Every island renders a readable SSR shell (headings,
  text, links usable before hydration).
- Prefetch (FR-025): primary internal navigation (header + card links)
  opts into hover/viewport-intent prefetching (config in
  `astro.config.mjs` + markers on links; exact API verified against
  `astro-docs` MCP at implement). External/source links never prefetch.
- Reserved space (FR-026/FR-027): `Hero`, card grids, pill rows, chord
  figures, and `NeckFrame` carry min-height/aspect reservations
  (`global.css` helpers + component classes) so deferred islands and
  art pop into stable slots; decorative art is CSS/SVG-only and MUST
  NOT gate primary content.
