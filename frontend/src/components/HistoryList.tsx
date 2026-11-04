import { useState } from "react";
import { BookOpen, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { HistoryEntry } from "@/lib/sheets/schemas";

export interface HistoryListProps {
  /** Entries in any order — the list sorts newest-first by `created_at`. */
  entries: readonly HistoryEntry[];
  /** Dedicated sheet page address for an entry (FR-009). */
  entryHref: (entry: HistoryEntry) => string;
  /** Fired only after the regenerate confirm dialog is accepted. */
  onRegenerate: (entry: HistoryEntry) => void;
  /** Fired only after the delete confirm dialog is accepted. */
  onDelete: (entry: HistoryEntry) => void;
  /** Mark/unmark favorite (FR-018); no confirm step. */
  onToggleFavorite: (entry: HistoryEntry) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Entry currently regenerating (actions disabled + spinner). */
  regeneratingId?: string | null;
  /** Entry currently deleting (actions disabled + spinner). */
  deletingId?: string | null;
  /** Entry whose favorite flag is being saved. */
  favoritingId?: string | null;
  /** Empty-state copy; differs when filters exclude every entry. */
  emptyMessage?: string;
}

const ICON_BUTTON =
  "text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const TEXT_BUTTON =
  "bg-secondary text-secondary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90";

type Pending =
  | { kind: "regenerate"; entry: HistoryEntry }
  | { kind: "delete"; entry: HistoryEntry };

/**
 * Format an ISO created_at for display. Falls back to the raw string when the
 * date is unparseable (schema guards this, but the UI never crashes on it).
 */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * History list (T048 + follow-ups, 004; cards refresh 007): responsive grid
 * cards sorted newest-first by `created_at`, each with its created time. The
 * card title links to the entry's dedicated sheet page; a compact icon
 * toolbar offers open / favorite / regenerate / delete, the latter two behind
 * a confirm dialog (regenerate re-runs the full provider pipeline, so it is
 * gated like delete). Loading / error / empty states per FR-009/010/014/018.
 * Icon buttons carry full-sentence aria-labels + titles so actions stay
 * discoverable.
 */
export function HistoryList({
  entries,
  entryHref,
  onRegenerate,
  onDelete,
  onToggleFavorite,
  isLoading = false,
  error = null,
  onRetry,
  regeneratingId = null,
  deletingId = null,
  favoritingId = null,
  emptyMessage = "No searches yet. Search a song above and it will appear here.",
}: HistoryListProps) {
  const [pending, setPending] = useState<Pending | null>(null);

  if (isLoading) {
    return (
      <div role="status" className="text-muted-foreground text-sm">
        Loading history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div role="alert" className="text-destructive text-sm">
          {error}
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} className={TEXT_BUTTON}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div role="status" className="text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  const close = (): void => setPending(null);

  // Defensive newest-first sort by created_at — the backend already orders
  // `created_at DESC` (004 T044), but the cards never depend on fetch order.
  const sorted = [...entries].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-2">
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Search history">
        {sorted.map((entry) => {
          const isRegenerating = regeneratingId === entry.id;
          const isDeleting = deletingId === entry.id;
          const busy = isRegenerating || isDeleting;
          const href = entryHref(entry);
          return (
            <li
              key={entry.id}
              className="bg-card flex w-full flex-col gap-2 rounded-xl border p-3"
            >
              <div className="flex min-w-0 flex-col">
                <a
                  href={href}
                  aria-label={`Open ${entry.query}`}
                  className="hover:text-primary truncate text-left text-sm font-medium underline-offset-2 hover:underline"
                >
                  {entry.query}
                </a>
                <span className="text-muted-foreground truncate text-xs">
                  {entry.matched_title}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {entry.matched_performer}
                </span>
                <time
                  dateTime={entry.created_at}
                  className="text-muted-foreground text-xs"
                >
                  {formatCreatedAt(entry.created_at)}
                </time>
              </div>
              <div
                role="group"
                aria-label={`Actions for ${entry.query}`}
                className="-mx-1 flex items-center gap-0.5"
              >
                <a
                  href={href}
                  aria-label={`Open ${entry.query}`}
                  title="Open"
                  className={ICON_BUTTON}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(entry)}
                  disabled={busy || favoritingId === entry.id}
                  aria-pressed={entry.favorite}
                  aria-label={
                    entry.favorite
                      ? `Remove ${entry.query} from favorites`
                      : `Add ${entry.query} to favorites`
                  }
                  title={entry.favorite ? "Unfavorite" : "Favorite"}
                  className={`${ICON_BUTTON} ${entry.favorite ? "text-primary" : ""}`}
                >
                  <Star
                    className={`size-4 ${entry.favorite ? "fill-current" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setPending({ kind: "regenerate", entry })}
                  disabled={busy}
                  aria-label={
                    isRegenerating
                      ? `Regenerating ${entry.query}…`
                      : `Regenerate ${entry.query}`
                  }
                  title="Regenerate"
                  className={ICON_BUTTON}
                >
                  {isRegenerating ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPending({ kind: "delete", entry })}
                  disabled={busy}
                  aria-label={
                    isDeleting
                      ? `Deleting ${entry.query}…`
                      : `Delete ${entry.query}`
                  }
                  title="Delete"
                  className={`${ICON_BUTTON} hover:text-destructive ml-auto`}
                >
                  {isDeleting ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {pending?.kind === "delete" && (
        <ConfirmDialog
          tone="destructive"
          title="Delete this search?"
          description={
            <>
              &ldquo;{pending.entry.query}&rdquo; ({pending.entry.matched_title}{" "}
              — {pending.entry.matched_performer}) and its saved sheet and any
              saved second-voice analyses will be permanently removed. This
              can&rsquo;t be undone.
            </>
          }
          confirmLabel="Confirm delete"
          confirmIcon={<Trash2 className="size-4" aria-hidden="true" />}
          onCancel={close}
          onConfirm={() => {
            onDelete(pending.entry);
            close();
          }}
        />
      )}
      {pending?.kind === "regenerate" && (
        <ConfirmDialog
          title="Regenerate this sheet?"
          description={
            <>
              &ldquo;{pending.entry.query}&rdquo; ({pending.entry.matched_title}{" "}
              — {pending.entry.matched_performer}) will be searched and
              generated again from scratch (a new history entry; this one is
              kept). It takes a moment and may return a different sheet.
            </>
          }
          confirmLabel="Regenerate"
          confirmIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          onCancel={close}
          onConfirm={() => {
            onRegenerate(pending.entry);
            close();
          }}
        />
      )}
    </div>
  );
}

export default HistoryList;
