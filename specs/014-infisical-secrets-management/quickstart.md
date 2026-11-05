# Quickstart: validate the Infisical integration (current state)

Runnable checks that prove the spec's claims. Each command states its expected result. Nothing here changes state, and nothing prints a secret value.

## Prerequisites

- Docker running, Node 22, Python 3.12, `backend/.venv` installed.
- For steps marked **[needs Infisical]**: `infisical login` done once by the maintainer. Agents stop and ask if the CLI requests login.

## 1. Compose fails fast without `DB_PASSWORD`

```bash
env -u DB_PASSWORD docker compose config -q
```

Expected: exit code 1 and the message `DB_PASSWORD missing, run via infisical run --env=dev --path=/backend`. Verified on 2026-11-04.

## 2. Compose resolves with a value present

```bash
DB_PASSWORD=validation-only docker compose config -q && echo OK
```

Expected: `OK`. This proves the guard checks presence only (spec, SC-001). Use a throwaway value; do not use a real one.

## 3. Backend tests skip DB tests without credentials

```bash
cd backend && env -u DB_PASSWORD -u TEST_DATABASE_URL python -m pytest -q tests   # any Python 3.12 env with `pip install -e '.[dev]'`
```

Expected on 2026-11-04: `278 passed, 129 skipped`, 0 failed. Skip reason: `DB_PASSWORD not set`.

## 4. Backend config precedence (no network, no DB)

```bash
cd backend && python -m pytest -q tests/test_health.py   # same environment as above
```

Expected: all pass. These tests cover `DATABASE_URL` parsing and `DB_*` loading.

## 5. No `.env` loader in code

```bash
grep -rnE 'load_dotenv|dotenv' backend frontend/src --include='*.py' --include='*.ts' --include='*.tsx' --include='*.astro'
```

Expected: no output. (`import.meta.env` is Vite, not a file loader.)

## 6. Leak scan

```bash
gitleaks detect --no-git --source . --redact
```

Expected: `no leaks found`. Verified on 2026-11-04 for the sanitized copy.

## 7. Ignore rules cover the sensitive paths

```bash
git check-ignore -v .env .env.local frontend/.env.production backend/.env.test secrets.key cert.pem terraform.tfstate
git check-ignore -v .env.example || echo ".env.example is NOT ignored (expected)"
```

Expected: the first command lists a matching rule for each path; the second prints `.env.example is NOT ignored (expected)`.

## 8. Live database check **[needs Infisical]**

```bash
infisical run --env=dev --path=/backend -- docker compose up -d --build
curl -fsS localhost:8000/health
curl -s -o /dev/null -w '%{http_code}\n' 'localhost:8000/api/v1/history?limit=1'
```

Expected: `/health` returns `ok`; the history route returns `200`. `[UNVERIFIED]` in this review: the history route was not exercised against a running stack.

## 9. Value holders check **[needs Infisical]**

Follow `.claude/skills/rotate-secret/SKILL.md`, "Checks". Expected: equal digests where a value is shared, and `e3b0c442` only for empty values. Prints digests and key names only.

## Not covered here

- Prod sync and the `pgvector` password rotation: never run; supervised only.
- Infisical UI settings (auto-sync off, deletion disabled): not visible from the repo.