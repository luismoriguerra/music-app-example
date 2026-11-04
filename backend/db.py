"""Persistence layer: PostgreSQL configuration from environment (Principle VII).

No SQLite anywhere. The domain layer never imports this module's web callers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import unquote, urlparse


class ConfigError(RuntimeError):
    """Raised when required database configuration is missing."""


@dataclass(frozen=True)
class DatabaseConfig:
    host: str
    port: int
    name: str
    user: str
    password: str

    @property
    def url(self) -> str:
        return (
            f"postgresql+psycopg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"
        )


REQUIRED_VARS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")

POSTGRES_SCHEMES = ("postgres", "postgresql")


def config_from_database_url(raw: str) -> DatabaseConfig:
    """Parse a PostgreSQL connection URL (Railway `DATABASE_URL` style).

    Accepts `postgres://` and `postgresql://`; percent-decoding applies to
    user/password. Missing parts raise ConfigError naming the gap.
    """
    parsed = urlparse(raw)
    if parsed.scheme not in POSTGRES_SCHEMES:
        raise ConfigError(
            f"DATABASE_URL scheme {parsed.scheme!r} is not PostgreSQL "
            f"(expected one of {', '.join(POSTGRES_SCHEMES)})"
        )
    if parsed.hostname in (None, "") or parsed.hostname.startswith("sqlite"):
        raise ConfigError("DATABASE_URL must include a PostgreSQL host (no SQLite)")
    name = parsed.path.lstrip("/")
    if not name or name.endswith(".db"):
        raise ConfigError("DATABASE_URL must include a PostgreSQL database name (no SQLite)")
    if not parsed.username:
        raise ConfigError("DATABASE_URL must include a username")
    if parsed.password is None:
        raise ConfigError("DATABASE_URL must include a password")
    return DatabaseConfig(
        host=parsed.hostname,
        port=parsed.port or 5432,
        name=name,
        user=unquote(parsed.username),
        password=unquote(parsed.password),
    )


def load_db_config(env: dict[str, str] | None = None) -> DatabaseConfig:
    """Read DATABASE_URL (preferred, Railway-style) or DB_* variables.

    Raises ConfigError naming any gap. SQLite is rejected in both paths.
    """
    source = env if env is not None else os.environ
    if source.get("DATABASE_URL"):
        return config_from_database_url(source["DATABASE_URL"])
    missing = [name for name in REQUIRED_VARS if not source.get(name)]
    if missing:
        raise ConfigError(f"Missing required environment variables: {', '.join(missing)}")
    if source["DB_HOST"].startswith("sqlite") or source["DB_NAME"].endswith(".db"):
        raise ConfigError("SQLite is not permitted; configure PostgreSQL (Principle VII)")
    return DatabaseConfig(
        host=source["DB_HOST"],
        port=int(source["DB_PORT"]),
        name=source["DB_NAME"],
        user=source["DB_USER"],
        password=source["DB_PASSWORD"],
    )


def make_postgres_db(config: DatabaseConfig):
    """Build the AgentOS PostgresDb for sessions/memory/knowledge.

    Imported lazily so unit tests and lint don't require agno at import time.
    """
    from agno.db.postgres import PostgresDb

    return PostgresDb(db_url=config.url)
