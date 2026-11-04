/**
 * Pure 2nd-voice harmony drills (013, FR-005 to FR-010). A step pairs the
 * Lead (1st voice) with Your part (2nd voice). Both are integers in the
 * key's scale: 0 = tonic, 1 = 2nd, ... 6 = 7th, 7 = tonic an octave up,
 * negatives below the tonic. Sounded pitches follow the 1st-voice rule
 * (008 FR-006): the tonic sits at the chosen octave, other degrees are
 * intervals above it, and each octave index adds 12 semitones, so no line
 * drops an octave in keys other than C. Intervals count scale steps, so the
 * semitone size (major or minor) follows the key. A scale note that cannot
 * be parsed is skipped, never thrown.
 */
import { noteToPitchClass } from "./sound";
import type { TrainerDifficulty } from "./trainer-exercises";
import type { SelectedScaleAtTranspose } from "./trainer-scale";

export type SecondVoiceTechnique = "parallel" | "intervals" | "independence";
export type ReferenceMix = "both" | "your" | "lead";
export type ScaleKey = Pick<SelectedScaleAtTranspose, "notes" | "rootPitch">;

export interface SecondVoiceStep {
  lead: number;
  your: number;
}

export interface SecondVoiceExercise {
  id: string;
  title: string;
  description: string;
  difficulty: TrainerDifficulty;
  technique: SecondVoiceTechnique;
  steps: readonly SecondVoiceStep[];
}

export interface SecondVoiceStepRow {
  leadNote: string;
  leadDegree: number;
  yourNote: string;
  yourDegree: number;
  interval: string;
}

const LEAD_ARC: readonly number[] = [0, 1, 2, 3, 4, 3, 2, 1, 0];
const SCALE_STEP_NAMES: readonly string[] = [
  "Unison",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "Octave",
];

function parallel(
  lead: readonly number[],
  interval: number,
): SecondVoiceStep[] {
  return lead.map((step) => ({ lead: step, your: step + interval }));
}

/** Eight exercises, two per difficulty group (FR-005, FR-007). */
export const SECOND_VOICE_EXERCISES: readonly SecondVoiceExercise[] = [
  {
    id: "parallel-3rd-above",
    title: "Parallel 3rds above",
    description: "Sing a 3rd above the lead, moving with it.",
    difficulty: "basic",
    technique: "parallel",
    steps: parallel(LEAD_ARC, 2),
  },
  {
    id: "parallel-3rd-below",
    title: "Parallel 3rds below",
    description: "Sing a 3rd below the lead, moving with it.",
    difficulty: "basic",
    technique: "parallel",
    steps: parallel(LEAD_ARC, -2),
  },
  {
    id: "parallel-6th-above",
    title: "Parallel 6ths above",
    description: "Sing a 6th above the lead; the two lines stay parallel.",
    difficulty: "intermediate",
    technique: "parallel",
    steps: parallel(LEAD_ARC, 5),
  },
  {
    id: "parallel-6th-below",
    title: "Parallel 6ths below",
    description: "Sing a 6th below the lead; the two lines stay parallel.",
    difficulty: "intermediate",
    technique: "parallel",
    steps: parallel(LEAD_ARC, -5),
  },
  {
    id: "interval-ladder",
    title: "Interval ladder over a held lead",
    description:
      "The lead holds the tonic while you climb a 3rd, 5th, 6th and octave, then come back down.",
    difficulty: "advanced",
    technique: "intervals",
    steps: [2, 4, 5, 7, 5, 4, 2, 0].map((your) => ({ lead: 0, your })),
  },
  {
    id: "hold-your-note",
    title: "Hold your note",
    description: "Hold the 5th while the lead moves around it.",
    difficulty: "advanced",
    technique: "independence",
    steps: LEAD_ARC.map((lead) => ({ lead, your: 4 })),
  },
  {
    id: "lead-leaps",
    title: "Lead leaps, you follow in 3rds",
    description: "The lead jumps a 5th on each beat; keep the 3rd above it.",
    difficulty: "master",
    technique: "intervals",
    steps: parallel([0, 4, 0, 4, 0, 4, 0], 2),
  },
  {
    id: "crossing-lines",
    title: "Crossing lines (contrary motion)",
    description:
      "The lines move in opposite directions and cross in the middle.",
    difficulty: "master",
    technique: "independence",
    steps: [
      { lead: 0, your: 4 },
      { lead: 1, your: 3 },
      { lead: 2, your: 2 },
      { lead: 3, your: 1 },
      { lead: 4, your: 0 },
      { lead: 3, your: 1 },
      { lead: 2, your: 2 },
      { lead: 1, your: 3 },
      { lead: 0, your: 4 },
    ],
  },
];

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/**
 * MIDI for one scale step: the tonic at `baseOctave` (C4 = 60 at base 4),
 * plus the degree's semitone distance above the tonic (mod 12), plus 12 per
 * octave index. Null when the degree's note name cannot be parsed.
 */
export function scaleStepMidi(
  step: number,
  key: ScaleKey,
  baseOctave: number,
): number | null {
  const size = key.notes.length;
  if (size === 0) return null;
  const note = key.notes[mod(step, size)];
  if (note === undefined) return null;
  const pitchClass = noteToPitchClass(note);
  if (pitchClass === null) return null;
  const octaveIndex = Math.floor(step / size);
  const aboveTonic = mod(pitchClass - key.rootPitch, 12) + 12 * octaveIndex;
  return (baseOctave + 1) * 12 + key.rootPitch + aboveTonic;
}

/**
 * Pitches sounding on one beat for the chosen reference mix (may be empty).
 * A unison step sounds one pitch, never the same note twice.
 */
export function beatMidis(
  step: SecondVoiceStep,
  key: ScaleKey,
  baseOctave: number,
  mix: ReferenceMix,
): number[] {
  const lead =
    mix === "your" ? null : scaleStepMidi(step.lead, key, baseOctave);
  const your =
    mix === "lead" ? null : scaleStepMidi(step.your, key, baseOctave);
  const beat: number[] = [];
  if (lead !== null) beat.push(lead);
  if (your !== null && your !== lead) beat.push(your);
  return beat;
}

/** One beat per step; the caller freezes the result when a run starts. */
export function exerciseBeats(
  exercise: SecondVoiceExercise,
  key: ScaleKey,
  baseOctave: number,
  mix: ReferenceMix,
): number[][] {
  return exercise.steps.map((step) => beatMidis(step, key, baseOctave, mix));
}

/** `rounds` back-to-back passes over the beats (Loop ×N as one run). */
export function repeatRounds(
  beats: readonly (readonly number[])[],
  rounds: number,
): number[][] {
  const out: number[][] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const beat of beats) out.push([...beat]);
  }
  return out;
}

/** Diatonic size and direction of Your part over the Lead, e.g. "3rd above". */
export function intervalLabel(step: SecondVoiceStep): string {
  const diff = step.your - step.lead;
  if (diff === 0) return "Unison";
  const size = Math.abs(diff);
  const name = SCALE_STEP_NAMES[size] ?? `${size + 1}th`;
  return `${name} ${diff > 0 ? "above" : "below"}`;
}

/** Display rows for an exercise: note names, degrees, and the interval. */
export function describeSteps(
  exercise: SecondVoiceExercise,
  notes: readonly string[],
): SecondVoiceStepRow[] {
  if (notes.length === 0) return [];
  return exercise.steps.map((step) => {
    const leadIndex = mod(step.lead, notes.length);
    const yourIndex = mod(step.your, notes.length);
    return {
      leadNote: notes[leadIndex] ?? "",
      leadDegree: leadIndex + 1,
      yourNote: notes[yourIndex] ?? "",
      yourDegree: yourIndex + 1,
      interval: intervalLabel(step),
    };
  });
}
