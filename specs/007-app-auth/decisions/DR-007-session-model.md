# Decision: Browser session model and role enforcement

## Status
**Accepted**

## Context
FR-002 requires a user to stay logged in across page loads, visits, and browser restarts on current major browsers. The original design (DR-005 assumption: `auth0-spa-js` in React islands, tokens in memory) cannot meet it here: every Astro navigation is a full page load that empties the in-memory cache, and silent login depends on a third-party cookie that Safari, Firefox, and Brave block. Clarifications on 2026-09-23 chose a backend-for-frontend with an encrypted cookie, accepted Auth0's 24-hour access-token lifetime, and resolved the resulting role-revoke conflict. This record amends DR-005's frontend assumption and consequence; DR-005's provider choice (Auth0) is unchanged.

Protected **fact**: the user's Auth0 tokens (access, ID with email, refresh) and the `admin` capability. **Authority**: Auth0 mints tokens; the Astro server only stores them; the FastAPI backend authorizes roles from the local `users` row. **Read path**: browser → Astro server (cookie) → backend (`Authorization: Bearer`).

**Question:** How does the browser keep a login across full page loads and restarts, and how do role revokes still apply on the next call with 24-hour tokens?

**Constraints that matter:**
- FR-002 — persistent login on major browsers; logout clears the session and revokes the refresh token; copies expire ≤24 h.
- FR-003 — protected paths deny calls without a valid token or session cookie.
- FR-006 / SC-007 — role revokes take effect on the target's next protected call (2026-09-23 split:
  FR-006 stays in 007; the SC-007 role-revoke half is now 010-admin-governance's SC-001).
- Constitution VI — no provider secrets or tokens readable by browser JS; VII — no second runtime store.

## Options Considered
- **Option A — BFF: Astro server session in an encrypted HttpOnly cookie; roles authorized from the local mirror.** **(chosen)**
- **Option B — SPA + Auth0 custom domain.** Same-site only if the frontend also moves to an owned domain; one hidden-iframe token fetch per protected page load. **(rejected)**
- **Option C — Refresh token in `localStorage`.** **(rejected)**
- **Option D — SPA as-is.** Full Auth0 redirect on every protected page load in Safari/Firefox/Brave. **(rejected)**
- **Option E — BFF with a server-side session table.** **(rejected by clarification: encrypted cookie chosen)**

## Assumptions
- [high risk] A server-side OIDC client for Astro handles the Authorization Code flow, refresh rotation, and logout correctly — library chosen in the T003 spike.
- [medium risk] Access + ID + refresh tokens fit in chunked cookies without breaking proxies or header limits.
- [medium risk] Parallel requests do not trigger Auth0 refresh-token reuse detection once `refresh_token.leeway` is set and refresh is single-flight.
- [low risk] Loading the `users` row on every protected call stays within the <150 ms p95 auth budget (the row is already loaded for `blocked`).

## Evidence
- `curl -sL https://publicsuffix.org/list/public_suffix_list.dat | grep -n '^up\.railway\.app$'` — `15435:up.railway.app`: each Railway subdomain is its own site, so Option B needs an owned domain.
- `grep -rln 'ClientRouter\|ViewTransitions' frontend/src` — no matches: every navigation is a full page load, emptying an in-memory token cache.
- `frontend/Dockerfile:22-29` — the frontend is served as static files (`serve dist`), so a BFF requires the SSR runtime switch (T011).
- `specs/007-app-auth/spec.md:16-19` — clarifications: BFF, encrypted cookie with no server store, 24-hour replay window.
- `specs/007-app-auth/spec.md:21` — clarification: roles authorized from the local account record.
- `specs/007-app-auth/spec.md:187-189` — FR-002 as clarified.
- `specs/007-app-auth/spec.md:201-203` — FR-006 as clarified.
- `specs/007-app-auth/spec.md:319-321` — SC-007 next-call revoke criterion (erratum 2026-09-23
  split: SC-007 at this line now covers only block/unblock; the next-call ROLE
  revoke criterion this decision also drove is 010-admin-governance's SC-001).
- `specs/007-app-auth/contracts/session-contract.md:23` — `__Host-session` cookie encrypted with `SESSION_ENCRYPTION_KEY`.
- `specs/007-app-auth/contracts/session-contract.md:42-49` — 24 h access-token lifetime, refresh leeway, logout revocation.
- `specs/007-app-auth/contracts/session-contract.md:102-104` — Terraform-provider `AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET` never reused by the apps.

## Decision
**Option A.** The Astro server (`music-app-example-web`, `regular_web`) runs the Authorization Code flow and keeps Auth0's tokens in an encrypted, HttpOnly, `Secure`, `SameSite=Lax` `__Host-session` cookie (chunked if large), with no server-side store. Browser islands reach the backend through an Astro proxy that attaches the Bearer; SSR pages call the backend server-side. Access tokens keep Auth0's 24-hour default; logout clears the cookie, revokes the refresh token, and signs out at Auth0, so a copied cookie works for at most 24 hours. Because tokens live that long, the backend authorizes roles from the `users` row it loads on every call; token role claims only seed that row at first login and drive UI visibility, and the admin API writes the provider grant and the mirror in one request.
- Option B rejected: needs an owned domain for the frontend and `login.` in every environment, stays cross-site on localhost, and costs an iframe fetch per protected page.
- Option C rejected: a long-lived token readable by any XSS, against the session contract.
- Option D rejected: a full Auth0 round trip per protected page on three major browsers fails FR-002's intent.
- Option E rejected by the clarification: it would need token-returning internal endpoints behind service-to-service auth and at-rest encryption.

## Confidence
Medium — the session shape follows from measured facts (Public Suffix List, full-page navigation, static frontend) and explicit clarification answers, but the OIDC library and refresh behaviour under parallel requests are unproven until the T003/T013 work.

## Consequences
**Easier:** Login persists across reloads and restarts on every major browser; no Auth0 SDK or token in the browser bundle; revokes and blocks apply on the next call regardless of token lifetime.
**Harder:** The frontend becomes a Node server (SSR runtime, T011) holding two secrets (`AUTH0_WEB_CLIENT_SECRET`, `SESSION_ENCRYPTION_KEY`); browser calls go through a proxy route; cookie chunking and single-flight refresh must be built and tested.
**Risks that remain:** A copied cookie can replay for up to 24 hours after logout (accepted); the encrypted cookie carries the user's email inside the ID token; refresh reuse detection can log users out if leeway or single-flight is missed — covered by T013/T050.

## Revisit Trigger
Reopen if: the project gets an owned domain and wants the SPA back; the 24-hour replay window becomes unacceptable (shorten `token_lifetime` or move to a server-side session store); cookies exceed header limits in practice; the chosen OIDC library proves unmaintained; or Auth0 ships a first-party Astro SDK.
