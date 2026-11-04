import { describe, expect, it } from "vitest";
import { extractUniqueChords, getChordHarmony } from "../src/lib/chord-harmony";

describe("chord-harmony (006 improvement)", () => {
  it("derives safe tones and flavor for major triads", () => {
    const g = getChordHarmony("G");
    expect(g.root).toBe("G");
    expect(g.quality).toBe("major");
    expect(g.safeTones).toEqual(["B", "D"]);
    expect(g.tones).toEqual(["G", "B", "D"]);
    expect(g.flavorTone).toBe("G");
    const c = getChordHarmony("C");
    expect(c.root).toBe("C");
    expect(c.safeTones).toEqual(["E", "G"]);
  });

  it("derives safe tones and flavor for minor triads", () => {
    const em = getChordHarmony("Em");
    expect(em.root).toBe("E");
    expect(em.quality).toBe("minor");
    expect(em.safeTones).toEqual(["G", "B"]);
    expect(em.flavorTone).toBe("G");

    const bm = getChordHarmony("Bm");
    expect(bm.root).toBe("B");
    expect(bm.safeTones).toEqual(["D", "F#"]);
  });

  it("identifies leading tone 3rd and tension on dominant 7th chords", () => {
    const b7 = getChordHarmony("B7");
    expect(b7.root).toBe("B");
    expect(b7.quality).toBe("dominant7");
    expect(b7.tones).toEqual(["B", "D#", "F#", "A"]);
    expect(b7.flavorTone).toBe("D#"); // 3rd of B7 is leading tone!
    expect(b7.flavorDescription).toContain("Leading tone");
    expect(b7.advice).toContain("Target D#");

    const a7 = getChordHarmony("A7");
    expect(a7.root).toBe("A");
    expect(a7.flavorTone).toBe("C#");
  });

  it("handles minor 7th chords", () => {
    const dm7 = getChordHarmony("Dm7");
    expect(dm7.root).toBe("D");
    expect(dm7.quality).toBe("minor7");
    expect(dm7.safeTones).toEqual(["D", "A"]);
    expect(dm7.flavorTone).toBe("F");
  });

  it("handles suspended and diminished chords", () => {
    const dsus4 = getChordHarmony("Dsus4");
    expect(dsus4.root).toBe("D");
    expect(dsus4.quality).toBe("suspended");
    expect(dsus4.flavorTone).toBe("G"); // 4th

    const a7sus4 = getChordHarmony("A7sus4");
    expect(a7sus4.root).toBe("A");
    expect(a7sus4.quality).toBe("suspended");
    expect(a7sus4.tones).toEqual(["A", "D", "E", "G"]);
    expect(a7sus4.flavorTone).toBe("D"); // sus 4th, not a leading tone

    const fsharpDim = getChordHarmony("F#°");
    expect(fsharpDim.root).toBe("F#");
    expect(fsharpDim.quality).toBe("diminished");
  });

  it("collapses double accidentals to readable enharmonics", () => {
    const dSharp7 = getChordHarmony("D#7");
    expect(dSharp7.tones).toEqual(["D#", "G", "A#", "C#"]);
  });

  it("extracts unique chords in order of progression", () => {
    const progression = [
      { chords: ["G", "B7", "Em", "Dm7", "C"] },
      { chords: ["G", "D", "Em", "Bm", "Dm7", "A", "A7", "D"] },
    ];
    const unique = extractUniqueChords(progression);
    const symbols = unique.map((u) => u.symbol);
    expect(symbols).toEqual([
      "G",
      "B7",
      "Em",
      "Dm7",
      "C",
      "D",
      "Bm",
      "A",
      "A7",
    ]);
  });
});
