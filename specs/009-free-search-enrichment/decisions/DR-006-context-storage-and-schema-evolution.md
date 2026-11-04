# Decision: Song Context Storage and Idempotent Schema Evolution

## Status
**Accepted**

## Context
Data Model entity `SongContext` introduces a nullable `context` field (`{text, source, source_url}`) on `song_sheets`. Plan 009 originally assumed `init_db()` create-only semantics without migrations per feature 004 precedent. However, `init_db()` uses SQLAlchemy `Base.metadata.create_all()`, which only creates nonexistent tables and **never adds new columns to existing tables**. Deploying this change to existing development volumes or the live Railway Postgres instance will immediately cause `UndefinedColumn: column song_sheets.context does not exist` on SQL queries. Additionally, the contract introduces `part: "enrichment"` in the `degraded` array, which is currently rejected by both backend and frontend enum validators.

**Question:** How should the new nullable song context field and wire schema additions be persisted and validated without breaking existing deployed databases?

**Constraints that matter:**
- Constitution VII: Backend is the persistent runtime; PostgreSQL schemas must evolve safely.
- FR-006: Context must remain separate from lyrics and chords.
- FR-009: History re-open serves the stored sheet with zero re-querying; context must persist reliably on the sheet record.
- Existing database instances must not require manual table drops or loss of user history entries.

## Options Considered
- **Option A — Add nullable JSONB column via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `init_db()`, plus enum extensions.** Add `context = Column(JSONB, nullable=True)` to `SongSheet`. In `init_db(engine)`, execute `ALTER TABLE song_sheets ADD COLUMN IF NOT EXISTS context JSONB;` immediately after `create_all()`. Update `backend/tests/conftest.py` test harness to invoke `init_db(engine)` rather than raw `create_all()`. Concurrently add `"enrichment"` to `DEGRADED_PARTS` (`backend/db_models.py:46`) and `degradedPartSchema` (`frontend/src/lib/sheets/schemas.ts:52`). **(chosen)**
- **Option B — Rely strictly on `Base.metadata.create_all()` and manual recreate.** Rely on automatic table creation and require developers/deployments to drop and recreate the `song_sheets` table. **(rejected: destroys user history on deployed instances and causes fatal runtime crashes upon code deployment before manual intervention)**
- **Option C — Fold `context` into the existing `body` JSONB.** Store context inside the `body` column. **(rejected: `backend/db_models.py:141-144` `validate_body` and `frontend/src/lib/sheets/schemas.ts:109-111` `sheetBodySchema` enforce strict `{sections: [...]}` structure; Zod strips unknown object properties, discarding context on the frontend; also violates FR-006 structural separation)**
- **Option D — Embed context inside `provider_refs` JSON.** Store context dictionary inside `song_sheets.provider_refs`. **(rejected: semantically incorrect; `provider_refs` exists solely to index external provider identifiers like `genius_id`, `lrclib_id`, and `duckduckgo` folded signatures)**

## Assumptions
- [high risk] The PostgreSQL user configured in Railway and local environments possesses `ALTER TABLE` privileges on the `song_sheets` table.
- [medium risk] An idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` adds negligible overhead to application startup lifespan.
- [low risk] Nullable JSONB columns in PostgreSQL take zero storage overhead for existing rows where context is `NULL`.

## Evidence
- `backend/db_models.py:635-637`: `init_db()` executes `Base.metadata.create_all(engine or get_engine())`, which ignores pre-existing tables.
- `backend/tests/conftest.py:88`: Test suite setup invokes `Base.metadata.create_all(engine)` directly, bypassing `init_db()`; test fixture setup must call `init_db(engine)` to ensure tests exercise the idempotent ALTER path.
- `backend/db_models.py:46`: `DEGRADED_PARTS = ("video", "chords")` lacks `"enrichment"`; `validate_degraded()` raises `ValueError` if an unrecognized part is present.
- `frontend/src/lib/sheets/schemas.ts:52`: `degradedPartSchema = z.enum(["video", "chords"])` rejects `"enrichment"` during client-side Zod parsing.
- `backend/db_models.py:141-144`: `validate_body` raises `ValueError("body must be {sections: [...]}")` if unexpected top-level shapes are passed.

## Decision
**Option A.** Evolve the database schema by executing an idempotent raw SQL statement `ALTER TABLE song_sheets ADD COLUMN IF NOT EXISTS context JSONB;` within `init_db()` in `backend/db_models.py`. Update backend `DEGRADED_PARTS` and frontend `degradedPartSchema` to accept `"enrichment"`. Reject Options B, C, and D for data destruction hazard, validation failure, and semantic corruption respectively.

## Confidence
High — Idempotent DDL within the application lifespan is safe, backwards-compatible, requires no full migration framework, and guarantees zero-downtime deployment for existing Postgres volumes.

## Consequences
**Easier:** Existing deployments seamlessly gain the new column on next reboot without data loss or manual SQL console commands.
**Harder:** `init_db()` executes a direct SQL statement in addition to SQLAlchemy metadata reflection, and `backend/tests/conftest.py` must call `init_db(engine)` to keep test databases aligned.
**Risks that remain:** None identified; adding a nullable column in Postgres 11+ is an instant metadata-only operation without table locks.

## Revisit Trigger
Reopen if: Future features introduce relational table modifications, requiring adoption of a formal migration tool (e.g. Alembic).
