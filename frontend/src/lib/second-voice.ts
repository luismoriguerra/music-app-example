import type { SecondVoiceSnapshot, Sheet } from "./sheets/schemas";

/**
 * Pure second-voice helpers (006, DR-001/R10): build the transposed snapshot
 * the panel POSTs and derive stale state. Zero Astro/UI imports (Principle
 * VIII).
 *
 * This module NEVER transposes: it reads the already-transposed `displaySheet`
 * `SheetView` derives and copies symbols verbatim.
 */

/** Build the analyze-request snapshot from the displayed sheet (DR-001). */
export function buildSnapshot(
  displaySheet: Sheet,
  transpose: number,
): SecondVoiceSnapshot {
  return {
    transpose,
    chords_by_line: displaySheet.body.sections.flatMap((section, si) =>
      section.lines.map((line, li) => ({
        section: si,
        line: li,
        chords: line.chords.map((chord) => ({
          offset: chord.offset,
          symbol: chord.symbol,
        })),
      })),
    ),
  };
}

/** Stale is derived, never stored: open offset vs current stepper (FR-008). */
export function isAnalysisStale(
  open: { transpose: number } | null | undefined,
  currentTranspose: number,
): boolean {
  if (open === null || open === undefined) return false;
  return open.transpose !== currentTranspose;
}
