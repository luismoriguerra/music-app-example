# Worked example: platform overlay (non-normative)

This shows how one fictional project — the Acme Photo Collective, a
multi-repo photo-sharing platform with centralized authorization —
configures `platform_routing` and extends the generic docs. Nothing here
ships as behavior. Copy the pattern, not the values.

All names below are invented for illustration (Acme, SnapBus,
PolicyGraph). Substitute your own platform's vocabulary.

## Config overlay

```yaml
platform_routing:
  adr_command: "design-review → adr-writer"
  platform_signals:
    - "new cross-service access rule"
    - "new shared event-bus topic / KV contract"
    - "new type or relation in the shared policy model"
    - "reporting lane may serve a class of data platform-wide"
    - "cross-gallery navigation rule"
```

## Routing rows this project appends

| Signal | Action |
|---|---|
| New "how may access-controlled data reach users" rule | ADR path |
| New SnapBus topic / KV bucket contract used by multiple services | ADR path |
| New PolicyGraph type or relation in the shared model | ADR path (+ justification for new relations) |
| Reporting lane may serve a class of data platform-wide | ADR path |
| Cross-gallery navigation rule affecting all galleries | ADR path |

Feature-local authorization menu they document in DRs: (a) gate on the
viewer relation; (b) restrict to counts/aggregates with no protected
detail; (c) remove or defer the surface; (d) model a new relation
(escalates to an ADR).

## Handoff shape

> This gap is platform-scoped, not feature-local. Stopping DR creation. Run
> design-review on [change ref], then adr-writer for NEW/SUPERSEDE items.

## What stays generic

The DR template, ledger shape, supersession protocol, and evidence bar are
unchanged — only the platform-signal list and the ADR command name differ per
project. That split is the whole point of the overlay.
