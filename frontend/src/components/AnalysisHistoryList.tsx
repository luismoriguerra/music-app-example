import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HELPER_BUTTON_CLASS } from "@/components/TransposeControl";
import type { SecondVoiceSummary } from "@/lib/sheets/schemas";

export interface AnalysisHistoryListProps {
  entries: readonly SecondVoiceSummary[];
  songTitle: string;
  selectedId?: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTr(offset: number): string {
  return `Tr. ${offset > 0 ? "+" : ""}${offset}`;
}

/**
 * Presentational history list (T024, 006): newest-first rows (the backend
 * sorts; this renders in order) with @Tr badges, timestamps, and model ids.
 * Delete reuses ConfirmDialog (Cancel autofocus + Escape abort, 004 idiom).
 */
export function AnalysisHistoryList({
  entries,
  songTitle,
  selectedId = null,
  onOpen,
  onDelete,
}: AnalysisHistoryListProps) {
  const [pendingDelete, setPendingDelete] = useState<SecondVoiceSummary | null>(
    null,
  );

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No analyses yet for this song — completed runs will appear here
      </p>
    );
  }

  return (
    <>
      <ul aria-label="Past analyses" className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            aria-current={entry.id === selectedId ? "true" : undefined}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-2 text-sm ${
              entry.id === selectedId ? "border-primary" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(entry.id)}
              className={HELPER_BUTTON_CLASS}
            >
              Open analysis at {formatTr(entry.transpose)}
            </button>
            <span className="bg-secondary rounded-full px-2 py-0.5 text-xs font-medium">
              @{formatTr(entry.transpose)}
            </span>
            <time
              dateTime={entry.created_at}
              className="text-muted-foreground text-xs"
            >
              {new Date(entry.created_at).toLocaleString()}
            </time>
            <span className="text-muted-foreground text-xs">
              {entry.model_id}
            </span>
            <button
              type="button"
              onClick={() => setPendingDelete(entry)}
              className="text-destructive ml-auto text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              Delete analysis at {formatTr(entry.transpose)}
            </button>
          </li>
        ))}
      </ul>
      {pendingDelete !== null && (
        <ConfirmDialog
          title="Delete this analysis?"
          description={
            <>
              Delete the {songTitle} analysis at{" "}
              {formatTr(pendingDelete.transpose)}? This cannot be undone.
            </>
          }
          confirmLabel="Confirm delete"
          tone="destructive"
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

export default AnalysisHistoryList;
