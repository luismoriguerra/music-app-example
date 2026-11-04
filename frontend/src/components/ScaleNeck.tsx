import { useId } from "react";
import {
  NECK_FRETS,
  NECK_OPEN_PITCHES,
  NECK_STRING_NAMES,
  scaleNeckTones,
} from "@/lib/scales";
import { cn } from "@/lib/utils";

const WIDTH = 760;
const HEIGHT = 208;
const PAD_TOP = 28;
const PAD_BOTTOM = 44;
const PAD_RIGHT = 16;
const LABEL_X = 16;
const OPEN_X = 46;
const NUT_X = 68;
const DOT_R = 12;
const BADGE_R = 7;
const INLAY_FRETS = [3, 5, 7, 10];

export interface ScaleNeckProps {
  name: string;
  notes?: readonly string[];
  rootPitch?: number;
  /** 1st-position sequence to badge with playing order (optional). */
  firstPositions?: ReadonlyArray<{
    string: number;
    fret: number;
    order: number;
  }>;
  className?: string;
}

function fontSizeFor(spelling: string): number {
  return spelling.length > 1 ? 8.5 : 10;
}

/**
 * Landscape 12-fret neck reference: every scale tone on frets 0..12 across
 * G/C/E/A, spelled from the scale's conventional note names (never from a
 * generic pitch map). Tonic = filled, other tones = outline; 1st-position
 * notes carry their playing-order badge to link back to the portrait chart.
 */
export function ScaleNeck({
  name,
  notes = [],
  rootPitch = -1,
  firstPositions = [],
  className,
}: ScaleNeckProps) {
  const titleId = useId();
  const tones = scaleNeckTones(notes, rootPitch, firstPositions);

  if (tones.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${name}: neck reference unavailable`}
        data-testid="scale-neck-placeholder"
        className={cn(
          "text-muted-foreground flex h-32 w-full items-center justify-center rounded-md border border-dashed text-xs",
          className,
        )}
      >
        Neck reference unavailable
      </div>
    );
  }

  const neckWidth = WIDTH - NUT_X - PAD_RIGHT;
  const fretW = neckWidth / NECK_FRETS;
  const stringGap =
    (HEIGHT - PAD_TOP - PAD_BOTTOM) / (NECK_OPEN_PITCHES.length - 1);
  const yOf = (s: number) => PAD_TOP + s * stringGap;
  const xOfFret = (fret: number) => NUT_X + (fret - 0.5) * fretW;
  const inlayY = (yOf(1) + yOf(2)) / 2;

  return (
    <div className={cn("w-full max-w-full min-w-0", className)}>
      <svg
        role="img"
        aria-labelledby={titleId}
        data-testid="scale-neck"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full max-w-full"
      >
        <title id={titleId}>{`${name} 12-fret neck reference`}</title>
        <desc>{`Scale tones across 12 frets in playing-spelling order: ${notes.join(" ")}.`}</desc>

        {/* fret numbers */}
        {Array.from({ length: NECK_FRETS }, (_, i) => (
          <text
            key={`n${i + 1}`}
            x={NUT_X + i * fretW + fretW / 2}
            y={PAD_TOP - 12}
            fontSize="10"
            textAnchor="middle"
            fill="currentColor"
            opacity={0.6}
          >
            {i + 1}
          </text>
        ))}
        <text
          x={OPEN_X}
          y={PAD_TOP - 12}
          fontSize="10"
          textAnchor="middle"
          fill="currentColor"
          opacity={0.6}
        >
          0
        </text>

        {/* string labels */}
        {NECK_STRING_NAMES.map((label, s) => (
          <text
            key={label}
            x={LABEL_X}
            y={yOf(s) + 4}
            fontSize="11"
            fontWeight={600}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.7}
          >
            {label}
          </text>
        ))}

        {/* nut */}
        <rect
          x={NUT_X - 2}
          y={PAD_TOP}
          width={4}
          height={stringGap * (NECK_OPEN_PITCHES.length - 1)}
          fill="currentColor"
        />

        {/* frets */}
        {Array.from({ length: NECK_FRETS + 1 }, (_, i) => (
          <line
            key={`f${i}`}
            x1={NUT_X + i * fretW}
            y1={PAD_TOP}
            x2={NUT_X + i * fretW}
            y2={PAD_TOP + stringGap * (NECK_OPEN_PITCHES.length - 1)}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.6}
          />
        ))}

        {/* strings */}
        {Array.from({ length: NECK_OPEN_PITCHES.length }, (_, s) => (
          <line
            key={`s${s}`}
            x1={OPEN_X}
            y1={yOf(s)}
            x2={WIDTH - PAD_RIGHT}
            y2={yOf(s)}
            stroke="currentColor"
            strokeWidth={1}
          />
        ))}

        {/* inlay markers */}
        {INLAY_FRETS.map((fret) => (
          <circle
            key={`inlay${fret}`}
            cx={NUT_X + (fret - 0.5) * fretW}
            cy={inlayY}
            r={3}
            fill="currentColor"
            opacity={0.18}
          />
        ))}

        {/* scale tones */}
        {tones.map((tone) => {
          const x = tone.fret === 0 ? OPEN_X : xOfFret(tone.fret);
          const y = yOf(tone.string);
          const key = `t${tone.string}-${tone.fret}`;
          return (
            <g
              key={key}
              data-testid="scale-neck-tone"
              data-string={tone.string}
              data-fret={tone.fret}
              data-note={tone.spelling}
              data-tonic={tone.isTonic ? "true" : "false"}
              data-order={tone.order ?? ""}
            >
              <title>
                {`${tone.spelling} — ${NECK_STRING_NAMES[tone.string]} string fret ${tone.fret}${tone.order ? ` (order ${tone.order})` : ""}`}
              </title>
              <circle
                cx={x}
                cy={y}
                r={DOT_R}
                fill={tone.isTonic ? "currentColor" : "var(--color-background)"}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 3.5}
                fontSize={fontSizeFor(tone.spelling)}
                textAnchor="middle"
                fill={tone.isTonic ? "var(--color-background)" : "currentColor"}
                fontWeight={700}
              >
                {tone.spelling}
              </text>
              {tone.order !== undefined && (
                <g data-testid="scale-neck-order">
                  <circle
                    cx={x + DOT_R - 1}
                    cy={y - DOT_R + 1}
                    r={BADGE_R}
                    fill="var(--color-background)"
                    stroke="currentColor"
                    strokeWidth={1}
                  />
                  <text
                    x={x + DOT_R - 1}
                    y={y - DOT_R + 4.5}
                    fontSize="8"
                    textAnchor="middle"
                    fill="currentColor"
                    fontWeight={700}
                  >
                    {tone.order}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* legend */}
        <text
          x={NUT_X}
          y={HEIGHT - 8}
          fontSize="10"
          fill="currentColor"
          opacity={0.7}
        >
          {`Filled = tonic · open column = fret 0 · numbered badge = 1st-position order · frets 1–${NECK_FRETS}`}
        </text>
      </svg>
    </div>
  );
}

export default ScaleNeck;
