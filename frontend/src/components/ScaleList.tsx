import { useEffect, useId, useMemo, useState } from "react";
import { FilterPills } from "@/components/FilterPills";
import { NeckFrame } from "@/components/NeckFrame";
import { ScaleDiagram } from "@/components/ScaleDiagram";
import { ScaleNeck } from "@/components/ScaleNeck";
import {
  filterScales,
  SCALE_FILTER_ALL,
  SCALE_FILTER_GROUPS,
  sortScales,
  type Scale,
  type ScaleFilterOption,
} from "@/lib/scales";

export interface ScaleListProps {
  scales: Scale[];
  /** Force an error state (e.g. when the loader failed upstream). */
  error?: string | null;
}

/**
 * Scales explorer island (US3): one-tap FilterPills over the unchanged
 * filter pipeline (FR-012/FR-013),
 * full-width focus detail with 1st-position chart + 12-fret neck (FR-006),
 * FR-012/FR-014 empty + error states, FR-015 diagram-missing placeholder.
 */
export function ScaleList({ scales, error = null }: ScaleListProps) {
  const baseId = useId();
  const [filter, setFilter] = useState<ScaleFilterOption>(SCALE_FILTER_ALL);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(
    () => sortScales(filterScales(scales, filter)),
    [scales, filter],
  );
  const counts = useMemo(
    () =>
      new Map(
        SCALE_FILTER_GROUPS.flatMap((group) =>
          group.options.map(
            (option) =>
              [
                option.value,
                filterScales(scales, option.value).length,
              ] as const,
          ),
        ),
      ),
    [scales],
  );
  const isFiltered = filter !== SCALE_FILTER_ALL;
  const selected =
    expanded !== null
      ? (visible.find((s) => s.name === expanded) ?? null)
      : null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (error) {
    return (
      <div
        role="alert"
        data-state="error"
        className="rounded-lg border border-dashed p-8 text-center text-sm"
      >
        <p className="mb-3">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (selected) {
    const positions =
      (selected.diagram as Scale["diagram"] | null)?.positions ?? [];
    return (
      <section
        aria-labelledby={`${baseId}-detail-heading`}
        className="flex w-full max-w-full min-w-0 flex-col gap-4"
      >
        <div>
          <button
            type="button"
            data-testid="scale-back"
            onClick={() => setExpanded(null)}
            className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2"
          >
            ← Back to all scales
          </button>
        </div>
        <article
          data-testid="scale-detail"
          className="bg-card text-card-foreground min-h-[60vh] w-full max-w-full min-w-0 rounded-xl border p-6 shadow-sm"
        >
          <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 id={`${baseId}-detail-heading`} className="text-2xl font-bold">
              {selected.name}
            </h2>
            <p className="text-muted-foreground text-sm capitalize">
              {selected.type}
              {" · "}Root {selected.root}
              {selected.rootAlias ? ` (also ${selected.rootAlias})` : ""}
            </p>
          </header>

          <div className="mt-6 grid min-w-0 gap-8 md:grid-cols-[1fr_220px] md:items-start">
            <dl className="grid min-w-0 grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{selected.name}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="capitalize">{selected.type}</dd>
              <dt className="text-muted-foreground">Root</dt>
              <dd>
                {selected.root}
                {selected.rootAlias ? ` (also ${selected.rootAlias})` : ""}
              </dd>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{selected.notes.join(" ")}</dd>
              <dt className="text-muted-foreground">Degrees</dt>
              <dd>{selected.degrees.join(" ")}</dd>
              <dt className="text-muted-foreground">Pattern</dt>
              <dd>{selected.intervals}</dd>
            </dl>
            <div className="flex flex-col items-center gap-2">
              <ScaleDiagram
                name={selected.name}
                diagram={selected.diagram}
                notes={selected.notes}
                className="max-w-44"
              />
              <p className="text-muted-foreground text-xs">
                Numbered in playing order
              </p>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold">Neck reference — 12 frets</h3>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              Landscape view of every {selected.name} tone across the fretboard.
              Filled dots mark the tonic; numbered badges match the 1st-position
              sequence above.
            </p>
            <NeckFrame>
              <ScaleNeck
                name={selected.name}
                notes={selected.notes}
                rootPitch={selected.rootPitch}
                firstPositions={positions}
              />
            </NeckFrame>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="flex w-full max-w-full min-w-0 flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <h2 id={`${baseId}-heading`} className="text-xl font-semibold">
          Scales{" "}
          <span
            className="text-muted-foreground text-base font-normal"
            data-testid="visible-count"
          >
            ({visible.length})
          </span>
        </h2>
        <FilterPills
          groups={SCALE_FILTER_GROUPS}
          value={filter}
          counts={counts}
          onChange={(next) => {
            setFilter(next as ScaleFilterOption);
            setExpanded(null);
          }}
          id="scale-filter"
        />
      </div>

      {visible.length === 0 ? (
        <div
          data-state="empty"
          className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm"
        >
          {isFiltered ? (
            <>
              <p className="mb-3">No matching scales.</p>
              <button
                type="button"
                onClick={() => setFilter(SCALE_FILTER_ALL)}
                className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium"
              >
                Show all scales
              </button>
            </>
          ) : (
            <p>No scales have been added to this topic yet.</p>
          )}
        </div>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="scale-list"
        >
          {visible.map((scale) => (
            <li
              key={scale.name}
              className="bg-card text-card-foreground rounded-xl border shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpanded(scale.name)}
                className="flex min-h-11 w-full items-center gap-4 rounded-xl p-4 text-left outline-none focus-visible:ring-2"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{scale.name}</h3>
                  <p className="text-muted-foreground text-xs capitalize">
                    {scale.type}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground text-lg leading-none"
                >
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ScaleList;
