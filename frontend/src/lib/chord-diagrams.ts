import type { ChordDiagram } from "./content/schemas";
import {
  matchCatalogChord,
  normalizeChordPositions,
  type CatalogChord,
} from "./sheets";
import type { Sheet } from "./sheets/schemas";

/**
 * Pure ukulele chord-diagram generation (004 follow-up): parse Western chord
 * symbols (FR-013) and compute playable standard-GCEA fingerings for
 * off-catalog chords (7ths, sus, dim, aug, ...). The 36-entry
 * major/minor/diminished catalog stays the source of truth for plain triads;
 * this module only fills the gaps the catalog cannot cover. It also hosts
 * the pure semitone transposition helpers behind the view stepper. Zero
 * Astro/UI imports (Principle VIII).
 */

/** Open-string pitch classes for standard GCEA tuning (C = 0). */
export const UKULELE_OPEN_PC = [7, 0, 4, 9] as const;

const NATURAL_PITCH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ROOT_RE = /^([A-G])(#{1,2}|b{1,2})?/;
const BASS_RE = /^([A-G])(#{1,2}|b{1,2})?$/;

/** Semitone intervals above the root for the most common qualities. */
const EXACT: Record<string, readonly number[]> = {
  "": [0, 4, 7],
  M: [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  "5": [0, 7],
  "6": [0, 4, 7, 9],
  M6: [0, 4, 7, 9],
  maj6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  min6: [0, 3, 7, 9],
  "7": [0, 4, 7, 10],
  M7: [0, 4, 7, 11],
  maj7: [0, 4, 7, 11],
  ma7: [0, 4, 7, 11],
  Maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  mM7: [0, 3, 7, 11],
  mMaj7: [0, 3, 7, 11],
  minMaj7: [0, 3, 7, 11],
  mmaj7: [0, 3, 7, 11],
  dim: [0, 3, 6],
  "\u00b0": [0, 3, 6],
  o: [0, 3, 6],
  mb5: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  "\u00b07": [0, 3, 6, 9],
  o7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  min7b5: [0, 3, 6, 10],
  hdim: [0, 3, 6, 10],
  hdim7: [0, 3, 6, 10],
  aug: [0, 4, 8],
  "+": [0, 4, 8],
  "+5": [0, 4, 8],
  "#5": [0, 4, 8],
  aug7: [0, 4, 8, 10],
  "+7": [0, 4, 8, 10],
  "7#5": [0, 4, 8, 10],
  "7+5": [0, 4, 8, 10],
  "7aug": [0, 4, 8, 10],
  "M7#5": [0, 4, 8, 11],
  "maj7#5": [0, 4, 8, 11],
  "+M7": [0, 4, 8, 11],
  augM7: [0, 4, 8, 11],
  augMaj7: [0, 4, 8, 11],
  "m7#5": [0, 3, 8, 10],
  sus: [0, 5, 7],
  sus4: [0, 5, 7],
  "4": [0, 5, 7],
  sus2: [0, 2, 7],
  "7sus": [0, 5, 7, 10],
  "7sus4": [0, 5, 7, 10],
  M7sus4: [0, 5, 7, 11],
  maj7sus4: [0, 5, 7, 11],
  add9: [0, 4, 7, 2],
  add2: [0, 4, 7, 2],
  "2": [0, 4, 7, 2],
  madd9: [0, 3, 7, 2],
  madd2: [0, 3, 7, 2],
  m2: [0, 3, 7, 2],
  minadd9: [0, 3, 7, 2],
  Madd9: [0, 4, 7, 2],
  majadd9: [0, 4, 7, 2],
  "9": [0, 4, 10, 2],
  m9: [0, 3, 10, 2],
  min9: [0, 3, 10, 2],
  M9: [0, 4, 11, 2],
  maj9: [0, 4, 11, 2],
  "11": [0, 5, 7, 10],
  m11: [0, 3, 10, 5],
  min11: [0, 3, 10, 5],
  M11: [0, 4, 11, 5],
  maj11: [0, 4, 11, 5],
  "13": [0, 4, 10, 9],
  m13: [0, 3, 10, 9],
  min13: [0, 3, 10, 9],
  M13: [0, 4, 11, 9],
  maj13: [0, 4, 11, 9],
  "69": [0, 4, 9, 2],
  "6/9": [0, 4, 9, 2],
  m69: [0, 3, 9, 2],
  "m6/9": [0, 3, 9, 2],
  min69: [0, 3, 9, 2],
  M69: [0, 4, 9, 2],
  maj69: [0, 4, 9, 2],
  "7b5": [0, 4, 6, 10],
  M7b5: [0, 4, 6, 11],
  maj7b5: [0, 4, 6, 11],
  "7#9": [0, 4, 10, 3],
  "7b9": [0, 4, 10, 1],
  "7#11": [0, 4, 10, 6],
  "9#11": [0, 4, 10, 6],
};

function pitchOf(letter: string, accidental?: string): number {
  let pitch = NATURAL_PITCH[letter] ?? 0;
  if (accidental) {
    for (const ch of accidental) pitch += ch === "#" ? 1 : -1;
  }
  return ((pitch % 12) + 12) % 12;
}

/**
 * Compositional fallback for tails outside EXACT: assemble root/third (or
 * sus)/fifth (or altered fifth)/seventh-or-sixth/one extension, capped at 4
 * pitch classes with the perfect fifth dropped first. Returns null when the
 * tail carries no recognizable quality marker at all.
 */
function fallbackIntervals(tail: string): readonly number[] | null {
  if (tail === "") return [0, 4, 7];
  if (!/(maj|min|m|dim|°|aug|sus|add|\d|\+|#|b\d|o)/i.test(tail)) {
    return null;
  }
  const low = tail.toLowerCase();
  const dimLike =
    low.includes("dim") || tail.includes("°") || low.startsWith("o");
  const augLike =
    low.includes("aug") || tail.includes("+") || tail.includes("#5");
  const sus2 = low.includes("sus2");
  const susLike = low.includes("sus");
  let minor = false;
  if (
    tail.startsWith("maj") ||
    tail.startsWith("Maj") ||
    tail.startsWith("MAJ") ||
    tail[0] === "M"
  ) {
    minor = false;
  } else if (tail.startsWith("min") || tail[0] === "m") {
    minor = true;
  }
  if (dimLike) minor = true;
  const third = sus2 ? 2 : susLike ? 5 : minor ? 3 : 4;
  const fifth = dimLike || low.includes("b5") ? 6 : augLike ? 8 : 7;
  let seventh: number | null = null;
  const hasMaj7 =
    low.includes("maj7") || tail.includes("M7") || low.includes("ma7");
  if (hasMaj7) {
    seventh = 11;
  } else if (
    low.includes("dim") &&
    tail.includes("7") &&
    !low.includes("m7b5") &&
    !low.includes("hdim")
  ) {
    seventh = 9;
  } else if (low.includes("m7b5") || low.includes("hdim")) {
    seventh = 10;
  } else if (tail.includes("7")) {
    seventh = 10;
  } else if (tail.includes("6")) {
    seventh = 9;
  }
  if (seventh === null) {
    const hasNine = low.includes("9") && !low.includes("add") && !susLike;
    if (low.includes("13") || low.includes("11") || hasNine) {
      seventh = hasMaj7 ? 11 : 10;
    }
  }
  let ext: number | null = null;
  if (low.includes("b9")) ext = 1;
  else if (low.includes("#9")) ext = 3;
  else if (low.includes("#11")) ext = 6;
  else if (low.includes("b13")) ext = 8;
  else if (tail.includes("13")) ext = 9;
  else if (tail.includes("11") && !susLike) ext = 5;
  else if (tail.includes("9") || low.includes("add2") || tail === "2") ext = 2;
  const out = [0, third, fifth];
  if (seventh !== null) out.push(seventh);
  if (ext !== null && !out.includes(ext)) out.push(ext);
  let uniq = [...new Set(out)];
  if (uniq.length > 4 && uniq.includes(7)) {
    uniq = uniq.filter((x) => x !== 7);
  }
  if (uniq.length > 4 && ext !== null) {
    uniq = uniq.filter((x) => x !== ext);
  }
  if (uniq.length > 4) uniq = uniq.slice(0, 4);
  return uniq;
}

export interface ParsedChord {
  root: string;
  rootPitch: number;
  /** Semitone intervals above the root (0 always first). */
  intervals: readonly number[];
  /** Required pitch classes (C = 0), bass merged when present. */
  pitchClasses: readonly number[];
  bassPitch: number | null;
}

/** Parse an FR-013 chord symbol into required pitch classes. */
export function parseChordSymbol(symbol: string): ParsedChord | null {
  if (typeof symbol !== "string") return null;
  const trimmed = symbol.trim();
  if (!trimmed) return null;
  let main = trimmed;
  let bassPitch: number | null = null;
  const slash = trimmed.indexOf("/");
  if (slash > 0) {
    const candidate = trimmed
      .slice(slash + 1)
      .trim()
      .replace(/\s+/g, "");
    const bassMatch = BASS_RE.exec(candidate);
    if (bassMatch) {
      bassPitch = pitchOf(bassMatch[1], bassMatch[2]);
      main = trimmed.slice(0, slash);
    }
  }
  const compact = main.replace(/\s+/g, "");
  const rootMatch = ROOT_RE.exec(compact);
  if (!rootMatch) return null;
  const rootPitch = pitchOf(rootMatch[1], rootMatch[2]);
  const tail = compact.slice(rootMatch[0].length).replace(/[()]/g, "");
  const intervals = EXACT[tail] ?? fallbackIntervals(tail);
  if (!intervals) return null;
  const pcs = new Set(intervals.map((iv) => (rootPitch + iv) % 12));
  if (bassPitch !== null && !pcs.has(bassPitch)) {
    if (pcs.size < 4) {
      pcs.add(bassPitch);
    } else {
      const fifthPc = (rootPitch + 7) % 12;
      if (pcs.has(fifthPc)) {
        pcs.delete(fifthPc);
        pcs.add(bassPitch);
      }
    }
  }
  return {
    root: rootMatch[1] + (rootMatch[2] ?? ""),
    rootPitch,
    intervals,
    pitchClasses: [...pcs],
    bassPitch,
  };
}

interface SearchHit {
  frets: [number, number, number, number];
  baseFret: number;
  cost: number;
  max: number;
  opens: number;
  sum: number;
}

function scoreShape(
  frets: [number, number, number, number],
  pcs: readonly number[],
  required: ReadonlySet<number>,
  rootPitch: number,
  baseFret: number,
): number {
  const opens = frets.filter((f) => f === 0).length;
  const fretted = frets.filter((f) => f > 0);
  const max = Math.max(...frets);
  const span =
    fretted.length > 0 ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const unique = new Set(fretted).size;
  let cost = max * 2 + span * 3 + (4 - opens) + unique + baseFret * 1.5;
  cost += frets.reduce((a, b) => a + b, 0) * 0.1;
  if (required.size <= 3) {
    const counts = new Map<number, number>();
    for (const pc of pcs) counts.set(pc, (counts.get(pc) ?? 0) + 1);
    const fifthPc = (rootPitch + 7) % 12;
    if ((counts.get(rootPitch) ?? 0) >= 2) {
      cost -= 2;
    } else {
      for (const [pc, count] of counts) {
        if (count >= 2 && pc !== rootPitch && pc !== fifthPc) cost += 3;
      }
    }
  }
  if (pcs[1] === rootPitch) cost -= 2;
  else if (pcs[0] === rootPitch) cost -= 1;
  return cost;
}

/**
 * Brute-force the cheapest shape sounding exactly `required`. Open mode
 * allows open strings and frets up to `openHi` (default 4); movable mode
 * forbids opens and slides up to fret 7. The extended open fallback
 * (`openHi` 5, the renderer's 5-fret window at baseFret 1) exists for
 * fifthless 4-note voicings such as Dm9 (C F E D = 5-5-0-5) that need an
 * open string next to a 5th-fret note. The mixed fallback (`mixed`, only
 * meaningful when `movable` is false) allows opens alongside frets up to 7
 * for shapes such as Fm9 (G F Ab Eb = 0-5-4-6); baseFret then shifts to the
 * lowest fretted note so the 5-fret window still contains every dot (the
 * renderer draws opens above the diagram at any baseFret).
 */
function searchShapes(
  required: ReadonlySet<number>,
  rootPitch: number,
  movable: boolean,
  openHi = 4,
  mixed = false,
): SearchHit | null {
  const lo = movable ? 1 : 0;
  const hi = movable ? 7 : mixed ? 7 : openHi;
  let best: SearchHit | null = null;
  const better = (next: SearchHit): boolean => {
    if (!best) return true;
    if (next.cost !== best.cost) return next.cost < best.cost;
    if (next.max !== best.max) return next.max < best.max;
    if (next.opens !== best.opens) return next.opens > best.opens;
    if (next.sum !== best.sum) return next.sum < best.sum;
    for (let i = 0; i < 4; i += 1) {
      if (next.frets[i] !== best.frets[i]) return next.frets[i] < best.frets[i];
    }
    return false;
  };
  for (let f0 = lo; f0 <= hi; f0 += 1) {
    for (let f1 = lo; f1 <= hi; f1 += 1) {
      for (let f2 = lo; f2 <= hi; f2 += 1) {
        for (let f3 = lo; f3 <= hi; f3 += 1) {
          const frets: [number, number, number, number] = [f0, f1, f2, f3];
          const fretted = frets.filter((f) => f > 0);
          if (
            fretted.length > 0 &&
            Math.max(...fretted) - Math.min(...fretted) > 3
          ) {
            continue;
          }
          const pcs = frets.map((f, i) => (UKULELE_OPEN_PC[i] + f) % 12);
          let ok = true;
          for (const pc of pcs) {
            if (!required.has(pc)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          for (const need of required) {
            if (!pcs.includes(need)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          // Mixed mode: when the shape reaches past fret 5, anchor the 5-fret
          // window at the lowest fretted note (max > 5 implies fretted is
          // non-empty, so Math.min is safe); otherwise baseFret stays 1.
          const baseFret = movable
            ? Math.min(...frets)
            : mixed && Math.max(...frets) > 5
              ? Math.min(...fretted)
              : 1;
          if (Math.max(...frets) > baseFret + 4) continue;
          const cost = scoreShape(frets, pcs, required, rootPitch, baseFret);
          const hit: SearchHit = {
            frets,
            baseFret,
            cost,
            max: Math.max(...frets),
            opens: frets.filter((f) => f === 0).length,
            sum: f0 + f1 + f2 + f3,
          };
          if (better(hit)) best = hit;
        }
      }
    }
  }
  return best;
}

function assignFingers(frets: readonly [number, number, number, number]): {
  fingers: [number, number, number, number];
  barres: Array<{ fret: number; fromString: number; toString: number }>;
} {
  const fingers: [number, number, number, number] = [0, 0, 0, 0];
  const byFret = new Map<number, number[]>();
  frets.forEach((f, i) => {
    if (f > 0) {
      const list = byFret.get(f) ?? [];
      list.push(i);
      byFret.set(f, list);
    }
  });
  const barres: Array<{ fret: number; fromString: number; toString: number }> =
    [];
  let next = 1;
  for (const fret of [...byFret.keys()].sort((a, b) => a - b)) {
    const strings = (byFret.get(fret) ?? []).sort((a, b) => a - b);
    // Split same-fret strings into contiguous runs: each run of 2+ shares one
    // finger (barre), isolated strings get their own finger.
    const runs: number[][] = [];
    for (const s of strings) {
      const last = runs[runs.length - 1];
      if (last && s === last[last.length - 1] + 1) last.push(s);
      else runs.push([s]);
    }
    for (const run of runs) {
      for (const s of run) fingers[s] = next;
      if (run.length >= 2) {
        barres.push({
          fret,
          fromString: run[0],
          toString: run[run.length - 1],
        });
      }
      next += 1;
    }
  }
  return { fingers, barres };
}

/**
 * Generate a playable GCEA diagram for any parsed chord symbol. Prefers open
 * position, then movable shapes; for dense 4-note chords falls back to a
 * no-fifth voicing, then to an extended open window reaching fret 5, then to
 * a mixed window (opens alongside frets 6-7 with a shifted baseFret).
 * Returns null when nothing playable exists.
 */
export function generateChordDiagram(symbol: string): ChordDiagram | null {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;
  const required = new Set(parsed.pitchClasses);
  const fifthPc = (parsed.rootPitch + 7) % 12;
  // No-fifth voicing for dense 4-note chords (standard for 4-string uke);
  // null when the chord has no perfect fifth to drop.
  const reduced =
    required.size === 4 && required.has(fifthPc)
      ? new Set([...required].filter((pc) => pc !== fifthPc))
      : null;
  let hit = searchShapes(required, parsed.rootPitch, false);
  if (!hit) hit = searchShapes(required, parsed.rootPitch, true);
  if (!hit && reduced) {
    hit =
      searchShapes(reduced, parsed.rootPitch, false) ??
      searchShapes(reduced, parsed.rootPitch, true);
  }
  if (!hit) {
    // Extended open-position fallback (fret 5 alongside opens): tried after
    // the original passes so every previously-resolving chord keeps its
    // exact diagram. Covers fifthless 4-note voicings such as Dm9, G13b9,
    // and Em9.
    hit = searchShapes(required, parsed.rootPitch, false, 5);
    if (!hit && reduced) {
      hit = searchShapes(reduced, parsed.rootPitch, false, 5);
    }
  }
  if (!hit) {
    // Mixed fallback (opens alongside frets 6-7, e.g. Fm9 [0,5,4,6]):
    // tried last of all; baseFret shifts to the lowest fretted note.
    hit = searchShapes(required, parsed.rootPitch, false, 4, true);
    if (!hit && reduced) {
      hit = searchShapes(reduced, parsed.rootPitch, false, 4, true);
    }
  }
  if (!hit) return null;
  const { fingers, barres } = assignFingers(hit.frets);
  return {
    strings: "GCEA",
    frets: hit.frets,
    fingers,
    baseFret: hit.baseFret,
    barres,
  };
}

/** Unique chord symbols in first-appearance order (whitespace-insensitive). */
export function collectUniqueChordSymbols(sheet: Sheet): string[] {
  const seen = new Map<string, string>();
  for (const section of sheet.body.sections) {
    for (const line of section.lines) {
      for (const chord of normalizeChordPositions(line)) {
        const key = chord.symbol.replace(/\s+/g, "");
        if (!seen.has(key)) seen.set(key, chord.symbol);
      }
    }
  }
  return [...seen.values()];
}

export interface ResolvedChord {
  symbol: string;
  diagram: ChordDiagram | null;
  source: "catalog" | "generated" | "none";
}

/**
 * Resolve every unique sheet chord to a diagram: curated catalog first, then
 * generated, else null (placeholder). Order follows first appearance.
 */
export function resolveSheetChords(
  sheet: Sheet,
  catalog: readonly CatalogChord[],
): ResolvedChord[] {
  return collectUniqueChordSymbols(sheet).map((symbol) => {
    const catalogHit = matchCatalogChord(symbol, catalog);
    if (catalogHit) {
      return {
        symbol,
        diagram: catalogHit.diagram,
        source: "catalog" as const,
      };
    }
    const generated = generateChordDiagram(symbol);
    if (generated) {
      return { symbol, diagram: generated, source: "generated" as const };
    }
    return { symbol, diagram: null, source: "none" as const };
  });
}

/** Stepper bounds for the transpose control (±12 is the identity, so ±11). */
export const TRANSPOSE_MIN = -11;
export const TRANSPOSE_MAX = 11;

/** Pitch-class spellings (C = 0): sharps for upward, flats for downward. */
const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

function spellPitch(pc: number, preferSharps: boolean): string {
  const norm = ((pc % 12) + 12) % 12;
  return (preferSharps ? SHARP_NAMES : FLAT_NAMES)[norm];
}

function transposeRoot(
  letter: string,
  accidental: string | undefined,
  semitones: number,
  preferSharps: boolean,
): string {
  return spellPitch(pitchOf(letter, accidental) + semitones, preferSharps);
}

/**
 * Transpose a chord symbol by N semitones, preserving the quality tail while
 * the root (and slash bass, when present) move. Spelling defaults to the
 * step direction (sharps up, flats down; naturals stay natural either way),
 * but callers with key context (e.g. transposeSheet) may pass an explicit
 * preferSharps override. Unparsable symbols pass through unchanged (never
 * throws) so the view always renders the original text.
 */
export function transposeChordSymbol(
  symbol: string,
  semitones: number,
  preferSharps?: boolean,
): string {
  if (!Number.isInteger(semitones) || semitones === 0) return symbol;
  if (typeof symbol !== "string") return symbol;
  const trimmed = symbol.trim();
  if (!trimmed) return symbol;
  // Only transpose symbols the parser understands; unknown tokens (e.g. the
  // degenerate "CB") stay put so the view keeps flagging the original text.
  if (!parseChordSymbol(symbol)) return symbol;
  const useSharps = preferSharps ?? semitones > 0;
  let main = trimmed;
  let bass = "";
  const slash = trimmed.indexOf("/");
  if (slash > 0) {
    const candidate = trimmed
      .slice(slash + 1)
      .trim()
      .replace(/\s+/g, "");
    const bassMatch = BASS_RE.exec(candidate);
    if (bassMatch) {
      bass =
        "/" + transposeRoot(bassMatch[1], bassMatch[2], semitones, useSharps);
      main = trimmed.slice(0, slash);
    }
  }
  const compact = main.replace(/\s+/g, "");
  const rootMatch = ROOT_RE.exec(compact);
  if (!rootMatch) return symbol;
  const tail = compact.slice(rootMatch[0].length);
  return (
    transposeRoot(rootMatch[1], rootMatch[2], semitones, useSharps) +
    tail +
    bass
  );
}

/** Transposed-tonic pitch classes that read naturally with flats (major-key map). */
const FLAT_TONIC_PCS = new Set([1, 3, 5, 8, 10]);

/** Transposed-tonic pitch classes that read naturally with sharps (major-key map). */
const SHARP_TONIC_PCS = new Set([2, 4, 7, 9, 11]);

/**
 * Pick a sheet-wide accidental spelling from the transposed tonic so
 * learner-facing chord names stay idiomatic (Am +1 -> Bbm, not A#m;
 * E-major +1 -> F/Bb/C/Dm). The tonic proxy is the most-frequent root
 * pitch (first-appearance tiebreak); C and F#/Gb fall back to the step
 * direction. Major-key map only: minor tonics sharing a pitch class
 * (e.g. Dm/Gm) ideally want flats - accepted nit, still strictly closer
 * to songbook spelling than pure direction.
 */
function chooseSheetSpelling(sheet: Sheet, semitones: number): boolean {
  const counts = new Map<number, number>();
  const order: number[] = [];
  for (const section of sheet.body.sections) {
    for (const line of section.lines) {
      for (const chord of line.chords) {
        const parsed = parseChordSymbol(chord.symbol);
        if (!parsed) continue;
        const pc = ((parsed.rootPitch % 12) + 12) % 12;
        if (!counts.has(pc)) order.push(pc);
        counts.set(pc, (counts.get(pc) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return semitones > 0;
  let tonic = order[0];
  let best = -1;
  for (const pc of order) {
    const n = counts.get(pc) ?? 0;
    if (n > best) {
      best = n;
      tonic = pc;
    }
  }
  const transposed = (((tonic + semitones) % 12) + 12) % 12;
  if (FLAT_TONIC_PCS.has(transposed)) return false;
  if (SHARP_TONIC_PCS.has(transposed)) return true;
  return semitones > 0;
}

/**
 * Transpose every chord symbol in a sheet by N semitones (pure: the input is
 * never mutated). Offsets, lyrics, and metadata pass through untouched; 0
 * returns the input reference unchanged. Accidental spelling is key-aware:
 * sharps/flats follow the transposed tonic (most-frequent root), with the
 * step direction as the tiebreak for C and F#/Gb.
 */
export function transposeSheet(sheet: Sheet, semitones: number): Sheet {
  if (!Number.isInteger(semitones) || semitones === 0) return sheet;
  const preferSharps = chooseSheetSpelling(sheet, semitones);
  return {
    ...sheet,
    body: {
      ...sheet.body,
      sections: sheet.body.sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) => ({
          ...line,
          chords: line.chords.map((chord) => ({
            ...chord,
            symbol: transposeChordSymbol(chord.symbol, semitones, preferSharps),
          })),
        })),
      })),
    },
  };
}
