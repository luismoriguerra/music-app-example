"""Backend test harness (T011): TestClient + transient Postgres + OWNER_ID.

DB-backed tests run against a transient `music_app_test` database on the
Compose `db` service (no SQLite anywhere, Principle VII). Connection values
come from TEST_DATABASE_URL, else DB_* env (injected by
`infisical run --env=dev --path=/backend`), with the host forced to localhost:
tests run on the host, not inside the Compose network. When Postgres is
unreachable the DB fixtures skip with a clear reason instead of failing the suite.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from urllib.parse import quote

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

TEST_DB_NAME = "music_app_test"


def test_db_url(dbname: str = TEST_DB_NAME) -> str:
    """Build the SQLAlchemy URL for the transient test database."""
    if os.getenv("TEST_DATABASE_URL"):
        return os.environ["TEST_DATABASE_URL"]
    password = os.getenv("DB_PASSWORD")
    if not password:
        pytest.skip(
            "DB_PASSWORD not set: run tests via "
            "`infisical run --env=dev --path=/backend -- .venv/bin/pytest`"
        )
    user = os.getenv("DB_USER", "music")
    port = os.getenv("DB_PORT", "5432")
    return (
        f"postgresql+psycopg://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@localhost:{port}/{dbname}"
    )


@pytest.fixture(autouse=True)
def _pin_owner_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Deterministic single-owner identity for every backend test (FR-011)."""
    monkeypatch.setenv("OWNER_ID", "owner")
    # Hermetic route tests fake providers at the httpx layer; no politeness sleeps.
    monkeypatch.setenv("PROVIDER_THROTTLE_SCALE", "0")


@pytest.fixture(autouse=True)
def _hermetic_enrichment(monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest) -> None:
    """Hermetic guard (Constitution III): prevent unmocked external enrichment in unit tests."""
    name = request.node.path.name
    if name.startswith("test_sheets_enrich") or "evals" in request.node.path.parts:
        return
    monkeypatch.setattr("agents.sheets.enrich.candidates_free.search", lambda *a, **kw: [])
    monkeypatch.setattr("agents.sheets.enrich.links_free.discover", lambda *a, **kw: ([], []))
    monkeypatch.setattr("agents.sheets.enrich.context_free.fetch", lambda *a, **kw: None)
    # pipeline.py binds these names at import time; patch the bound names too.
    monkeypatch.setattr("agents.sheets.pipeline.discover_links_free", lambda *a, **kw: ([], []))
    monkeypatch.setattr("agents.sheets.pipeline.fetch_context_free", lambda *a, **kw: None)


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    """Session engine on the transient test database (created on demand)."""
    from db_models import init_db

    try:
        maintenance = create_engine(test_db_url("postgres"), isolation_level="AUTOCOMMIT")
        with maintenance.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": TEST_DB_NAME},
            ).first()
            if not exists:
                conn.execute(text(f"CREATE DATABASE {TEST_DB_NAME}"))
        maintenance.dispose()
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"transient Postgres unavailable ({exc}); start Compose db")

    engine = create_engine(test_db_url())
    try:
        with engine.connect():
            pass
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"transient Postgres unavailable ({exc}); start Compose db")
    init_db(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(test_engine: Engine) -> Iterator[Session]:
    """Function-scoped session rolled back after each test (transient)."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client():
    """Plain TestClient for app-level tests (route tests add DB overrides)."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    return TestClient(create_app())
