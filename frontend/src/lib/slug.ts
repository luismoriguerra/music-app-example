const MAX_SLUG_LENGTH = 64;

/** Title → lowercase ASCII slug, single hyphens, ≤64 chars (FR-015). */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

/** Slugify a list of titles, resolving collisions with -2, -3, … suffixes (in order). */
export function uniqueSlugs(titles: string[]): string[] {
  const used = new Map<string, number>();
  return titles.map((title) => {
    const base = slugify(title);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}
