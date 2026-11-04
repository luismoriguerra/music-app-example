import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import {
  diagramToMidis,
  playMidiChord,
  type ChordPlaybackMode,
} from "@/lib/sound";
import type { ChordDiagram as ChordDiagramData } from "@/lib/content/schemas";
export interface ChordPopoverProps {
  /** Chord symbol as displayed (already transposed). */
  symbol: string;
  diagram: ChordDiagramData;
  /** Character offset within the lyric line (kept for tests/positioning). */
  offset?: number;
  /** Strum/block playback for the click-to-play voicing; default "strum". */
  playbackMode?: ChordPlaybackMode;
}

/**
 * Inline chord symbol that reveals its fingering diagram in place (FR-013 as
 * amended 2026-09-16): mouse hover shows it transiently; click, tap, Enter or
 * Space pin it open (survives mouse-leave); click again, Escape, or an
 * outside pointer-down closes. Hover is gated on `pointerType === "mouse"` so
 * a touch tap does not open-then-toggle. Disclosure semantics (button with
 * aria-expanded/aria-controls); rendered in place, no portal. Click also
 * sounds the diagram's exact uke voicing (FR-013 as amended 2026-09-18:
 * pin + strum together); hover stays silent and transient.
 */
export function ChordPopover({
  symbol,
  diagram,
  offset,
  playbackMode = "strum",
}: ChordPopoverProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const open = hover || pinned;

  // Flip the panel to the right edge when it would overflow the viewport.
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setAlignRight(rect.left + 120 > window.innerWidth);
  }, [open]);

  // Closing clears BOTH flags: with a mouse resting on the symbol, clearing
  // only `pinned` would leave the hover state showing it (Escape/second click
  // would appear to do nothing). The next pointer-enter re-opens as usual.
  const close = (): void => {
    setPinned(false);
    setHover(false);
  };

  // Keyed on `open`, not `pinned`: hover-shown content must be dismissible
  // with Escape without moving the pointer (WCAG 1.4.13). Outside-tap only
  // matters when pinned — hover already closes on pointer-leave.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const onEnter = (event: ReactPointerEvent): void => {
    if (event.pointerType === "mouse") setHover(true);
  };
  const onLeave = (event: ReactPointerEvent): void => {
    if (event.pointerType === "mouse") setHover(false);
  };
  const toggle = (): void => {
    // Click does both jobs: sound the exact fretted voicing, then toggle
    // the pin. playMidiChord no-ops safely without an AudioContext.
    playMidiChord(diagramToMidis(diagram), { mode: playbackMode });
    if (pinned) close();
    else setPinned(true);
  };
  return (
    <span
      ref={rootRef}
      className="relative inline-block"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <button
        type="button"
        data-offset={offset}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${symbol} chord diagram`}
        onClick={toggle}
        className="text-primary rounded-sm underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
      >
        {symbol}
      </button>
      {open && (
        <span
          id={id}
          role="group"
          aria-label={`${symbol} fingering`}
          data-testid="chord-popover"
          className={`bg-popover text-popover-foreground absolute top-full z-20 mt-1 flex w-max flex-col items-center gap-1 rounded-md border p-2 shadow-md ${alignRight ? "right-0" : "left-0"}`}
        >
          <span className="text-xs font-medium">{symbol}</span>
          <ChordDiagram name={symbol} diagram={diagram} />
        </span>
      )}
    </span>
  );
}

export default ChordPopover;
