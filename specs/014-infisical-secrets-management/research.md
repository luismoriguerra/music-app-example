# Research: Infisical secrets design (current state)

Phase 0 resolves the design decisions already embodied in the repo. Rationale is taken from the repo's own docs and commit `fb625e2`; where the repo gives no reason, it says `[INFERRED]`.

## D1: Central secrets store instead of `.env` files

- **Decision**: Infisical project `music app`, with `dev` and `prod` environments.
- **Rationale**: Commit `fb625e2` message: "Secrets no longer live in .env files." Dev and prod values are kept separate, and prod values can be synced to Railway (`README.md:53-62`).
- **Alternatives considered**: `.env` files (removed; `README.md:43` says "There is no `.env` fallback any more"). Railway variables only, with no dev store `[INFERRED]`.

## D2: Inject through a CLI wrapper, not a file

- **Decision**: `infisical run --env=dev --path=/backend -- <cmd>` for every compose and test command.
- **Rationale**: Secrets reach only the launched process and are never written to disk (`README.md:43`; `.claude/settings.json:11-18` pre-approves the wrapped commands).
- **Alternatives considered**: Exporting values into the shell (not documented, not blocked). Partial enforcement is recorded in `plan.md`, "Known inconsistencies".

## D3: Names-only manifest in `.env.example`

- **Decision**: `.env.example` lists every variable the app reads, with empty secret values.
- **Rationale**: Gives reviewers a complete contract without values (`.env.example:1-10` header).
- **Alternatives considered**: Generating the manifest from code `[INFERRED]`; not implemented.

## D4: Fail fast on `DB_PASSWORD` only

- **Decision**: `${DB_PASSWORD:?...}` in compose; other API variables use `:-` defaults.
- **Rationale**: The DB cannot start or be reached without a password. Provider keys are optional for most features, and their absence degrades specific routes (`docker-compose.yml:7,25,27-30`).
- **Alternatives considered**: Fail fast on every secret. Not chosen; the repo does not state why `[INFERRED]`.

## D5: `DATABASE_URL` precedence over `DB_*`

- **Decision**: `load_db_config` reads `DATABASE_URL` first, then `DB_*` (`backend/db.py:73-75`).
- **Rationale**: Railway provides `DATABASE_URL` as a service reference. The manifest says it must stay a reference so the value is never frozen (`.env.example`, comment block near `DATABASE_URL`).
- **Alternatives considered**: Copying `DATABASE_URL` into Infisical. Rejected in `.claude/skills/add-secret/SKILL.md` section 1.

## D6: One-way prod sync with manual trigger

- **Decision**: Named sync `prod-backend-to-railway`, auto-sync off, deletion disabled (README and rotate-secret SKILL).
- **Rationale**: Prod edits are deliberate and reviewed; deletion is manual so a rename does not silently drop a prod key (`.claude/skills/add-secret/SKILL.md` section 7).
- **Alternatives considered**: Auto-sync (not chosen; documented as off "by design" in `spec.md` Assumptions).

## D7: Digest-based holders check

- **Decision**: Compare 8-hex SHA-256 prefixes across locations; never print values (`.claude/skills/rotate-secret/SKILL.md`, "Checks").
- **Rationale**: Revoke an old provider key only when no location still holds it.
- **Alternatives considered**: Comparing values directly (rejected: discloses secrets).

## D8: Prod deploy uses a separate Railway project token

- **Decision**: `RAILWAY_TOKEN` in GitHub environment `prod`; it must be a project token (`.github/workflows/deploy.yml:3-6`; README).
- **Rationale**: Scoped to the `production` Railway environment.
- **Alternatives considered**: Account token. Documented as unsupported; not enforced in code (`[UNVERIFIED]` enforcement).

## D9: Browser-visible config stays out of the store

- **Decision**: `PUBLIC_API_URL` is a Railway frontend variable and a Docker `ARG` (`frontend/Dockerfile:11-14`).
- **Rationale**: Astro inlines `PUBLIC_*` at build time; it is not secret, and the Dockerfile comment explains why an `ARG` is needed.
- **Alternatives considered**: Storing it in Infisical. Not done; the add-secret skill forbids it.

## D10: Leak guards in four places

- **Decision**: Git (`.gitignore`), Docker contexts (`backend/.dockerignore`, `frontend/.dockerignore`), Railway upload (`.railwayignore`), agent permissions (`.claude/settings.json`), and scanner fingerprints (`.infisicalignore`).
- **Rationale**: Each path can leak a value independently; the migration commit added all five.
- **Alternatives considered**: One guard only. Not chosen `[INFERRED]`.

## Open research items

- `[UNVERIFIED]` Whether prod Railway holds `YOUTUBE_API_KEY` and `GENIUS_ACCESS_TOKEN`.
- `[UNVERIFIED]` Sync settings (auto-sync off, deletion disabled) in the Infisical UI; the repo holds only the documentation.
- `[UNVERIFIED]` The `pgvector` prod password rotation path (never run).