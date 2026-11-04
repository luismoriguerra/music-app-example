"""AgentOS composition: FastAPI app with a health route (v1 scaffold, no feature traffic).

Layering (Principle VIII): app/ wires routes + optional AgentOS; domain lives in
agents/ (reserved, empty in v1); persistence in db.py.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from db import ConfigError, load_db_config

logger = logging.getLogger(__name__)

APP_NAME = "music-app-example-backend"
APP_VERSION = "0.1.0"


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    _init_feature_tables()
    yield


def _init_feature_tables() -> None:
    """Create 004 feature tables when a DB is configured (idempotent).

    Without DB config the app still boots so `/health` stays green in
    DB-less dev, but every sheets/history route will fail per-request
    (FR-007) — hence the loud warning below. (Starlette's
    `TestClient(app).get()` without a `with` block never runs lifespan,
    so this swallow is NOT what keeps `test_health` green.)
    """
    try:
        load_db_config()
    except ConfigError as exc:
        logger.warning(
            "DATABASE_URL/DB_* not configured (%s); skipping song_sheets/"
            "history_entries init — sheets routes will fail per-request.",
            exc,
        )
        return
    from db_models import init_db

    init_db()


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:4321,http://127.0.0.1:4321")
    return [o.strip() for o in raw.split(",") if o.strip()]


def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, version=APP_VERSION, lifespan=_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    from app.routes_second_voice import router as second_voice_router
    from app.routes_sheets import router as sheets_router
    from app.routes_sheets import validation_error_handler

    app.include_router(sheets_router)
    app.include_router(second_voice_router)
    app.add_exception_handler(RequestValidationError, validation_error_handler)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": APP_NAME, "version": APP_VERSION}

    if os.getenv("AGENTOS_ENABLED", "false").lower() == "true":
        _mount_agentos(app)

    return app


def _mount_agentos(app: FastAPI) -> None:
    """Attach AgentOS when explicitly enabled and DB config is present.

    Kept behind a flag so `pytest` and the health smoke work without Postgres.
    """
    try:
        config = load_db_config()
    except ConfigError as exc:  # pragma: no cover - exercised only with AGENTOS_ENABLED
        raise RuntimeError(f"AgentOS enabled but database misconfigured: {exc}") from exc

    from agno.os import AgentOS

    from db import make_postgres_db

    agent_os = AgentOS(agents=[], db=make_postgres_db(config), base_app=app)
    agent_os.get_app()


app = create_app()
