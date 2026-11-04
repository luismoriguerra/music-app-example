import type { ReactNode } from "react";

export interface NeckFrameProps {
  children: ReactNode;
  label?: string;
  hint?: string;
}

/**
 * Pannable 12-fret neck frame (FR-017) for the Circle/Scale focus views.
 * Single implementation (React): islands cannot import `.astro`, so the
 * contract's `NeckFrame.astro` name is a documented converge deviation.
 */
export function NeckFrame({
  children,
  label = "Fretboard neck reference — swipe sideways to explore",
  hint = "Swipe sideways to explore the full neck →",
}: NeckFrameProps) {
  return (
    <div
      data-testid="neck-frame"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region: tabindex=0 enables keyboard scrolling (WCAG)
      tabIndex={0}
      role="region"
      aria-label={label}
      className="rock-reserve-frame bg-card text-card-foreground w-full max-w-full min-w-0 overflow-x-auto rounded-xl border shadow-sm"
    >
      <div className="min-w-[640px] p-4">{children}</div>
      <p
        aria-hidden="true"
        className="text-muted-foreground px-4 pb-3 text-xs md:hidden"
      >
        {hint}
      </p>
    </div>
  );
}

export default NeckFrame;
