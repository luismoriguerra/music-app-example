import { useId, useMemo, useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { FilterPills } from "@/components/FilterPills";
import {
  FILTER_ALL,
  FILTER_GROUPS,
  filterChords,
  sortChords,
  type Chord,
  type FilterOption,
} from "@/lib/chords";
import { cn } from "@/lib/utils";

export interface ChordListProps {
  chords: Chord[];
  /** Force an error state (e.g. when the loader failed upstream). */
  error?: string | null;
}

/**
 * Chords explorer island (US3): one-tap FilterPills over the unchanged
 * filter pipeline (FR-012/FR-013), single-open inline expansion detail
 * (FR-010), FR-013/FR-016 empty + error states.
 */
export function ChordList({ chords, error = null }: ChordListProps) {
  const selectId = useId();
  const [filter, setFilter] = useState<FilterOption>(FILTER_ALL);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(
    () => sortChords(filterChords(chords, filter)),
    [chords, filter],
  );

  const counts = useMemo(
    () =>
      new Map(
        FILTER_GROUPS.flatMap((group) =>
          group.options.map(
            (option) =>
              [
                option.value,
                filterChords(chords, option.value).length,
              ] as const,
          ),
        ),
      ),
    [chords],
  );

  if (error) {
    return (
      <div
        role="alert"
        data-state="error"
        className="border-destructive/40 rounded-lg border p-6 text-center text-sm"
      >
        <p className="mb-3">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${selectId}-heading`}
      className="flex w-full max-w-full min-w-0 flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <h2 id={`${selectId}-heading`} className="text-xl font-semibold">
          Chords{" "}
          <span
            className="text-muted-foreground text-base font-normal"
            data-testid="visible-count"
          >
            ({visible.length})
          </span>
        </h2>
        <FilterPills
          groups={FILTER_GROUPS}
          value={filter}
          counts={counts}
          onChange={(next) => {
            setFilter(next);
            setExpanded(null);
          }}
          id="chord-filter"
        />
      </div>

      {visible.length === 0 ? (
        <div
          data-state="empty"
          className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm"
        >
          <p className="mb-3">No matching chords.</p>
          <button
            type="button"
            onClick={() => setFilter(FILTER_ALL)}
            className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium"
          >
            Show all chords
          </button>
        </div>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="chord-list"
        >
          {visible.map((chord) => {
            const isOpen = expanded === chord.name;
            const panelId = `${selectId}-${chord.name.replace(/[^a-z0-9]+/gi, "-")}`;
            return (
              <li
                key={chord.name}
                className="bg-card text-card-foreground rounded-xl border shadow-sm"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isOpen ? null : chord.name)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-4 rounded-xl p-4 text-left outline-none focus-visible:ring-2",
                    isOpen && "bg-accent",
                  )}
                >
                  <ChordDiagram
                    name={chord.name}
                    diagram={chord.diagram}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{chord.name}</h3>
                    <p className="text-muted-foreground text-xs capitalize">
                      {chord.type}
                    </p>
                  </div>
                </button>
                {isOpen && (
                  <dl
                    id={panelId}
                    data-testid="chord-detail"
                    className="grid grid-cols-2 gap-2 border-t p-4 text-sm"
                  >
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{chord.name}</dd>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="capitalize">{chord.type}</dd>
                    <dt className="text-muted-foreground">Root</dt>
                    <dd>
                      {chord.root}
                      {chord.rootAlias ? ` (also ${chord.rootAlias})` : ""}
                    </dd>
                    <dt className="text-muted-foreground">Frets (G C E A)</dt>
                    <dd>{chord.diagram.frets.join(" ")}</dd>
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ChordList;
