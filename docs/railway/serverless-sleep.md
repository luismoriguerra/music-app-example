# Serverless (sleep when idle)

Railway calls this setting **Serverless** (formerly App Sleeping). Verified 2026-11-10 with Railway CLI 5.35.1. Assumes `P`, `E` and `sid` from [overview](overview.md#looking-up-ids).

## How it behaves

Per the [Railway serverless docs](https://docs.railway.com/deployments/serverless):

- A service sleeps after roughly 5–10 minutes with **no outbound packets**. Database connections, telemetry, NTP and responses to inbound requests all count as outbound.
- Any inbound request wakes it, from the internet or over the private network.
- The first request after sleep waits for a cold boot and may return **502**.
- The setting applies when a container is **created**. Changing it on a running service does nothing until a new deployment exists.

## Current state (2026-11-10)

Observed 2026-11-10 19:28–19:33 UTC: terraform-states went `SLEEPING` first (~19:28), then backend (~19:30), then frontend (~19:33). pgvector stayed `SUCCESS`. Cold start of a sleeping backend: `/health` → 200 in 2.15s; `/api/v1/history?limit=1` → 200 in 0.53s, no 502 observed. Frontend cold start was not measured.

| Service | Setting | Why |
|---|---|---|
| frontend | on | Static server; slept ~19:33 |
| backend | on | No background jobs; `AGENTOS_ENABLED` unset; slept ~19:30 |
| terraform-states | on | Idle; slept ~19:28 |
| pgvector | **off** | See below; never slept |

### pgvector stays awake

When the backend wakes, its lifespan calls `init_db()` (`backend/db_models.py`, `Base.metadata.create_all` plus `ALTER TABLE`). `app/main.py` only catches a missing-config `ConfigError`. A database connection error during that call is not caught, so the backend fails to start while pgvector is still waking. `pool_pre_ping=True` replaces dead pooled connections; it does not retry an unreachable database.

Leave pgvector awake until a cold-start test passes with both services asleep. That test needs a startup retry in `init_db()`, which is a code change.

## Commands

```bash
# Enable on a service (use false to disable)
railway api 'mutation($s:String!,$e:String!){serviceInstanceUpdate(serviceId:$s,environmentId:$e,input:{sleepApplication:true})}' \
  --raw-var s="$(sid backend)" --raw-var e="$E" --compact

# Apply: create a new deployment from the current code with the new settings
railway api 'mutation($s:String!,$e:String!){serviceInstanceRedeploy(serviceId:$s,environmentId:$e)}' \
  --raw-var s="$(sid backend)" --raw-var e="$E" --compact
```

`railway redeploy -s <svc> -e production -y` looks equivalent but **copies the previous deployment's snapshot**, so sleep stays off. Use the API mutation above.

`railway redeploy --from-source` also rebuilds from source and did pick up the new setting for terraform-states.

## Verify

```bash
# Instance setting (what the next deployment will get)
railway api 'query($s:String!,$e:String!){serviceInstance(serviceId:$s,environmentId:$e){sleepApplication latestDeployment{id status meta}}}' \
  --raw-var s="$(sid backend)" --raw-var e="$E" --compact \
  | jq '.data.serviceInstance | {instance_sleep: .sleepApplication, deploy_sleep: .latestDeployment.meta.serviceManifest.deploy.sleepApplication}'

# Status: sleeping services report SLEEPING (DeploymentStatus enum)
railway api 'query($s:String!,$e:String!){serviceInstance(serviceId:$s,environmentId:$e){latestDeployment{status}}}' \
  --raw-var s="$(sid backend)" --raw-var e="$E" --compact | jq -r '.data.serviceInstance.latestDeployment.status'

# Cold start: first request after SLEEPING
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' --max-time 60 "https://<backend-domain>/health"
```

## Disable

Set `sleepApplication:false` with the same mutation, then run `serviceInstanceRedeploy`.
