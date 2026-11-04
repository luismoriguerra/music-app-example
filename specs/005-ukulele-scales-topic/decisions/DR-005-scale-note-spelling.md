# Decision: Scale note spelling

> Scope note: decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved to `005-ukulele-scales-topic` on 2026-09-16 when the Scales spec was created.

## Status

**Accepted**

## Context

DR-003 fixes entry identity (24 enharmonic-combined flat-first entries like chords), but chord entries carry no note names — only frets/fingers — while DR-001 commits every scale entry to scale degrees + interval pattern, i.e. spelled note sequences. Blind flat-first spelling produces theoretical keys: Db natural minor is Db Eb Fb Gb Ab Bbb Cb (double-flat Bbb) and Gb natural minor is Gb Ab Bbb Cb Db Ebb Fb (Bbb + Ebb). The display-name rule and the intra-entry spelling rule must be decoupled before the `005` spec and content gate bake flat-first everywhere.

**Question:** How are scale note names spelled within each enharmonic-combined entry?

**Constraints that matter:**

- DR-003 — entry display names stay combined flat-first; filter matches `root` OR `rootAlias`.
- DR-001 — every entry carries scale degrees + interval pattern (spelled notes, not just shapes).
- DR-004 — natural minor only in v1 (one minor pattern; spelling table covers 12 major + 12 natural minor).

## Options Considered

- **Option A — Per-entry conventional spelling.** (chosen) Display name stays combined flat-first (`Db / C# minor`); filter still matches either spelling; but the note sequence + degree labels spell from the conventional tonic (Db-minor entry shows C# natural minor: C# D# E F# G# A B). Full 24-row spelling table authored in the `005` spec and validated against a music reference at plan time.
- **Option B — Flat-first everywhere.** Spell every entry from its flat-first root, including Db/Gb/Ab minor.
- **Option C — Split entries by conventional spelling.** Separate `C# minor` and `Db minor` style entries keyed to conventional tonics.

## Assumptions

- [medium risk] Conventional-tonic table (C#/F#/G# minor over Db/Gb/Ab; F# or Gb major either way) matches a standard theory reference — plan-time validation required.
- [medium risk] Eb minor (6 flats) vs D# minor (6 sharps) has no clear conventional winner; needs a music reference + owner call at `005` specify.
- [low risk] Learners accept combined entry titles with single-spelling note sequences (title says "Db / C# minor", notes say C# D# E …) without confusion.

## Evidence

- `frontend/src/content/chords/db-minor.json:1-6` — canonical entry `"Db / C# minor"` (`root: Db`, `rootAlias: C#`); file carries frets/fingers only, zero note names — chords never spell notes.
- `specs/005-ukulele-scales-topic/decisions/DR-001-scales-topic-shape.md:45` — every scale entry carries "scale degrees + interval pattern": scales do spell notes.
- Computed natural-minor spellings (W-H-W-W-H-W-W), 2026-09-16: Db minor = Db Eb Fb Gb Ab Bbb Cb (double-flat → theoretical, relative Fb major); Gb minor = Gb Ab Bbb Cb Db Ebb Fb (Bbb + Ebb → theoretical, relative Bbb major); Ab minor = Ab Bb Cb Db Eb Fb Gb (7 flats, valid but heavy vs 5-sharp G# minor).
- Gb major = Gb Ab Bb Cb Db Eb F — Cb is the correct diatonic 4th of a normal 6-flat key, not a defect; only the minor theoretical keys force respelling.

## Decision

**Option A.** Decouple display identity from note spelling: combined flat-first titles and combined filter matching stay (DR-003 intact), while note sequences spell from the conventional tonic per a 24-row table validated at plan time. Option B rejected: bakes double-flat theoretical keys into the spec, content, and gate. Option C rejected: breaks DR-003's 24-entry identity and forks the course naming convention.

## Confidence

Medium — the principle is evidence-backed (theoretical-key computation + chord-vs-scale note distinction), but the full 24-row table and the Eb/D# minor row need reference validation plus walkthrough confirmation.

## Consequences

**Easier:** No theoretical keys ship; DR-003 identity/filter work proceeds unchanged; content gate validates spellings against an explicit table instead of an implicit flat-first rule.
**Harder:** A 24-row spelling table must be authored in the `005` spec and validated against a music reference at plan time; Eb/D# minor needs an owner call.
**Risks that remain:** Title/notes spelling mismatch confuses beginners ("Db / C# minor" showing C# notes) — mitigated by a one-line entry note naming the displayed spelling and by walkthrough confirmation.

## Revisit Trigger

Reopen if: the music-reference validation overturns any conventional-tonic choice, the owner walkthrough prefers flat-first-everywhere pedagogy, or `005` adds harmonic/melodic minor (new patterns need their own spelling rows — see DR-004).
