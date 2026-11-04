import { isLoopCount, LOOP_OPTIONS, type LoopCount } from "@/lib/trainer-prefs";
import type {
  SecondVoiceStepRow,
  SecondVoiceTechnique,
} from "@/lib/second-voice-exercises";
import { cn } from "@/lib/utils";

/** Live state of this card's exercise; sent only while it is the one running (013 FR-012). */
export interface SecondVoiceRun {
  mode: "play" | "loop";
  loops: number;
  /** Step index across all rounds of the run, not reduced to one round. */
  position: number;
}

const TECHNIQUE_LABEL: Record<SecondVoiceTechnique, string> = {
  parallel: "Parallel",
  intervals: "Intervals",
  independence: "Independence",
};

export interface SecondVoiceExerciseCardProps {
  id: string;
  title: string;
  description: string;
  technique: SecondVoiceTechnique;
  rows: readonly SecondVoiceStepRow[];
  loopCount: LoopCount;
  onLoopCountChange: (count: LoopCount) => void;
  audioAvailable: boolean;
  run: SecondVoiceRun | null;
  onPlay: () => void;
  onLoop: () => void;
  onStop: () => void;
  onStepPreview: (index: number) => void;
}

/**
 * One 2nd-voice exercise card (013 US2/US3): step rows, Play / Loop / Stop,
 * round count, and per-step taps. Presentational: props in, events out.
 */
export function SecondVoiceExerciseCard({
  id,
  title,
  description,
  technique,
  rows,
  loopCount,
  onLoopCountChange,
  audioAvailable,
  run,
  onPlay,
  onLoop,
  onStop,
  onStepPreview,
}: SecondVoiceExerciseCardProps) {
  const stepCount = rows.length;
  const currentStep =
    run !== null && stepCount > 0 ? run.position % stepCount : -1;
  const round =
    run !== null && stepCount > 0
      ? Math.floor(run.position / stepCount) + 1
      : 0;
  const playing = run?.mode === "play";
  const looping = run?.mode === "loop";
  return (
    <li
      data-testid={`second-voice-exercise-${id}`}
      aria-busy={run !== null}
      className="bg-card flex flex-col gap-2 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          <span
            data-testid="second-voice-technique"
            className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
          >
            {TECHNIQUE_LABEL[technique]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid={`second-voice-play-${id}`}
            onClick={playing ? onStop : onPlay}
            disabled={!audioAvailable}
            aria-label={playing ? `Stop ${title}` : `Play ${title}`}
            className="bg-primary text-primary-foreground focus-visible:ring-ring/50 rounded-full px-4 py-1.5 text-xs font-semibold outline-none hover:opacity-90 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? "Stop" : "Play"}
          </button>
          <button
            type="button"
            data-testid={`second-voice-loop-${id}`}
            onClick={looping ? onStop : onLoop}
            disabled={!audioAvailable}
            aria-label={
              looping
                ? `Stop looping ${title}`
                : `Loop ${title} ${loopCount} times`
            }
            className="border-primary text-primary focus-visible:ring-ring/50 rounded-full border px-4 py-1.5 text-xs font-semibold outline-none hover:opacity-90 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {looping ? "Stop" : `Loop ×${loopCount}`}
          </button>
          <select
            data-testid={`second-voice-loop-count-${id}`}
            aria-label={`Loop rounds for ${title}`}
            title="Loop rounds (applies to the next loop)"
            value={loopCount}
            disabled={!audioAvailable}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (isLoopCount(next)) onLoopCountChange(next);
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
      <p className="text-muted-foreground text-xs">{description}</p>
      {run !== null && (
        <p
          data-testid="second-voice-progress"
          role="status"
          className="text-muted-foreground text-xs"
        >
          {run.loops > 1 && `Round ${round} of ${run.loops} · `}
          Step {currentStep + 1} of {stepCount}
        </p>
      )}
      <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
        {rows.map((row, index) => (
          <li key={`${row.leadNote}-${row.yourNote}-${index}`}>
            <button
              type="button"
              data-testid="second-voice-step"
              aria-current={index === currentStep ? "true" : undefined}
              aria-label={`Play step ${index + 1}: lead ${row.leadNote}, your part ${row.yourNote}, ${row.interval}`}
              title={
                audioAvailable
                  ? `Hear step ${index + 1}`
                  : "Audio isn't available in this browser"
              }
              disabled={!audioAvailable}
              onClick={() => onStepPreview(index)}
              className={cn(
                "bg-secondary text-secondary-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1 text-xs outline-none hover:opacity-80 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40",
                index === currentStep && "ring-primary ring-2",
              )}
            >
              <span aria-hidden="true" className="font-medium">
                Lead {row.leadNote}
              </span>
              <span aria-hidden="true" className="font-medium">
                You {row.yourNote}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                {row.interval}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </li>
  );
}
