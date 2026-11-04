import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SheetView } from "@/components/SheetView";
import { SourceLinks } from "@/components/SourceLinks";
import type { CatalogChord } from "@/lib/sheets";
import { sheetEntryPath } from "@/lib/routes";
import {
  NotFoundError,
  UUID_RE,
  deleteHistoryEntry,
  getHistoryEntry,
  navigateTo,
  regenerateHistoryEntry,
  resolveApiBase,
  setHistoryFavorite,
} from "@/lib/sheets/history-api";
import type { Sheet } from "@/lib/sheets/schemas";

export interface SheetEntryProps {
  /** Game page path, e.g. `/courses/ukulele/games/lyrics-chords`. */
  gamePath: string;
  gameTitle: string;
  coursePath: string;
  courseTitle: string;
  /** Chords catalog for cross-links; defaults to empty (all off-catalog). */
  catalog?: readonly CatalogChord[];
  /** Backend base URL. Defaults to PUBLIC_API_URL (or localhost:8000). */
  apiBaseUrl?: string;
}

type State =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "ready"; sheet: Sheet; favorite: boolean };

const SECONDARY_BUTTON =
  "bg-secondary text-secondary-foreground inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const ICON_BUTTON =
  "text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Dedicated sheet page island (004 FR-009/010/015/018): the entry id is the
 * last path segment of `<gamePath>/<entry_id>` (game-route.md). Renders the
 * breadcrumb ending in the song title, the stored sheet (zero re-query, R7),
 * and favorite / regenerate / delete actions; unknown or malformed ids show
 * the not-found view.
 */
export function SheetEntry({
  gamePath,
  gameTitle,
  coursePath,
  courseTitle,
  catalog = [],
  apiBaseUrl,
}: SheetEntryProps) {
  const apiBase = resolveApiBase(apiBaseUrl);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirm, setConfirm] = useState<"regenerate" | "delete" | null>(null);
  const [busy, setBusy] = useState<"regenerate" | "delete" | "favorite" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const id =
      window.location.pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    if (!UUID_RE.test(id)) {
      setState({ kind: "not-found" });
      return;
    }
    setEntryId(id);
    setState({ kind: "loading" });
    let cancelled = false;
    getHistoryEntry(apiBase, id)
      .then((parsed) => {
        if (!cancelled)
          setState({
            kind: "ready",
            sheet: parsed.sheet,
            favorite: parsed.favorite,
          });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            kind: err instanceof NotFoundError ? "not-found" : "error",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, reload]);

  const title = state.kind === "ready" ? state.sheet.matched_title : null;

  useEffect(() => {
    if (title) document.title = `${title} — ${gameTitle}`;
  }, [title, gameTitle]);

  const runAction = async (
    kind: "regenerate" | "delete" | "favorite",
    action: () => Promise<void>,
    failure: string,
  ): Promise<void> => {
    setBusy(kind);
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(failure);
    } finally {
      setBusy(null);
    }
  };

  const crumbTitle =
    state.kind === "ready"
      ? state.sheet.matched_title
      : state.kind === "not-found"
        ? "Not found"
        : "Song";

  return (
    <section
      aria-label="Song sheet"
      className="flex w-full max-w-full min-w-0 flex-col gap-4"
    >
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <a href="/" className="hover:underline">
          Courses
        </a>
        <span aria-hidden="true"> / </span>
        <a href={coursePath} className="hover:underline">
          {courseTitle}
        </a>
        <span aria-hidden="true"> / </span>
        <a href={gamePath} className="hover:underline">
          {gameTitle}
        </a>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{crumbTitle}</span>
      </nav>

      {state.kind === "loading" && (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading sheet…
        </div>
      )}

      {state.kind === "not-found" && (
        <div
          role="alert"
          className="border-destructive/50 bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm"
        >
          <p>
            History entry not found. The link may be wrong or the entry may no
            longer exist.
          </p>
          <div className="flex gap-2">
            <a href="/" className={SECONDARY_BUTTON}>
              Home
            </a>
            <a href={gamePath} className={SECONDARY_BUTTON}>
              Back to generator
            </a>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="border-destructive/50 bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm"
        >
          <p>
            Couldn&apos;t reach the song service. Check your connection and try
            again.
          </p>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className={`${SECONDARY_BUTTON} w-fit`}
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && entryId && (
        <div className="flex flex-col gap-6">
          {/* SheetView shows title + performer; the page h1 is for AT only. */}
          <h1 className="sr-only">
            {state.sheet.matched_title} — {state.sheet.matched_performer}
          </h1>
          <div className="flex items-center justify-between gap-2">
            <a
              href={gamePath}
              aria-label="Back to search and stored songs"
              title="Back to search and stored songs"
              className={SECONDARY_BUTTON}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="ml-2">Back</span>
            </a>
            <div
              role="group"
              aria-label="Sheet actions"
              className="flex items-center gap-0.5"
            >
              <button
                type="button"
                onClick={() =>
                  void runAction(
                    "favorite",
                    async () => {
                      const updated = await setHistoryFavorite(
                        apiBase,
                        entryId,
                        !state.favorite,
                      );
                      setState({ ...state, favorite: updated.favorite });
                    },
                    "Couldn't update the favorite. Try again.",
                  )
                }
                disabled={busy !== null}
                aria-pressed={state.favorite}
                aria-label={
                  state.favorite ? "Remove from favorites" : "Add to favorites"
                }
                title={state.favorite ? "Unfavorite" : "Favorite"}
                className={`${ICON_BUTTON} ${state.favorite ? "text-primary" : ""}`}
              >
                <Star
                  className={`size-4 ${state.favorite ? "fill-current" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => setConfirm("regenerate")}
                disabled={busy !== null}
                aria-label={
                  busy === "regenerate" ? "Regenerating…" : "Regenerate"
                }
                title="Regenerate"
                className={ICON_BUTTON}
              >
                {busy === "regenerate" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirm("delete")}
                disabled={busy !== null}
                aria-label={busy === "delete" ? "Deleting…" : "Delete"}
                title="Delete"
                className={`${ICON_BUTTON} hover:text-destructive`}
              >
                {busy === "delete" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {confirm === "regenerate" && (
            <ConfirmDialog
              title="Regenerate this sheet?"
              description={
                <>
                  &ldquo;{state.sheet.matched_title}&rdquo; (
                  {state.sheet.matched_performer}) will be searched and
                  generated again from scratch (a new history entry; this one is
                  kept). It takes a moment and may return a different sheet.
                </>
              }
              confirmLabel="Regenerate"
              confirmIcon={<RefreshCw className="size-4" aria-hidden="true" />}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                setConfirm(null);
                void runAction(
                  "regenerate",
                  async () => {
                    const parsed = await regenerateHistoryEntry(
                      apiBase,
                      entryId,
                    );
                    navigateTo(sheetEntryPath(gamePath, parsed.entry_id));
                  },
                  "Couldn't regenerate this sheet. Try again.",
                );
              }}
            />
          )}
          {confirm === "delete" && (
            <ConfirmDialog
              tone="destructive"
              title="Delete this search?"
              description={
                <>
                  &ldquo;{state.sheet.matched_title}&rdquo; (
                  {state.sheet.matched_performer}) and its saved sheet and any
                  saved second-voice analyses will be permanently removed from
                  history. This can&rsquo;t be undone.
                </>
              }
              confirmLabel="Confirm delete"
              confirmIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                setConfirm(null);
                void runAction(
                  "delete",
                  async () => {
                    await deleteHistoryEntry(apiBase, entryId);
                    navigateTo(gamePath);
                  },
                  "Couldn't delete this entry. Try again.",
                );
              }}
            />
          )}
          {actionError && (
            <div role="alert" className="text-destructive text-sm">
              {actionError}
            </div>
          )}
          <SheetView
            sheet={state.sheet}
            catalog={catalog}
            apiBaseUrl={apiBase}
          />
          <section aria-label="Sources" className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Other sources</h2>
            <SourceLinks
              links={state.sheet.source_links}
              degraded={state.sheet.degraded}
            />
          </section>
        </div>
      )}
    </section>
  );
}

export default SheetEntry;
