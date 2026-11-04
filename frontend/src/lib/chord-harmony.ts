/**
 * Pure chord-harmony tone derivation (006 improvement): computes safe harmony
 * tones, flavor/leading tones, and actionable singing guidance for any Western
 * chord symbol. Zero Astro/UI dependencies (Principle VIII).
 */

const NATURAL_NOTES = ["C", "D", "E", "F", "G", "A", "B"] as const;
const SEMITONES_FROM_C: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export type ChordQuality =
  | "major"
  | "minor"
  | "dominant7"
  | "major7"
  | "minor7"
  | "diminished"
  | "augmented"
  | "suspended"
  | "other";

export interface ChordHarmonyGuide {
  symbol: string;
  root: string;
  quality: ChordQuality;
  /** Full voicing tones: [root, 3rd, 5th, (7th)] for chord playback. */
  tones: string[];
  /** Stable blend tones (typically 3rd & 5th) that lock cleanly with lead voice. */
  safeTones: string[];
  /** Emotional color, leading, or tension note. */
  flavorTone: string;
  /** Explanation of what the flavor tone does harmonically. */
  flavorDescription: string;
  /** Concise, actionable guidance for singing 2nd voice over this chord. */
  advice: string;
}

function spellInterval(
  rootPc: number,
  rootIdx: number,
  degreeOffset: number,
  targetSemitones: number,
): string {
  const targetLetter = NATURAL_NOTES[(rootIdx + degreeOffset) % 7];
  const targetPc = (rootPc + targetSemitones) % 12;
  const natPc = SEMITONES_FROM_C[targetLetter];
  const diff = (((targetPc - natPc) % 12) + 12) % 12;

  if (diff === 0) return targetLetter;
  if (diff === 1) return `${targetLetter}#`;
  if (diff === 11) return `${targetLetter}b`;
  if (diff === 2) {
    // Double-sharp: respell via the next natural (F## -> G, E## -> F#) so
    // beginners never see ## in the harmony table.
    const next = NATURAL_NOTES[(NATURAL_NOTES.indexOf(targetLetter) + 1) % 7];
    const need = (((targetPc - SEMITONES_FROM_C[next]) % 12) + 12) % 12;
    return need === 0 ? next : `${next}#`;
  }
  if (diff === 10) {
    // Double-flat: respell via the previous natural (Fbb -> Eb, Cbb -> Bb).
    const prev = NATURAL_NOTES[(NATURAL_NOTES.indexOf(targetLetter) + 6) % 7];
    const need = (((targetPc - SEMITONES_FROM_C[prev]) % 12) + 12) % 12;
    return need === 0 ? prev : `${prev}b`;
  }
  return targetLetter;
}

/**
 * Deterministically derives safe vocal harmony tones and color notes from
 * a standard Western chord symbol.
 */
export function getChordHarmony(symbol: string): ChordHarmonyGuide {
  const trimmed = symbol.trim();
  const match = /^([A-G])(#{1,2}|b{1,2})?(.*)$/.exec(trimmed);
  if (!match) {
    return {
      symbol: trimmed,
      root: trimmed,
      quality: "other",
      tones: [trimmed],
      safeTones: [],
      flavorTone: trimmed,
      flavorDescription: "Unknown chord shape",
      advice: "Match the lead voice or hum the root note.",
    };
  }

  const [, rootLetter, rootAccRaw, tailRaw] = match;
  const rootAcc = rootAccRaw || "";
  const root = rootLetter + rootAcc;
  const tail = tailRaw || "";
  const tailLower = tail.toLowerCase();

  const accOffset =
    (rootAcc.match(/#/g) || []).length - (rootAcc.match(/b/g) || []).length;
  const rootPc = (((SEMITONES_FROM_C[rootLetter] + accOffset) % 12) + 12) % 12;
  const rootIdx = NATURAL_NOTES.indexOf(
    rootLetter as (typeof NATURAL_NOTES)[number],
  );

  const isMinor =
    tail.startsWith("m") &&
    !tail.startsWith("maj") &&
    !tail.startsWith("Maj") &&
    !tail.startsWith("M");
  const isDim =
    tailLower.includes("dim") ||
    tail.includes("°") ||
    tailLower.startsWith("o");
  const isAug = tailLower.includes("aug") || tail.includes("+");
  const isSus4 = tailLower.includes("sus4") || tailLower === "sus";
  const isSus2 = tailLower.includes("sus2");
  const has7 = tail.includes("7");
  const isMaj7 =
    !isMinor &&
    has7 &&
    (tailLower.includes("maj7") ||
      tail.includes("M7") ||
      tailLower.includes("ma7"));
  const isDom7 = has7 && !isMinor && !isMaj7 && !isDim && !isSus4 && !isSus2;

  let thirdSemitones = 4; // major 3rd
  let thirdDegree = 2;
  if (isSus4) {
    thirdSemitones = 5;
    thirdDegree = 3;
  } else if (isSus2) {
    thirdSemitones = 2;
    thirdDegree = 1;
  } else if (isMinor || isDim) {
    thirdSemitones = 3;
    thirdDegree = 2;
  }

  let fifthSemitones = 7;
  if (isDim || tailLower.includes("b5")) {
    fifthSemitones = 6;
  } else if (isAug || tailLower.includes("#5")) {
    fifthSemitones = 8;
  }

  const thirdNote = spellInterval(rootPc, rootIdx, thirdDegree, thirdSemitones);
  const fifthNote = spellInterval(rootPc, rootIdx, 4, fifthSemitones);

  let seventhNote: string | null = null;
  if (has7) {
    let seventhSemitones = 10; // minor 7th (dominant / min7)
    if (isDim && (tailLower.includes("dim7") || tail.includes("°7"))) {
      seventhSemitones = 9;
    } else if (isMaj7) {
      seventhSemitones = 11;
    }
    seventhNote = spellInterval(rootPc, rootIdx, 6, seventhSemitones);
  }
  const tones: string[] = [root, thirdNote, fifthNote];
  if (seventhNote) {
    tones.push(seventhNote);
  }

  // Assign quality, safe tones, flavor tone, and advice
  let quality: ChordQuality = "major";
  let safeTones: string[] = [thirdNote, fifthNote];
  let flavorTone = root;
  let flavorDescription = "Tonic center note";
  let advice = `Sing ${thirdNote} for a bright 3rd above, or ${fifthNote} for high lift.`;

  if (isDom7) {
    quality = "dominant7";
    safeTones = [root, fifthNote];
    flavorTone = thirdNote;
    flavorDescription = "Leading tone (3rd) — pulls up by half-step";
    advice = `Target ${thirdNote} (leading tone) to create tension; resolve up a half-step when the chord changes.`;
  } else if (isMinor && has7) {
    quality = "minor7";
    safeTones = [root, fifthNote];
    flavorTone = thirdNote;
    flavorDescription = "Minor 3rd & 7th — soulful coloring";
    advice = `Sing ${thirdNote} for melancholy warmth, or ${seventhNote ?? fifthNote} for vocal depth.`;
  } else if (isMinor) {
    quality = "minor";
    safeTones = [thirdNote, fifthNote];
    flavorTone = thirdNote;
    flavorDescription = "Minor 3rd — emotional core";
    advice = `Sing ${thirdNote} for a rich minor 3rd above, or ${fifthNote} for stability.`;
  } else if (isMaj7) {
    quality = "major7";
    safeTones = [thirdNote, fifthNote];
    flavorTone = seventhNote ?? thirdNote;
    flavorDescription = "Major 7th — lush acoustic color";
    advice = `Sing ${seventhNote} for a dreamy modern harmony, or ${thirdNote} for sweetness.`;
  } else if (isDim) {
    quality = "diminished";
    safeTones = [thirdNote, fifthNote];
    flavorTone = fifthNote;
    flavorDescription = "Diminished 5th (tritone tension)";
    advice = `Tense passing chord — sing ${thirdNote} or ${fifthNote}, then quickly step into the resolution.`;
  } else if (isAug) {
    quality = "augmented";
    safeTones = [root, thirdNote];
    flavorTone = fifthNote;
    flavorDescription = "Augmented 5th — mysterious pull";
    advice = `Sing ${fifthNote} for dramatic tension resolving up.`;
  } else if (isSus4) {
    quality = "suspended";
    safeTones = [root, fifthNote];
    flavorTone = thirdNote;
    flavorDescription = "Suspended 4th — wants to resolve down";
    advice = `Hold ${thirdNote} for floating tension, then slide down a half-step when it resolves.`;
  } else if (isSus2) {
    quality = "suspended";
    safeTones = [root, fifthNote];
    flavorTone = thirdNote;
    flavorDescription = "Suspended 2nd — open, airy color";
    advice = `Sing ${thirdNote} for an open acoustic blend.`;
  }

  return {
    symbol: trimmed,
    root,
    quality,
    tones,
    safeTones,
    flavorTone,
    flavorDescription,
    advice,
  };
}
/**
 * Extracts unique chords in their order of appearance from a progression or chord list.
 */
export function extractUniqueChords(
  chords: readonly string[] | readonly { chords: readonly string[] }[],
): ChordHarmonyGuide[] {
  const seen = new Set<string>();
  const guides: ChordHarmonyGuide[] = [];

  const add = (sym: string) => {
    const clean = sym.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    guides.push(getChordHarmony(clean));
  };

  for (const item of chords) {
    if (typeof item === "string") {
      add(item);
    } else if (item && Array.isArray(item.chords)) {
      for (const sym of item.chords) add(sym);
    }
  }

  return guides;
}
