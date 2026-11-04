import { TRANSPOSE_MAX, TRANSPOSE_MIN } from "@/lib/chord-diagrams";

export interface TransposeControlProps {
  value: number;
  onChange: (next: number) => void;
}

function formatValue(value: number): string {
  return value > 0 ? `Tr. +${value}` : `Tr. ${value}`;
}

function clampTranspose(next: number): number {
  return Math.min(TRANSPOSE_MAX, Math.max(TRANSPOSE_MIN, next));
}

const STEP_BUTTON_CLASS =
  "bg-secondary text-secondary-foreground inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export const HELPER_BUTTON_CLASS =
  "bg-secondary text-secondary-foreground inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Transpose stepper (004 follow-up): shifts every displayed chord by N
 * semitones (half-tones) up or down from the original key. The center label
 * doubles as a reset-to-original button whenever the value is non-zero.
 * Helper shortcuts (Reset, −3/+3 semitones) sit beside the stepper for
 * larger jumps; jumps clamp to the ±11 bounds.
 */
export function TransposeControl({ value, onChange }: TransposeControlProps) {
  return (
    <div
      data-testid="transpose-control"
      className="flex flex-wrap items-center gap-2"
    >
      <div
        role="group"
        aria-label="Transpose"
        className="bg-card inline-flex items-center gap-1 rounded-full border p-1"
      >
        <button
          type="button"
          aria-label="Transpose down half a tone"
          disabled={value <= TRANSPOSE_MIN}
          onClick={() => onChange(value - 1)}
          className={STEP_BUTTON_CLASS}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          aria-label="Reset transpose to original key"
          title={value === 0 ? undefined : "Reset to original key"}
          disabled={value === 0}
          onClick={() => onChange(0)}
          data-testid="transpose-value"
          aria-live="polite"
          className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center px-2 text-center text-sm font-medium disabled:cursor-default disabled:opacity-100"
        >
          {formatValue(value)}
        </button>
        <button
          type="button"
          aria-label="Transpose up half a tone"
          disabled={value >= TRANSPOSE_MAX}
          onClick={() => onChange(value + 1)}
          className={STEP_BUTTON_CLASS}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div
        role="group"
        aria-label="Transpose shortcuts"
        className="inline-flex items-center gap-1"
      >
        <button
          type="button"
          aria-label="Reset"
          title={value === 0 ? undefined : "Reset to original key"}
          disabled={value === 0}
          onClick={() => onChange(0)}
          data-testid="transpose-reset"
          className={HELPER_BUTTON_CLASS}
        >
          Reset
        </button>
        <button
          type="button"
          aria-label="Transpose down 3 semitones"
          title="Transpose down 3 semitones"
          disabled={value <= TRANSPOSE_MIN}
          onClick={() => onChange(clampTranspose(value - 3))}
          data-testid="transpose-minus-3"
          className={HELPER_BUTTON_CLASS}
        >
          <span aria-hidden="true">−3</span>
        </button>
        <button
          type="button"
          aria-label="Transpose up 3 semitones"
          title="Transpose up 3 semitones"
          disabled={value >= TRANSPOSE_MAX}
          onClick={() => onChange(clampTranspose(value + 3))}
          data-testid="transpose-plus-3"
          className={HELPER_BUTTON_CLASS}
        >
          <span aria-hidden="true">+3</span>
        </button>
      </div>
    </div>
  );
}

export default TransposeControl;
