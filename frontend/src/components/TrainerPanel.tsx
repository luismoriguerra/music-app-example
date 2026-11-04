import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildTrainerExercises,
  type TrainerCategory,
  type TrainerDifficulty,
  type TrainerExercise,
} from "@/lib/trainer-exercises";
import {
  listTrainerScaleOptions,
  resolveTrainerScale,
  type SelectedScaleAtTranspose,
  type TrainerAnalysisKey,
  type TrainerScaleMode,
} from "@/lib/trainer-scale";
import {
  sequenceProgress,
  startSequence,
  trainerAudioAvailable,
} from "@/lib/trainer-sequence";
import {
  DEFAULT_BPM,
  isLoopCount,
  LOOP_OPTIONS,
  persistBpm,
  persistLoopCount,
  readPersistedBpm,
  readPersistedLoopCount,
  type LoopCount,
} from "@/lib/trainer-prefs";
import { NeckFrame } from "@/components/NeckFrame";
import { ScaleNeck } from "@/components/ScaleNeck";
import {
  TRAINER_MAX_BPM,
  TrainerTimingStrip,
} from "@/components/TrainerTimingStrip";
import { noteToPitchClass, playNote } from "@/lib/sound";
import type { Sheet } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";

export interface TrainerScaleSelection {
  tonic: string;
  mode: TrainerScaleMode;
}

export interface TrainerPanelProps {
  displaySheet: Sheet;
  transpose: number;
  /** True while the trainer tab is selected; hiding stops playback. */
  active: boolean;
  /** Open AI analysis key; SheetView passes null unless its transpose matches (008 FR-004). */
  analysisKey?: TrainerAnalysisKey | null;
  /** Initial picker selection; the panel owns the override after mount. */
  scaleOverride?: TrainerScaleSelection | null;
  /** Initial tempo in BPM (default 84); tempo state is panel-owned. */
  bpm?: number;
  /** Initial vocal reference octave (default 4); panel-owned. */
  octave?: number;
  onScaleOverrideChange?: (next: TrainerScaleSelection | null) => void;
  /** Renders the loading skeleton with reserved space. */
  isLoading?: boolean;
}

const DEFAULT_OCTAVE = 4;
const PROGRESS_TICK_MS = 50;
type RunMode = "play" | "loop";

const SOURCE_HINT: Record<SelectedScaleAtTranspose["source"], string> = {
  analysis: "AI analysis",
  heuristic: "song chords",
  picker: "your pick",
};

const DIFFICULTY_GROUPS: ReadonlyArray<{
  difficulty: TrainerDifficulty;
  heading: string;
}> = [
  { difficulty: "basic", heading: "Basic" },
  { difficulty: "intermediate", heading: "Intermediate" },
  { difficulty: "advanced", heading: "Advanced" },
  { difficulty: "master", heading: "Master" },
];

const CATEGORY_LABEL: Record<TrainerCategory, string> = {
  agility: "Agility",
  tonality: "Tonality",
  flexibility: "Flexibility",
};

function sheetHasChords(sheet: Sheet): boolean {
  return sheet.body.sections.some((section) =>
    section.lines.some((line) => line.chords.length > 0),
  );
}

function sanitizeBpm(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_BPM;
  }
  return Math.min(TRAINER_MAX_BPM, Math.max(40, value));
}

function sanitizeOctave(value: number | undefined): number {
  if (value === 3 || value === 4 || value === 5) return value;
  return DEFAULT_OCTAVE;
}

/**
 * MIDI for one exercise note, placed relative to the tonic: the tonic sits
 * at `baseOctave`, every other scale note is the interval above it, and
 * degree 8 adds the octave. Absolute placement (`noteToMidi(name, octave)`)
 * would drop any pitch class below the tonic's an octave too low — in G
 * major, C and D would sound a seventh under the G they follow. Null for
 * unparseable names (skipped, never a wrong pitch).
 */
function midiForNote(
  note: string,
  rootPitch: number,
  baseOctave: number,
  octaveOffset: number,
): number | null {
  const pc = noteToPitchClass(note);
  if (pc === null) return null;
  const tonicMidi = (baseOctave + 1) * 12 + rootPitch;
  return tonicMidi + ((pc - rootPitch + 12) % 12) + 12 * octaveOffset;
}

interface RunButtonProps {
  label: string;
  ariaLabel: string;
  stopAriaLabel: string;
  testId: string;
  running: boolean;
  audioAvailable: boolean;
  emphasis: "primary" | "outline";
  onStart: () => void;
  onStop: () => void;
}

/** Play-style toggle: the button that started the running session shows Stop. */
function RunButton({
  label,
  ariaLabel,
  stopAriaLabel,
  testId,
  running,
  audioAvailable,
  emphasis,
  onStart,
  onStop,
}: RunButtonProps) {
  if (running) {
    return (
      <button
        type="button"
        data-testid="trainer-stop"
        onClick={onStop}
        aria-label={stopAriaLabel}
        className="bg-secondary text-secondary-foreground focus-visible:ring-ring/50 rounded-full px-4 py-1.5 text-xs font-semibold outline-none hover:opacity-90 focus-visible:ring-[3px]"
      >
        Stop
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onStart}
      disabled={!audioAvailable}
      aria-label={ariaLabel}
      title={
        audioAvailable ? undefined : "Audio isn't available in this browser"
      }
      className={cn(
        "focus-visible:ring-ring/50 rounded-full px-4 py-1.5 text-xs font-semibold outline-none hover:opacity-90 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40",
        emphasis === "primary"
          ? "bg-primary text-primary-foreground"
          : "border-primary text-primary border",
      )}
    >
      {label}
    </button>
  );
}

export function TrainerPanel({
  displaySheet,
  transpose,
  active,
  analysisKey = null,
  scaleOverride: initialOverride = null,
  bpm: initialBpm,
  octave: initialOctave,
  onScaleOverrideChange,
  isLoading = false,
}: TrainerPanelProps) {
  const [override, setOverride] = useState<TrainerScaleSelection | null>(
    initialOverride,
  );
  // Tempo state is panel-owned and frozen per Play session (US3). An
  // explicit prop wins; otherwise the last-used tempo persists (T022).
  const [bpm, setBpm] = useState(() =>
    sanitizeBpm(initialBpm ?? readPersistedBpm(DEFAULT_BPM)),
  );

  useEffect(() => {
    persistBpm(bpm);
  }, [bpm]);
  const [octave, setOctave] = useState(() => sanitizeOctave(initialOctave));
  const [loopCount, setLoopCount] = useState<LoopCount>(readPersistedLoopCount);

  useEffect(() => {
    persistLoopCount(loopCount);
  }, [loopCount]);

  // 013 FR-011: the 2nd-voice trainer shares these settings, and both panels
  // stay mounted, so pick up its latest choice each time this tab is shown.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      setBpm((current) => sanitizeBpm(readPersistedBpm(current)));
      setLoopCount((current) => readPersistedLoopCount(current));
    }
    wasActive.current = active;
  }, [active]);

  const [fretboardOpen, setFretboardOpen] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [audioAvailable] = useState(() => trainerAudioAvailable());
  // `mode` (not the round count) decides which button shows Stop, so
  // changing the loop dropdown mid-run never orphans the running session.
  const [playing, setPlaying] = useState<{
    id: string;
    mode: RunMode;
    loops: number;
    notesPerLoop: number;
  } | null>(null);
  const [position, setPosition] = useState(0);
  const sessionRef = useRef<{ id: number; stop: () => void } | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sessionSeq = useRef(0);
  const options = useMemo(() => listTrainerScaleOptions(), []);
  const [activeDifficulty, setActiveDifficulty] =
    useState<TrainerDifficulty>("basic");
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

  const exercises = useMemo(
    () => (resolution.ok ? buildTrainerExercises(resolution.scale.notes) : []),
    [resolution],
  );

  const settleSession = useCallback(() => {
    sessionRef.current = null;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(null);
    setPosition(0);
  }, []);

  const haltSession = useCallback(() => {
    const session = sessionRef.current;
    settleSession();
    session?.stop();
  }, [settleSession]);

  // Tab hide and unmount stop the running session (FR-010).
  useEffect(() => {
    if (!active && sessionRef.current) haltSession();
  }, [active, haltSession]);
  useEffect(() => haltSession, [haltSession]);

  // Escape anywhere halts the running session.
  useEffect(() => {
    if (playing === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") haltSession();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [playing, haltSession]);

  function toggleFretboard(id: string): void {
    setFretboardOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function handlePlay(exercise: TrainerExercise, mode: RunMode): void {
    const loops = mode === "loop" ? loopCount : 1;
    if (!resolution.ok) return;
    haltSession();
    const rootPitch = resolution.scale.rootPitch;
    const midis = exercise.notes
      .map((note, index) =>
        midiForNote(note, rootPitch, octave, exercise.octaves[index] ?? 0),
      )
      .filter((midi): midi is number => midi !== null);
    if (midis.length === 0) return;
    // A loop is ONE frozen session of back-to-back rounds, so Stop, Escape,
    // tab hide and the no-overlap rule cover every round at once.
    const run = Array.from({ length: loops }, () => midis).flat();
    sessionSeq.current += 1;
    const sessionId = sessionSeq.current;
    const session = startSequence(run, { bpm });
    const startedAtMs = Date.now();
    const stepMs = 60000 / bpm;
    sessionRef.current = { id: sessionId, stop: session.stop };
    setPlaying({ id: exercise.id, mode, loops, notesPerLoop: midis.length });
    setPosition(0);
    intervalRef.current = window.setInterval(() => {
      setPosition(sequenceProgress(run.length, startedAtMs, stepMs));
    }, PROGRESS_TICK_MS);
    void session.finished.then(() => {
      if (sessionRef.current?.id === sessionId) settleSession();
    });
  }

  function handleNotePreview(exercise: TrainerExercise, index: number): void {
    // Single-note preview: stop any running sequence first (FR-006 never
    // overlaps), then sound just this chip at the same tonic-relative pitch
    // Play-all would use (degree 8 sounds the upper octave).
    if (!resolution.ok) return;
    haltSession();
    const note = exercise.notes[index];
    if (note === undefined) return;
    const midi = midiForNote(
      note,
      resolution.scale.rootPitch,
      octave,
      exercise.octaves[index] ?? 0,
    );
    if (midi === null) return;
    // playNote takes a name + octave; derive the octave that lands on `midi`.
    playNote(note, { octave: Math.floor(midi / 12) - 1 });
  }

  function handlePick(label: string): void {
    const option = options.find((entry) => entry.label === label);
    if (!option) return;
    const next = { tonic: option.tonic, mode: option.mode };
    setOverride(next);
    onScaleOverrideChange?.(next);
  }

  function handleRetry(): void {
    setOverride(null);
    onScaleOverrideChange?.(null);
  }

  function onDifficultyTabKeyDown(e: React.KeyboardEvent): void {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const order = DIFFICULTY_GROUPS.map((g) => g.difficulty);
    const direction = e.key === "ArrowRight" ? 1 : -1;
    const next =
      order[
        (order.indexOf(activeDifficulty) + direction + order.length) %
          order.length
      ] ?? "basic";
    setActiveDifficulty(next);
    haltSession();
    document.getElementById(`trainer-${uid}-tab-${next}`)?.focus();
  }

  if (isLoading) {
    return (
      <div
        data-testid="trainer-panel"
        data-state="loading"
        className="flex min-h-64 flex-col gap-3"
      >
        <p role="status" className="text-muted-foreground text-sm">
          Loading trainer…
        </p>
      </div>
    );
  }

  if (!resolution.ok) {
    // An override that fails to resolve is a caller error (retry clears it);
    // without an override the only failure is "no scale", i.e. the empty
    // state with its picker fallback.
    if (override) {
      return (
        <div
          data-testid="trainer-panel"
          data-state="error"
          className="flex min-h-64 flex-col gap-3"
        >
          <p className="text-sm">
            Couldn&apos;t load the trainer for that scale.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="bg-secondary text-secondary-foreground focus-visible:ring-ring/50 w-fit rounded-full px-4 py-2 text-sm font-medium outline-none hover:opacity-90 focus-visible:ring-[3px]"
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <div
        data-testid="trainer-panel"
        data-state="empty"
        className="flex min-h-64 flex-col gap-3"
      >
        <p className="text-sm">
          {sheetHasChords(displaySheet)
            ? "Couldn't read this song's chords — pick a scale to start training."
            : "This song has no chords, so pick a scale to train in."}
        </p>
        <label className="flex w-fit flex-col gap-1 text-sm">
          <span className="font-medium">Choose a scale</span>
          <select
            aria-label="Choose a scale"
            value=""
            onChange={(event) => handlePick(event.target.value)}
            className="bg-card rounded-lg border px-3 py-2"
          >
            <option value="">Choose a scale…</option>
            {options.map((option) => (
              <option key={option.label} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  const { scale } = resolution;
  return (
    <div
      data-testid="trainer-panel"
      data-state="ready"
      className="flex flex-col gap-5"
    >
      <p data-testid="trainer-scale-label" className="text-sm">
        <span className="font-semibold">
          {scale.tonic} {scale.mode}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · from {SOURCE_HINT[scale.source]}
        </span>
      </p>
      {!audioAvailable && (
        <p
          data-testid="trainer-audio-unavailable"
          className="text-muted-foreground text-xs"
        >
          Audio isn&apos;t available in this browser, so playback is off — the
          exercises still follow the transpose.
        </p>
      )}
      <TrainerTimingStrip
        bpm={bpm}
        onBpmChange={setBpm}
        octave={octave}
        onOctaveChange={setOctave}
      />
      <div
        role="tablist"
        aria-label="Exercise difficulty"
        data-testid="trainer-difficulty-tablist"
        className="bg-muted inline-flex h-9 w-fit max-w-full items-center justify-center overflow-x-auto rounded-lg p-[3px]"
      >
        {DIFFICULTY_GROUPS.map(({ difficulty, heading }) => (
          <button
            key={difficulty}
            type="button"
            role="tab"
            id={`trainer-${uid}-tab-${difficulty}`}
            aria-selected={activeDifficulty === difficulty}
            aria-controls={`trainer-${uid}-panel-${difficulty}`}
            tabIndex={activeDifficulty === difficulty ? 0 : -1}
            data-state={activeDifficulty === difficulty ? "active" : "inactive"}
            data-testid={`trainer-difficulty-tab-${difficulty}`}
            onClick={() => {
              setActiveDifficulty(difficulty);
              haltSession();
            }}
            onKeyDown={onDifficultyTabKeyDown}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
              activeDifficulty === difficulty
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {heading}
          </button>
        ))}
      </div>
      {DIFFICULTY_GROUPS.map(({ difficulty }) => (
        <div
          key={difficulty}
          role="tabpanel"
          id={`trainer-${uid}-panel-${difficulty}`}
          aria-labelledby={`trainer-${uid}-tab-${difficulty}`}
          hidden={activeDifficulty !== difficulty}
          data-testid={`trainer-group-${difficulty}`}
        >
          <ul className="flex flex-col gap-3">
            {exercises
              .filter((exercise) => exercise.difficulty === difficulty)
              .map((exercise) => {
                const current = playing?.id === exercise.id ? playing : null;
                const isPlaying = current !== null;
                const noteIndex = current
                  ? position % current.notesPerLoop
                  : -1;
                const round = current
                  ? Math.floor(position / current.notesPerLoop) + 1
                  : 0;
                return (
                  <li
                    key={exercise.id}
                    data-testid={`trainer-exercise-${exercise.id}`}
                    aria-busy={isPlaying}
                    className="bg-card flex flex-col gap-2 rounded-xl border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{exercise.title}</p>
                        <span
                          data-testid="trainer-category"
                          className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                        >
                          {CATEGORY_LABEL[exercise.category]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RunButton
                          label="Play"
                          ariaLabel={`Play ${exercise.title}`}
                          stopAriaLabel={`Stop ${exercise.title}`}
                          testId={`trainer-play-${exercise.id}`}
                          running={current?.mode === "play"}
                          audioAvailable={audioAvailable}
                          emphasis="primary"
                          onStart={() => handlePlay(exercise, "play")}
                          onStop={haltSession}
                        />
                        <RunButton
                          label={`Loop ×${loopCount}`}
                          ariaLabel={`Loop ${exercise.title} ${loopCount} times`}
                          stopAriaLabel={`Stop looping ${exercise.title}`}
                          testId={`trainer-loop-${exercise.id}`}
                          running={current?.mode === "loop"}
                          audioAvailable={audioAvailable}
                          emphasis="outline"
                          onStart={() => handlePlay(exercise, "loop")}
                          onStop={haltSession}
                        />
                        <select
                          data-testid={`trainer-loop-count-${exercise.id}`}
                          aria-label={`Loop rounds for ${exercise.title}`}
                          title="Loop rounds (applies to the next loop)"
                          value={loopCount}
                          disabled={!audioAvailable}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (isLoopCount(next)) setLoopCount(next);
                          }}
                          className="bg-card focus-visible:ring-ring/50 rounded-full border px-2 py-1.5 text-xs font-semibold outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {LOOP_OPTIONS.map((count) => (
                            <option key={count} value={count}>
                              ×{count}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {exercise.description}
                    </p>
                    {current && (
                      <p
                        data-testid="trainer-progress"
                        role="status"
                        className="text-muted-foreground text-xs"
                      >
                        {current.loops > 1 &&
                          `Round ${round} of ${current.loops} · `}
                        Note {noteIndex + 1} of {current.notesPerLoop}
                      </p>
                    )}
                    <ol className="flex flex-wrap gap-1.5" aria-label="Notes">
                      {exercise.notes.map((note, index) => {
                        const isCurrent = noteIndex === index;
                        return (
                          <li key={`${note}-${index}`}>
                            <button
                              type="button"
                              data-testid="trainer-note"
                              aria-current={isCurrent ? "true" : undefined}
                              aria-label={`Play note ${note} (degree ${exercise.degrees[index] ?? ""})`}
                              title={
                                audioAvailable
                                  ? `Play ${note}`
                                  : "Audio isn't available in this browser"
                              }
                              disabled={!audioAvailable}
                              onClick={() => handleNotePreview(exercise, index)}
                              className={cn(
                                "bg-secondary text-secondary-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-baseline gap-1 rounded-md px-2 py-1 text-xs font-medium outline-none hover:opacity-80 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40",
                                isCurrent && "ring-primary ring-2",
                              )}
                            >
                              <span aria-hidden="true">{note}</span>
                              <span
                                className="text-muted-foreground text-[10px]"
                                aria-hidden="true"
                              >
                                {exercise.degrees[index]}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <button
                      type="button"
                      data-testid={`trainer-fretboard-toggle-${exercise.id}`}
                      aria-expanded={fretboardOpen.has(exercise.id)}
                      aria-controls={`trainer-${uid}-fretboard-${exercise.id}`}
                      onClick={() => toggleFretboard(exercise.id)}
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-fit rounded-md text-xs font-medium outline-none focus-visible:ring-[3px]"
                    >
                      {fretboardOpen.has(exercise.id) ? "▾ Hide" : "▸ Show"} uke
                      fretboard
                    </button>
                    {fretboardOpen.has(exercise.id) && (
                      <div
                        id={`trainer-${uid}-fretboard-${exercise.id}`}
                        data-testid={`trainer-fretboard-${exercise.id}`}
                      >
                        <NeckFrame
                          label={`Uke fretboard for ${exercise.title} — swipe sideways to explore`}
                        >
                          <ScaleNeck
                            name={exercise.title}
                            notes={[...new Set(exercise.notes)]}
                            rootPitch={scale.rootPitch}
                          />
                        </NeckFrame>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default TrainerPanel;
