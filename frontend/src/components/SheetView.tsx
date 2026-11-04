import { useId, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { getChordHarmony } from "@/lib/chord-harmony";
import { diagramToMidis, playChord, playMidiChord } from "@/lib/sound";
import { useChordPlaybackMode } from "@/lib/use-chord-playback";
import { ChordPopover } from "@/components/ChordPopover";
import { SecondVoicePanel } from "@/components/SecondVoicePanel";
import { SecondVoiceTrainer } from "@/components/SecondVoiceTrainer";
import { TrainerPanel } from "@/components/TrainerPanel";
import { TransposeControl } from "@/components/TransposeControl";
import { resolveSheetChords, transposeSheet } from "@/lib/chord-diagrams";
import { normalizeChordPositions, type CatalogChord } from "@/lib/sheets";
import type { SecondVoiceAnalysis, Sheet } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";

type SheetTab = "sheet" | "analysis" | "trainer";

export interface SheetViewProps {
  sheet: Sheet;
  catalog: readonly CatalogChord[];
  /** Backend base URL. Defaults to PUBLIC_API_URL (or localhost:8000). */
  apiBaseUrl?: string;
}

function resolveApiBase(override?: string): string {
  const raw =
    override?.trim() ||
    (import.meta.env?.PUBLIC_API_URL as string | undefined)?.trim() ||
    "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

function sourceLabel(source: string): string {
  if (source === "chart") return "Ultimate Guitar";
  if (source === "lrclib") return "LRCLIB";
  if (source === "lyrics_ovh") return "lyrics.ovh";
  return "Source";
}

/**
 * Presentational sheet (T040, 004): identity, sections, chords-above-lyrics
 * by offset, per-part attribution atop, chords-missing notice, inline chord
 * symbols that reveal their fingering diagram on hover/tap (M2 as amended
 * 2026-09-16) with diagram-unavailable tags for unvoiceable symbols, plus a
 * right-side chord reference column stacking every unique song chord
 * (catalog diagrams first, generated fingerings for off-catalog symbols). A
 * transpose stepper above the tabs shifts every displayed chord (inline +
 * reference) by semitones from the original key, with Reset/-3/+3 shortcuts
 * for larger jumps. Three tabs split the page, in order: "Lyrics + Chords"
 * (the sheet), "1st-voice trainer" (008 scale-aware vocal exercises with
 * reference audio), and "AI 2nd voice analyzer" (013 2nd-voice trainer
 * drills above the 006 analysis of the transposed chords, auto-generated on
 * first visit when the song has no saved analysis). Panels mount on first
 * visit, then stay mounted with `hidden` so runs, history, and trainer state
 * survive tab switches.
 * Lyrics-only sheets show Lyrics + Chords + Trainer (analysis stays
 * chord-gated).
 *
 * Keyed by `sheet.id`: a different song remounts the whole view, so
 * transpose, tab, and the analysis panel reset synchronously — no stale
 * frame under the new sheet, no orphaned history request.
 *
 * Chord audio (FR-013 as amended 2026-09-18): activating any voiceable
 * chord sounds its exact displayed uke voicing; the strum/block setting
 * is owned here and shared with the analysis table.
 */
export function SheetView(props: SheetViewProps) {
  return <SheetViewInner key={props.sheet.id} {...props} />;
}

function SheetViewInner({ sheet, catalog, apiBaseUrl }: SheetViewProps) {
  const chordsMissing = sheet.chord_source === "none";
  const [transpose, setTranspose] = useState(0);
  const [tab, setTab] = useState<SheetTab>("sheet");
  const [hasVisitedAnalysis, setHasVisitedAnalysis] = useState(false);
  const [hasVisitedTrainer, setHasVisitedTrainer] = useState(false);
  // Open AI analysis for the trainer's analysis-key path (008 FR-004).
  // Reset per song via the key={sheet.id} remount above.
  const [openAnalysis, setOpenAnalysis] = useState<SecondVoiceAnalysis | null>(
    null,
  );
  // Single owner of the strum/block chord-audio setting, shared by the
  // sheet chords below and the analysis table (persisted to localStorage).
  const [chordMode, setChordMode] = useChordPlaybackMode();
  const uid = useId().replace(/:/g, "");
  const sheetTabId = `sheet-${uid}-tab-sheet`;
  const analysisTabId = `sheet-${uid}-tab-analysis`;
  const trainerTabId = `sheet-${uid}-tab-trainer`;
  const sheetPanelId = `sheet-${uid}-panel-sheet`;
  const analysisPanelId = `sheet-${uid}-panel-analysis`;
  const trainerPanelId = `sheet-${uid}-panel-trainer`;
  const displaySheet = useMemo(
    () => transposeSheet(sheet, transpose),
    [sheet, transpose],
  );
  // The analysis key applies only at its own transpose (same guard as the
  // analysis stale marking); otherwise the trainer falls back to the
  // transposed-tonic heuristic.
  const trainerAnalysisKey =
    openAnalysis && openAnalysis.transpose === transpose
      ? {
          tonic: openAnalysis.analysis.key.tonic,
          mode: openAnalysis.analysis.key.mode,
          scale: [...openAnalysis.analysis.scale],
        }
      : null;
  const reference = resolveSheetChords(displaySheet, catalog);
  const diagramBySymbol = new Map(
    reference.map((entry) => [entry.symbol.replace(/\s+/g, ""), entry.diagram]),
  );

  const tabOrder: SheetTab[] = chordsMissing
    ? ["sheet", "trainer"]
    : ["sheet", "trainer", "analysis"];

  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const direction = e.key === "ArrowRight" ? 1 : -1;
    const next =
      tabOrder[
        (tabOrder.indexOf(tab) + direction + tabOrder.length) % tabOrder.length
      ] ?? "sheet";
    setTab(next);
    if (next === "analysis") setHasVisitedAnalysis(true);
    if (next === "trainer") setHasVisitedTrainer(true);
    document
      .getElementById(
        next === "sheet"
          ? sheetTabId
          : next === "analysis"
            ? analysisTabId
            : trainerTabId,
      )
      ?.focus();
  }

  const sheetContent = (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {displaySheet.body.sections.map((section, si) => (
          <section
            key={si}
            aria-label={section.heading ?? `Section ${si + 1}`}
            className="flex flex-col gap-2"
          >
            {section.heading && (
              <h3 className="text-sm font-semibold">{section.heading}</h3>
            )}
            <div className="flex flex-col gap-3">
              {section.lines.map((line, li) => {
                const chords = normalizeChordPositions(line);
                return (
                  <div key={li} className="flex flex-col gap-0.5">
                    {chords.length > 0 && (
                      <div
                        role="group"
                        className="flex flex-wrap gap-x-3 gap-y-0.5"
                        aria-label="Chords"
                      >
                        {chords.map((chord, ci) => {
                          const diagram =
                            diagramBySymbol.get(
                              chord.symbol.replace(/\s+/g, ""),
                            ) ?? null;
                          return (
                            <span
                              key={ci}
                              data-chord={chord.symbol}
                              className="inline-flex items-center gap-1 text-xs font-medium"
                            >
                              {diagram ? (
                                <ChordPopover
                                  symbol={chord.symbol}
                                  diagram={diagram}
                                  offset={chord.offset}
                                  playbackMode={chordMode}
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    data-offset={chord.offset}
                                    onClick={() => {
                                      const guide = getChordHarmony(
                                        chord.symbol,
                                      );
                                      playChord(guide.tones, {
                                        mode: chordMode,
                                      });
                                    }}
                                    className="hover:text-primary cursor-pointer rounded-sm underline decoration-dotted underline-offset-2 active:scale-95"
                                    title={`Play ${chord.symbol} chord`}
                                    aria-label={`${chord.symbol} chord (no diagram)`}
                                  >
                                    {chord.symbol}
                                  </button>
                                  <span className="text-muted-foreground text-[10px]">
                                    (no diagram)
                                  </span>
                                </>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{line.text}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {reference.length > 0 && (
        <aside
          aria-label="Chord reference"
          data-testid="chord-reference"
          className="w-full shrink-0 lg:sticky lg:top-4 lg:w-56 xl:w-64"
        >
          <h3 className="mb-3 text-sm font-semibold">
            Chords in this song ({reference.length})
          </h3>
          <ul className="flex flex-col gap-4">
            {reference.map(({ symbol, diagram, source }) => (
              <li
                key={symbol}
                data-chord-ref={symbol}
                data-source={source}
                className="flex flex-col gap-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (diagram) {
                      playMidiChord(diagramToMidis(diagram), {
                        mode: chordMode,
                      });
                    } else {
                      // Unvoiceable symbol: fall back to abstract chord tones.
                      const guide = getChordHarmony(symbol);
                      playChord(guide.tones, { mode: chordMode });
                    }
                  }}
                  className="hover:text-primary group/ref inline-flex w-fit cursor-pointer items-center gap-1.5 text-left text-sm font-medium transition-transform active:scale-95"
                  title={`Play ${symbol} chord (${chordMode})`}
                  aria-label={`Play ${symbol} chord (${chordMode})`}
                >
                  <span>{symbol}</span>
                  <Volume2 className="h-3 w-3 opacity-40 transition-opacity group-hover/ref:opacity-100" />
                </button>
                <ChordDiagram name={symbol} diagram={diagram} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );

  return (
    <article
      aria-label={`${sheet.matched_title} sheet`}
      className="flex w-full max-w-full min-w-0 flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">
          {sheet.matched_title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {sheet.matched_performer}
        </p>
        {(sheet.capo || sheet.tuning_note) && (
          <p className="text-muted-foreground text-xs">
            {sheet.capo && <span>Capo {sheet.capo}</span>}
            {sheet.capo && sheet.tuning_note && <span> · </span>}
            {sheet.tuning_note && <span>Tuning {sheet.tuning_note}</span>}
          </p>
        )}
      </header>

      {sheet.context && (
        <section
          data-testid="song-context-block"
          aria-label="About this song"
          className="bg-card/50 flex flex-col gap-1.5 rounded-xl border p-3.5 text-sm"
        >
          <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
            <span>About this song</span>
            {sheet.context.source_url ? (
              <a
                href={sheet.context.source_url}
                target="_blank"
                rel="noopener"
                className="text-primary hover:underline"
              >
                Source: {sheet.context.source || "Wikipedia"}
              </a>
            ) : (
              <span>Source: {sheet.context.source || "Wikipedia"}</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {sheet.context.text}
          </p>
        </section>
      )}

      <div
        data-testid="sheet-attribution"
        className="bg-card flex flex-col gap-1 rounded-xl border p-3 text-sm"
      >
        <p>
          <span className="font-medium">Lyrics:</span>{" "}
          <a
            href={sheet.lyric_source_url}
            target="_blank"
            rel="noopener"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {sourceLabel(sheet.lyric_source)}
          </a>
        </p>
        <p>
          <span className="font-medium">Chords:</span>{" "}
          {sheet.chord_source === "model-generated" ? (
            <span>
              model-generated{sheet.model_id ? ` (${sheet.model_id})` : ""}
            </span>
          ) : sheet.chord_source === "none" ? (
            <span>unavailable</span>
          ) : sheet.chord_source_url ? (
            <a
              href={sheet.chord_source_url}
              target="_blank"
              rel="noopener"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {sourceLabel(sheet.lyric_source)}
            </a>
          ) : (
            <span>{sheet.chord_source}</span>
          )}
        </p>
      </div>

      {chordsMissing && (
        <div
          role="status"
          className="text-muted-foreground rounded-xl border p-3 text-sm"
        >
          No chords found for this song — lyrics only. Try regenerating later or
          check the sources below.
        </div>
      )}

      {!chordsMissing && (
        <div className="flex flex-wrap items-center gap-3">
          <TransposeControl value={transpose} onChange={setTranspose} />
          {transpose !== 0 && (
            <p className="text-muted-foreground text-xs">
              Showing chords transposed{" "}
              {transpose > 0 ? `+${transpose}` : transpose} semitone
              {Math.abs(transpose) === 1 ? "" : "s"} from the original key
            </p>
          )}
        </div>
      )}
      <>
        <div
          role="tablist"
          aria-label="Sheet views"
          className="bg-muted inline-flex h-9 w-fit max-w-full items-center justify-center overflow-x-auto rounded-lg p-[3px]"
        >
          <button
            type="button"
            role="tab"
            id={sheetTabId}
            aria-selected={tab === "sheet"}
            aria-controls={sheetPanelId}
            tabIndex={tab === "sheet" ? 0 : -1}
            data-state={tab === "sheet" ? "active" : "inactive"}
            data-testid="sheet-tab-sheet"
            onClick={() => setTab("sheet")}
            onKeyDown={onTabKeyDown}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
              tab === "sheet"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lyrics + Chords
          </button>
          <button
            type="button"
            role="tab"
            id={trainerTabId}
            aria-selected={tab === "trainer"}
            aria-controls={trainerPanelId}
            tabIndex={tab === "trainer" ? 0 : -1}
            data-state={tab === "trainer" ? "active" : "inactive"}
            data-testid="sheet-tab-trainer"
            onClick={() => {
              setTab("trainer");
              setHasVisitedTrainer(true);
            }}
            onKeyDown={onTabKeyDown}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
              tab === "trainer"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            1st-voice trainer
          </button>
          {!chordsMissing && (
            <button
              type="button"
              role="tab"
              id={analysisTabId}
              aria-selected={tab === "analysis"}
              aria-controls={analysisPanelId}
              tabIndex={tab === "analysis" ? 0 : -1}
              data-state={tab === "analysis" ? "active" : "inactive"}
              data-testid="sheet-tab-analysis"
              onClick={() => {
                setTab("analysis");
                setHasVisitedAnalysis(true);
              }}
              onKeyDown={onTabKeyDown}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
                tab === "analysis"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              AI 2nd voice analyzer
            </button>
          )}
        </div>
        <div
          role="tabpanel"
          id={sheetPanelId}
          aria-labelledby={sheetTabId}
          hidden={tab !== "sheet"}
        >
          {sheetContent}
        </div>
        <div
          role="tabpanel"
          id={trainerPanelId}
          aria-labelledby={trainerTabId}
          hidden={tab !== "trainer"}
        >
          {hasVisitedTrainer && (
            <TrainerPanel
              displaySheet={displaySheet}
              transpose={transpose}
              active={tab === "trainer"}
              analysisKey={trainerAnalysisKey}
            />
          )}
        </div>
        {!chordsMissing && (
          <div
            role="tabpanel"
            id={analysisPanelId}
            aria-labelledby={analysisTabId}
            hidden={tab !== "analysis"}
          >
            {hasVisitedAnalysis && (
              <>
                <SecondVoiceTrainer
                  displaySheet={displaySheet}
                  transpose={transpose}
                  analysisKey={trainerAnalysisKey}
                  active={tab === "analysis"}
                />
                <SecondVoicePanel
                  displaySheet={displaySheet}
                  transpose={transpose}
                  apiBaseUrl={resolveApiBase(apiBaseUrl)}
                  chordPlayback={chordMode}
                  onChordPlaybackChange={setChordMode}
                  onOpenAnalysisChange={setOpenAnalysis}
                />
              </>
            )}
          </div>
        )}
      </>
    </article>
  );
}

export default SheetView;
