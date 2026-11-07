"""Shared pytest fixtures.

API tests run against a real Postgres database (production is Postgres-only).
Every test gets a freshly created schema and a new synthetic fleet, so the
suite refuses to run unless TEST_DATABASE_URL is set explicitly; it never
falls back to DATABASE_URL or backend/.env, so a real Neon database can't be
wiped by accident.
"""
import os
from collections.abc import Iterator

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise pytest.UsageError(
        "Set TEST_DATABASE_URL to a disposable Postgres database before running the tests, e.g.\n"
        "  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fleet_test pytest"
    )

# Must happen before anything imports app.config. load_dotenv() never
# overrides variables that are already set, so these also shadow backend/.env.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ANTHROPIC_API_KEY"] = ""  # always exercise the free rule-based assistant


@pytest.fixture
def db_session() -> Iterator["Session"]:  # noqa: F821
    from app.database import Base, SessionLocal, engine
    from app.seed import seed_database

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db, 15, 15)
        yield db


@pytest.fixture
def client(db_session) -> Iterator["TestClient"]:  # noqa: F821
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
