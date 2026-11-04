import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { CandidateList } from "@/components/CandidateList";
import { HistoryList } from "@/components/HistoryList";
import { STARTER_SONGS } from "@/lib/sheets/starter-songs";
import { sheetEntryPath } from "@/lib/routes";
import {
  deleteHistoryEntry,
  HttpStatusError,
  listHistory,
  navigateTo,
  pageCount,
  regenerateHistoryEntry,
  resolveApiBase,
  setHistoryFavorite,
} from "@/lib/sheets/history-api";
import {
  generateSheetResponseSchema,
  songSearchResponseSchema,
  type Candidate,
  type HistoryEntry,
} from "@/lib/sheets/schemas";

export interface SheetGeneratorProps {
  /** Game page path, e.g. `/courses/ukulele/games/lyrics-chords`. */
  gamePath: string;
  /** Backend base URL. Defaults to PUBLIC_API_URL (or localhost:8000). */
  apiBaseUrl?: string;
}

type Phase = "idle" | "candidates" | "no-match" | "error";
type ErrorKind = "connection" | "service";

const NAME_FILTER_DEBOUNCE_MS = 300;

/**
 * Lyrics + Chords generator search page island (004): song-name input
 * (FR-003), candidate disambiguation (FR-006), paginated + filterable history
 * with favorites (FR-009/010/018), loading/empty/error states (FR-014). Every
 * stored sheet opens on its dedicated page (`<gamePath>/<entry_id>`); legacy
 * `?entry=<uuid>` links redirect there. Runtime fetch only, no SSR (R11).
 */
export function SheetGenerator({ gamePath, apiBaseUrl }: SheetGeneratorProps) {
  const apiBase = resolveApiBase(apiBaseUrl);
  const inputId = useId();
  const guidanceId = useId();
  const nameFilterId = useId();
  const [query, setQuery] = useState("");
  const [guidance, setGuidance] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("connection");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [lastCandidate, setLastCandidate] = useState<Candidate | null>(null);
  const [generatingCandidate, setGeneratingCandidate] =
    useState<Candidate | null>(null);
  // History (US3): open by default for one-click re-open.
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  // Init true: the SSR shell + first paint must show "Loading history…" —
  // never a false "No searches yet" before the fetch resolves.
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // History view is restored from the URL on mount before the first fetch.
  const [historyRestored, setHistoryRestored] = useState(false);
  const [historyReload, setHistoryReload] = useState(0);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [lastRegenerateId, setLastRegenerateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const historyRequest = useRef(0);

  const openSheet = (entryId: string): void =>
    navigateTo(sheetEntryPath(gamePath, entryId));

  // Mount: legacy `?entry=<uuid>` deep links now live at the dedicated sheet
  // page; otherwise restore the history view (`?page=&q=&fav=1`) so Back from
  // a sheet page returns to the same page and filters.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("entry");
    if (id) {
      navigateTo(sheetEntryPath(gamePath, id), { replace: true });
      return;
    }
    const page = Number(params.get("page"));
    const name = (params.get("q") ?? "").trim();
    if (Number.isInteger(page) && page > 1) setHistoryPage(page);
    setNameInput(name);
    setNameFilter(name);
    setFavoritesOnly(params.get("fav") === "1");
    setHistoryRestored(true);
  }, [gamePath]);

  // Mirror the history view into the URL (defaults omitted).
  useEffect(() => {
    if (!historyRestored) return;
    const params = new URLSearchParams();
    if (historyPage > 1) params.set("page", String(historyPage));
    if (nameFilter) params.set("q", nameFilter);
    if (favoritesOnly) params.set("fav", "1");
    const search = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [historyRestored, historyPage, nameFilter, favoritesOnly]);

  // Debounced name filter; any filter change restarts at page 1. Skipped when
  // the trimmed input already matches (mount, whitespace-only edits) so a
  // no-op never yanks the user back to page 1.
  useEffect(() => {
    const next = nameInput.trim();
    if (next === nameFilter) return;
    const timer = window.setTimeout(() => {
      setNameFilter(next);
      setHistoryPage(1);
    }, NAME_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [nameInput, nameFilter]);

  useEffect(() => {
    if (!historyOpen || !historyRestored) return;
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError(null);
    listHistory(apiBase, {
      page: historyPage,
      name: nameFilter,
      favoritesOnly,
    })
      .then((parsed) => {
        if (request !== historyRequest.current) return;
        const lastPage = pageCount(parsed.total);
        // A page emptied by delete (or a shrunk filter) falls back to the
        // last remaining page.
        if (historyPage > lastPage) {
          setHistoryPage(lastPage);
          return;
        }
        setHistoryEntries(parsed.entries);
        setHistoryTotal(parsed.total);
        setHistoryLoading(false);
      })
      .catch(() => {
        if (request !== historyRequest.current) return;
        setHistoryError("Couldn't load search history. Check your connection.");
        setHistoryLoading(false);
      });
  }, [
    apiBase,
    historyOpen,
    historyRestored,
    historyPage,
    nameFilter,
    favoritesOnly,
    historyReload,
  ]);

  const reloadHistory = (): void => setHistoryReload((n) => n + 1);

  // A rejected fetch means no answer reached us, so the connection is the
  // suspect. Any non-2xx answer means the service responded (LRCLIB 503 surfaces
  // as PROVIDER_ERROR 502): blame the service, never the learner's connection.
  const showSearchError = (error: unknown): void => {
    setErrorKind(error instanceof HttpStatusError ? "service" : "connection");
    setPhase("error");
  };

  const regenerate = async (entryId: string): Promise<void> => {
    setRegeneratingId(entryId);
    setLastRegenerateId(entryId);
    setPhase("idle");
    try {
      const parsed = await regenerateHistoryEntry(apiBase, entryId);
      openSheet(parsed.entry_id);
    } catch (error) {
      showSearchError(error);
    } finally {
      setRegeneratingId(null);
    }
  };

  const deleteEntry = async (entryId: string): Promise<void> => {
    setDeletingId(entryId);
    setActionError(null);
    try {
      await deleteHistoryEntry(apiBase, entryId);
      reloadHistory();
    } catch {
      setActionError("Couldn't delete that history entry. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFavorite = async (entry: HistoryEntry): Promise<void> => {
    setFavoritingId(entry.id);
    setActionError(null);
    try {
      const updated = await setHistoryFavorite(
        apiBase,
        entry.id,
        !entry.favorite,
      );
      if (favoritesOnly && !updated.favorite) {
        reloadHistory();
      } else {
        setHistoryEntries((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e)),
        );
      }
    } catch {
      setActionError("Couldn't update that favorite. Try again.");
    } finally {
      setFavoritingId(null);
    }
  };

  const backToSearch = (): void => {
    if (generatingCandidate !== null) return;
    setCandidates([]);
    setPhase("idle");
  };

  const generate = async (
    trimmedQuery: string,
    candidate: Candidate,
  ): Promise<void> => {
    setLastQuery(trimmedQuery);
    setLastCandidate(candidate);
    setLastRegenerateId(null);
    setGeneratingCandidate(candidate);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/sheets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, candidate }),
      });
      if (!res.ok)
        throw new HttpStatusError(`generate failed: ${res.status}`, res.status);
      const parsed = generateSheetResponseSchema.parse(await res.json());
      openSheet(parsed.entry_id);
    } catch (error) {
      showSearchError(error);
    } finally {
      setSubmitting(false);
      setGeneratingCandidate(null);
    }
  };

  const submit = async (raw: string): Promise<void> => {
    const trimmed = raw.trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
      setGuidance("Enter a song name (1–200 characters) to search.");
      return;
    }
    setGuidance(null);
    setCandidates([]);
    setLastQuery(trimmed);
    setLastCandidate(null);
    setGeneratingCandidate(null);
    setLastRegenerateId(null);
    setSubmitting(true);
    setPhase("idle");
    try {
      const res = await fetch(`${apiBase}/api/v1/song-search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok)
        throw new HttpStatusError(`search failed: ${res.status}`, res.status);
      const parsed = songSearchResponseSchema.parse(await res.json());
      if (parsed.candidates.length === 0) {
        setPhase("no-match");
      } else if (
        parsed.candidates.length === 1 &&
        !("duckduckgo" in parsed.candidates[0].provider_refs)
      ) {
        await generate(trimmed, parsed.candidates[0]);
        return;
      } else {
        setCandidates(parsed.candidates);
        setPhase("candidates");
      }
    } catch (error) {
      showSearchError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void submit(query);
  };

  const retry = (): void => {
    // Regenerate failure retries the regenerate; sheet failure retries the
    // sheet; else re-runs the search.
    if (lastRegenerateId) {
      void regenerate(lastRegenerateId);
    } else if (lastCandidate && lastQuery) {
      void generate(lastQuery, lastCandidate);
    } else {
      void submit(query);
    }
  };

  const startStarter = (starter: string): void => {
    setQuery(starter);
    void submit(starter);
  };

  const showSearchHome = phase !== "candidates";
  const filtered = nameFilter !== "" || favoritesOnly;
  const totalPages = pageCount(historyTotal);

  let submitLabel = "Search & generate";
  if (submitting)
    submitLabel = generatingCandidate !== null ? "Generating…" : "Searching…";

  return (
    <section
      aria-label="Lyrics and chords generator"
      className="flex w-full max-w-full min-w-0 flex-col gap-4"
    >
      <div
        className={
          showSearchHome
            ? "flex max-w-full min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start"
            : "flex max-w-full min-w-0 flex-col gap-4"
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          {showSearchHome && (
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor={inputId} className="text-sm font-medium">
                  Song name
                </label>
                {/* text-base (16px): smaller text makes iOS Safari auto-zoom
                    on focus, breaking the mobile layout. */}
                <input
                  id={inputId}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Riptide"
                  autoComplete="off"
                  aria-describedby={guidance ? guidanceId : undefined}
                  className="bg-background min-h-11 w-full min-w-0 rounded-md border px-3 text-base shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-primary-foreground inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitLabel}
              </button>
            </form>
          )}

          {guidance && (
            <p
              id={guidanceId}
              role="status"
              className="text-muted-foreground text-sm"
            >
              {guidance}
            </p>
          )}

          {showSearchHome && (
            <section
              aria-label="Quick start"
              data-testid="quick-start"
              className="flex flex-col gap-3"
            >
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">
                  Start with an example
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Pick a song to generate its lyric-and-chord sheet instantly —
                  no typing needed.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {STARTER_SONGS.map((starter) => (
                  <li key={starter}>
                    <button
                      type="button"
                      onClick={() => startStarter(starter)}
                      className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium hover:opacity-90"
                    >
                      {starter}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {phase === "candidates" && (
            <div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-4 duration-300">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={backToSearch}
                  disabled={generatingCandidate !== null}
                  aria-label="Back to search"
                  title="Back to search"
                  className="bg-secondary text-secondary-foreground inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  <span className="ml-2">Back</span>
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="font-display truncate text-lg font-bold tracking-tight">
                    Pick the right match
                  </h2>
                  <p className="text-muted-foreground truncate text-sm">
                    {candidates.length} matches for &ldquo;
                    {lastQuery || query.trim()}&rdquo;
                  </p>
                </div>
              </div>
              <CandidateList
                candidates={candidates}
                onPick={(c) => void generate(lastQuery || query.trim(), c)}
                pendingCandidate={generatingCandidate}
              />
            </div>
          )}

          {phase === "no-match" && (
            <div role="status" className="text-muted-foreground text-sm">
              No songs matched. Check the spelling and try another song name.
            </div>
          )}

          {phase === "error" && (
            <div
              role="alert"
              className="border-destructive/50 bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm"
            >
              <p>
                {errorKind === "service"
                  ? "The song service returned an error. Try again in a moment."
                  : "Couldn't reach the song service. Check your connection and try again."}
              </p>
              <button
                type="button"
                onClick={retry}
                className="bg-secondary text-secondary-foreground inline-flex min-h-11 w-fit items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90"
              >
                Try again
              </button>
            </div>
          )}

          {showSearchHome && (
            <section
              aria-label="History"
              className="flex max-w-full min-w-0 flex-col gap-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <h2 className="min-w-0 text-sm font-semibold">
                  History
                  {!historyLoading && historyError === null && historyTotal > 0
                    ? ` (${historyTotal})`
                    : ""}
                </h2>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((open) => !open)}
                  aria-expanded={historyOpen}
                  aria-controls="history-panel"
                  className="bg-secondary text-secondary-foreground inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90"
                >
                  {historyOpen ? "Hide history" : "Show history"}
                </button>
              </div>

              {historyOpen && (
                <div id="history-panel" className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label htmlFor={nameFilterId} className="sr-only">
                      Filter history by name
                    </label>
                    <input
                      id={nameFilterId}
                      type="search"
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                      placeholder="Filter by name"
                      autoComplete="off"
                      className="bg-background min-h-11 w-full min-w-0 flex-1 rounded-md border px-3 text-base shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFavoritesOnly((on) => !on);
                        setHistoryPage(1);
                      }}
                      aria-pressed={favoritesOnly}
                      className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90 ${
                        favoritesOnly
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      Favorites only
                    </button>
                  </div>
                  {actionError && (
                    <div role="alert" className="text-destructive text-sm">
                      {actionError}
                    </div>
                  )}
                  <HistoryList
                    entries={historyEntries}
                    entryHref={(entry) => sheetEntryPath(gamePath, entry.id)}
                    onRegenerate={(entry) => void regenerate(entry.id)}
                    onDelete={(entry) => void deleteEntry(entry.id)}
                    onToggleFavorite={(entry) => void toggleFavorite(entry)}
                    isLoading={historyLoading}
                    error={historyError}
                    onRetry={reloadHistory}
                    regeneratingId={regeneratingId}
                    deletingId={deletingId}
                    favoritingId={favoritingId}
                    emptyMessage={
                      filtered ? "No songs match these filters." : undefined
                    }
                  />
                  {!historyLoading &&
                    historyError === null &&
                    totalPages > 1 && (
                      <nav
                        aria-label="History pages"
                        className="flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => setHistoryPage((p) => p - 1)}
                          disabled={historyPage <= 1}
                          className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span
                          className="text-muted-foreground text-sm"
                          aria-live="polite"
                        >
                          Page {historyPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHistoryPage((p) => p + 1)}
                          disabled={historyPage >= totalPages}
                          className="bg-secondary text-secondary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    )}
                </div>
              )}
            </section>
          )}
        </div>

        {showSearchHome && (
          <aside aria-label="Tips" className="flex min-w-0 flex-col gap-4">
            <section
              aria-label="How it works"
              className="bg-card flex flex-col gap-2 rounded-xl border p-4"
            >
              <h2 className="text-sm font-semibold">How it works</h2>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
                <li>Search for any song by name.</li>
                <li>Pick the right match when several songs share a name.</li>
                <li>Play the sheet and transpose it to your key.</li>
              </ol>
            </section>
          </aside>
        )}
      </div>
    </section>
  );
}

export default SheetGenerator;
