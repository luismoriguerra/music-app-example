import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Structural subset shared by the chords/circles/scales FILTER_GROUPS. */
export interface FilterPillGroup {
  readonly label: string;
  readonly options: ReadonlyArray<{
    readonly value: string;
    readonly label: string;
  }>;
}

export interface FilterPillsProps {
  groups: readonly FilterPillGroup[];
  value: string;
  counts: ReadonlyMap<string, number>;
  onChange: (value: string) => void;
  /** a11y label wiring; also used as the radiogroup data-testid. */
  id?: string;
}

/**
 * Shared one-tap filter control (FR-012): a radiogroup of pills with live
 * counts. Props-driven and semantics-free — values flow to the owning
 * island's existing filter pipeline. Wrapping row on sm+, snap-scroll row
 * on phones; arrow-key radiogroup with roving tabindex.
 */
export function FilterPills({
  groups,
  value,
  counts,
  onChange,
  id,
}: FilterPillsProps) {
  const labelId = useId();
  const options = groups.flatMap((group) => [...group.options]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusIndex(selectedIndex);
  }, [selectedIndex]);

  const move = (next: number): void => {
    const clamped = (next + options.length) % options.length;
    const option = options[clamped];
    if (!option) return;
    setFocusIndex(clamped);
    onChange(option.value);
    pillRefs.current[clamped]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(options.length - 1);
        break;
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        Filter
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        data-testid={id}
        className="rock-reserve-pills flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                pillRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => {
                setFocusIndex(index);
                onChange(option.value);
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "inline-flex min-h-11 shrink-0 snap-start items-center justify-center rounded-full px-4 text-sm font-medium transition-colors",
                selected
                  ? "bg-rock text-rock-foreground"
                  : "bg-secondary text-secondary-foreground hover:opacity-90",
              )}
            >
              {option.label} ({counts.get(option.value) ?? 0})
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FilterPills;
