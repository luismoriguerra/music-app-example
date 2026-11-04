import { ChevronRight, Loader2, Music2 } from "lucide-react";
import type { Candidate } from "@/lib/sheets/schemas";

export interface CandidateListProps {
  candidates: readonly Candidate[];
  onPick: (candidate: Candidate) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Candidate currently generating — its row shows inline loading, others disable. */
  pendingCandidate?: Candidate | null;
}

function isSameCandidate(a: Candidate, b: Candidate): boolean {
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    (a.album ?? null) === (b.album ?? null)
  );
}

/**
 * Presentational candidate rows (T039, 004): title/artist/album/artwork,
 * pick affordance, loading/error/empty states (FR-006/FR-014).
 * Pending pick renders inline row loading (per-row spinner) with peers disabled.
 */
export function CandidateList({
  candidates,
  onPick,
  isLoading = false,
  error = null,
  onRetry,
  pendingCandidate = null,
}: CandidateListProps) {
  if (isLoading) {
    return (
      <div role="status" className="text-muted-foreground text-sm">
        Searching for matching songs…
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
          <button
            type="button"
            onClick={onRetry}
            className="bg-secondary text-secondary-foreground inline-flex min-h-11 w-fit items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div role="status" className="text-muted-foreground text-sm">
        No songs matched. Check the spelling and try another song name.
      </div>
    );
  }

  const busy = pendingCandidate !== null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Matching songs">
      {candidates.map((candidate, index) => {
        const isPending = busy && isSameCandidate(candidate, pendingCandidate);
        return (
          <li
            key={`${candidate.title}|${candidate.artist}|${index}`}
            aria-busy={isPending || undefined}
            style={{ animationDelay: `${index * 45}ms` }}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-300 ease-out"
          >
            <button
              type="button"
              onClick={() => onPick(candidate)}
              disabled={busy}
              aria-label={
                isPending
                  ? `Generating ${candidate.title} by ${candidate.artist}…`
                  : `Use ${candidate.title} by ${candidate.artist}`
              }
              className={`group bg-card flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out sm:gap-4 sm:p-4 ${
                isPending
                  ? "border-rock shadow-[0_0_0_4px_var(--rock-glow)]"
                  : busy
                    ? "opacity-50"
                    : "hover:border-rock/60 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_var(--rock-glow),0_0_0_1px_var(--rock-glow)] active:translate-y-0 disabled:cursor-not-allowed"
              }`}
            >
              {candidate.artwork_url ? (
                <img
                  src={candidate.artwork_url}
                  alt={`${candidate.title} artwork`}
                  className="size-12 shrink-0 rounded-lg object-cover shadow-sm"
                  loading="lazy"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-secondary text-muted-foreground group-hover:text-rock flex size-12 shrink-0 items-center justify-center rounded-lg transition-colors"
                >
                  <Music2 className="size-5" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-display truncate text-base font-bold tracking-tight">
                  {candidate.title}
                </span>
                <span className="truncate text-sm">{candidate.artist}</span>
                {candidate.album && (
                  <span className="text-muted-foreground truncate text-xs">
                    {candidate.album}
                  </span>
                )}
              </span>
              {isPending ? (
                <span className="text-rock inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generating…
                </span>
              ) : (
                <>
                  <span className="bg-secondary text-secondary-foreground group-hover:bg-rock group-hover:text-rock-foreground hidden min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors sm:inline-flex">
                    Use this song
                  </span>
                  <ChevronRight
                    className="text-muted-foreground group-hover:text-rock size-5 shrink-0 transition-[color,transform] group-hover:translate-x-0.5 sm:hidden"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default CandidateList;
