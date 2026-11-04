export interface SecondVoiceHowToMixOption {
  label: string;
  hint: string;
}

export interface SecondVoiceHowToProps {
  /** Reference-audio choices exactly as the trainer's control labels them. */
  mixOptions: readonly SecondVoiceHowToMixOption[];
  /** Difficulty levels exactly as the trainer's tabs label them, easiest first. */
  levels: readonly string[];
}

/**
 * "How to practice" guide (013 US5, FR-017): a collapsed-by-default disclosure
 * that explains the trainer in plain language. Stateless and presentational;
 * the control labels arrive as props, so the copy cannot drift from them.
 */
export function SecondVoiceHowTo({
  mixOptions,
  levels,
}: SecondVoiceHowToProps) {
  return (
    <details
      data-testid="second-voice-howto"
      className="rounded-lg border p-2.5 open:p-3"
    >
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium select-none">
        How to practice
      </summary>
      <div className="text-muted-foreground mt-2 flex flex-col gap-2 text-xs">
        <ol className="flex list-decimal flex-col gap-2 pl-4">
          <li>
            <span className="text-foreground font-medium">Set up.</span> The key
            is shown above; to change it, use the Tr. stepper above the tabs.
            Pick the Octave that sits comfortably in your voice and a Tempo you
            can follow. Start slow.
          </li>
          <li>
            <span className="text-foreground font-medium">
              Choose what you hear
            </span>{" "}
            under Reference audio:
            <ul className="mt-1 mb-1 flex list-disc flex-col gap-0.5 pl-4">
              {mixOptions.map((option) => (
                <li key={option.label}>
                  <span className="text-foreground font-medium">
                    {option.label}
                  </span>
                  : {option.hint}
                </li>
              ))}
            </ul>
            A good order: hear both voices, learn your part alone, then sing it
            against the lead only.
          </li>
          <li>
            <span className="text-foreground font-medium">Practice.</span> Play
            runs an exercise once. Loop repeats it; choose the number of rounds
            beside it. Stop or Esc halts it. Tap a step to hear only that step,
            as set by Reference audio.
          </li>
          <li>
            <span className="text-foreground font-medium">Move up.</span> When a
            level feels easy, go to the next one ({levels.join(", ")}).
          </li>
        </ol>
        <p>
          Each step reads Lead, You, and the interval between them, counted in
          this key&apos;s scale. The lead is a practice line in the song&apos;s
          key, not the song&apos;s own melody.
        </p>
      </div>
    </details>
  );
}
