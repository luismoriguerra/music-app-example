import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnalysisHistoryList } from "@/components/AnalysisHistoryList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SecondVoiceView } from "@/components/SecondVoiceView";
import { HELPER_BUTTON_CLASS } from "@/components/TransposeControl";
import { buildSnapshot, isAnalysisStale } from "@/lib/second-voice";
import type { ChordPlaybackMode } from "@/lib/sound";
import {
  secondVoiceAnalyzeResponseSchema,
  secondVoiceGetResponseSchema,
  secondVoiceListResponseSchema,
  type SecondVoiceAnalysis,
  type SecondVoiceSummary,
  type Sheet,
} from "@/lib/sheets/schemas";

export interface SecondVoicePanelProps {
  displaySheet: Sheet;
  transpose: number;
  apiBaseUrl: string;
  /** Shared strum/block chord-audio setting (owned by SheetView). */
  chordPlayback?: ChordPlaybackMode;
  onChordPlaybackChange?: (mode: ChordPlaybackMode) => void;
  /** Reports the open analysis (null when none) so SheetView can feed the trainer's analysis-key path (008 FR-004). */
  onOpenAnalysisChange?: (open: SecondVoiceAnalysis | null) => void;
}

function formatTr(offset: number): string {
  return `Tr. ${offset > 0 ? "+" : ""}${offset}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data.error?.message) return data.error.message;
  } catch {
    // Keep the fallback when the error body is unreadable.
  }
  return fallback;
}

async function postAnalysis(
  apiBaseUrl: string,
  displaySheet: Sheet,
  transpose: number,
): Promise<SecondVoiceAnalysis> {
  const res = await fetch(
    `${apiBaseUrl}/api/v1/sheets/${displaySheet.id}/second-voice`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSnapshot(displaySheet, transpose)),
    },
  );
  if (!res.ok)
    throw new Error(await readError(res, `Analysis failed (${res.status}).`));
  return secondVoiceAnalyzeResponseSchema.parse(await res.json()).analysis;
}

async function fetchHistory(
  apiBaseUrl: string,
  sheetId: string,
): Promise<SecondVoiceSummary[]> {
  const res = await fetch(
    `${apiBaseUrl}/api/v1/sheets/${sheetId}/second-voice`,
  );
  if (!res.ok)
    throw new Error(await readError(res, `History failed (${res.status}).`));
  return secondVoiceListResponseSchema.parse(await res.json()).analyses;
}

async function fetchAnalysis(
  apiBaseUrl: string,
  analysisId: string,
): Promise<SecondVoiceAnalysis> {
  const res = await fetch(`${apiBaseUrl}/api/v1/second-voice/${analysisId}`);
  if (!res.ok)
    throw new Error(await readError(res, `Re-open failed (${res.status}).`));
  return secondVoiceGetResponseSchema.parse(await res.json()).analysis;
}

async function deleteAnalysis(
  apiBaseUrl: string,
  analysisId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/v1/second-voice/${analysisId}`, {
    method: "DELETE",
  });
  if (!res.ok)
    throw new Error(await readError(res, `Delete failed (${res.status}).`));
}

/**
 * Second-voice container (T018/T025, 006): trigger + analyze fetch + stale +
 * per-song history, rendered in its own "AI 2nd voice analyzer" tab in
 * SheetView. Hidden for lyrics-only sheets (FR-001); stale is derived per
 * render (FR-008). Ready/stale states mount SecondVoiceView (T030). On mount
 * the panel auto-loads history newest-first and opens the newest entry at
 * the current transpose (else the newest overall, zero inference). When the
 * song has no saved analysis yet, it auto-generates one at the current
 * transpose (at most once per mount) and shows a generating animation
 * while it waits. SheetView keys this panel by sheet, so a song change
 * remounts it with fresh state.
 */
export function SecondVoicePanel({
  displaySheet,
  transpose,
  apiBaseUrl,
  chordPlayback,
  onChordPlaybackChange,
  onOpenAnalysisChange,
}: SecondVoicePanelProps) {
  const [open, setOpen] = useState<SecondVoiceAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [entries, setEntries] = useState<SecondVoiceSummary[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  // Guards the initial load against a re-run (apiBaseUrl change) while a
  // previous load is in flight: only the latest generation may commit.
  const loadGen = useRef(0);
  // Mount-time transpose for the auto-open pick, read through a ref so a
  // stepper move never re-triggers the load (it marks the open one stale).
  const transposeRef = useRef(transpose);
  transposeRef.current = transpose;
  // Latest displayed sheet for the auto-generate POST (same ref idiom: the
  // load callback must not re-run on every transpose-driven sheet change).
  const displaySheetRef = useRef(displaySheet);
  displaySheetRef.current = displaySheet;
  // Auto-generate fires at most once per mounted panel, so a retried or
  // re-run load (or a StrictMode double effect) never spends a second
  // model call; later runs are explicit (Generate / Regenerate / Retry).
  const autoRunStarted = useRef(false);

  const lyricsOnly = displaySheet.chord_source === "none";

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setEntries(await fetchHistory(apiBaseUrl, displaySheet.id));
      setInitialError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "History failed.");
    } finally {
      setHistoryLoading(false);
    }
  }, [apiBaseUrl, displaySheet.id]);

  // Initial load: fetch history newest-first and auto-open the newest entry
  // at the current transpose, else the newest overall (two GETs, zero
  // inference). Runs once per sheet on mount; transpose changes never
  // reload — a moved stepper marks the open analysis stale.
  const loadInitial = useCallback(async () => {
    const gen = ++loadGen.current;
    if (lyricsOnly) {
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    setInitialError(null);
    try {
      const list = await fetchHistory(apiBaseUrl, displaySheet.id);
      if (loadGen.current !== gen) return;
      setEntries(list);
      if (list.length > 0) {
        const pick =
          list.find((e) => e.transpose === transposeRef.current) ?? list[0];
        setOpening(true);
        try {
          const latest = await fetchAnalysis(apiBaseUrl, pick.id);
          if (loadGen.current !== gen) return;
          setOpen(latest);
        } finally {
          if (loadGen.current === gen) setOpening(false);
        }
      } else if (!autoRunStarted.current) {
        // First visit with no saved analysis: generate one automatically.
        autoRunStarted.current = true;
        setLoading(true);
        setError(null);
        try {
          const analysis = await postAnalysis(
            apiBaseUrl,
            displaySheetRef.current,
            transposeRef.current,
          );
          if (loadGen.current !== gen) return;
          setOpen(analysis);
        } catch (err) {
          if (loadGen.current !== gen) return;
          setError(err instanceof Error ? err.message : "Analysis failed.");
        } finally {
          if (loadGen.current === gen) setLoading(false);
        }
      }
    } catch (err) {
      if (loadGen.current !== gen) return;
      setInitialError(
        err instanceof Error ? err.message : "Could not load saved analyses.",
      );
    } finally {
      if (loadGen.current === gen) setInitialLoading(false);
    }
  }, [apiBaseUrl, displaySheet.id, lyricsOnly]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!historyOpen) return;
    void refreshHistory();
  }, [historyOpen, refreshHistory]);

  // Reports the open analysis to SheetView for the trainer's analysis-key
  // path (008 FR-004). Fires on mount (null) and on every open/clear.
  useEffect(() => {
    onOpenAnalysisChange?.(open);
  }, [open, onOpenAnalysisChange]);

  if (lyricsOnly) return null;

  const stale = isAnalysisStale(open, transpose);
  const busy = loading || opening;
  const showEmpty =
    !initialLoading &&
    initialError === null &&
    !busy &&
    open === null &&
    error === null &&
    entries !== null &&
    entries.length === 0;

  const run = async () => {
    if (busy) return;
    setLoading(true);
    setError(null);
    try {
      const analysis = await postAnalysis(apiBaseUrl, displaySheet, transpose);
      setOpen(analysis);
      setInitialError(null);
      if (historyOpen) await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const openEntry = async (id: string) => {
    if (busy) return;
    setOpening(true);
    setError(null);
    try {
      setOpen(await fetchAnalysis(apiBaseUrl, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-open failed.");
    } finally {
      setOpening(false);
    }
  };

  const removeEntry = async (id: string) => {
    setHistoryError(null);
    try {
      await deleteAnalysis(apiBaseUrl, id);
      if (open?.id === id) setOpen(null);
      await refreshHistory();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  // Layout contract (006): SheetView mounts this panel inside its own
  // "AI 2nd voice analyzer" tabpanel on first visit, then keeps it mounted
  // with `hidden` so runs survive tab switches. Stacked full-width cards
  // (attribution-box idiom). Transpose stays shared above the tabs
  // (SheetView state).
  return (
    <section
      aria-label="AI second voice"
      className="flex min-w-0 flex-col gap-3"
    >
      <p className="text-muted-foreground text-xs">
        Analyzes the transposed chords from the Lyrics + Chords tab at the
        current transpose.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {open === null ? (
          <button
            type="button"
            onClick={run}
            disabled={busy}
            aria-busy={busy}
            className={HELPER_BUTTON_CLASS}
          >
            Generate AI 2nd voice
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRegenerate(true)}
            disabled={busy}
            aria-busy={busy}
            className={HELPER_BUTTON_CLASS}
          >
            Regenerate
          </button>
        )}
        <span className="text-muted-foreground text-xs font-medium">
          {formatTr(transpose)}
        </span>
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className={HELPER_BUTTON_CLASS}
        >
          {historyOpen ? "Hide past analyses" : "Past analyses"}
        </button>
      </div>

      {confirmingRegenerate && (
        <ConfirmDialog
          title="Regenerate second voice analysis?"
          description={
            <>
              This will run a new AI analysis for{" "}
              <strong>{displaySheet.matched_title || "this song"}</strong> at{" "}
              <strong>{formatTr(transpose)}</strong>. Past analyses remain saved
              in history.
            </>
          }
          confirmLabel="Regenerate"
          onConfirm={() => {
            setConfirmingRegenerate(false);
            void run();
          }}
          onCancel={() => setConfirmingRegenerate(false)}
        />
      )}

      {loading && (
        <div
          role="status"
          aria-label={`Analyzing at ${formatTr(transpose)}…`}
          data-testid="second-voice-generating"
          className="bg-card flex flex-col gap-3 rounded-xl border p-3 text-sm"
        >
          <p className="text-rock inline-flex items-center gap-2 font-medium">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Generating your 2nd-voice analysis at {formatTr(transpose)}…
          </p>
          <p className="text-muted-foreground text-xs">
            The AI is reading the song&apos;s chords — this can take up to a
            minute.
          </p>
          <div aria-hidden="true" className="flex flex-col gap-2">
            <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
            <div className="bg-muted h-3 w-5/6 animate-pulse rounded" />
            <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
          </div>
        </div>
      )}

      {opening && !loading && (
        <div
          role="status"
          aria-label="Loading saved analysis…"
          className="text-muted-foreground rounded-xl border p-3 text-sm"
        >
          Loading saved analysis…
        </div>
      )}

      {initialLoading && !busy && open === null && (
        <div
          role="status"
          aria-label="Loading saved analyses…"
          className="text-muted-foreground rounded-xl border p-3 text-sm"
        >
          Loading saved analyses…
        </div>
      )}

      {initialError !== null && !initialLoading && open === null && (
        <div
          role="alert"
          className="bg-card flex flex-col gap-2 rounded-xl border p-3 text-sm"
        >
          <p className="text-sm">{initialError}</p>
          <button
            type="button"
            onClick={() => void loadInitial()}
            className={`${HELPER_BUTTON_CLASS} self-start`}
          >
            Retry loading
          </button>
        </div>
      )}

      {error !== null && !busy && (
        <div
          role="alert"
          className="bg-card flex flex-col gap-2 rounded-xl border p-3 text-sm"
        >
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={run}
            className={`${HELPER_BUTTON_CLASS} self-start`}
          >
            Retry
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-3 text-sm">
          <p className="text-sm">
            No analyses yet for this song — set your key, then run your first
            analysis.
          </p>
        </div>
      )}

      {open !== null && !busy && (
        <div
          data-testid="second-voice-analysis"
          className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-3 text-sm"
        >
          <p className="text-muted-foreground text-xs font-medium">
            @{formatTr(open.transpose)}
          </p>
          {stale && (
            <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-2">
              <p className="text-xs">
                Computed at {formatTr(open.transpose)} — showing{" "}
                {formatTr(transpose)}
              </p>
              <button
                type="button"
                onClick={() => setConfirmingRegenerate(true)}
                className={`${HELPER_BUTTON_CLASS} self-start`}
              >
                Re-run at {formatTr(transpose)}
              </button>
            </div>
          )}
          <SecondVoiceView
            analysis={open.analysis}
            chordPlayback={chordPlayback}
            onChordPlaybackChange={onChordPlaybackChange}
          />
        </div>
      )}

      {historyOpen && (
        <div className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-3 text-sm">
          {historyLoading && (
            <div
              role="status"
              aria-label="Loading past analyses…"
              className="text-muted-foreground text-sm"
            >
              Loading past analyses…
            </div>
          )}
          {historyError !== null && !historyLoading && (
            <div role="alert" className="flex flex-col gap-2">
              <p className="text-sm">{historyError}</p>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className={`${HELPER_BUTTON_CLASS} self-start`}
              >
                Retry history
              </button>
            </div>
          )}
          {!historyLoading && historyError === null && entries !== null && (
            <AnalysisHistoryList
              entries={entries}
              songTitle={displaySheet.matched_title}
              selectedId={open?.id ?? null}
              onOpen={(id) => void openEntry(id)}
              onDelete={(id) => void removeEntry(id)}
            />
          )}
        </div>
      )}
    </section>
  );
}

export default SecondVoicePanel;
