# Decision: Scale entry identity

> Scope note: decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved to `005-ukulele-scales-topic` on 2026-09-16 when the Scales spec was created.

> Correction 2026-09-16 (pre-push amend, user-approved): the original Easier overstated schema/gate reuse. Corrected below — decision unchanged. Intra-entry note spelling is explicitly out of scope here; see DR-005.

## Status

**Accepted**

## Context

DR-001 makes Scales an explorer over per-key entries, so each scale needs an identity: one entry per pitch and type like chords, or fewer entries with an in-view switch. The choice fixes the entry count, the filter design, and deep-link granularity, and `001` already settled the analogous chords question the same way.

**Question:** How are scale entries identified across the 12 chromatic roots?

**Constraints that matter:**

- `001` FR-008 — grouped filter (All / by type / by note) must stay applicable to the Scales list.
- `001` clarify (single shared entry per pitch and type; flat-first combined names) — no confusing duplicate diagrams.
- `001` SC-005 — 24-entry coverage bar the Scales catalog mirrors.

## Options Considered

- **Option A — 24 entries, enharmonic-combined, flat-first.** (chosen) 12 pitches × major/natural-minor; `Bb / A# major` style names; `root` + `rootAlias` + `rootPitch` fields cloned from the chord schema.
- **Option B — 12 entries with in-view mode toggle.** One entry per pitch; learner flips major/minor inside the expanded detail.
- **Option C — 36 entries with separate enharmonics.** `Bb major` and `A# major` as distinct entries.

## Assumptions

- [low risk] The same 12 chromatic roots cover scales; no scale needs a root spelling outside `NOTE_ROOTS`/`NOTE_ALIASES`.
- [medium risk] Major-before-minor sort order reads as well for scales as it does for chords.

## Evidence

- `ls frontend/src/content/chords/*.json | wc -l` → `24` (measured 2026-09-16) — the shipped catalog this decision mirrors 1:1.
- `frontend/src/lib/notes.ts:49-55` — `ENHARMONIC_PAIR` flat→sharp map; `:61` `CHORD_COUNT_V1 = 24`.
- `frontend/src/lib/chords.ts:52-61` — pure filter logic (type match; spelling matches `root` OR `rootAlias`); `:64-71` major-before-minor sort — logic reusable for scales, but the schema shape is new (`scaleSchema`) and validate Rules 4/6/15 need scales parallels (see `frontend/src/lib/content/validate.ts:4-8,62-75`).
- `specs/001-music-course-catalog/spec.md:23-24` — single shared entry per pitch and type with flat-first combined display names, explicitly to avoid duplicate diagrams.

## Decision

**Option A.** 24 scale entries mirroring chords exactly. Option B rejected: a mode toggle breaks deep-link-per-scale granularity and the grouped-filter parity, and toggle state complicates shareable addresses. Option C rejected: `001` already settled this against duplicates — relitigating it would fork the course's naming convention.

## Confidence

Medium — entry identity clones a shipped, tested naming/filter convention, but schema, collection, and validate work is new (not a port-unchanged reuse).

## Consequences

**Easier:** Filter/sort logic and flat-first combined naming reuse; learners meet one consistent naming scheme across Chords and Scales.
**Harder:** New `scaleSchema`, new `scales` collection wiring, and parallel validate/content-gate rules — plus 24 scale fingering sets to author and audit (see DR-002). Intra-entry note spelling is a separate question (see DR-005).
**Risks that remain:** Authoring load for 24 correct fingerings — mitigated by generating note sequences from interval patterns programmatically and hand-verifying only the fingerings.

## Revisit Trigger

Reopen if: `005` adds harmonic/melodic minor (entry count changes — see DR-004) or filter UX research favors a mode toggle over separate entries.
