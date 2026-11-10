# Known issues

Open as of 2026-11-10. Remove an entry once it is fixed and verified.

## Deploy workflow fails: GitHub `prod` environment is empty

**Symptom.** `deploy.yml` fails in both deploy jobs within a second. The log shows:

```
railway up ./backend --path-as-root --service "" --environment "" --ci
##[error]Process completed with exit code 1.
```

**Cause.** The GitHub environment `prod` exists but has no variables and no secrets (`gh variable list --env prod` and `gh secret list --env prod` both return nothing). `RAILWAY_TOKEN`, `RAILWAY_ENVIRONMENT` and `RAILWAY_SERVICE_*` resolve to empty strings.

**Impact.** The push to `main` on 2026-11-04 (run `41932728250`) and the manual run on 2026-11-10 (run `42884181562`) both failed. Prod still runs code deployed on 2026-11-02; `main` (`19687cf`, PR #1 merge) has not been deployed.

**Fix.** Recreate the `prod` environment entries, using the table in the root [README](../../README.md#2-set-github-secrets--vars-environment-prod):

1. Secret `RAILWAY_TOKEN`: a Railway **project** token scoped to `production` (Railway project → Settings → Tokens). Create it in the dashboard; never paste the value into chat or shell history.
2. Variables `RAILWAY_ENVIRONMENT=production`, `RAILWAY_SERVICE_FRONTEND=frontend`, `RAILWAY_SERVICE_BACKEND=backend`, `FRONTEND_URL`, `BACKEND_URL`.
3. Run `gh workflow run deploy.yml --ref main`, then `gh run watch <run-id>`.

**Verify.** The run is green and `railway deployment list -s backend -e production --limit 1 --json` shows a new `SUCCESS` deployment. Sleep stays on: the setting lives on the service instance, and `railway.json` does not set it.

## `railway.json` deploy settings are not applied

**Symptom.** `backend/railway.json` sets `healthcheckPath: /health`, `healthcheckTimeout: 30` and `restartPolicyMaxRetries: 3`. The active backend deployment runs with `healthcheckPath: null`, `healthcheckTimeout: null` and `restartPolicyMaxRetries: 10`.

**Evidence.** In the deployment's `meta`, `propertyFileMapping` lists the file's keys, but `fileServiceManifest` is `{}`, and `serviceManifest.deploy` shows the instance defaults. Read it with:

```bash
railway status -p "$P" -e production --json | jq '.environments.edges[0].node.serviceInstances.edges[]
  | select(.node.serviceName=="backend") | .node.latestDeployment.meta
  | {fileServiceManifest, propertyFileMapping, deploy: .serviceManifest.deploy}'
```

**Impact.** Railway does not health-check the backend on deploy. A backend that starts but fails `/health` still goes live. `deploy.yml` still polls for `SUCCESS`, which only catches crash-on-start.

**Cause.** Unknown. A plausible guess, not verified: the `--path-as-root` upload does not hand the file over as config-as-code.

**Fix options.**

1. Set the same values on the service instance (`serviceInstanceUpdate` with `healthcheckPath`, `healthcheckTimeout`; restart policy in the dashboard), then redeploy. Quick, but the settings then live outside the repo.
2. Move to Railway's new config (`railway config pull` → `.railway/railway.ts`, then `railway config plan` and `railway config apply`). This replaces `railway.json` before its deprecation date (2026-12-01 per `specs/002-railway-deploy/plan.md`). It is an infra change, so it goes through a spec.

## `railway redeploy` does not apply changed settings

Not a bug, but easy to fall into: `railway redeploy` (without `--from-source`) reuses the previous deployment's settings snapshot. See [serverless-sleep.md](serverless-sleep.md#commands) for commands that do apply them.

## `railway metrics --http` fails on long windows

`stepSeconds must be at least N (max 1000 data points)`. Use `--since 12h`. See [cost-and-usage.md](cost-and-usage.md#commands).
