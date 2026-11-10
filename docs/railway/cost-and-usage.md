# Cost and usage

Verified 2026-11-10 with Railway CLI 5.35.1. Assumes `P` from [overview](overview.md#looking-up-ids).

## How the bill works

Railway bills for what services actually use (memory and CPU over time, plus egress and volume storage), not for their limits. The workspace shows a $5 soft limit and $10 hard limit (`railway usage`); the plan's included usage was not verified. For this app nearly all usage is **memory held while a container runs**. CPU is under 0.01 vCPU on every service. Sleeping a service therefore saves money; lowering its CPU or memory limit does not.

## Baseline (2026-11-10, before enabling sleep)

| Service | CPU (7d) | Memory (7d) |
|---|---|---|
| backend | < 0.01 vCPU | 141 MB |
| frontend | < 0.01 vCPU | 69 MB |
| terraform-states | < 0.01 vCPU | 58 MB |
| pgvector | < 0.01 vCPU | 49 MB |

Billing period Oct 16 – Nov 16, 2026: this project had used $2.57 so far. The whole workspace estimate was $6.18, over the $5 included usage.

Traffic over 12 hours: the frontend served 117 requests, 94% of them 404s (bot scans). The backend had no HTTP requests over 24 hours.

## Commands

```bash
# Spend
railway usage                              # workspace: current, estimated, limits
railway usage projects                     # per-project cost this period
railway usage --period previous --json     # last period

# Resource use
railway metrics --all --since 7d --cpu --memory -p "$P" -e production
railway metrics -s frontend --since 12h --http -p "$P" -e production
```

`--http` fails over long windows with `stepSeconds must be at least N (max 1000 data points)`: the CLI asks for too many points. Use `--since 12h`; for the frontend, even `1d` failed.

## Levers, and which ones pay off

| Lever | Status | Saves money? |
|---|---|---|
| Sleep when idle | On for frontend, backend, terraform-states | **Yes**, the main lever. See [serverless-sleep.md](serverless-sleep.md) |
| Replicas | 1 per service | Already minimal |
| Regions | Single region (`us-east4`) | Already minimal |
| CPU/memory limits (`serviceInstanceLimitsUpdate`, `vCPUs`, `memoryGB`) | Defaults (8 vCPU / 8 GB caps) | No. You pay for use, not the cap. A tight memory cap only adds out-of-memory kills |
| Remove `terraform-states` | Still exists | Some. Delete it if Terraform will not be used (destructive: it deletes the volume) |

## Spending limits

```bash
railway usage limit status
railway usage limit update --soft 5 --hard 10     # whole dollars
```

The current limits are soft $5 (email alert) and hard $10. Railway rejects a hard limit under $10 (`Compute hard limit must be at least $10, or exactly $0`), so $10 is the lowest cap available.
