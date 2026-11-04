import type { DegradedEntry, SourceLink } from "@/lib/sheets/schemas";

export interface SourceLinksProps {
  links: readonly SourceLink[];
  degraded?: readonly DegradedEntry[];
}

/** Label fallback for dead/label-less links: host + path without scheme. */
function displayLabel(link: SourceLink): string {
  if (link.label && link.label.trim()) return link.label;
  try {
    const url = new URL(link.url);
    return `${url.host}${url.pathname}`.replace(/\/$/, "") || link.url;
  } catch {
    return link.url;
  }
}

function kindLabel(kind: string): string | null {
  switch (kind) {
    case "video":
      return "Video";
    case "chords":
      return "Chords";
    case "lyrics":
      return "Lyrics";
    default:
      return null;
  }
}

/**
 * Presentational FR-016 outbound links (T041, 004, US2): provider/label rows
 * opening outside the app, empty state, video-degradation notice.
 */
export function SourceLinks({ links, degraded = [] }: SourceLinksProps) {
  const videoDegraded = degraded.find((d) => d.part === "video");
  const enrichDegraded = degraded.find((d) => d.part === "enrichment");

  if (links.length === 0 && !videoDegraded && !enrichDegraded) {
    return (
      <div role="status" className="text-muted-foreground text-sm">
        No other sources found for this song.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Other sources">
          {links.map((link) => (
            <li key={link.url} className="min-w-0">
              <a
                href={link.url}
                target="_blank"
                rel="noopener"
                className="text-primary text-sm break-all underline underline-offset-2 hover:opacity-80"
              >
                {kindLabel(link.kind) ? (
                  <span className="text-muted-foreground mr-1.5 text-xs font-semibold tracking-wider uppercase">
                    [{kindLabel(link.kind)}]
                  </span>
                ) : null}
                {displayLabel(link)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div role="status" className="text-muted-foreground text-sm">
          No other sources found for this song.
        </div>
      )}
      {videoDegraded && (
        <div role="status" className="text-muted-foreground text-sm">
          Video links unavailable ({videoDegraded.reason}); page links above are
          intact.
        </div>
      )}
      {enrichDegraded && (
        <div role="status" className="text-muted-foreground text-xs">
          Additional search enrichment was unavailable ({enrichDegraded.reason}
          ).
        </div>
      )}
    </div>
  );
}

export default SourceLinks;
