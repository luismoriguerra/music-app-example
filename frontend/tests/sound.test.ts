import { describe, expect, it } from "vitest";
import {
  arpeggioMidis,
  diagramToMidis,
  midiToFrequency,
  noteToFrequency,
  noteToMidi,
  noteToPitchClass,
  playChord,
  playMidiChord,
  playNote,
} from "../src/lib/sound";

describe("sound (Web Audio tone generator)", () => {
  it("parses pitch classes correctly", () => {
    expect(noteToPitchClass("C")).toBe(0);
    expect(noteToPitchClass("C#")).toBe(1);
    expect(noteToPitchClass("Db")).toBe(1);
    expect(noteToPitchClass("D")).toBe(2);
    expect(noteToPitchClass("D#")).toBe(3);
    expect(noteToPitchClass("Eb")).toBe(3);
    expect(noteToPitchClass("E")).toBe(4);
    expect(noteToPitchClass("F")).toBe(5);
    expect(noteToPitchClass("F#")).toBe(6);
    expect(noteToPitchClass("G")).toBe(7);
    expect(noteToPitchClass("Ab")).toBe(8);
    expect(noteToPitchClass("A")).toBe(9);
    expect(noteToPitchClass("Bb")).toBe(10);
    expect(noteToPitchClass("B")).toBe(11);
  });

  it("handles double accidentals and case-insensitivity", () => {
    expect(noteToPitchClass("F##")).toBe(7); // F + 2 = G
    expect(noteToPitchClass("c#")).toBe(1);
    expect(noteToPitchClass("invalid")).toBeNull();
  });

  it("computes MIDI note numbers", () => {
    // C4 is standard MIDI note 60
    expect(noteToMidi("C", 4)).toBe(60);
    // A4 is standard MIDI note 69 (Concert pitch 440 Hz)
    expect(noteToMidi("A", 4)).toBe(69);
    // C5 is MIDI note 72
    expect(noteToMidi("C", 5)).toBe(72);
  });

  it("converts MIDI to exact standard frequencies", () => {
    // A4 = 440 Hz
    expect(midiToFrequency(69)).toBeCloseTo(440, 2);
    // A3 = 220 Hz
    expect(midiToFrequency(57)).toBeCloseTo(220, 2);
    // A5 = 880 Hz
    expect(midiToFrequency(81)).toBeCloseTo(880, 2);
    // C4 ≈ 261.63 Hz
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it("converts note names directly to frequencies", () => {
    expect(noteToFrequency("A", 4)).toBeCloseTo(440, 2);
    expect(noteToFrequency("C", 4)).toBeCloseTo(261.63, 1);
    expect(noteToFrequency("E", 4)).toBeCloseTo(329.63, 1);
  });

  it("returns null for unparseable note names (callers stay silent)", () => {
    expect(noteToFrequency("N.C.", 4)).toBeNull();
    expect(noteToFrequency("", 4)).toBeNull();
  });

  it("spells ascending MIDI lines, bumping octaves past the root", () => {
    expect(arpeggioMidis(["B", "D#", "F#", "A"], 4)).toEqual([71, 75, 78, 81]);
    expect(arpeggioMidis(["G", "B", "D"], 4)).toEqual([67, 71, 74]);
    expect(arpeggioMidis(["C", "N.C.", "E"], 4)).toEqual([60, 64]);
  });

  it("maps diagrams to the exact fretted voicing (absolute frets, re-entrant G)", () => {
    expect(diagramToMidis({ frets: [0, 0, 0, 3] })).toEqual([67, 60, 64, 72]);
    expect(diagramToMidis({ frets: [2, 0, 0, 0] })).toEqual([69, 60, 64, 69]);
    expect(diagramToMidis({ frets: [-1, 0, 0, 3] })).toEqual([60, 64, 72]);
  });

  it("players no-op safely in test/node environments, even for bad input", () => {
    // Without browser window.AudioContext, everything safely no-ops
    expect(() => playNote("C", { octave: 4 })).not.toThrow();
    expect(() => playNote("N.C.")).not.toThrow();
    expect(() => playChord(["G", "B", "D"], { mode: "strum" })).not.toThrow();
    expect(() => playChord(["G", "B", "D"], { mode: "block" })).not.toThrow();
    expect(() => playChord(["N.C."])).not.toThrow();
    expect(() =>
      playMidiChord([67, 60, 64, 72], { mode: "strum" }),
    ).not.toThrow();
    expect(() => playMidiChord([], { mode: "block" })).not.toThrow();
  });
});
