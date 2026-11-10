# Operations docs

Runbooks and notes for running the deployed app. Feature specs live in [`specs/`](../specs/); first-time Railway setup lives in the root [README](../README.md#deploying-to-railway). This folder documents how the running system is configured and why.

## Railway (production hosting)

| Doc | Read it when |
|---|---|
| [Overview](railway/overview.md) | You need the service map, which settings live where, or the service IDs for CLI/API calls |
| [Serverless (sleep when idle)](railway/serverless-sleep.md) | You want to turn sleep on or off, check whether a service is asleep, or understand cold starts |
| [Cost and usage](railway/cost-and-usage.md) | You want to see what the project costs, read metrics, or change spending limits |
| [Known issues](railway/known-issues.md) | A deploy fails, or a `railway.json` setting seems to have no effect |

## Conventions

- No secrets, IDs or real domains in these files (see `specs/002-railway-deploy/plan.md`). Every page shows how to look them up with the CLI.
- Every command was run against the live project unless marked otherwise. Each page records the date and CLI version it was verified with.
