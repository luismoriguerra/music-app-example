import {
  CHORD_COUNT,
  NOTE_ALIASES,
  NOTE_ROOTS,
  ROOT_PITCH,
  SCALE_COUNT_V1,
  SPELLING_PITCH,
} from "../notes";
import { SPELLING_TABLE } from "../scales";
import type { Chord, Course, Game, Scale, Topic } from "./schemas";

export interface Collections {
  courses: Course[];
  topics: Topic[];
  games: Game[];
  chords: Chord[];
  scales: Scale[];
}

function duplicates<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) dups.add(k);
    seen.add(k);
  }
  return [...dups];
}

/**
 * Cross-collection integrity checks that a per-entry Zod schema cannot see.
 * Returns human-readable errors naming the broken entry; empty = valid.
 */
export function validateCollections({
  courses,
  topics,
  games,
  chords,
  scales,
}: Collections): string[] {
  const errors: string[] = [];

  // Rule 2 — slug uniqueness per scope.
  for (const slug of duplicates(courses, (c) => c.slug)) {
    errors.push(`courses/${slug}: duplicate course slug`);
  }
  for (const key of duplicates(topics, (t) => `${t.courseSlug}/${t.slug}`)) {
    errors.push(`topics/${key}: duplicate topic slug within course`);
  }
  for (const key of duplicates(games, (g) => `${g.courseSlug}/${g.slug}`)) {
    errors.push(`games/${key}: duplicate game slug within course`);
  }

  // Rule 3 — every topic/game references an existing course.
  const courseSlugs = new Set(courses.map((c) => c.slug));
  for (const t of topics) {
    if (!courseSlugs.has(t.courseSlug)) {
      errors.push(
        `topics/${t.slug}: courseSlug "${t.courseSlug}" does not resolve to a course`,
      );
    }
  }
  for (const g of games) {
    if (!courseSlugs.has(g.courseSlug)) {
      errors.push(
        `games/${g.slug}: courseSlug "${g.courseSlug}" does not resolve to a course`,
      );
    }
  }

  // Rule 4 — every chord references an existing topic; exactly 36 unique-named chords.
  const topicSlugs = new Set(topics.map((t) => t.slug));
  for (const c of chords) {
    if (!topicSlugs.has(c.topicSlug)) {
      errors.push(
        `chords/${c.name}: topicSlug "${c.topicSlug}" does not resolve to a topic`,
      );
    }
  }
  if (chords.length !== CHORD_COUNT) {
    errors.push(
      `chords: expected exactly ${CHORD_COUNT} entries, found ${chords.length}`,
    );
  }
  for (const name of duplicates(chords, (c) => c.name)) {
    errors.push(`chords/${name}: duplicate chord name`);
  }
  for (const key of duplicates(chords, (c) => `${c.rootPitch}/${c.type}`)) {
    errors.push(`chords: duplicate (rootPitch,type) pair ${key}`);
  }

  // Rule 28 — every chord diagram voices its type triad above rootPitch
  // (open GCEA + frets, mod 12; muted -1 strings excluded) and nothing else.
  const TRIAD_INTERVALS: Record<Chord["type"], readonly number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
  };
  const CHORD_OPEN_PITCH = [7, 0, 4, 9]; // G C E A
  for (const c of chords) {
    const sounded = new Set<number>();
    c.diagram.frets.forEach((fret, string) => {
      if (fret < 0) return; // muted string: sounds nothing
      sounded.add((CHORD_OPEN_PITCH[string] + fret) % 12);
    });
    const triad = new Set(
      TRIAD_INTERVALS[c.type].map((i) => (c.rootPitch + i) % 12),
    );
    const missing = [...triad].filter((pc) => !sounded.has(pc));
    const extra = [...sounded].filter((pc) => !triad.has(pc));
    if (missing.length > 0 || extra.length > 0) {
      errors.push(
        `chords/${c.name}: diagram pitch classes [${[...sounded].sort((a, b) => a - b).join(",")}] do not match ${c.type} triad above pitch ${c.rootPitch}`,
      );
    }
  }

  // Rule 6 — every filter spelling matches at least one chord via root or alias.
  const matched = new Set<string>();
  for (const c of chords) {
    matched.add(c.root);
    if (c.rootAlias) matched.add(c.rootAlias);
  }
  for (const spelling of [...NOTE_ROOTS, ...NOTE_ALIASES]) {
    if (!matched.has(spelling)) {
      errors.push(
        `chords: filter spelling "${spelling}" matches no chord via root or rootAlias`,
      );
    }
  }

  // Rule 15 — every lesson progression chord name resolves to a chord entry.
  const chordNames = new Set(chords.map((c) => c.name));
  for (const t of topics) {
    if (t.format !== "lesson" || !t.lesson) continue;
    for (const section of t.lesson.sections) {
      for (const progression of section.progressions) {
        for (const name of progression.chords) {
          if (!chordNames.has(name)) {
            errors.push(
              `topics/${t.slug} [${progression.name}]: chord "${name}" does not resolve to the Chords reference`,
            );
          }
        }
      }
    }
  }

  // Rule 29 — every lesson progression chord is diatonic to its circle's
  // (key pitch, type): the resolved catalog entry's (rootPitch,type) MUST
  // belong to the derived diatonic set (notes from SPELLING_TABLE + fixed
  // quality vector). Unresolvable names are rule 15's to report; skip them.
  const DIATONIC_QUALITIES: Record<string, readonly string[]> = {
    major: ["major", "minor", "minor", "major", "major", "minor", "diminished"],
    minor: ["minor", "diminished", "major", "minor", "minor", "major", "major"],
  };
  const chordByName = new Map(chords.map((c) => [c.name, c]));
  for (const t of topics) {
    if (t.format !== "lesson" || !t.lesson) continue;
    for (const section of t.lesson.sections) {
      for (const progression of section.progressions) {
        const row =
          SPELLING_TABLE[`${ROOT_PITCH[progression.key]}/${progression.type}`];
        if (!row) continue;
        const diatonic = new Set(
          row.notes
            .slice(0, 7)
            .map(
              (note, i) =>
                `${SPELLING_PITCH[note]}/${DIATONIC_QUALITIES[progression.type][i]}`,
            ),
        );
        for (const name of progression.chords) {
          const entry = chordByName.get(name);
          if (!entry) continue; // rule 15 reports dangling names
          if (!diatonic.has(`${entry.rootPitch}/${entry.type}`)) {
            errors.push(
              `topics/${t.slug} [${progression.name}]: chord "${name}" is not diatonic to ${progression.key} ${progression.type}`,
            );
          }
        }
      }
    }
  }

  // Rule 18 — progression names unique per course (CircleList keys React
  // key, expanded state, and aria-controls ids on circle.name).
  const progressionRefs: Array<{
    course: string;
    topic: string;
    name: string;
  }> = [];
  for (const t of topics) {
    if (t.format !== "lesson" || !t.lesson) continue;
    for (const section of t.lesson.sections) {
      for (const progression of section.progressions) {
        progressionRefs.push({
          course: t.courseSlug,
          topic: t.slug,
          name: progression.name,
        });
      }
    }
  }
  for (const key of duplicates(progressionRefs, (r) =>
    JSON.stringify([r.course, r.name]),
  )) {
    const [course, name] = JSON.parse(key) as [string, string];
    const slugs = new Set(
      progressionRefs
        .filter((r) => r.course === course && r.name === name)
        .map((r) => r.topic),
    );
    for (const slug of slugs) {
      errors.push(`topics/${slug}: duplicate progression name "${name}"`);
    }
  }

  // Rule 23 — every scale references an existing topic; exactly 24 unique-named scales.
  for (const s of scales) {
    if (!topicSlugs.has(s.topicSlug)) {
      errors.push(
        `scales/${s.name}: topicSlug "${s.topicSlug}" does not resolve to a topic`,
      );
    }
  }
  if (scales.length !== SCALE_COUNT_V1) {
    errors.push(
      `scales: expected exactly ${SCALE_COUNT_V1} entries, found ${scales.length}`,
    );
  }
  for (const name of duplicates(scales, (s) => s.name)) {
    errors.push(`scales/${name}: duplicate scale name`);
  }
  for (const key of duplicates(scales, (s) => `${s.rootPitch}/${s.type}`)) {
    errors.push(`scales: duplicate (rootPitch,type) pair ${key}`);
  }

  // Rule 24 — every filter spelling matches at least one scale via root or alias.
  const matchedScale = new Set<string>();
  for (const s of scales) {
    matchedScale.add(s.root);
    if (s.rootAlias) matchedScale.add(s.rootAlias);
  }
  for (const spelling of [...NOTE_ROOTS, ...NOTE_ALIASES]) {
    if (!matchedScale.has(spelling)) {
      errors.push(
        `scales: filter spelling "${spelling}" matches no scale via root or rootAlias`,
      );
    }
  }

  // Rule 25 — every scale's notes match the normative spelling table; no
  // double accidentals (FR-008/SC-005).
  const DOUBLE_ACCIDENTAL_RE = /bb|x|##/;
  for (const s of scales) {
    for (const note of s.notes) {
      if (DOUBLE_ACCIDENTAL_RE.test(note)) {
        errors.push(
          `scales/${s.name}: note "${note}" contains a double accidental`,
        );
      }
    }
    const row = SPELLING_TABLE[`${s.rootPitch}/${s.type}`];
    if (!row) {
      errors.push(
        `scales/${s.name}: no spelling row for (${s.rootPitch},${s.type})`,
      );
      continue;
    }
    for (let i = 0; i < s.notes.length; i++) {
      if (s.notes[i] !== row.notes[i]) {
        errors.push(
          `scales/${s.name}: notes diverge from spelling table at degree ${i + 1} ("${s.notes[i]}" vs "${row.notes[i]}")`,
        );
        break;
      }
    }
  }

  // Rule 26 — every diagram position's pitch agrees with its note
  // (open-string pitch + fret, mod 12; research R8).
  const OPEN_PITCH = [7, 0, 4, 9]; // G C E A
  for (const s of scales) {
    for (const pos of s.diagram.positions) {
      const note = s.notes[pos.order - 1];
      const want = SPELLING_PITCH[note];
      if (want === undefined) continue; // rule 25 already flags bad spellings
      const have = (OPEN_PITCH[pos.string] + pos.fret) % 12;
      if (have !== want) {
        errors.push(
          `scales/${s.name}: position ${pos.order} pitch ${have} != note "${note}" pitch ${want}`,
        );
      }
    }
  }

  return errors;
}
