import { useState } from "react";
import { Volume2 } from "lucide-react";
import { extractUniqueChords } from "@/lib/chord-harmony";
import { playChord, playNote, type ChordPlaybackMode } from "@/lib/sound";
import type { SecondVoiceOut } from "@/lib/sheets/schemas";

export interface SecondVoiceViewProps {
  analysis: SecondVoiceOut;
  /** Shared strum/block setting (owned by SheetView); internal strum when absent. */
  chordPlayback?: ChordPlaybackMode;
  onChordPlaybackChange?: (mode: ChordPlaybackMode) => void;
}

function pitch(cell: string | null): string {
  return cell ?? "—";
}

/**
 * Presentational renderer (006 T029, trimmed by 013): the recommended second
 * voice with its harmony lanes and chord-tone table, the note-by-note table,
 * and singing tips. Symbols render verbatim (DR-001: no pitch math outside
 * chord-diagrams.ts); missing-melody rows show "—" with the gate footnote
 * (FR-010), never invented pitches.
 */
export function SecondVoiceView({
  analysis,
  chordPlayback,
  onChordPlaybackChange,
}: SecondVoiceViewProps) {
  const missing = analysis.second_voice.melody_status === "missing";
  // Controlled in production (SheetView owns the shared setting);
  // uncontrolled strum fallback keeps standalone renders working.
  const [internalMode, setInternalMode] = useState<ChordPlaybackMode>("strum");
  const chordMode = chordPlayback ?? internalMode;
  const setChordMode = onChordPlaybackChange ?? setInternalMode;
  // Harmony-table octave (default 4): shifts the chord base and the single
  // tones in "Possible Tones by Chord".
  const [harmonyOctave, setHarmonyOctave] = useState<number>(4);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">Recommended second voice</h3>
        {missing ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              Lead melody not available: the sung melodic line is missing, so no
              exact second voice is proposed.
            </p>
            <p className="text-sm">{analysis.second_voice.strategy}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm">{analysis.second_voice.strategy}</p>
            {analysis.second_voice.up && (
              <p className="text-sm">Above: {analysis.second_voice.up}</p>
            )}
            {analysis.second_voice.down && (
              <p className="text-sm">Below: {analysis.second_voice.down}</p>
            )}
            {analysis.second_voice.recommendation && (
              <p className="text-sm">{analysis.second_voice.recommendation}</p>
            )}
          </div>
        )}

        {/* Practical Vocal Harmony Lanes */}
        <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Vocal Harmony Lanes
          </p>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="bg-card flex flex-col gap-1 rounded-md border p-2.5">
              <span className="text-foreground font-semibold">
                ✨ Bright Lane (3rd Above)
              </span>
              <p className="text-muted-foreground">
                Follow the lead a 3rd above. If lead sings the chord root, sing
                the 3rd; if lead sings the 3rd, sing the 5th.
              </p>
            </div>
            <div className="bg-card flex flex-col gap-1 rounded-md border p-2.5">
              <span className="text-foreground font-semibold">
                🎵 Warm Lane (Under-Harmony)
              </span>
              <p className="text-muted-foreground">
                Sing below the lead voice. Target the chord's 5th below the lead
                (a 4th below the root), or the root when lead sings the 3rd.
              </p>
            </div>
          </div>
        </div>

        {/* Chord Tone Harmony Cheat Sheet */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Possible Tones by Chord
              </p>
              <span className="text-muted-foreground/75 text-[11px]">
                tap any note or chord to hear sound 🔊
              </span>
            </div>
            {/* Harmony octave + playback mode: Strum (default) vs Block */}
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                Octave
                <select
                  aria-label="Harmony octave"
                  data-testid="harmony-octave"
                  value={harmonyOctave}
                  onChange={(e) => setHarmonyOctave(Number(e.target.value))}
                  className="bg-muted/70 border-border text-foreground cursor-pointer rounded-md border px-1.5 py-0.5 text-xs font-medium"
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
              <div
                role="radiogroup"
                aria-label="Chord playback mode"
                className="bg-muted/70 inline-flex items-center rounded-md p-0.5 text-xs"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={chordMode === "strum"}
                  onClick={() => setChordMode("strum")}
                  className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                    chordMode === "strum"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Strum: natural acoustic brush across notes (~25ms)"
                >
                  Strum
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chordMode === "block"}
                  onClick={() => setChordMode("block")}
                  className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                    chordMode === "block"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Block: all notes struck together simultaneously (0ms)"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="bg-muted/50 text-left font-semibold">
                <tr>
                  <th className="border-b px-2.5 py-1.5 whitespace-nowrap">
                    Chord
                  </th>
                  <th className="border-b px-2.5 py-1.5 whitespace-nowrap">
                    Safe Blend Tones
                  </th>
                  <th className="border-b px-2.5 py-1.5 whitespace-nowrap">
                    Color / Leading Tone
                  </th>
                  <th className="border-b px-2.5 py-1.5">Singing Advice</th>
                </tr>
              </thead>
              <tbody>
                {extractUniqueChords(analysis.progression).map((guide) => (
                  <tr
                    key={guide.symbol}
                    className="hover:bg-muted/30 border-b last:border-b-0"
                  >
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          playChord(guide.tones, {
                            mode: chordMode,
                            baseOctave: harmonyOctave,
                          })
                        }
                        className="hover:text-primary group/chord inline-flex cursor-pointer items-center gap-1 font-semibold transition-transform active:scale-95"
                        title={`Play ${guide.symbol} chord (${chordMode}, octave ${harmonyOctave})`}
                        aria-label={`Play ${guide.symbol} chord (${chordMode})`}
                      >
                        <span>{guide.symbol}</span>
                        <Volume2 className="h-3 w-3 opacity-40 transition-opacity group-hover/chord:opacity-100" />
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1.5">
                        {guide.safeTones.map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() =>
                              playNote(tone, { octave: harmonyOctave })
                            }
                            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-medium shadow-xs transition-transform active:scale-95"
                            title={`Play ${tone}${harmonyOctave}`}
                            aria-label={`Play note ${tone}`}
                          >
                            <span>{tone}</span>
                            <Volume2 className="h-2.5 w-2.5 opacity-40" />
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            playNote(guide.flavorTone, {
                              octave: harmonyOctave,
                            })
                          }
                          className="bg-primary/10 hover:bg-primary/20 text-primary inline-flex w-fit cursor-pointer items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-bold transition-transform active:scale-95"
                          title={`Play ${guide.flavorTone}${harmonyOctave} (color)`}
                          aria-label={`Play color note ${guide.flavorTone}`}
                        >
                          <span>{guide.flavorTone}</span>
                          <Volume2 className="h-2.5 w-2.5 opacity-60" />
                        </button>
                        <span className="text-muted-foreground text-[11px] leading-tight">
                          {guide.flavorDescription}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-2.5 py-1.5 text-xs">
                      {guide.advice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">Note-by-note table</h3>
        <details className="group rounded-lg border p-2.5 open:p-3">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium select-none">
            View phrase-by-phrase table ({analysis.note_table.length} phrases)
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    Section
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    Snippet
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    Chord
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    1st voice
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    2nd voice
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    Interval
                  </th>
                  <th className="border-b px-2 py-1.5 text-left font-semibold">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.note_table.map((row, i) => (
                  <tr
                    key={`${row.section}-${i}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {row.section}
                    </td>
                    <td className="max-w-40 px-2 py-1 align-top">
                      {row.lyric_snippet}
                    </td>
                    <td className="px-2 py-1 align-top font-medium whitespace-nowrap">
                      {row.chord}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {pitch(row.first_voice)}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {pitch(row.second_voice)}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {pitch(row.interval)}
                    </td>
                    <td className="min-w-40 px-2 py-1 align-top">
                      {row.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing && (
            <p className="text-muted-foreground mt-2 text-xs">
              No melody, so no exact pitches are invented (FR-010).
            </p>
          )}
        </details>
      </section>
      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="text-sm font-semibold">Singing tips</h3>
        <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm">
          {analysis.singing_tips.map((tip, i) => (
            <li key={`${tip.slice(0, 24)}-${i}`}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default SecondVoiceView;
