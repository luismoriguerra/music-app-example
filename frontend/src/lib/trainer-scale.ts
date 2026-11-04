/**
 * Pure scale-at-transpose resolver for the 1st-voice trainer (008, FR-004).
 *
 * Priority: picker override → analysis key → most-frequent-root heuristic.
 * The input sheet is already transposed (`displaySheet`), so the heuristic
 * winner IS the transposed tonic and `transpose` is recorded as provenance.
 * Zero UI/Astro imports (Principle VIII). An unspellable analysis key falls
 * through to the heuristic; throws (bad override, bad transpose, unresolvable
 * sheet) map to view states in the caller.
 */
import {
  parseChordSymbol,
  TRANSPOSE_MAX,
  TRANSPOSE_MIN,
} from "./chord-diagrams";
import { SPELLING_PITCH } from "./notes";
import { scaleSpelling } from "./scales";
import { normalizeChordPositions } from "./sheets";
import type { Sheet } from "./sheets/schemas";

export type TrainerScaleMode = "major" | "minor";
export type TrainerScaleSource = "analysis" | "heuristic" | "picker";

export interface SelectedScaleAtTranspose {
  tonic: string;
  mode: TrainerScaleMode;
  notes: readonly string[];
  transpose: number;
  source: TrainerScaleSource;
  rootPitch: number;
}

export interface TrainerAnalysisKey {
  tonic: string;
  mode: TrainerScaleMode;
  scale: readonly string[];
}

export interface TrainerScaleOverride {
  tonic: string;
  mode: TrainerScaleMode;
}

export interface ResolveTrainerScaleArgs {
  displaySheet: Sheet;
  transpose: number;
  analysisKey?: TrainerAnalysisKey | null;
  override?: TrainerScaleOverride | null;
}

function assertValidTranspose(transpose: number): void {
  if (
    !Number.isInteger(transpose) ||
    transpose < TRANSPOSE_MIN ||
    transpose > TRANSPOSE_MAX
  ) {
    throw new Error(
      `transpose ${String(transpose)} out of range (${TRANSPOSE_MIN}..${TRANSPOSE_MAX})`,
    );
  }
}

function pitchOfTonic(tonic: string, where: string): number {
  const pitch = SPELLING_PITCH[tonic.trim()];
  if (pitch === undefined) {
    throw new Error(`unknown tonic "${tonic}" in ${where}`);
  }
  return pitch;
}

function assertValidMode(
  mode: string,
  where: string,
): asserts mode is TrainerScaleMode {
  if (mode !== "major" && mode !== "minor") {
    throw new Error(`unknown mode "${mode}" in ${where}`);
  }
}

function fromTonicAndMode(
  tonic: string,
  mode: string,
  transpose: number,
  source: TrainerScaleSource,
  where: string,
): SelectedScaleAtTranspose {
  assertValidMode(mode, where);
  const rootPitch = pitchOfTonic(tonic, where);
  const row = scaleSpelling(rootPitch, mode);
  return {
    tonic: row.displaySpelling,
    mode,
    notes: row.notes,
    transpose,
    source,
    rootPitch,
  };
}

interface RootVote {
  count: number;
  minor: number;
  major: number;
  firstSeen: number;
}

function heuristicScale(
  displaySheet: Sheet,
  transpose: number,
): SelectedScaleAtTranspose {
  const votes = new Map<number, RootVote>();
  let order = 0;
  for (const section of displaySheet.body.sections) {
    for (const line of section.lines) {
      for (const chord of normalizeChordPositions(line)) {
        const parsed = parseChordSymbol(chord.symbol);
        if (!parsed) continue;
        const pc = parsed.rootPitch;
        let vote = votes.get(pc);
        if (!vote) {
          vote = { count: 0, minor: 0, major: 0, firstSeen: order++ };
          votes.set(pc, vote);
        }
        vote.count += 1;
        const hasMinorThird = parsed.pitchClasses.includes((pc + 3) % 12);
        const hasMajorThird = parsed.pitchClasses.includes((pc + 4) % 12);
        if (hasMinorThird && !hasMajorThird) vote.minor += 1;
        else if (hasMajorThird && !hasMinorThird) vote.major += 1;
      }
    }
  }
  if (votes.size === 0) {
    throw new Error(
      "no scale could be determined: sheet has no parseable chords",
    );
  }
  let winner = -1;
  let best: RootVote | null = null;
  for (const [pc, vote] of votes) {
    if (
      !best ||
      vote.count > best.count ||
      (vote.count === best.count && vote.firstSeen < best.firstSeen)
    ) {
      winner = pc;
      best = vote;
    }
  }
  const mode: TrainerScaleMode =
    best && best.minor > best.major ? "minor" : "major";
  const row = scaleSpelling(winner, mode);
  return {
    tonic: row.displaySpelling,
    mode,
    notes: row.notes,
    transpose,
    source: "heuristic",
    rootPitch: winner,
  };
}

export function resolveTrainerScale({
  displaySheet,
  transpose,
  analysisKey = null,
  override = null,
}: ResolveTrainerScaleArgs): SelectedScaleAtTranspose {
  assertValidTranspose(transpose);
  if (override) {
    return fromTonicAndMode(
      override.tonic,
      override.mode,
      transpose,
      "picker",
      "scale override",
    );
  }
  if (analysisKey && analysisKey.scale.length > 0) {
    try {
      return fromTonicAndMode(
        analysisKey.tonic,
        analysisKey.mode,
        transpose,
        "analysis",
        "analysis key",
      );
    } catch {
      // Analysis is a hint, heuristic is the floor: the schema accepts
      // spellings SPELLING_PITCH doesn't know (E#, Fb, B#, double
      // accidentals), so an unspellable analysis falls through instead of
      // throwing the panel into its empty state.
    }
  }
  return heuristicScale(displaySheet, transpose);
}

export interface TrainerScaleOption {
  tonic: string;
  mode: TrainerScaleMode;
  label: string;
}

/**
 * The 24 picker scales (12 tonics × major/minor) with conventional
 * display spellings. Every tonic is a valid `TrainerScaleOverride`.
 */
export function listTrainerScaleOptions(): readonly TrainerScaleOption[] {
  const modes: readonly TrainerScaleMode[] = ["major", "minor"];
  const out: TrainerScaleOption[] = [];
  for (const mode of modes) {
    for (let rootPitch = 0; rootPitch < 12; rootPitch += 1) {
      const row = scaleSpelling(rootPitch, mode);
      out.push({
        tonic: row.displaySpelling,
        mode,
        label: `${row.displaySpelling} ${mode}`,
      });
    }
  }
  return out;
}
