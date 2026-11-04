import { useId } from "react";
import type { ChordDiagram as ChordDiagramData } from "@/lib/content/schemas";

const STRING_COUNT = 4;
const FRET_ROWS = 5;
const WIDTH = 96;
const HEIGHT = 120;
const PAD_X = 16;
const PAD_TOP = 22;
const PAD_BOTTOM = 10;
const STRING_GAP = (WIDTH - PAD_X * 2) / (STRING_COUNT - 1);
const FRET_GAP = (HEIGHT - PAD_TOP - PAD_BOTTOM) / FRET_ROWS;
const DOT_R = 6;

export interface ChordDiagramProps {
  name: string;
  diagram?: ChordDiagramData | null;
  className?: string;
}

function isValid(
  d: ChordDiagramData | null | undefined,
): d is ChordDiagramData {
  return (
    !!d &&
    d.strings === "GCEA" &&
    Array.isArray(d.frets) &&
    d.frets.length === STRING_COUNT &&
    Array.isArray(d.fingers) &&
    d.fingers.length === STRING_COUNT &&
    d.frets.every((f) => Number.isInteger(f) && f >= -1)
  );
}

/** Inline-SVG ukulele chord diagram (R3): 4 strings × 5 frets, dots + finger numbers. */
export function ChordDiagram({ name, diagram, className }: ChordDiagramProps) {
  // Hooks before any early return (rules-of-hooks): a diagram flipping
  // valid <-> null on the same instance must not change the hook count.
  const titleId = useId();
  if (!isValid(diagram)) {
    return (
      <div
        role="img"
        aria-label={`${name}: diagram unavailable`}
        data-testid="chord-diagram-placeholder"
        className={`text-muted-foreground flex h-[120px] w-[96px] items-center justify-center rounded-md border border-dashed text-xs ${className ?? ""}`}
      >
        Diagram unavailable
      </div>
    );
  }

  const baseFret = diagram.baseFret ?? 1;
  const xOf = (stringIdx: number) => PAD_X + stringIdx * STRING_GAP;
  const yOfFret = (fret: number) =>
    PAD_TOP + (fret - baseFret + 0.5) * FRET_GAP;

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      data-testid="chord-diagram"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={className}
    >
      <title id={titleId}>{`${name} fingering diagram`}</title>
      <desc>{`Frets G C E A: ${diagram.frets.join(" ")}. Base fret ${baseFret}.`}</desc>

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
          y={PAD_TOP + FRET_GAP / 2 + 4}
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
          y2={HEIGHT - PAD_BOTTOM}
          stroke="currentColor"
          strokeWidth={1}
        />
      ))}

      {/* frets */}
      {Array.from({ length: FRET_ROWS + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={PAD_X}
          y1={PAD_TOP + i * FRET_GAP}
          x2={WIDTH - PAD_X}
          y2={PAD_TOP + i * FRET_GAP}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {/* barres */}
      {diagram.barres?.map((b, i) => {
        const from = Math.min(b.fromString, b.toString);
        const to = Math.max(b.fromString, b.toString);
        return (
          <rect
            key={`b${i}`}
            data-testid="barre"
            x={xOf(from) - DOT_R}
            y={yOfFret(b.fret) - DOT_R}
            width={xOf(to) - xOf(from) + DOT_R * 2}
            height={DOT_R * 2}
            rx={DOT_R}
            fill="currentColor"
          />
        );
      })}

      {/* dots / open / muted */}
      {diagram.frets.map((fret, i) => {
        const x = xOf(i);
        if (fret === -1) {
          return (
            <text
              key={`m${i}`}
              x={x}
              y={PAD_TOP - 8}
              fontSize="10"
              textAnchor="middle"
              fill="currentColor"
              data-testid="muted"
            >
              ×
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`o${i}`}
              cx={x}
              cy={PAD_TOP - 10}
              r={3.5}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              data-testid="open"
            />
          );
        }
        const finger = diagram.fingers[i];
        return (
          <g key={`d${i}`} data-testid="dot">
            <circle cx={x} cy={yOfFret(fret)} r={DOT_R} fill="currentColor" />
            {finger > 0 && (
              <text
                x={x}
                y={yOfFret(fret) + 3.5}
                fontSize="9"
                textAnchor="middle"
                fill="var(--color-background)"
                fontWeight={600}
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default ChordDiagram;
