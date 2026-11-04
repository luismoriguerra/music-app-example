import { describe, expect, it } from "vitest";
import { buildTrainerExercises } from "@/lib/trainer-exercises";

const C_MAJOR = ["C", "D", "E", "F", "G", "A", "B", "C"];

describe("buildTrainerExercises (008 FR-002)", () => {
  it("returns 32 exercises: 8 per difficulty (4 groups), 11/10/11 per technique", () => {
    const exercises = buildTrainerExercises(C_MAJOR);
    expect(exercises).toHaveLength(32);
    for (const level of [
      "basic",
      "intermediate",
      "advanced",
      "master",
    ] as const) {
      expect(exercises.filter((e) => e.difficulty === level)).toHaveLength(8);
    }
    expect(exercises.filter((e) => e.category === "agility")).toHaveLength(11);
    expect(exercises.filter((e) => e.category === "tonality")).toHaveLength(10);
    expect(exercises.filter((e) => e.category === "flexibility")).toHaveLength(
      11,
    );
    const ids = exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives notes from scale degrees with parallel degree labels", () => {
    const exercises = buildTrainerExercises(C_MAJOR);
    const run = exercises.find((e) => e.id === "agility-run-1");
    expect(run?.notes).toEqual(["C", "D", "E", "F", "G", "F", "E", "D", "C"]);
    expect(run?.degrees).toEqual(["1", "2", "3", "4", "5", "4", "3", "2", "1"]);
    expect(run?.octaves).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const drone = exercises.find((e) => e.id === "tonality-drone-1");
    expect(drone?.notes).toEqual(["C", "E", "G", "C"]);
    expect(drone?.degrees).toEqual(["1", "3", "5", "8"]);
    expect(drone?.octaves).toEqual([0, 0, 0, 1]);
    const arpeggio = exercises.find((e) => e.id === "flexibility-arpeggio-1");
    expect(arpeggio?.notes).toEqual(["C", "E", "G", "C", "G", "E", "C"]);
    expect(arpeggio?.octaves).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(
      Object.fromEntries(exercises.map((e) => [e.id, e.difficulty])),
    ).toMatchObject({
      "agility-run-1": "basic",
      "tonality-drone-1": "basic",
      "tonality-call-1": "intermediate",
      "flexibility-arpeggio-1": "intermediate",
      "flexibility-siren-1": "intermediate",
      "agility-thirds-1": "advanced",
    });
    for (const exercise of exercises) {
      expect(exercise.degrees).toHaveLength(exercise.notes.length);
      expect(exercise.octaves).toHaveLength(exercise.notes.length);
      expect(exercise.title.length).toBeGreaterThan(0);
      expect(exercise.description.length).toBeGreaterThan(0);
      expect(exercise.notes.length).toBeGreaterThanOrEqual(1);
      expect(exercise.notes.length).toBeLessThanOrEqual(32);
    }
  });
  it("includes a master difficulty group with correct degrees and octaves", () => {
    const exercises = buildTrainerExercises(C_MAJOR);
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const cadence = byId.get("tonality-cadence-1");
    expect(cadence?.difficulty).toBe("master");
    expect(cadence?.notes).toEqual(["C", "F", "G", "C", "A", "F", "G", "C"]);
    const leaps = byId.get("agility-staccato-leap-1");
    expect(leaps?.difficulty).toBe("master");
    expect(leaps?.notes).toEqual(["C", "G", "D", "A", "E", "B", "F", "C"]);
    expect(leaps?.octaves).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    const arc = byId.get("flexibility-grand-arc-1");
    expect(arc?.difficulty).toBe("master");
    expect(arc?.degrees).toEqual([
      "1",
      "3",
      "5",
      "8",
      "7",
      "5",
      "3",
      "1",
      "2",
      "4",
      "6",
      "8",
      "1",
    ]);
    expect(arc?.octaves).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  });

  it("builds the six recommended patterns with correct degrees and octaves", () => {
    const exercises = buildTrainerExercises(C_MAJOR);
    const byId = new Map(exercises.map((e) => [e.id, e]));
    expect(byId.get("flexibility-triad-1")?.notes).toEqual([
      "C",
      "E",
      "G",
      "E",
      "C",
    ]);
    expect(byId.get("flexibility-triad-1")?.difficulty).toBe("basic");
    expect(byId.get("agility-descend-1")?.notes).toEqual([
      "G",
      "F",
      "E",
      "D",
      "C",
      "D",
      "E",
      "F",
      "G",
    ]);
    expect(byId.get("agility-descend-1")?.difficulty).toBe("basic");
    expect(byId.get("tonality-octave-run-1")?.degrees).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(byId.get("tonality-octave-run-1")?.octaves[7]).toBe(1);
    expect(byId.get("agility-fourths-1")?.notes).toEqual([
      "C",
      "F",
      "D",
      "G",
      "E",
      "A",
      "F",
      "B",
      "G",
      "C",
      "G",
      "E",
      "D",
      "C",
    ]);
    expect(byId.get("agility-fourths-1")?.difficulty).toBe("advanced");
    expect(byId.get("tonality-leap-1")?.notes).toEqual([
      "C",
      "G",
      "C",
      "G",
      "E",
      "C",
    ]);
    expect(byId.get("tonality-leap-1")?.octaves).toEqual([0, 0, 1, 0, 0, 0]);
    expect(byId.get("flexibility-melisma-1")?.notes).toEqual([
      "C",
      "E",
      "G",
      "B",
      "C",
      "B",
      "G",
      "E",
      "C",
    ]);
    expect(byId.get("flexibility-melisma-1")?.difficulty).toBe("advanced");
  });

  it("marks degree 8 one octave up so the siren sounds the leap", () => {
    const exercises = buildTrainerExercises(C_MAJOR);
    const siren = exercises.find((e) => e.id === "flexibility-siren-1");
    expect(siren?.notes).toEqual(["C", "C", "C"]);
    expect(siren?.degrees).toEqual(["1", "8", "1"]);
    expect(siren?.octaves).toEqual([0, 1, 0]);
  });

  it("follows the given scale (transposed key)", () => {
    const dMajor = ["D", "E", "F#", "G", "A", "B", "C#", "D"];
    const exercises = buildTrainerExercises(dMajor);
    const run = exercises.find((e) => e.id === "agility-run-1");
    expect(run?.notes).toEqual(["D", "E", "F#", "G", "A", "G", "F#", "E", "D"]);
  });

  it("truncates degrees past a short scale without throwing", () => {
    const short = ["C", "D", "E", "F", "G"];
    const exercises = buildTrainerExercises(short);
    expect(exercises.length).toBeGreaterThan(0);
    for (const exercise of exercises) {
      expect(exercise.degrees).toHaveLength(exercise.notes.length);
      expect(exercise.octaves).toHaveLength(exercise.notes.length);
      for (const note of exercise.notes) {
        expect(short).toContain(note);
      }
    }
    const siren = exercises.find((e) => e.id === "flexibility-siren-1");
    // 1-8-1 with no 8th degree keeps the two tonics.
    expect(siren?.notes).toEqual(["C", "C"]);
    expect(siren?.degrees).toEqual(["1", "1"]);
    expect(siren?.octaves).toEqual([0, 0]);
  });

  it("returns no exercises for an empty scale", () => {
    expect(buildTrainerExercises([])).toEqual([]);
  });

  it("is deterministic and never mutates its input", () => {
    const input = [...C_MAJOR];
    const first = buildTrainerExercises(input);
    const second = buildTrainerExercises(input);
    expect(second).toEqual(first);
    expect(input).toEqual(C_MAJOR);
  });

  it("caps output with perCategory", () => {
    expect(buildTrainerExercises(C_MAJOR, { perCategory: 1 })).toHaveLength(3);
    expect(buildTrainerExercises(C_MAJOR, { perCategory: 2 })).toHaveLength(6);
    expect(buildTrainerExercises(C_MAJOR, { perCategory: 0 })).toEqual([]);
    expect(buildTrainerExercises(C_MAJOR, { perCategory: 99 })).toHaveLength(
      32,
    );
  });
});
