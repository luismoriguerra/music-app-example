import type { Chord } from "./content/schemas";
import type {
  Candidate,
  ChordPosition,
  SheetLine,
  SourceLink,
} from "./sheets/schemas";

/**
 * Pure sheet helpers (T010, 004): candidate dedup, chord-position
 * normalization, catalog cross-link matching, sources dedup. Zero Astro and
 * zero UI imports (Principle VIII).
 */

export type { Candidate, ChordPosition, SheetLine, SourceLink };
export type CatalogChord = Chord;

/**
 * Standard Western chord vocabulary (FR-013). MUST stay textually identical
 * to CHORD_SYMBOL_RE in backend/db_models.py.
 */
export const CHORD_SYMBOL_RE =
  /^[A-G](?:#{1,2}|b{1,2})?(?:m(?!aj)|maj|min|dim|aug|sus|add|\d+(?:sus|add)?)?[0-9#A-Gb()+\-/M°]*$/;

export function isChordSymbol(symbol: unknown): boolean {
  if (typeof symbol !== "string") return false;
  const canonical = symbol.replace(/\s+/g, "");
  return canonical.length > 0 && CHORD_SYMBOL_RE.test(canonical);
}

const foldSpelling = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Normalized `title + artist` identity key (lowercase/punctuation-folded). */
export function normalizeIdentity(title: string, artist: string): string {
  return `${foldSpelling(title)}|${foldSpelling(artist)}`;
}

/** Dedup candidates by normalized identity, keeping the first occurrence. */
export function dedupeCandidates(
  candidates: readonly Candidate[],
): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const candidate of candidates) {
    const key = normalizeIdentity(candidate.title, candidate.artist);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

/**
 * Defensive chord-position normalization for rendering: drop out-of-range
 * offsets (UTF-16 code units — JS string length), sort ascending, dedupe
 * shared offsets keeping the first. Zero-chord lines stay legal.
 */
export function normalizeChordPositions(line: SheetLine): ChordPosition[] {
  const width = line.text.length;
  const valid = line.chords.filter(
    (c) => Number.isInteger(c.offset) && c.offset >= 0 && c.offset <= width,
  );
  const sorted = [...valid].sort((a, b) => a.offset - b.offset);
  const seen = new Set<number>();
  return sorted.filter((c) => {
    if (seen.has(c.offset)) return false;
    seen.add(c.offset);
    return true;
  });
}

const CATALOG_ROOT_RE = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/;

/**
 * Match a chord symbol against the 36-entry Chords catalog (M2). Only plain
 * triads resolve (major: "", "maj", "M"; minor: "m", "min"); anything with
 * extensions, alterations, or a slash bass returns null so the view renders
 * the symbol with a diagram-unavailable tag.
 */
export function matchCatalogChord(
  symbol: string,
  catalog: readonly CatalogChord[],
): CatalogChord | null {
  const compact = symbol.replace(/\s+/g, "");
  const rootMatch = CATALOG_ROOT_RE.exec(compact);
  if (!rootMatch) return null;
  const [, root, tail] = rootMatch;
  let type: "major" | "minor" | null = null;
  if (tail === "" || tail === "maj" || tail === "M") type = "major";
  else if (tail === "m" || tail === "min") type = "minor";
  if (!type) return null;
  return (
    catalog.find(
      (entry) =>
        entry.type === type &&
        (entry.root === root || entry.rootAlias === root),
    ) ?? null
  );
}

/**
 * Dedup outbound links: drop urls in the attribution set, then drop repeat
 * urls, keeping the first occurrence of each.
 */
export function dedupeSourceLinks(
  links: readonly SourceLink[],
  attributionUrls: readonly string[],
): SourceLink[] {
  const blocked = new Set(attributionUrls);
  const seen = new Set<string>();
  const out: SourceLink[] = [];
  for (const link of links) {
    if (blocked.has(link.url) || seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}
