# Decision: Structured JSON output over Markdown blob

## Status
**Accepted**

## Context
Story 3 (trust/teachability) needs stable section rendering and evaluable claims (degrees consistent, non-diatonics flagged, no invented melody). The question is the model's output shape: a Markdown blob the panel renders as prose, or a JSON schema the panel renders data-driven.

**Question:** Should the analysis agent return a Markdown blob or structured JSON via `output_schema`?

**Constraints that matter:**
- FR-004 — Agno Agent with `SecondVoiceOut` JSON `output_schema`, never free prose.
- FR-009 — 9 final-format sections under stable headings, data-driven from JSON.
- FR-010 — no-melody gate must be mechanically checkable (zero invented pitch rows).
- FR-014 — schema-invalid output fails closed (nothing stored, no partial render).
- Principle IV — agent behavior covered by scenario evals; gates must be green before merge.
- Principle V — model choice via live `openrouter-model-eval`, recorded in research.md.

## Options Considered
- **Option A — Markdown blob.** Fastest to ship; panel renders prose; sections drift between runs; claims unverifiable except by reading. **(rejected)**
- **Option B — Structured JSON (`SecondVoiceOut`) via Agno `output_schema`.** Typed sections mirroring the 9 headings + note-by-note rows; panel renders from fields; validators + evals assert shape and cross-field consistency; schema violation fails closed. **(chosen)**
- **Option C — Hybrid: JSON skeleton + Markdown section bodies.** Keeps prose flexibility inside a typed envelope; still leaves the highest-value claims (degrees, intervals, table pitches) unparseable. **(rejected)**

## Assumptions
- [low risk] The 9 headings + table + tips fit a Pydantic/Zod schema without loss (all are lists/records of strings, chords, degrees, intervals — no free-form essays required).
- [medium risk] The selected model reliably emits schema-valid JSON at ~2–4k output tokens — mitigated by the mandatory pre-wiring `openrouter-model-eval` gate (Principle V) testing exactly this, plus fail-closed retries.
- [low risk] English pedagogy + Anglo note names survive structured output (schema carries locale-neutral fields; prose fields hold English copy).

## Evidence
- `backend/agents/sheets/fallback.py:61-64` — `ChordsOut` proves the Agno `output_schema` pattern in this repo (typed wire, no prose).
- `backend/agents/sheets/fallback.py:67-87` — `build_agent` factory (lazy per-request, NOT in AgentOS) the analysis agent clones.
- `backend/agents/sheets/fallback.py:30-40` — `INSTRUCTIONS` + budget constants precedent (`MODEL_TIMEOUT_S`, `MODEL_MAX_TOKENS` — 004 learned Agno's 1024 default truncates real songs).
- `backend/evals/test_sheets_fallback.py:149-187` — shipped eval gates (coverage, vocab, untouched, attribution, latency) the new suite extends (`transpose_respected`, `degrees_consistent`, `non_diatonic_flagged`, `no_invented_melody`, `english_format_complete`).
- `frontend/src/lib/sheets/schemas.ts:131-193` — `sheetSchema.superRefine` cross-field validation precedent (shape + semantic rules in one schema).
- `specs/004-lyrics-chords-generator/research.md:212-224` — R6 output-contract decision + T036 chords-only amendment (wire-shape discipline with measured budget evidence).
- `specs/004-lyrics-chords-generator/contracts/rest-api.md:17-31` — error taxonomy (`VALIDATION_ERROR` etc.) FR-014 reuses for fail-closed runs.

## Decision
**Option B.** Option A rejected: undeterministic sections cannot satisfy FR-009 (stable headings), SC-007 (100% sections present), or the eval gates (no fields to assert — `no_invented_melody` becomes unreadable). Option C rejected: it pays the schema cost while keeping the critical claims (degrees, functions, intervals, table pitches) in unparseable prose — the worst of both. Option B makes every SC-005/SC-007 claim a field assertion, reuses the repo's proven `output_schema` + factory + eval-gate machinery, and gives fail-closed semantics for free (Pydantic rejection → error-with-retry, nothing stored).

## Confidence
High — the pattern is shipped and measured in this repo (`ChordsOut` + T036/T037 addenda); the user explicitly directed JSON structured output; risk concentrates in model selection, which Principle V gates with live evidence before any wiring.

## Consequences
**Easier:** Deterministic rendering; field-level evals; schema-invalid runs fail closed by construction; Zod/Pydantic mirrors give contract tests on both sides.
**Harder:** Up-front schema design (`SecondVoiceOut` + row types + cross-field rules); larger output token budget (~2–4k vs ~1.2k chords-only) with its own latency/cost measurement; prompt must teach the schema, not just the theory.
**Risks that remain:** Model emits valid-JSON-but-wrong-theory (schema can't catch mislabeled keys) — mitigated by semantic evals (`degrees_consistent` recomputes degrees from chords+key; fixtures with known answers) + owner walkthrough (SC-003).

## Revisit Trigger
Reopen if: the gated model eval shows no candidate reliably emitting the full schema within budget (fall back to a smaller schema or staged calls), output-token cost dominates (revisit C with typed claims + prose bodies), or streaming/progressive render becomes a requirement (SSE favors incremental shapes).
