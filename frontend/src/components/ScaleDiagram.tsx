import { useId } from "react";
import type { ScaleDiagram as ScaleDiagramData } from "@/lib/content/schemas";
import { cn } from "@/lib/utils";

const STRING_COUNT = 4;
const MIN_FRET_ROWS = 5;
const WIDTH = 96;
const CHART_HEIGHT = 120;
const HEIGHT = 136;
const PAD_X = 16;
const PAD_TOP = 22;
const PAD_BOTTOM = 10;
const STRING_GAP = (WIDTH - PAD_X * 2) / (STRING_COUNT - 1);
const DOT_R = 6;

export interface ScaleDiagramProps {
  name: string;
  diagram?: ScaleDiagramData | null;
  notes?: readonly string[];
  className?: string;
}

function isValid(
  d: ScaleDiagramData | null | undefined,
): d is ScaleDiagramData {
  return (
    !!d &&
    d.strings === "GCEA" &&
    Array.isArray(d.positions) &&
    d.positions.length === 8 &&
    d.positions.every(
      (p) =>
        Number.isInteger(p.string) &&
        p.string >= 0 &&
        p.string < STRING_COUNT &&
        Number.isInteger(p.fret) &&
        p.fret >= 0 &&
        Number.isInteger(p.order) &&
        p.order >= 1 &&
        p.order <= 8 &&
        Number.isInteger(p.finger) &&
        p.finger >= 0 &&
        p.finger <= 4,
    )
  );
}

/**
 * Inline-SVG ukulele scale diagram (DR-002): 4-string fretboard chart with one
 * numbered dot per position in playing order (filled = fretted, outline =
 * open), extending the ChordDiagram idiom to sequences.
 */
export function ScaleDiagram({
  name,
  diagram,
  notes = [],
  className,
}: ScaleDiagramProps) {
  // Hooks before any early return (rules-of-hooks): a diagram flipping
  // valid <-> null on the same instance must not change the hook count.
  const titleId = useId();
  if (!isValid(diagram)) {
    return (
      <div
        role="img"
        aria-label={`${name}: diagram unavailable`}
        data-testid="scale-diagram-placeholder"
        className={`text-muted-foreground flex h-[136px] w-[96px] items-center justify-center rounded-md border border-dashed text-xs ${className ?? ""}`}
      >
        Diagram unavailable
      </div>
    );
  }

  const baseFret = diagram.baseFret ?? 1;
  const maxFret = Math.max(...diagram.positions.map((p) => p.fret));
  const fretRows = Math.max(MIN_FRET_ROWS, maxFret - baseFret + 1);
  const fretGap = (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) / fretRows;
  const xOf = (stringIdx: number) => PAD_X + stringIdx * STRING_GAP;
  const yOfFret = (fret: number) => PAD_TOP + (fret - baseFret + 0.5) * fretGap;
  const ordered = [...diagram.positions].sort((a, b) => a.order - b.order);

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      data-testid="scale-diagram"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={cn("h-auto w-full", className)}
    >
      <title id={titleId}>{`${name} scale diagram`}</title>
      <desc>{`Notes in playing order: ${notes.join(" ")}. ${diagram.positionLabel}.`}</desc>

      {/* nut or base-fret label */}
      {baseFret === 1 ? (
        <rect
          x={PAD_X - 1}
          y={PAD_TOP - 3}
          width={WIDTH - PAD_X * 2 + 2}
          height={3}
          fill="currentColor"
        />
      ) : (
        <text
          x={PAD_X - 10}
          y={PAD_TOP + fretGap / 2 + 4}
          fontSize="10"
          textAnchor="end"
          fill="currentColor"
        >
          {baseFret}
        </text>
      )}

      {/* strings */}
      {Array.from({ length: STRING_COUNT }, (_, i) => (
        <line
          key={`s${i}`}
          x1={xOf(i)}
          y1={PAD_TOP}
          x2={xOf(i)}
          y2={CHART_HEIGHT - PAD_BOTTOM}
          stroke="currentColor"
          strokeWidth={1}
        />
      ))}

      {/* frets */}
      {Array.from({ length: fretRows + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={PAD_X}
          y1={PAD_TOP + i * fretGap}
          x2={WIDTH - PAD_X}
          y2={PAD_TOP + i * fretGap}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {/* ordered positions: outline = open, filled = fretted */}
      {ordered.map((pos) => {
        const x = xOf(pos.string);
        const note = notes[pos.order - 1] ?? "";
        if (pos.fret === 0) {
          return (
            <g key={`p${pos.order}`} data-testid="scale-open" data-note={note}>
              <title>{`Order ${pos.order}: ${note} (open)`}</title>
              <circle
                cx={x}
                cy={PAD_TOP - 10}
                r={DOT_R}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={PAD_TOP - 10 + 3.5}
                fontSize="9"
                textAnchor="middle"
                fill="currentColor"
                fontWeight={600}
              >
                {pos.order}
              </text>
            </g>
          );
        }
        return (
          <g key={`p${pos.order}`} data-testid="scale-dot" data-note={note}>
            <title>{`Order ${pos.order}: ${note}`}</title>
            <circle
              cx={x}
              cy={yOfFret(pos.fret)}
              r={DOT_R}
              fill="currentColor"
            />
            <text
              x={x}
              y={yOfFret(pos.fret) + 3.5}
              fontSize="9"
              textAnchor="middle"
              fill="var(--color-background)"
              fontWeight={600}
            >
              {pos.order}
            </text>
          </g>
        );
      })}

      {/* position label */}
      <text
        x={WIDTH / 2}
        y={HEIGHT - 4}
        fontSize="9"
        textAnchor="middle"
        fill="currentColor"
        opacity={0.7}
      >
        {diagram.positionLabel}
      </text>
    </svg>
  );
}

export default ScaleDiagram;
