# Decision: Identity provider — Astro-guide alternatives evaluated

## Status
**Accepted**

## Context
Supersedes DR-001, which chose Auth0 against only the self-hosted ladder (R1–R4) and Clerk. This record re-runs the decision against every provider in Astro's authentication guide, including its Community Resources, adds evidence gathered 2026-09-23, and keeps the same choice with two newly measured risks.

Protected **fact**: per-user ownership of sheets, history, and analyses, plus the `admin` capability. **Authority**: the IdP-issued access token (`sub`, `permissions[]`, namespaced roles claim), verified by the FastAPI backend via JWKS. **Read path**: `Authorization: Bearer` on every protected REST route and MCP tool call.

**Question:** Which identity provider should the app use, evaluated against every option in Astro's authentication guide?

**Constraints that matter:**
- Requester mandate — Auth0, "managed by Terraform" (`spec.md:9`).
- FR-011 — all tenant configuration as Terraform code, per environment.
- FR-005 / FR-006 — exactly `user`/`admin`, projected into the access token.
- FR-019 — admin invite with a hosted set-password flow; the admin never handles passwords.
- Constitution II — backend (Python/FastAPI) owns verification and ownership; VII — own Postgres, no second runtime store.
- Deploy target — Railway, not Azure (`plan.md:64-70`).

## Options Considered
- **Option A — Auth0.** Universal Login + Core RBAC, official partner Terraform provider, FastAPI and React SPA quickstarts. Not listed in the Astro guide. **(chosen)**
- **Option B — Better Auth.** Astro first-class; self-hosted on our Postgres; JWT plugin exposes JWKS; admin plugin covers create/role/ban. **(rejected — retained as fallback)**
- **Option C — Clerk.** Official `@clerk/astro` SDK and Python backend SDK. **(rejected)**
- **Option D — Lucia.** Session guides for Astro. **(rejected)**
- **Option E — Scalekit.** OAuth/OIDC platform with an Astro SSR guide and Python SDK; B2B/SSO-oriented. **(rejected)**
- **Option F — Supabase Auth.** Astro guide; Python client; community Terraform provider. **(rejected)**
- **Option G — Firebase Auth.** Astro guide. **(rejected — not evaluated in depth)**
- **Option H — Microsoft Entra ID EasyAuth.** Astro community resource, tied to Azure Static Web Apps. **(rejected)**

## Assumptions
- [high risk] The dev-tenant round trip works as documented — unverified until T007.
- [high risk] `auth0-fastapi-api` reaches a stable release, or its beta API holds until then; `PyJWT` + `PyJWKClient` stays the documented fallback.
- [medium risk] `@auth0/auth0-spa-js` in React islands covers the Astro frontend without an Astro-native SDK.
- [medium risk] MAU + M2M-token pricing stays acceptable at hundreds of users.
- [low risk] Firebase, left unevaluated, would not outrank Auth0 on the mandate + Terraform criteria.

## Evidence
- `https://docs.astro.build/en/guides/authentication/` (read 2026-09-23) — lists Better Auth, Clerk, Lucia, Scalekit; points to Supabase and Firebase guides; Community Resources lists only Entra ID EasyAuth. Auth0 is not listed.
- `https://lucia-auth.com/` (read 2026-09-23) — "Lucia was deprecated in March 2025."
- `https://registry.terraform.io/providers/auth0/auth0/latest/docs` (read 2026-09-23) — official partner provider, v1.58.0, published 2026-09-22, 79 resources incl. `action`, `attack_protection`, `client`, `connection`.
- `https://registry.terraform.io/providers/supabase/supabase/latest/docs` + `supabase/terraform-provider-supabase` `docs/resources/settings.md` (read 2026-09-23) — community tier, v1.11.0, 7 resources; `settings.auth` is "Auth settings as serialised JSON" (`updateV1AuthConfig`: site URL, OTP, external-provider secrets, hooks). No role/RBAC resource.
- `curl -s -o /dev/null -w '%{http_code}' https://registry.terraform.io/v1/providers/{clerk/clerk,clerkinc/clerk,scalekit/scalekit,scalekit-inc/scalekit}` — `404` for all four: no provider at those namespaces (other namespaces not searched).
- `curl -sL -w '%{http_code}' https://auth0.com/docs/quickstart/{spa/react,backend/fastapi,webapp/astro,spa/astro}` — `200`, `200`, `404`, `404`: FastAPI + React SPA supported, no Astro quickstart.
- `https://pypi.org/pypi/auth0-fastapi-api/json` — version `1.0.0b9` (pre-release).
- `https://pypi.org/pypi/{clerk-backend-api,scalekit-sdk-python,supabase-auth}/json` — `7.0.0`, `2.19.1`, `2.31.0`: Python verification exists for Clerk, Scalekit, and Supabase too, so it does not differentiate.
- `https://www.better-auth.com/docs/plugins/jwt` — `/api/auth/jwks` endpoint for verifying tokens in external services.
- `https://www.better-auth.com/docs/plugins/admin` — `createUser`, role assignment, ban/unban, `create-admin` CLI.
- `https://clerk.com/docs/reference/astro/overview` — `clerk()` integration, `clerkMiddleware()`, `locals.auth()`.
- `specs/007-app-auth/spec.md:9` — requester mandate: Auth0 managed by Terraform.
- `specs/007-app-auth/spec.md:216-220` — FR-011 tenant-as-code requirement.
- `specs/007-app-auth/plan.md:64-70` — deploy via Railway (rules out Azure Static Web Apps hosting).
- `specs/007-app-auth/plan.md:37` — `auth0-fastapi-api` listed as the primary backend dependency, `PyJWT` fallback.
- `backend/db_models.py:100-102` — `owner_id()` synthetic identity being replaced.

## Decision
**Option A — Auth0.** It is the only candidate that meets the requester mandate and FR-011 together: an official partner Terraform provider covers roles, clients, connections, Actions, and attack protection. Supabase's provider covers auth settings (`settings.auth`) but has no role/RBAC resources; no Clerk or Scalekit provider was found at the four namespaces checked. Backend verification stays SDK-primary (`auth0-fastapi-api`) with `PyJWT` + `PyJWKClient` as fallback, with the SDK's pre-release status logged as a risk.
- Option B rejected: fails the mandate and turns a Node auth server into the identity authority beside the Python backend (Principle II). It remains the strongest fallback because it is Astro-first and self-hosted on our Postgres (R3).
- Option C rejected: no Terraform provider found at `clerk/clerk` or `clerkinc/clerk`, so FR-011 is unmet as far as checked; same vendor lock-in as Auth0 without the mandate.
- Option D rejected: deprecated March 2025.
- Option E rejected: no Terraform provider found at `scalekit/scalekit` or `scalekit-inc/scalekit`; B2B/enterprise-SSO focus doesn't match a consumer music app.
- Option F rejected: fails the mandate and adds a second managed Postgres (Constitution VII); its Terraform provider covers auth settings but has no role/RBAC resources.
- Option G rejected without deep evaluation: fails the mandate, and it would add a second managed data plane [INFERENCE].
- Option H rejected: requires Azure Static Web Apps hosting; this app deploys on Railway.

## Confidence
Medium — the choice rests on the mandate plus measured registry, quickstart, and package results, but the dev-tenant round trip (T007) has not run and the backend SDK is still a pre-release.

## Consequences
**Easier:** Tenant config is reviewable Terraform; identity, reset, social login, and revocation come hosted; the ownership design stays IdP-agnostic, so Option B stays a real fallback.
**Harder:** No Astro-native SDK, so the frontend wires `@auth0/auth0-spa-js` into React islands by hand; the backend depends on a beta SDK; local dev needs a network-reachable dev tenant.
**Risks that remain:** Breaking changes in `auth0-fastapi-api` before 1.0 — mitigated by the documented `PyJWT` fallback and pinning an exact version. Claims missing or mis-namespaced — mitigated by the T007 go/no-go (`tasks.md:211-213`). Firebase not evaluated in depth — low impact given the mandate.

## Revisit Trigger
Reopen if: T007 fails; `auth0-fastapi-api` ships a breaking pre-1.0 change or stays unstable at T009; Auth0 pricing or rate limits become untenable (fall back to Better Auth via a spec amendment — no silent substitution); an official Clerk or Scalekit Terraform provider is found or published; Auth0 ships an Astro SDK; the requester lifts the Auth0 mandate; or a project ADR log is adopted (promote this platform-wide identity choice to an ADR).
