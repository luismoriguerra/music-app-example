---
name: openrouter-model-eval
description: Evaluate and compare LLMs via the OpenRouter MCP (live catalog, pricing, benchmarks) and record a model decision. Use when choosing or changing any LLM used by backend agents or frontend features — never hardcode a model ID without running this first.
argument-hint: "[feature or requirement, e.g. 'music tagging agent']"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Make every LLM choice evidence-based using live OpenRouter data, and leave a decision record so future changes are diffable, not guesses.

## Prerequisites

- The `openrouter` project MCP server must be connected. If tools are unavailable, tell the user to run `claude mcp login openrouter` (one-time OAuth, capped key) and stop.
- First, list the OpenRouter MCP tools available in this session and map them to the capabilities below (tool names may evolve; go by capability).

## Workflow

1. **Clarify requirements** from input or the active spec: task type (chat, extraction, tagging, vision, embeddings), quality bar, latency budget, cost ceiling, context-window needs, modality, and privacy constraints (hosted vs on-device).
2. **Query the live catalog** via OpenRouter MCP: candidate models matching the modality/context needs, per-provider pricing and latency, usage rankings, and third-party benchmarks.
3. **Shortlist 2–3 candidates** with a comparison table: model + provider route, context window, input/output price, benchmark signals, latency signals.
4. **Test the finalists** with a representative prompt from the actual feature via the MCP test-inference capability. Keep prompts small and comparable; note quality, latency, and cost per call.
5. **Record the decision** in the active spec's `research.md` (or the spec's spec.md appendix if no research file exists yet):
   - Requirements summary, candidates table, test prompts + results, winner + rationale, runner-up + when to revisit.
   - Exact model ID and provider route to configure (e.g. `openai/gpt-...` via OpenRouter).
6. **Output a summary**: winner, expected cost/latency, and the follow-up (usually: wire it in `backend/` config, add an Agno test-scenario locking the behavior).

## Rules

- Never recommend a model from training data alone — always pull live OpenRouter data in-session.
- Never paste API keys or OAuth tokens into the repo. Auth stays per-user via `claude mcp login`.
- Prefer a cheaper model that passes the eval over a flagship that merely impresses.
