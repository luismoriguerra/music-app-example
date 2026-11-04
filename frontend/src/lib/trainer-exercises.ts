/**
 * Pure deterministic vocalise pattern builder for the 1st-voice trainer
 * (008, FR-002). Degrees index into the resolved scale notes (1-based);
 * no pitch math lives here. Degree 8 is the octave duplicate of the
 * tonic, so each note carries an octave offset (0, or 1 for degree 8)
 * that playback adds to the base octave. Each pattern carries a
 * technique category and a difficulty level; the panel groups by
 * difficulty and badges the technique. Total: short scales truncate,
 * empty scales yield no exercises — never throws.
 */
export type TrainerCategory = "agility" | "tonality" | "flexibility";

export type TrainerDifficulty =
  "basic" | "intermediate" | "advanced" | "master";

export interface TrainerExercise {
  id: string;
  category: TrainerCategory;
  difficulty: TrainerDifficulty;
  title: string;
  notes: readonly string[];
  degrees: readonly string[];
  octaves: readonly number[];
  description: string;
}

interface Pattern {
  id: string;
  category: TrainerCategory;
  difficulty: TrainerDifficulty;
  title: string;
  degrees: readonly number[];
  description: string;
}

const PATTERNS: readonly Pattern[] = [
  {
    id: "agility-run-1",
    category: "agility",
    difficulty: "basic",
    title: "Stepwise Run",
    degrees: [1, 2, 3, 4, 5, 4, 3, 2, 1],
    description: "Climb five steps and back down — light, even, connected.",
  },
  {
    id: "agility-thirds-1",
    category: "agility",
    difficulty: "advanced",
    title: "Thirds Ladder",
    degrees: [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 6, 5, 4, 3, 2, 1],
    description: "Leap up in thirds, then walk home — agility under control.",
  },
  {
    id: "tonality-drone-1",
    category: "tonality",
    difficulty: "basic",
    title: "Sustained Drone",
    degrees: [1, 3, 5, 8],
    description: "Hold each pillar tone steady — tune the chord of the key.",
  },
  {
    id: "tonality-call-1",
    category: "tonality",
    difficulty: "intermediate",
    title: "Tonic Call & Response",
    degrees: [5, 3, 1, 1, 3, 5, 8, 5, 3, 1],
    description: "Answer every call on the tonic — land home with confidence.",
  },
  {
    id: "flexibility-arpeggio-1",
    category: "flexibility",
    difficulty: "intermediate",
    title: "Arpeggio Wave",
    degrees: [1, 3, 5, 8, 5, 3, 1],
    description: "Roll up the arpeggio and back — stretch without strain.",
  },
  {
    id: "flexibility-siren-1",
    category: "flexibility",
    difficulty: "intermediate",
    title: "Octave Siren",
    degrees: [1, 8, 1],
    description: "Leap to the octave and back — one breath, no scoop.",
  },
  {
    id: "flexibility-triad-1",
    category: "flexibility",
    difficulty: "basic",
    title: "Gentle Triad",
    degrees: [1, 3, 5, 3, 1],
    description: "Rock the triad gently — even tone on every pillar.",
  },
  {
    id: "agility-descend-1",
    category: "agility",
    difficulty: "basic",
    title: "Descending Five",
    degrees: [5, 4, 3, 2, 1, 2, 3, 4, 5],
    description: "Walk down five steps and back — soft landing on the tonic.",
  },
  {
    id: "tonality-octave-run-1",
    category: "tonality",
    difficulty: "intermediate",
    title: "Full Octave Run",
    degrees: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1],
    description: "Sing the full scale up and home — tune every degree.",
  },
  {
    id: "agility-fourths-1",
    category: "agility",
    difficulty: "advanced",
    title: "Fourths Climb",
    degrees: [1, 4, 2, 5, 3, 6, 4, 7, 5, 8, 5, 3, 2, 1],
    description: "Leap in fourths to the top — then walk home in steps.",
  },
  {
    id: "tonality-leap-1",
    category: "tonality",
    difficulty: "advanced",
    title: "Leap & Return",
    degrees: [1, 5, 8, 5, 3, 1],
    description: "Leap to the fifth and octave — land home in tune.",
  },
  {
    id: "flexibility-melisma-1",
    category: "flexibility",
    difficulty: "advanced",
    title: "Melisma Wave",
    degrees: [1, 3, 5, 7, 8, 7, 5, 3, 1],
    description: "Roll through the seventh to the top — flexible and free.",
  },
  {
    id: "tonality-scale-walk-1",
    category: "tonality",
    difficulty: "basic",
    title: "Scale Walk",
    degrees: [1, 2, 3, 2, 1],
    description:
      "Step up three notes and settle back — find the key before anything harder.",
  },
  {
    id: "flexibility-neighbor-1",
    category: "flexibility",
    difficulty: "basic",
    title: "Neighbor Tone",
    degrees: [1, 2, 1, 2, 1],
    description:
      "Rock gently between the tonic and its neighbor — loosen the jaw.",
  },
  {
    id: "agility-mirror-1",
    category: "agility",
    difficulty: "basic",
    title: "Mirror Three",
    degrees: [3, 2, 1, 2, 3],
    description:
      "Dip below the tonic and return — a small, symmetric warm-up shape.",
  },
  {
    id: "tonality-anchor-1",
    category: "tonality",
    difficulty: "basic",
    title: "Anchor Tones",
    degrees: [1, 3, 1, 5, 1],
    description:
      "Return to the tonic after each pillar tone — build a steady home base.",
  },
  {
    id: "agility-zigzag-1",
    category: "agility",
    difficulty: "intermediate",
    title: "Zigzag Climb",
    degrees: [1, 3, 2, 4, 3, 5, 4, 3, 2, 1],
    description:
      "Alternate up and back while still climbing — keeps the ear guessing.",
  },
  {
    id: "flexibility-bridge-1",
    category: "flexibility",
    difficulty: "intermediate",
    title: "Bridge Leap",
    degrees: [1, 4, 5, 8, 5, 4, 1],
    description:
      "Cross tonic to fourth to fifth to the octave — smooth over every gap.",
  },
  {
    id: "tonality-echo-1",
    category: "tonality",
    difficulty: "intermediate",
    title: "Echo Fifths",
    degrees: [1, 5, 1, 5, 3, 1],
    description:
      "Answer the fifth with the tonic twice, then settle through the third.",
  },
  {
    id: "agility-skip-1",
    category: "agility",
    difficulty: "intermediate",
    title: "Skipping Stones",
    degrees: [1, 3, 5, 4, 2, 1],
    description:
      "Skip up in thirds, then walk back down — light footwork for the voice.",
  },
  {
    id: "flexibility-cascade-1",
    category: "flexibility",
    difficulty: "advanced",
    title: "Cascade Descent",
    degrees: [8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3, 1],
    description:
      "Overlapping steps tumble down the scale — flexible, never rushed.",
  },
  {
    id: "agility-turn-1",
    category: "agility",
    difficulty: "advanced",
    title: "Turn & Return",
    degrees: [1, 2, 1, 7, 1, 2, 3, 2, 1],
    description:
      "A classic vocal turn below the tonic before climbing — control under speed.",
  },
  {
    id: "tonality-suspension-1",
    category: "tonality",
    difficulty: "advanced",
    title: "Suspended Fourth",
    degrees: [4, 3, 1, 4, 3, 1, 5, 1],
    description:
      "Lean on the fourth before resolving home, twice, then land on the fifth.",
  },
  {
    id: "flexibility-sweep-1",
    category: "flexibility",
    difficulty: "advanced",
    title: "Wide Sweep",
    degrees: [1, 4, 7, 5, 8, 5, 7, 4, 1],
    description:
      "Sweep through the seventh on the way up and down — stretch the range.",
  },
  {
    id: "agility-cascade-run-1",
    category: "agility",
    difficulty: "master",
    title: "Double Scale Run",
    degrees: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8],
    description:
      "Run the full scale up, down, and up again in one breath — total control.",
  },
  {
    id: "tonality-cadence-1",
    category: "tonality",
    difficulty: "master",
    title: "Full Cadence",
    degrees: [1, 4, 5, 1, 6, 4, 5, 1],
    description:
      "Trace tonic-subdominant-dominant-tonic twice — feel the key's gravity.",
  },
  {
    id: "flexibility-serpentine-1",
    category: "flexibility",
    difficulty: "master",
    title: "Serpentine Ascent",
    degrees: [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 5, 3, 1],
    description:
      "Weave up in thirds, then leap home in one breath — precise and free.",
  },
  {
    id: "agility-staccato-leap-1",
    category: "agility",
    difficulty: "master",
    title: "Staccato Leaps",
    degrees: [1, 5, 2, 6, 3, 7, 4, 8],
    description:
      "Jump a fifth higher on every step — crisp attacks, no sliding.",
  },
  {
    id: "tonality-pedal-1",
    category: "tonality",
    difficulty: "master",
    title: "Pedal Point Climb",
    degrees: [1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1, 8],
    description:
      "Return to the tonic between every degree — hear each note against home.",
  },
  {
    id: "flexibility-spiral-1",
    category: "flexibility",
    difficulty: "master",
    title: "Spiral Descent",
    degrees: [8, 5, 6, 3, 4, 1, 2, 7, 8, 5, 6, 3, 4, 1],
    description: "Fall in broken thirds from the top — no two steps alike.",
  },
  {
    id: "agility-triplet-run-1",
    category: "agility",
    difficulty: "master",
    title: "Triplet Runs",
    degrees: [1, 2, 3, 1, 2, 3, 4, 5, 6, 4, 5, 6, 7, 8],
    description:
      "Group the scale in threes on the way up — rhythmic precision at pace.",
  },
  {
    id: "flexibility-grand-arc-1",
    category: "flexibility",
    difficulty: "master",
    title: "Grand Arc",
    degrees: [1, 3, 5, 8, 7, 5, 3, 1, 2, 4, 6, 8, 1],
    description:
      "The widest arc yet — arpeggiate up, scale down, then close the circle.",
  },
];

export function buildTrainerExercises(
  scaleNotes: readonly string[],
  opts?: { perCategory?: number },
): TrainerExercise[] {
  const perCategory = opts?.perCategory ?? PATTERNS.length;
  if (perCategory <= 0 || scaleNotes.length === 0) return [];
  const used = new Map<TrainerCategory, number>();
  const out: TrainerExercise[] = [];
  for (const pattern of PATTERNS) {
    const count = used.get(pattern.category) ?? 0;
    if (count >= perCategory) continue;
    used.set(pattern.category, count + 1);
    const notes: string[] = [];
    const degrees: string[] = [];
    const octaves: number[] = [];
    for (const degree of pattern.degrees) {
      const note = scaleNotes[degree - 1];
      if (note === undefined) continue;
      notes.push(note);
      degrees.push(String(degree));
      octaves.push(degree === 8 ? 1 : 0);
    }
    if (notes.length === 0) continue;
    out.push({
      id: pattern.id,
      category: pattern.category,
      difficulty: pattern.difficulty,
      title: pattern.title,
      notes,
      degrees,
      octaves,
      description: pattern.description,
    });
  }
  return out;
}
