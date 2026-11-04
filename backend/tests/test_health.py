from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import create_app
from db import ConfigError, config_from_database_url, load_db_config

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_health_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "music-app-example-backend"


def test_db_config_loads_from_env() -> None:
    env = {
        "DB_HOST": "db",
        "DB_PORT": "5432",
        "DB_NAME": "music_app",
        "DB_USER": "music",
        "DB_PASSWORD": "secret",
    }
    config = load_db_config(env)
    assert config.port == 5432
    assert config.url.startswith("postgresql+psycopg://music:secret@db:5432/music_app")


def test_db_config_names_missing_vars() -> None:
    with pytest.raises(ConfigError) as excinfo:
        load_db_config({"DB_HOST": "db"})
    assert "DB_PORT" in str(excinfo.value)
    assert "DB_PASSWORD" in str(excinfo.value)


def test_db_config_rejects_sqlite() -> None:
    env = {
        "DB_HOST": "sqlite",
        "DB_PORT": "0",
        "DB_NAME": "local.db",
        "DB_USER": "x",
        "DB_PASSWORD": "y",
    }
    with pytest.raises(ConfigError):
        load_db_config(env)


def test_compose_file_defines_api_and_db_services() -> None:
    compose = yaml.safe_load((REPO_ROOT / "docker-compose.yml").read_text())
    services = compose["services"]
    assert "api" in services
    assert "db" in services
    assert services["db"]["image"].startswith("pgvector/pgvector:")


def test_db_config_parses_database_url() -> None:
    config = load_db_config(
        {"DATABASE_URL": "postgresql://music:s%40cret@postgres.railway.internal:5432/railway"}
    )
    assert config.host == "postgres.railway.internal"
    assert config.port == 5432
    assert config.name == "railway"
    assert config.user == "music"
    assert config.password == "s@cret"  # percent-decoded
    assert config.url == "postgresql+psycopg://music:s@cret@postgres.railway.internal:5432/railway"


def test_db_config_database_url_takes_precedence_over_db_vars() -> None:
    config = load_db_config(
        {
            "DATABASE_URL": "postgres://rail:pass@rail.host:5433/raildb",
            "DB_HOST": "db",
            "DB_PORT": "5432",
            "DB_NAME": "music_app",
            "DB_USER": "music",
            "DB_PASSWORD": "secret",
        }
    )
    assert (config.host, config.port, config.name) == ("rail.host", 5433, "raildb")


def test_db_config_rejects_non_postgres_database_url() -> None:
    with pytest.raises(ConfigError) as excinfo:
        config_from_database_url("sqlite:///local.db")
    assert "PostgreSQL" in str(excinfo.value)


def test_db_config_rejects_database_url_missing_parts() -> None:
    with pytest.raises(ConfigError, match="database name"):
        config_from_database_url("postgresql://u:p@host:5432/")
    with pytest.raises(ConfigError, match="username"):
        config_from_database_url("postgresql://host:5432/db")
    with pytest.raises(ConfigError, match="password"):
        config_from_database_url("postgresql://u@host:5432/db")
