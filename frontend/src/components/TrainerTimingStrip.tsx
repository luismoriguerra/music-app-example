import { useId } from "react";
import { cn } from "@/lib/utils";

export interface TrainerTimingStripProps {
  bpm: number;
  onBpmChange: (next: number) => void;
  octave: number;
  onOctaveChange: (next: number) => void;
}

export const TRAINER_MIN_BPM = 60;
export const TRAINER_MAX_BPM = 240;

/** Each preset carries a short practice guide shown while it is selected. */
const PRESETS: ReadonlyArray<{ label: string; bpm: number; tips: string[] }> = [
  {
    label: "Slow",
    bpm: 60,
    tips: [
      "Learn the shape: sing every note fully and check pitch against the tone.",
      "Breathe low and keep the jaw loose; accuracy before speed.",
    ],
  },
  {
    label: "Steady",
    bpm: 90,
    tips: [
      "Connect notes legato on one breath, no bumps between steps.",
      "Keep vowel and volume even across the whole pattern.",
    ],
  },
  {
    label: "Brisk",
    bpm: 120,
    tips: [
      "Lighten the voice; let the notes flow instead of pushing each one.",
      "If pitches start sliding, drop back to Steady for a few loops.",
    ],
  },
  {
    label: "Fast",
    bpm: 160,
    tips: [
      "Bridge to runs: aim at the target notes and let passing notes skim.",
      'Sing on a single open vowel ("ah" or "oo") to stay agile.',
    ],
  },
  {
    label: "Melisma",
    bpm: 200,
    tips: [
      "Melisma speed: one vowel across many notes, small and precise.",
      'Keep breath support steady, never aspirate ("ha-ha") between notes.',
      "Only come here once the run is clean at Fast.",
    ],
  },
  {
    label: "Blaze",
    bpm: 240,
    tips: [
      "Show-off speed: very light voice, minimal volume.",
      "Short sets only; stop the moment notes blur or the throat tightens.",
    ],
  },
];

const OCTAVES: ReadonlyArray<number> = [3, 4, 5];

/**
 * Trainer-level tempo control (008, FR-007): one BPM slider with quick
 * presets plus the vocal reference octave. Fully controlled (props in,
 * events out); the panel owns the state and freezes it per Play session.
 */
export function TrainerTimingStrip({
  bpm,
  onBpmChange,
  octave,
  onOctaveChange,
}: TrainerTimingStripProps) {
  const octaveLabelId = `trainer-octave-${useId().replace(/:/g, "")}`;
  return (
    <div
      data-testid="trainer-timing-strip"
      className="bg-card flex flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          data-testid="trainer-tempo-readout"
          className="text-sm font-semibold"
          aria-label={`Tempo ${bpm} beats per minute`}
        >
          ♩= {bpm}
        </p>
        <div
          role="group"
          aria-label="Tempo presets"
          className="flex flex-wrap gap-1.5"
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={bpm === preset.bpm}
              title={`${preset.label} — ${preset.bpm} BPM`}
              onClick={() => onBpmChange(preset.bpm)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-full px-3 py-1.5 text-xs font-semibold outline-none focus-visible:ring-[3px]",
                bpm === preset.bpm
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:opacity-90",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {PRESETS.filter((preset) => preset.bpm === bpm).map((preset) => (
        <ul
          key={preset.label}
          data-testid="trainer-tempo-tips"
          aria-live="polite"
          aria-label={`${preset.label} practice tips`}
          className="text-muted-foreground list-disc pl-4 text-xs"
        >
          {preset.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ))}
      <label className="flex flex-col gap-1 text-xs font-medium">
        <span>Tempo</span>
        <input
          type="range"
          min={TRAINER_MIN_BPM}
          max={TRAINER_MAX_BPM}
          value={bpm}
          aria-label="Tempo"
          aria-valuetext={`${bpm} beats per minute`}
          data-testid="trainer-tempo-slider"
          onChange={(event) => onBpmChange(Number(event.target.value))}
          className="w-full accent-current"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span id={octaveLabelId} className="text-xs font-medium">
          Octave
        </span>
        <div
          role="group"
          aria-labelledby={octaveLabelId}
          className="flex gap-1.5"
        >
          {OCTAVES.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Octave ${value}`}
              aria-pressed={octave === value}
              onClick={() => onOctaveChange(value)}
              className={cn(
                "focus-visible:ring-ring/50 min-h-8 min-w-8 rounded-full px-2 text-xs font-semibold outline-none focus-visible:ring-[3px]",
                octave === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:opacity-90",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TrainerTimingStrip;
