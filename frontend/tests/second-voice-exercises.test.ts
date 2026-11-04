import { describe, expect, it } from "vitest";
import {
  beatMidis,
  describeSteps,
  exerciseBeats,
  intervalLabel,
  repeatRounds,
  SECOND_VOICE_EXERCISES,
  scaleStepMidi,
  type ScaleKey,
  type SecondVoiceExercise,
} from "@/lib/second-voice-exercises";
import {
  listTrainerScaleOptions,
  resolveTrainerScale,
  type TrainerScaleMode,
} from "@/lib/trainer-scale";
import { makeChordSheet } from "./trainer-fixtures";

const C_MAJOR: ScaleKey = {
  notes: ["C", "D", "E", "F", "G", "A", "B"],
  rootPitch: 0,
};
const D_MAJOR: ScaleKey = {
  notes: ["D", "E", "F#", "G", "A", "B", "C#"],
  rootPitch: 2,
};
const G_MAJOR: ScaleKey = {
  notes: ["G", "A", "B", "C", "D", "E", "F#"],
  rootPitch: 7,
};
const B_MAJOR: ScaleKey = {
  notes: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
  rootPitch: 11,
};
const A_MINOR: ScaleKey = {
  notes: ["A", "B", "C", "D", "E", "F", "G"],
  rootPitch: 9,
};
const UNPARSEABLE_TONIC: ScaleKey = {
  notes: ["H", "D", "E", "F", "G", "A", "B"],
  rootPitch: 0,
};

function exercise(id: string): SecondVoiceExercise {
  const found = SECOND_VOICE_EXERCISES.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing exercise ${id}`);
  return found;
}

describe("SECOND_VOICE_EXERCISES catalog (013 FR-005, FR-007)", () => {
  it("covers all four difficulty groups with unique ids", () => {
    const ids = SECOND_VOICE_EXERCISES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      new Set(SECOND_VOICE_EXERCISES.map((entry) => entry.difficulty)),
    ).toEqual(new Set(["basic", "intermediate", "advanced", "master"]));
  });

  it("ships every drill shape the spec requires", () => {
    const ids = new Set(SECOND_VOICE_EXERCISES.map((entry) => entry.id));
    for (const required of [
      "parallel-3rd-above",
      "parallel-3rd-below",
      "parallel-6th-above",
      "parallel-6th-below",
      "interval-ladder",
      "hold-your-note",
      "crossing-lines",
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it("keeps parallel lines at one constant interval", () => {
    const sixthsBelow = describeSteps(
      exercise("parallel-6th-below"),
      C_MAJOR.notes,
    );
    expect(new Set(sixthsBelow.map((row) => row.interval))).toEqual(
      new Set(["6th below"]),
    );
  });

  it("crosses the lines in contrary motion", () => {
    const [first, second] = exercise("crossing-lines").steps;
    expect(second?.lead).toBe((first?.lead ?? 0) + 1);
    expect(second?.your).toBe((first?.your ?? 0) - 1);
  });

  it("keeps the phrase inside E3 to E5 at octave 4 in C major", () => {
    const midis = SECOND_VOICE_EXERCISES.flatMap((entry) =>
      exerciseBeats(entry, C_MAJOR, 4, "both"),
    ).flat();
    expect(Math.min(...midis)).toBe(52);
    expect(Math.max(...midis)).toBe(76);
  });
});

describe("scaleStepMidi (013 FR-010, 008 FR-006 anchoring)", () => {
  it("places the tonic at the chosen octave", () => {
    expect(scaleStepMidi(0, C_MAJOR, 4)).toBe(60);
    expect(scaleStepMidi(0, C_MAJOR, 3)).toBe(48);
    expect(scaleStepMidi(0, C_MAJOR, 5)).toBe(72);
  });

  it("builds diatonic steps above the tonic and the octave at step 7", () => {
    expect(scaleStepMidi(2, C_MAJOR, 4)).toBe(64);
    expect(scaleStepMidi(7, C_MAJOR, 4)).toBe(72);
  });

  it("builds steps below the tonic from the octave under it", () => {
    expect(scaleStepMidi(-2, C_MAJOR, 4)).toBe(57);
    expect(scaleStepMidi(-5, C_MAJOR, 4)).toBe(52);
  });

  it("keeps the minor third in a minor key", () => {
    const thirdAboveTonic =
      (scaleStepMidi(2, A_MINOR, 4) ?? 0) - (scaleStepMidi(0, A_MINOR, 4) ?? 0);
    expect(thirdAboveTonic).toBe(3);
  });

  it("anchors the tonic at the chosen octave for every root", () => {
    expect(scaleStepMidi(0, B_MAJOR, 4)).toBe(71);
    expect(scaleStepMidi(0, G_MAJOR, 4)).toBe(67);
  });

  it("shifts pitches by the transpose when the tonic does not wrap", () => {
    expect(scaleStepMidi(2, C_MAJOR, 4)).toBe(64);
    expect(scaleStepMidi(2, D_MAJOR, 4)).toBe(66);
  });

  it("returns null for a note name it cannot parse instead of throwing", () => {
    expect(scaleStepMidi(0, UNPARSEABLE_TONIC, 4)).toBeNull();
    expect(scaleStepMidi(1, UNPARSEABLE_TONIC, 4)).toBe(62);
  });
});

describe("beatMidis reference mix (013 FR-009)", () => {
  const thirdAbove = { lead: 0, your: 2 };

  it("sounds the lead then your part on the same beat for the both mix", () => {
    expect(beatMidis(thirdAbove, C_MAJOR, 4, "both")).toEqual([60, 64]);
  });

  it("sounds only the lead for the lead mix", () => {
    expect(beatMidis(thirdAbove, C_MAJOR, 4, "lead")).toEqual([60]);
  });

  it("sounds only your part for the your mix", () => {
    expect(beatMidis(thirdAbove, C_MAJOR, 4, "your")).toEqual([64]);
  });

  it("drops a voice whose note cannot be parsed and keeps the other", () => {
    expect(beatMidis(thirdAbove, UNPARSEABLE_TONIC, 4, "both")).toEqual([64]);
  });

  it("sounds a unison step as one pitch, not the same note twice", () => {
    const unison = { lead: 4, your: 4 };
    expect(beatMidis(unison, C_MAJOR, 4, "both")).toEqual([67]);
    expect(beatMidis(unison, C_MAJOR, 4, "lead")).toEqual([67]);
    expect(beatMidis(unison, C_MAJOR, 4, "your")).toEqual([67]);
  });

  it("keeps both pitches when the lines are an octave apart", () => {
    expect(beatMidis({ lead: 0, your: 7 }, C_MAJOR, 4, "both")).toEqual([
      60, 72,
    ]);
  });
});

describe("exerciseBeats and repeatRounds (013 FR-005, FR-008)", () => {
  it("builds one beat per step for the chosen mix", () => {
    const beats = exerciseBeats(
      exercise("parallel-3rd-above"),
      C_MAJOR,
      4,
      "both",
    );
    expect(beats).toHaveLength(9);
    expect(beats[0]).toEqual([60, 64]);
    expect(beats[1]).toEqual([62, 65]);
    expect(beats[4]).toEqual([67, 71]);
  });

  it("repeats the frozen beats back to back for each loop round", () => {
    expect(repeatRounds([[60], [62]], 3)).toEqual([
      [60],
      [62],
      [60],
      [62],
      [60],
      [62],
    ]);
  });

  it("copies beats so a finished run cannot change its source", () => {
    const source = [[60]];
    repeatRounds(source, 1)[0]?.push(99);
    expect(source).toEqual([[60]]);
  });
});

describe("intervalLabel (013 FR-006)", () => {
  it("names the diatonic size and direction of your part", () => {
    expect(intervalLabel({ lead: 0, your: 2 })).toBe("3rd above");
    expect(intervalLabel({ lead: 4, your: 0 })).toBe("5th below");
    expect(intervalLabel({ lead: 0, your: 5 })).toBe("6th above");
    expect(intervalLabel({ lead: 0, your: 7 })).toBe("Octave above");
  });

  it("labels equal steps as a unison", () => {
    expect(intervalLabel({ lead: 3, your: 3 })).toBe("Unison");
  });
});

describe("describeSteps (013 FR-006 display)", () => {
  it("lists note names, degrees, and the interval for each step in the key", () => {
    const rows = describeSteps(exercise("parallel-3rd-above"), C_MAJOR.notes);
    expect(rows[0]).toEqual({
      leadNote: "C",
      leadDegree: 1,
      yourNote: "E",
      yourDegree: 3,
      interval: "3rd above",
    });
    expect(rows[4]).toEqual({
      leadNote: "G",
      leadDegree: 5,
      yourNote: "B",
      yourDegree: 7,
      interval: "3rd above",
    });
  });

  it("shows an octave step as the tonic's degree labelled as an octave", () => {
    const rows = describeSteps(exercise("interval-ladder"), C_MAJOR.notes);
    expect(rows[3]).toEqual({
      leadNote: "C",
      leadDegree: 1,
      yourNote: "C",
      yourDegree: 1,
      interval: "Octave above",
    });
  });

  it("returns no rows for an empty key", () => {
    expect(describeSteps(exercise("parallel-3rd-above"), [])).toEqual([]);
  });
});

describe("every picker key (013 SC-003, FR-010)", () => {
  const sheet = makeChordSheet(["C"]);
  const REFERENCE_TONIC: Record<TrainerScaleMode, string> = {
    major: "C",
    minor: "A",
  };
  const OCTAVES = [3, 4, 5];

  function keyFor(tonic: string, mode: TrainerScaleMode): ScaleKey {
    return resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      override: { tonic, mode },
    });
  }

  /** Every sounded pitch of the exercise as semitones above the key's tonic. */
  function offsetsAboveTonic(
    entry: SecondVoiceExercise,
    key: ScaleKey,
    octave: number,
  ): number[][] {
    const tonic = scaleStepMidi(0, key, octave) ?? Number.NaN;
    return exerciseBeats(entry, key, octave, "both").map((beat) =>
      beat.map((midi) => midi - tonic),
    );
  }

  it.each(listTrainerScaleOptions())(
    "$label sounds the tonic at the chosen octave and the same intervals above it",
    ({ tonic, mode }) => {
      const key = keyFor(tonic, mode);
      const reference = keyFor(REFERENCE_TONIC[mode], mode);
      for (const octave of OCTAVES) {
        expect(scaleStepMidi(0, key, octave)).toBe(
          (octave + 1) * 12 + key.rootPitch,
        );
        for (const entry of SECOND_VOICE_EXERCISES) {
          expect(offsetsAboveTonic(entry, key, octave)).toEqual(
            offsetsAboveTonic(entry, reference, octave),
          );
        }
      }
    },
  );
});
