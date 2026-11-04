import { z } from "zod";
import { isChordSymbol } from "../sheets";

/**
 * Zod mirrors of contracts/rest-api.md (T008, 004). The island validates every
 * backend response with these schemas; the valid/invalid fixtures in
 * tests/sheets.schemas.test.ts double as contract tests. Zero Astro imports
 * (Principle VIII).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuid = z.string().regex(UUID_RE, "must be a uuid");

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be an ISO datetime");

const isHttpsUrl = (s: string): boolean => {
  if (!s.startsWith("https://")) return false;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
};

const httpsUrl = (field: string) =>
  z.string().refine(isHttpsUrl, `${field} must be an https URL`);

const trimmedQuery = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => s === s.trim() && s.trim().length > 0, {
    message: "must be 1–200 chars, trimmed",
  });

const identityField = (field: string) =>
  z
    .string()
    .min(1)
    .max(200)
    .refine((s) => s === s.trim() && s.length > 0, {
      message: `${field} must be 1–200 chars, trimmed`,
    });

export const lyricSourceSchema = z.enum(["chart", "lrclib", "lyrics_ovh"]);
export const chordSourceSchema = z.enum(["chart", "model-generated", "none"]);
export const sourceKindSchema = z.enum([
  "lyrics",
  "chords",
  "video",
  "context",
]);
export const degradedPartSchema = z.enum(["video", "chords", "enrichment"]);
export const degradedReasonSchema = z.enum(["quota", "timeout", "unavailable"]);
export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NO_MATCH",
  "NOT_FOUND",
  "PROVIDER_ERROR",
]);

export const providerRefsSchema = z
  .object({
    lrclib_id: z.number().int().optional(),
    genius_id: z.number().int().optional(),
    chart_url: z.string().optional(),
    duckduckgo: z.string().optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: "at least one provider ref must be present",
  });

export const candidateSchema = z.object({
  title: identityField("title"),
  artist: identityField("artist"),
  album: z.string().max(200).nullable(),
  artwork_url: httpsUrl("artwork_url").nullable(),
  provider_refs: providerRefsSchema,
});

export const songSearchRequestSchema = z.object({ query: trimmedQuery });

export const songSearchResponseSchema = z.object({
  candidates: z.array(candidateSchema),
});

export const chordPositionSchema = z.object({
  offset: z.number().int().min(0),
  symbol: z
    .string()
    .refine((s) => isChordSymbol(s), "must be standard Western notation"),
});

export const sheetLineSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .refine((s) => s.trim().length > 0, "lyric line must be non-blank"),
    chords: z.array(chordPositionSchema),
  })
  .refine((line) => line.chords.every((c) => c.offset <= line.text.length), {
    message: "chord offset exceeds line width (UTF-16 code units)",
  });

export const sheetSectionSchema = z.object({
  heading: z.string().nullable(),
  lines: z.array(sheetLineSchema).min(1),
});

export const sheetBodySchema = z.object({
  sections: z.array(sheetSectionSchema).min(1),
});

export const sourceLinkSchema = z.object({
  label: z.string().min(1),
  url: httpsUrl("source link url"),
  kind: sourceKindSchema,
});

export const degradedEntrySchema = z.object({
  part: degradedPartSchema,
  reason: degradedReasonSchema,
});

export const songContextSchema = z.object({
  text: z.string().min(1).max(600),
  source: z.string().min(1),
  source_url: httpsUrl("context.source_url"),
});

const countChords = (body: z.infer<typeof sheetBodySchema>): number =>
  body.sections.reduce(
    (n, section) =>
      n + section.lines.reduce((m, line) => m + line.chords.length, 0),
    0,
  );

export const sheetSchema = z
  .object({
    id: uuid,
    query: trimmedQuery,
    matched_title: identityField("matched_title"),
    matched_performer: identityField("matched_performer"),
    lyric_source: lyricSourceSchema,
    lyric_source_url: httpsUrl("lyric_source_url"),
    chord_source: chordSourceSchema,
    chord_source_url: httpsUrl("chord_source_url").nullable(),
    model_id: z.string().min(1).max(200).nullable(),
    body: sheetBodySchema,
    source_links: z.array(sourceLinkSchema).max(8),
    degraded: z.array(degradedEntrySchema),
    context: songContextSchema.nullable().default(null).optional(),
    capo: z.string().max(200).nullable(),
    tuning_note: z.string().max(200).nullable(),
    created_at: isoDateTime,
  })
  .superRefine((sheet, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const hasModel =
      typeof sheet.model_id === "string" && sheet.model_id.trim().length > 0;
    const hasUrl = sheet.chord_source_url !== null;
    if (sheet.chord_source === "chart" && !(hasUrl && !hasModel)) {
      fail("chord_source 'chart' ⟺ url present AND model_id NULL");
    }
    if (sheet.chord_source === "model-generated" && !(hasModel && !hasUrl)) {
      fail("chord_source 'model-generated' ⟺ model_id present AND url NULL");
    }
    const totalChords = countChords(sheet.body);
    if (sheet.chord_source === "none") {
      if (hasModel || hasUrl) {
        fail("chord_source 'none' ⟺ model_id AND url both NULL");
      }
      if (totalChords !== 0) {
        fail("chord_source 'none' requires a zero-chord body");
      }
      if (
        !sheet.degraded.some(
          (d) =>
            d.part === "chords" &&
            (d.reason === "timeout" || d.reason === "unavailable"),
        )
      ) {
        fail("chord_source 'none' requires a degraded chords entry");
      }
    } else if (totalChords < 1) {
      fail("a zero-chord body is legal only as chord_source 'none'");
    }
    const urls = sheet.source_links.map((l) => l.url);
    if (new Set(urls).size !== urls.length) {
      fail("source_links urls must be unique");
    }
    const attribution = new Set(
      [sheet.lyric_source_url, sheet.chord_source_url].filter(
        (u): u is string => u !== null,
      ),
    );
    if (urls.some((u) => attribution.has(u))) {
      fail("source_links must dedupe against attribution URLs");
    }
  });

export const historyEntrySchema = z.object({
  id: uuid,
  query: trimmedQuery,
  matched_title: identityField("matched_title"),
  matched_performer: identityField("matched_performer"),
  sheet_id: uuid,
  favorite: z.boolean(),
  created_at: isoDateTime,
});

export const historyListResponseSchema = z.object({
  entries: z.array(historyEntrySchema),
  total: z.number().int().min(0),
});

export const historyGetResponseSchema = z.object({
  entry_id: uuid,
  favorite: z.boolean(),
  sheet: sheetSchema,
});

export const generateSheetResponseSchema = z.object({
  entry_id: uuid,
  sheet: sheetSchema,
});

export const regenerateResponseSchema = z.object({
  entry_id: uuid,
  sheet: sheetSchema,
});

export const errorSchema = z.object({
  error: z.object({ code: errorCodeSchema, message: z.string().min(1) }),
});

/* ------------------------------------------------------------------ */
/* Second-voice analysis (006) — mirrors contracts/rest-api.md + R1.    */
/* ------------------------------------------------------------------ */

const NOTE_NAME_RE = /^[A-G](?:#{1,2}|b{1,2})?$/;

const noteName = (field: string) =>
  z
    .string()
    .refine(
      (s) => NOTE_NAME_RE.test(s.trim()),
      `${field} must be an Anglo note name`,
    );

/** Stepper provenance: ±12 is the identity, so ±11 (004 TRANSPOSE_MIN/MAX). */
export const transposeOffsetSchema = z.number().int().min(-11).max(11);

const snapshotChordSchema = z.object({
  offset: z.number().int().min(0),
  symbol: z
    .string()
    .refine((s) => isChordSymbol(s), "must be standard Western notation"),
});

export const snapshotLineSchema = z
  .object({
    section: z.number().int().min(0),
    line: z.number().int().min(0),
    chords: z.array(snapshotChordSchema),
  })
  .strict();

/** Analyze request: the rendered transposed snapshot + provenance (DR-001). */
export const secondVoiceSnapshotSchema = z.object({
  transpose: transposeOffsetSchema,
  chords_by_line: z.array(snapshotLineSchema).min(1),
});

const chordSymbolField = (field: string) =>
  z
    .string()
    .refine(
      (s) => isChordSymbol(s),
      `${field} must be standard Western notation`,
    );

export const secondVoiceKeySchema = z.object({
  tonic: noteName("key.tonic"),
  mode: z.enum(["major", "minor"]),
  justification: z.string().min(1).max(600),
});

export const diatonicChordSchema = z.object({
  degree: z.string().min(1),
  chord: chordSymbolField("diatonic chord"),
});

const DIATONIC_DEGREES_BY_MODE = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
} as const;

export const progressionRowSchema = z.object({
  section: z.string().min(1).max(80),
  chords: z.array(chordSymbolField("progression chord")).min(1),
  degrees: z.array(z.string().min(1)).min(1),
});

export const specialChordSchema = z.object({
  chord: chordSymbolField("special chord"),
  function: z.string().min(1).max(600),
});

export const cadenceSchema = z.object({
  name: z.string().min(1).max(80),
  chords: z.array(chordSymbolField("cadence chord")).min(1),
  location: z.string().min(1).max(160),
});

export const sectionFeelSchema = z.object({
  section: z.string().min(1).max(80),
  feeling: z.string().min(1).max(480),
});

export const secondVoiceProposalSchema = z.object({
  melody_status: z.enum(["missing", "present"]),
  strategy: z.string().max(600),
  up: z.string().max(600).nullable(),
  down: z.string().max(600).nullable(),
  recommendation: z.string().max(600).nullable(),
});

export const noteTableRowSchema = z.object({
  section: z.string().min(1).max(80),
  lyric_snippet: z.string().min(1).max(120),
  chord: chordSymbolField("note-table chord"),
  first_voice: z.string().nullable(),
  second_voice: z.string().nullable(),
  interval: z.string().nullable(),
  explanation: z.string().min(1).max(480),
});

/** Structured analysis JSON: English keys, English values (R1). */
export const secondVoiceOutSchema = z
  .object({
    key: secondVoiceKeySchema,
    scale: z.array(noteName("scale note")).min(1),
    diatonic_chords: z.array(diatonicChordSchema),
    progression: z.array(progressionRowSchema).min(1).max(20),
    special_chords: z.array(specialChordSchema).max(12),
    cadences: z.array(cadenceSchema).max(12),
    section_feel: z.array(sectionFeelSchema).min(1).max(20),
    second_voice: secondVoiceProposalSchema,
    note_table: z.array(noteTableRowSchema).max(60),
    singing_tips: z.array(z.string().min(1).max(320)).min(1).max(5),
  })
  .superRefine((out, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const degrees = out.diatonic_chords.map((d) => d.degree);
    const expected = DIATONIC_DEGREES_BY_MODE[out.key.mode];
    if (
      degrees.length !== expected.length ||
      !degrees.every((d, i) => d === expected[i])
    ) {
      fail(
        `diatonic_chords for a ${out.key.mode} key must be exactly [${expected.join(", ")}]`,
      );
    }
    for (const row of out.progression) {
      if (row.degrees.length !== row.chords.length) {
        fail("each progression row needs len(degrees) == len(chords)");
        break;
      }
    }
    if (
      out.second_voice.melody_status === "missing" &&
      out.note_table.some(
        (r) =>
          r.second_voice !== null ||
          r.first_voice !== null ||
          r.interval !== null,
      )
    ) {
      fail("melody_status 'missing' forbids note_table pitches (FR-010)");
    }
    if (
      out.second_voice.melody_status === "missing" &&
      (out.second_voice.up !== null ||
        out.second_voice.down !== null ||
        out.second_voice.recommendation !== null)
    ) {
      fail("melody_status 'missing' forbids proposal fields (FR-010)");
    }
    if (
      out.note_table.length === 0 &&
      out.second_voice.strategy.trim().length === 0
    ) {
      fail("an empty note_table needs a non-empty strategy");
    }
  });

export const secondVoiceAnalysisSchema = z.object({
  id: uuid,
  sheet_id: uuid,
  transpose: transposeOffsetSchema,
  model_id: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => s.trim().length > 0, {
      message: "model_id must be non-blank",
    }),
  analysis: secondVoiceOutSchema,
  created_at: isoDateTime,
});

export const secondVoiceSummarySchema = z
  .object({
    id: uuid,
    sheet_id: uuid,
    transpose: transposeOffsetSchema,
    model_id: z.string().min(1).max(200),
    created_at: isoDateTime,
  })
  .strict();

export const secondVoiceAnalyzeResponseSchema = z.object({
  analysis: secondVoiceAnalysisSchema,
});

export const secondVoiceGetResponseSchema = z.object({
  analysis: secondVoiceAnalysisSchema,
});

export const secondVoiceListResponseSchema = z.object({
  analyses: z.array(secondVoiceSummarySchema),
  total: z.number().int().min(0),
});

export type Candidate = z.infer<typeof candidateSchema>;
export type ChordPosition = z.infer<typeof chordPositionSchema>;
export type SheetLine = z.infer<typeof sheetLineSchema>;
export type SheetSection = z.infer<typeof sheetSectionSchema>;
export type SheetBody = z.infer<typeof sheetBodySchema>;
export type SourceLink = z.infer<typeof sourceLinkSchema>;
export type DegradedEntry = z.infer<typeof degradedEntrySchema>;
export type SongContext = z.infer<typeof songContextSchema>;
export type Sheet = z.infer<typeof sheetSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type ApiError = z.infer<typeof errorSchema>;
export type TransposeOffset = z.infer<typeof transposeOffsetSchema>;
export type SecondVoiceSnapshot = z.infer<typeof secondVoiceSnapshotSchema>;
export type SecondVoiceOut = z.infer<typeof secondVoiceOutSchema>;
export type SecondVoiceAnalysis = z.infer<typeof secondVoiceAnalysisSchema>;
export type SecondVoiceSummary = z.infer<typeof secondVoiceSummarySchema>;
