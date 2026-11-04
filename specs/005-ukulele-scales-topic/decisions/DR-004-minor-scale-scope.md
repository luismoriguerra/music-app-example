# Decision: Minor scale scope

> Scope note: decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved to `005-ukulele-scales-topic` on 2026-09-16 when the Scales spec was created.

## Status

**Accepted**

## Context

"Teach major and minor scales" leaves "minor" ambiguous: natural, harmonic, and melodic minor are all real, each with its own pattern and fingering. The repo's convention is to ship the beginner core and defer variants (chords shipped major/minor only; circles excluded 7ths), and DR-003's 24-entry count assumes exactly one minor form.

**Question:** Which minor scale forms does v1 teach?

**Constraints that matter:**

- `001` clarify "Major and minor only" — the shipped scope-discipline precedent for v1 content.
- `003` assumption excluding 7ths (variants appear "at most as unnamed prose, never as a diagrammed chord") — the variant-deferral rule this decision copies.
- User scope — "teach scale major and minor", singular each.

## Options Considered

- **Option A — Natural minor only.** (chosen) One minor pattern (W-H-W-W-H-W-W); 12 minor entries; other forms may appear as unnamed prose mentions, never as diagrammed entries.
- **Option B — Natural + harmonic + melodic.** All three forms as full entries (36 minor entries; 48 total with major).
- **Option C — Harmonic minor instead of natural.** Lead with the raised-7th sound common in some pedagogy.

## Assumptions

- [medium risk] Unqualified "minor" reads as natural minor to the target beginner; some teachers lead with harmonic minor, so the walkthrough must confirm.
- [low risk] Learners meeting harmonic/melodic minor in songs tolerate a prose pointer ("a raised 7th variant exists") without a full entry.

## Evidence

- `specs/001-music-course-catalog/spec.md:18` — "Major and minor only" v1 scope clarification.
- `specs/003-ukulele-harmonic-circles/spec.md:288-292` — 7th-chord variants excluded from the reference: existing entries only, "7" at most as unnamed prose — the deferral template Option A follows.
- User message 2026-09-16 — "teach scale major and minor" (singular each; no variant named).

## Decision

**Option A.** Natural minor only in v1. Option B rejected: triples the minor authoring/diagram load to 48 total entries and overloads beginners with three similar patterns before the first is solid. Option C rejected: splits beginner focus away from the relative-major relationship the lesson follow-up will teach, and contradicts the plain reading of "minor".

## Confidence

High — a scope call directly supported by the user's wording plus two shipped deferral precedents.

## Consequences

**Easier:** 12 minor fingerings, one pattern to author, audit, and test; DR-003's 24-entry count holds.
**Harder:** Learners meeting harmonic minor in songs (including `004` Lyrics + Chords sheets) lack a diagrammed reference — mitigated by allowing a prose sidebar mention, never a diagram.
**Risks that remain:** Pedagogy mismatch if the owner teaches harmonic-first — mitigated by confirming the assumption in the `005` specify walkthrough before content authoring starts.

## Revisit Trigger

Reopen if: the owner walkthrough teaches harmonic-first, or songbook demand (e.g. `004` sheets repeatedly needing harmonic minor diagrams) justifies promoting a variant to full entries.
