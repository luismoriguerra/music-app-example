import type { Course, Game, Topic } from "./content/schemas";

/**
 * Pure static-path builders (FR-014/FR-015). Pages pass collection data in and
 * spread the result into `getStaticPaths()`; any slug not returned here has no
 * page and falls through to 404.astro at build time.
 */

export function courseStaticPaths(courses: readonly Course[]) {
  return courses.map((course) => ({
    params: { course: course.slug },
    props: { course },
  }));
}

export function topicStaticPaths(topics: readonly Topic[]) {
  return topics.map((topic) => ({
    params: { course: topic.courseSlug, topic: topic.slug },
    props: { topic },
  }));
}

export function gameStaticPaths(games: readonly Game[]) {
  return games.map((game) => ({
    params: { course: game.courseSlug, game: game.slug },
    props: { game },
  }));
}

/** Game whose stored sheets get dedicated pages (004 FR-009). */
export const SHEET_GAME_SLUG = "lyrics-chords";

/**
 * Static shell for the per-entry sheet page (game-route.md): one page per
 * course owning the lyrics-chords game, at `/courses/<c>/games/lyrics-chords/entry`.
 * The host rewrites every `/courses/<c>/games/lyrics-chords/<id>` to it.
 */
export function sheetEntryShellStaticPaths(games: readonly Game[]) {
  return games
    .filter((game) => game.slug === SHEET_GAME_SLUG)
    .map((game) => ({ params: { course: game.courseSlug }, props: { game } }));
}

/** Dedicated sheet page address for a history entry. */
export function sheetEntryPath(gamePath: string, entryId: string): string {
  return `${gamePath.replace(/\/+$/, "")}/${entryId}`;
}
