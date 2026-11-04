import { useEffect, useId, useMemo, useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { NeckFrame } from "@/components/NeckFrame";
import { FilterPills } from "@/components/FilterPills";
import { ScaleNeck } from "@/components/ScaleNeck";
import {
  CIRCLE_FILTER_ALL,
  CIRCLE_FILTER_GROUPS,
  diatonicChords,
  filterCircles,
  sortCircles,
  type CircleFilter,
} from "@/lib/circles";
import type { Chord, Progression } from "@/lib/content/schemas";
import { ENHARMONIC_PAIR, ENHARMONIC_ROOT, ROOT_PITCH } from "@/lib/notes";

export interface CircleListProps {
  circles: Progression[];
  chords: Chord[];
  /** Force an error state (e.g. when the loader failed upstream). */
  error?: string | null;
}

/** "Gb" → "Gb / F#"; "F#" → "Gb / F#"; "C" → "C". */
function keyDisplay(key: string): string {
  const pair = (ENHARMONIC_PAIR as Record<string, string | undefined>)[key];
  if (pair) return `${key} / ${pair}`;
  const root = (ENHARMONIC_ROOT as Record<string, string | undefined>)[key];
  if (root) return `${root} / ${key}`;
  return key;
}

function typeLabel(type: Progression["type"]): string {
  return type === "minor" ? "Minor" : "Major";
}

/**
 * Circles explorer island (006 US1–US2, Scales parity): one-tap
 * FilterPills over the unchanged filter pipeline (FR-012/FR-013),
 * full-width focus detail with the key's
 * scale notes, seven-row diatonic chord table, and 12-fret neck reference
 * (FR-004–FR-011), empty + error states mirroring Scales.
 * Circles + the Chords reference arrive via props; derivation is pure,
 * no fetching.
 */
export function CircleList({ circles, chords, error = null }: CircleListProps) {
  const baseId = useId();
  const [filter, setFilter] = useState<CircleFilter>(CIRCLE_FILTER_ALL);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => sortCircles(circles), [circles]);
  const visible = useMemo(
    () => filterCircles(sorted, filter),
    [sorted, filter],
  );
  const counts = useMemo(
    () =>
      new Map(
        CIRCLE_FILTER_GROUPS.flatMap((group) =>
          group.options.map(
            (option) =>
              [
                option.value,
                filterCircles(circles, option.value).length,
              ] as const,
          ),
        ),
      ),
    [circles],
  );
  const selected =
    expanded !== null
      ? (visible.find((c) => c.name === expanded) ?? null)
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

  if (selected) {
    const rows = diatonicChords(selected, chords);
    const notes = rows.map((r) => r.note);
    return (
      <section
        aria-labelledby={`${baseId}-detail-heading`}
        className="flex w-full max-w-full min-w-0 flex-col gap-4"
      >
        <div>
          <button
            type="button"
            data-testid="circle-back"
            onClick={() => setExpanded(null)}
            className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2"
          >
            ← Back to all circles
          </button>
        </div>
        <article
          data-testid="circle-detail"
          className="bg-card text-card-foreground min-h-[60vh] w-full max-w-full min-w-0 rounded-xl border p-6 shadow-sm"
        >
          <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 id={`${baseId}-detail-heading`} className="text-2xl font-bold">
              {selected.name}
            </h2>
            <p className="text-muted-foreground text-sm">
              Key of {keyDisplay(selected.key)} · {typeLabel(selected.type)}
            </p>
          </header>

          <dl className="mt-6 grid min-w-0 grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Progression</dt>
            <dd>{selected.degrees.join(" – ")}</dd>
            <dt className="text-muted-foreground">Chords</dt>
            <dd>{selected.chords.join(", ")}</dd>
            <dt className="text-muted-foreground">Scale notes</dt>
            <dd>{notes.join(" ")}</dd>
          </dl>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold">Diatonic chords</h3>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              Every chord native to {keyDisplay(selected.key)}{" "}
              {typeLabel(selected.type)}. Marked rows form this circle.
            </p>
            <table data-testid="diatonic-table" className="w-full text-sm">
              <thead className="hidden sm:table-header-group">
                <tr>
                  <th scope="col" className="py-2 pr-4 text-left font-medium">
                    Degree
                  </th>
                  <th scope="col" className="py-2 pr-4 text-left font-medium">
                    Note
                  </th>
                  <th scope="col" className="py-2 pr-4 text-left font-medium">
                    Chord
                  </th>
                  <th scope="col" className="py-2 pr-4 text-left font-medium">
                    Diagram
                  </th>
                  <th scope="col" className="py-2 text-left font-medium">
                    In circle
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.degree}
                    data-testid="diatonic-row"
                    className="border-t"
                  >
                    <td className="block py-3 pr-4 font-medium sm:table-cell">
                      {row.degree}
                    </td>
                    <td className="block py-3 pr-4 sm:table-cell">
                      {row.note}
                    </td>
                    <td className="block py-3 pr-4 sm:table-cell">
                      {row.chord
                        ? row.chord.name
                        : `${row.note} ${row.quality}`}
                    </td>
                    <td className="block py-3 pr-4 sm:table-cell">
                      {row.chord ? (
                        <ChordDiagram
                          name={row.chord.name}
                          diagram={row.chord.diagram}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Diagram unavailable.
                        </p>
                      )}
                    </td>
                    <td className="block py-3 sm:table-cell">
                      {row.inCircle ? "In this circle" : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold">Neck reference — 12 frets</h3>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              Landscape view of every {selected.name} tone across the fretboard.
              Filled dots mark the tonic.
            </p>
            <NeckFrame>
              <ScaleNeck
                name={selected.name}
                notes={notes}
                rootPitch={ROOT_PITCH[selected.key]}
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
          Circles{" "}
          <span
            className="text-muted-foreground text-base font-normal"
            data-testid="visible-count"
          >
            ({visible.length})
          </span>
        </h2>
        <FilterPills
          groups={CIRCLE_FILTER_GROUPS}
          value={filter}
          counts={counts}
          onChange={(next) => {
            setFilter(next);
            setExpanded(null);
          }}
          id="circle-filter"
        />
      </div>

      {visible.length === 0 ? (
        <div
          data-state="empty"
          className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm"
        >
          <p className="mb-3">No matching circles.</p>
          <button
            type="button"
            onClick={() => setFilter(CIRCLE_FILTER_ALL)}
            className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium"
          >
            Show all circles
          </button>
        </div>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="circle-list"
        >
          {visible.map((circle) => (
            <li
              key={circle.name}
              className="bg-card text-card-foreground rounded-xl border shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpanded(circle.name)}
                className="flex min-h-11 w-full items-center gap-4 rounded-xl p-4 text-left outline-none focus-visible:ring-2"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{circle.name}</h3>
                  <p className="text-muted-foreground text-xs">
                    Key of {keyDisplay(circle.key)} · {typeLabel(circle.type)} ·{" "}
                    {circle.degrees.join(" – ")}
                  </p>
                  <p className="mt-1 text-sm">{circle.chords.join(", ")}</p>
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

export default CircleList;
