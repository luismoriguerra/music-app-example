# Contract: Rockstar Theme (tokens, toggle, persistence)

**Feature**: `007-rockstar-ux-refresh` | **Date**: 2026-09-18
**Spec**: [../spec.md](../spec.md) | **Research**: R1/R2/R8 in [../research.md](../research.md)

## Token contract (`frontend/src/styles/global.css`)

- The existing `@theme inline` + `:root` / `.dark` custom-prop block is
  EXTENDED (not replaced): all current token names keep working.
- ADDS a rockstar accent family (`--color-rock-*` scale or equivalent
  single accent + glow tints — exact names at implement, documented in
  code): one energetic accent used for primary actions, active pills,
  focus rings, and sparse highlights in both appearances.
- Dark-first: `:root` (no `.dark`) is the LIGHT appearance; `.dark` is
  the stage appearance (near-black background, warm paper text). Default
  preference is `"dark"` per spec Assumptions.
- Contrast (FR-019/SC-005): `muted-foreground` on `background`/`card`
  MUST be ≥4.5:1 in both appearances; large text + essential controls
  ≥3:1. Verified by the quickstart contrast audit (zero failures).
- Focus (FR-020): a global `:focus-visible` ring (accent, ≥2px,
  offset) MUST be visible on every interactive element.
- Motion (FR-021): `@media (prefers-reduced-motion: reduce)` MUST
  flatten decorative glows/transitions to a static equivalent; no
  content depends on motion.

## Toggle + persistence contract (`lib/theme.ts` + `ThemeToggle` + layout script)

```text
ThemePreference = "dark" | "light" | "system"   (default "dark")
storageKey      = "music-app-example:theme"             (exact, shared)
resolveTheme(stored) = stored ?? "dark"
effective(p, prefersDark) =
  p == "system" ? (prefersDark ? "dark" : "light") : p
```

Rules:

- `lib/theme.ts` is pure (zero Astro/React imports): preference type,
  storage key const, `resolveTheme(stored) = stored ?? "dark"` + `effectiveTheme()` helpers.
- `Layout.astro` SSR-defaults `<html class="dark">` and embeds a blocking init script that reads `storageKey` (missing → `"dark"`)
  and applies/removes `.dark` on `<html>` before first paint (no flash
  of wrong appearance on revisit).
- `ThemeToggle.tsx` (`client:idle`) cycles dark → light → system,
  persists every change, updates `.dark` immediately, exposes its state
  (`aria-pressed` or `aria-label` naming the current mode), and is
  keyboard-operable with a 44px+ target.
- No-JS fallback: SSR `<html class="dark">` default renders dark (dark-first); the app stays fully usable
  (readable shells; no theme switching/filtering without JS).

## Shell contract (`Layout.astro` + `Hero.astro` + footer)

- Header (sticky): app identity with stage mark (link to `/`) +
  "Courses" nav + `ThemeToggle`. Static Astro except the toggle island.
- `Hero.astro` (static): eyebrow + display headline + subcopy +
  optional art slot; composed by home + course pages only.
- Footer (static, minimal): app name + catalog/course links.
- `ViewStates.astro` + `404.astro`: same props/behavior, rockstar
  styling only (FR-022).

## Cross-app contract

None — theme is frontend-local (device storage only, no backend calls).
