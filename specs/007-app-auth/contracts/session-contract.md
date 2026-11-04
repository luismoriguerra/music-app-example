# Session Contract (007)

**Spec**: [spec.md](../spec.md) | **Applies to**: `frontend/` ↔ `backend/` (Principle II handoff)

**Amended 2026-09-23 (BFF)**: Auth0 mints; the Astro server runs the login
flow and stores the tokens in an encrypted HttpOnly cookie (it never mints
identity); FastAPI verifies and authorizes roles from the local mirror
(DR-007, DR-005, DR-006). No Auth0 SDK or token reaches the browser bundle;
the former browser SPA SDK and the old `music-app-example-spa` client are removed.

## Transports

- **Browser → login**: Authorization Code flow run by the Astro server (SSR,
  `@astrojs/node` standalone) against the Auth0 `music-app-example-web` client
  (`app_type = regular_web`, confidential) via a server-side OIDC client
  (spike picks lib). Endpoints under `frontend/src/pages/api/auth/`:
  `GET /api/auth/login` (accepts `?next=`), `GET /api/auth/callback`,
  (a callback carrying `error=access_denied` from the admission Action, or a backend `403 NOT_INVITED`
  on first login, renders a neutral "invite required" page and sets no session cookie; FR-026),
  `POST /api/auth/logout`. The browser only ever sees Universal Login and
  redirects; no Auth0 values are exposed to client JS.
- **Session storage**: access, ID and refresh tokens live in the
  `__Host-session` cookie: encrypted with `SESSION_ENCRYPTION_KEY` (frontend
  server env only), `HttpOnly`, `Secure` (always — required by `__Host-`; dev runs on `http://localhost`, which Chrome/Firefox treat as secure, or HTTPS via a local cert where a browser refuses), `SameSite=Lax`,
  `Path=/`, chunked when it exceeds 4 KB. No server-side session store.
- **Browser islands → backend**: islands call the Astro proxy
  `frontend/src/pages/api/backend/[...path].ts`, which decrypts the session
  (refreshing if needed) and forwards to `{BACKEND_URL}` with
  `Authorization: Bearer <Auth0 access token>`. The browser never calls the
  backend directly and never holds a token.
- **SSR → backend**: server-rendered pages call the backend server-side with
  `Authorization: Bearer <Auth0 access token>` taken from the decrypted session.
- **MCP / API callers → backend**: unchanged — `Authorization: Bearer <Auth0
  access token>`. The backend REST/MCP contract stays Bearer-only.
- Token content the backend trusts (all verified via JWKS): `iss`, `aud`
  (`AUTH0_API_AUDIENCE`), `exp`, `sub`; `permissions[]` is verified with the token but NEVER decides role access (it is role-derived and stale for up to 24 h) — role checks read the `users.role` mirror (SC-007). The
  namespaced roles claim (`https://music-app.example.com/roles`) only seeds
  the `users.role` mirror at first login and drives UI visibility; it is
  never used for backend authorization (D2). The namespaced `admission` claim
  (`https://music-app.example.com/admission: "allowlist"`, set by the admission Action,
  DR-012) is trusted only at first-login provisioning, never for authorization.
- **Lifetimes**: access token 24 h (`auth0_resource_server.token_lifetime =
  86400`). Accepted risk: a copied cookie can replay for ≤24 h after logout
  (DR-007).
- **Refresh**: rotating refresh tokens; `refresh_token.leeway` set on
  `music-app-example-web`; the Astro server performs a single-flight refresh per
  request (concurrent requests share one refresh) to avoid reuse-detection
  logouts, then re-writes the cookie.
- **Logout** (`POST /api/auth/logout`): clear `__Host-session`, revoke the
  refresh token at Auth0 (`/oauth/revoke`), redirect via Auth0 `/v2/logout`.
- Missing/invalid/expired/revoked token → `401 { error: { code:
  "UNAUTHENTICATED" } }`. Valid token without permission (role per mirror)
  → `403 { error: { code: "FORBIDDEN" } }`. Unknown-or-foreign IDs → `404`
  (never confirm existence). Over rate limit → `429 { error: { code:
  "RATE_LIMITED", retry_after } }` with a `Retry-After` header.
- Browser navigation without a valid session → redirect to
  `/api/auth/login?next=<path>`.

## Who mints / who verifies

- **Mints**: Auth0 (credentials, sessions, access/ID/refresh tokens, social
  connections, password reset). Terraform owns the tenant shape (DR-002); the
  app mints nothing.
- **Stores**: the Astro server holds the Auth0-issued tokens in the encrypted
  `__Host-session` cookie and refreshes them; it does not mint or alter
  identity.
- **Verifies**: FastAPI on every protected call (`Auth0FastAPI.require_auth`,
  JWKS-cached) → loads the local `users` row by `sub` (denies `blocked`) →
  authorizes roles from the `users.role` mirror, plus ownership, flags and
  rate limits, through `authorize(subject, action, resource)` and
  `scope(subject, action, resource_type)` in `backend/app/auth/` (DR-006; no
  inline route checks). Never trusts frontend claims.
- **Frontend role use**: UI visibility only (mirror role via `GET /auth/me`,
  token roles claim before first mirror load); enforcement is always backend.

## `App.Locals` (Astro, coarse gating only)

```ts
interface Locals {
  user: { id: string; email: string; role: "user" | "admin" } | null;
}
```

Populated server-side by Astro middleware on every request from the decrypted
`__Host-session` cookie; absence only redirects to login (or renders 403 on
admin pages), never grants anything.

## Security rules

- The session cookie is encrypted with `SESSION_ENCRYPTION_KEY`; it may carry
  PII (e.g. email via the ID token) only in encrypted form and is never
  readable by JS (`HttpOnly`). `__Host-` prefix requires `Secure`, `Path=/`,
  no `Domain`.
- No tokens, Auth0 SDK, or `AUTH0_*` values in the browser bundle.
- Secrets per environment (D6), never committed, never in the browser bundle:
  - Backend (Railway): `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`,
    `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`.
  - Frontend server (Railway, runtime): `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`,
    `AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET`,
    `SESSION_ENCRYPTION_KEY`, `APP_BASE_URL`, `BACKEND_URL`.
  - CI (GitHub Environments `auth0-dev`, `prod`): `AUTH0_DOMAIN`,
    `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET`, `TF_VAR_resend_smtp_password`,
    `TF_VAR_google_client_secret`, `TF_STATE_PG_CONN_STR` (Terraform state, DR-009).
- `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` belong to the terraform-deployer
  M2M client and are read only by the Terraform provider; they are never
  reused by the frontend or backend apps.
- All secrets from environment; sample names in `.env.example` only.
