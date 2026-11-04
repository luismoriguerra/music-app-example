import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { SecondVoiceExerciseCard } from "@/components/SecondVoiceExerciseCard";
import { SecondVoiceHowTo } from "@/components/SecondVoiceHowTo";
import {
  TRAINER_MAX_BPM,
  TRAINER_MIN_BPM,
  TrainerTimingStrip,
} from "@/components/TrainerTimingStrip";
import {
  beatMidis,
  describeSteps,
  exerciseBeats,
  repeatRounds,
  type ReferenceMix,
  SECOND_VOICE_EXERCISES,
  type SecondVoiceExercise,
} from "@/lib/second-voice-exercises";
import type { Sheet } from "@/lib/sheets/schemas";
import { playMidiChord } from "@/lib/sound";
import type { TrainerDifficulty } from "@/lib/trainer-exercises";
import {
  DEFAULT_BPM,
  type LoopCount,
  persistBpm,
  persistLoopCount,
  readPersistedBpm,
  readPersistedLoopCount,
} from "@/lib/trainer-prefs";
import {
  listTrainerScaleOptions,
  resolveTrainerScale,
  type SelectedScaleAtTranspose,
  type TrainerAnalysisKey,
  type TrainerScaleOverride,
} from "@/lib/trainer-scale";
import {
  sequenceProgress,
  startStepSequence,
  trainerAudioAvailable,
} from "@/lib/trainer-sequence";
import { cn } from "@/lib/utils";

export interface SecondVoiceTrainerProps {
  displaySheet: Sheet;
  transpose: number;
  /** Open analysis key, already limited to the current transpose by SheetView (008 FR-004). */
  analysisKey?: TrainerAnalysisKey | null;
  /** True while the analyzer tab is selected; hiding stops playback (013 FR-008). */
  active: boolean;
}

const DEFAULT_OCTAVE = 4;
const PROGRESS_TICK_MS = 50;
const MS_PER_MINUTE = 60_000;

const DIFFICULTY_GROUPS: ReadonlyArray<{
  difficulty: TrainerDifficulty;
  heading: string;
}> = [
  { difficulty: "basic", heading: "Basic" },
  { difficulty: "intermediate", heading: "Intermediate" },
  { difficulty: "advanced", heading: "Advanced" },
  { difficulty: "master", heading: "Master" },
];
const LEVEL_HEADINGS = DIFFICULTY_GROUPS.map((group) => group.heading);

const MIX_OPTIONS: ReadonlyArray<{
  mix: ReferenceMix;
  label: string;
  hint: string;
}> = [
  {
    mix: "both",
    label: "Both voices",
    hint: "Hear the lead and your part together",
  },
  { mix: "your", label: "Your part", hint: "Hear only the line you sing" },
  {
    mix: "lead",
    label: "Lead only",
    hint: "Hear only the lead to sing against",
  },
];

/** Where the scale came from, shown beside the label (008 FR-004). */
const SOURCE_HINT: Record<SelectedScaleAtTranspose["source"], string> = {
  analysis: "AI analysis",
  heuristic: "song chords",
  picker: "your pick",
};

/** What the screen needs about the running exercise; the frozen beats live in the session. */
interface ActiveRun {
  exerciseId: string;
  mode: "play" | "loop";
  loops: number;
}

function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM;
  return Math.min(TRAINER_MAX_BPM, Math.max(TRAINER_MIN_BPM, value));
}

/**
 * 2nd-voice trainer (013 US2 to US4): scale-aware harmony drills above the
 * analysis. Owns the scale resolution, reference mix, tempo, octave, and the
 * single playback session; the cards and timing strip are presentational.
 */
export function SecondVoiceTrainer({
  displaySheet,
  transpose,
  analysisKey = null,
  active,
}: SecondVoiceTrainerProps) {
  const [override, setOverride] = useState<TrainerScaleOverride | null>(null);
  const [bpm, setBpm] = useState(() => clampBpm(readPersistedBpm(DEFAULT_BPM)));
  const [octave, setOctave] = useState(DEFAULT_OCTAVE);
  const [loopCount, setLoopCount] = useState<LoopCount>(readPersistedLoopCount);
  const [mix, setMix] = useState<ReferenceMix>("both");
  const [difficulty, setDifficulty] = useState<TrainerDifficulty>("basic");
  const [audioAvailable] = useState(() => trainerAudioAvailable());
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [position, setPosition] = useState(0);
  const scaleOptions = useMemo(() => listTrainerScaleOptions(), []);
  const sessionRef = useRef<{ id: number; stop: () => void } | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sessionSeq = useRef(0);
  const uid = useId().replace(/:/g, "");

  const resolution = useMemo(() => {
    try {
      return {
        ok: true as const,
        scale: resolveTrainerScale({
          displaySheet,
          transpose,
          analysisKey,
          override,
        }),
      };
    } catch {
      return { ok: false as const };
    }
  }, [displaySheet, transpose, analysisKey, override]);

  const settle = useCallback(() => {
    sessionRef.current = null;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRun(null);
    setPosition(0);
  }, []);

  const halt = useCallback(() => {
    const session = sessionRef.current;
    settle();
    session?.stop();
  }, [settle]);

  // Hiding the analyzer tab or leaving the page stops playback (013 FR-008).
  useEffect(() => {
    if (!active && sessionRef.current) halt();
  }, [active, halt]);
  useEffect(() => halt, [halt]);

  // Tempo and loop count are shared with the 1st-voice trainer (013 FR-011).
  // Both panels stay mounted, so pick up the other trainer's latest choice
  // each time this one is shown again; a running session is never touched.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      setBpm((current) => clampBpm(readPersistedBpm(current)));
      setLoopCount((current) => readPersistedLoopCount(current));
    }
    wasActive.current = active;
  }, [active]);

  // Escape halts a running session anywhere on the page (013 FR-008).
  useEffect(() => {
    if (run === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") halt();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [run, halt]);

  function startRun(
    exercise: SecondVoiceExercise,
    mode: "play" | "loop",
  ): void {
    if (!resolution.ok) return;
    halt();
    const rounds = mode === "loop" ? loopCount : 1;
    // Beats are frozen here: later tempo, octave, mix, or key changes never
    // alter this run (013 FR-008, FR-009).
    const beats = exerciseBeats(exercise, resolution.scale, octave, mix);
    const steps = repeatRounds(beats, rounds);
    if (steps.every((beat) => beat.length === 0)) return;
    sessionSeq.current += 1;
    const id = sessionSeq.current;
    const session = startStepSequence(steps, { bpm });
    const startedAt = Date.now();
    const stepMs = MS_PER_MINUTE / bpm;
    sessionRef.current = { id, stop: session.stop };
    setRun({ exerciseId: exercise.id, mode, loops: rounds });
    setPosition(0);
    intervalRef.current = window.setInterval(() => {
      setPosition(sequenceProgress(steps.length, startedAt, stepMs));
    }, PROGRESS_TICK_MS);
    void session.finished.then(() => {
      if (sessionRef.current?.id === id) settle();
    });
  }

  function previewStep(exercise: SecondVoiceExercise, index: number): void {
    if (!resolution.ok) return;
    halt();
    const step = exercise.steps[index];
    if (step === undefined) return;
    const midis = beatMidis(step, resolution.scale, octave, mix);
    if (midis.length === 0) return;
    playMidiChord(midis, { mode: "block" });
  }

  function pickScale(label: string): void {
    const option = scaleOptions.find((entry) => entry.label === label);
    if (!option) return;
    setOverride({ tonic: option.tonic, mode: option.mode });
  }

  function onDifficultyKeyDown(event: ReactKeyboardEvent): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const order = DIFFICULTY_GROUPS.map((group) => group.difficulty);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next =
      order[
        (order.indexOf(difficulty) + direction + order.length) % order.length
      ] ?? "basic";
    setDifficulty(next);
    halt();
    document.getElementById(`second-voice-${uid}-tab-${next}`)?.focus();
  }

  if (!resolution.ok) {
    if (override) {
      return (
        <section
          aria-label="2nd-voice trainer"
          data-testid="second-voice-trainer"
          data-state="error"
          className="flex min-h-40 flex-col gap-3"
        >
          <p className="text-sm">
            Couldn&apos;t load the trainer for that scale.
          </p>
          <button
            type="button"
            onClick={() => setOverride(null)}
            className="bg-secondary text-secondary-foreground focus-visible:ring-ring/50 w-fit rounded-full px-4 py-2 text-sm font-medium outline-none hover:opacity-90 focus-visible:ring-[3px]"
          >
            Try again
          </button>
        </section>
      );
    }
    return (
      <section
        aria-label="2nd-voice trainer"
        data-testid="second-voice-trainer"
        data-state="empty"
        className="flex min-h-40 flex-col gap-3"
      >
        <p className="text-sm">
          Couldn&apos;t read this song&apos;s chords — pick a scale to start
          training.
        </p>
        <label className="flex w-fit flex-col gap-1 text-sm">
          <span className="font-medium">Choose a scale</span>
          <select
            aria-label="Choose a scale"
            value=""
            onChange={(event) => pickScale(event.target.value)}
            className="bg-card rounded-lg border px-3 py-2"
          >
            <option value="">Choose a scale…</option>
            {scaleOptions.map((option) => (
              <option key={option.label} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    );
  }

  const { scale } = resolution;
  return (
    <section
      aria-label="2nd-voice trainer"
      data-testid="second-voice-trainer"
      data-state="ready"
      className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-3"
    >
      <p data-testid="second-voice-scale-label" className="text-sm">
        <span className="font-semibold">
          {scale.tonic} {scale.mode}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · from {SOURCE_HINT[scale.source]}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        Sing your part against the lead, one step per beat, in this song&apos;s
        key.
      </p>
      <SecondVoiceHowTo mixOptions={MIX_OPTIONS} levels={LEVEL_HEADINGS} />
      {!audioAvailable && (
        <p
          data-testid="second-voice-audio-unavailable"
          className="text-muted-foreground text-xs"
        >
          Audio isn&apos;t available in this browser, so playback is off — the
          exercises still follow the transpose.
        </p>
      )}
      <TrainerTimingStrip
        bpm={bpm}
        onBpmChange={(next) => {
          setBpm(next);
          persistBpm(next);
        }}
        octave={octave}
        onOctaveChange={setOctave}
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Reference audio
        </p>
        <div
          role="radiogroup"
          aria-label="Reference audio"
          className="bg-muted/70 inline-flex w-fit items-center rounded-md p-0.5 text-xs"
        >
          {MIX_OPTIONS.map((option) => (
            <button
              key={option.mix}
              type="button"
              role="radio"
              aria-checked={mix === option.mix}
              title={option.hint}
              onClick={() => setMix(option.mix)}
              className={cn(
                "cursor-pointer rounded px-2 py-0.5 font-medium transition-colors",
                mix === option.mix
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Exercise difficulty"
        className="bg-muted inline-flex h-9 w-fit max-w-full items-center justify-center overflow-x-auto rounded-lg p-[3px]"
      >
        {DIFFICULTY_GROUPS.map((group) => (
          <button
            key={group.difficulty}
            type="button"
            role="tab"
            id={`second-voice-${uid}-tab-${group.difficulty}`}
            aria-selected={difficulty === group.difficulty}
            aria-controls={`second-voice-${uid}-panel-${group.difficulty}`}
            tabIndex={difficulty === group.difficulty ? 0 : -1}
            data-testid={`second-voice-difficulty-tab-${group.difficulty}`}
            onClick={() => {
              setDifficulty(group.difficulty);
              halt();
            }}
            onKeyDown={onDifficultyKeyDown}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
              difficulty === group.difficulty
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {group.heading}
          </button>
        ))}
      </div>
      {DIFFICULTY_GROUPS.map((group) => (
        <div
          key={group.difficulty}
          role="tabpanel"
          id={`second-voice-${uid}-panel-${group.difficulty}`}
          aria-labelledby={`second-voice-${uid}-tab-${group.difficulty}`}
          hidden={difficulty !== group.difficulty}
          data-testid={`second-voice-group-${group.difficulty}`}
        >
          <ul className="flex flex-col gap-3">
            {SECOND_VOICE_EXERCISES.filter(
              (exercise) => exercise.difficulty === group.difficulty,
            ).map((exercise) => (
              <SecondVoiceExerciseCard
                key={exercise.id}
                id={exercise.id}
                title={exercise.title}
                description={exercise.description}
                technique={exercise.technique}
                rows={describeSteps(exercise, scale.notes)}
                loopCount={loopCount}
                onLoopCountChange={(next) => {
                  setLoopCount(next);
                  persistLoopCount(next);
                }}
                audioAvailable={audioAvailable}
                run={
                  run?.exerciseId === exercise.id
                    ? { mode: run.mode, loops: run.loops, position }
                    : null
                }
                onPlay={() => startRun(exercise, "play")}
                onLoop={() => startRun(exercise, "loop")}
                onStop={halt}
                onStepPreview={(index) => previewStep(exercise, index)}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
