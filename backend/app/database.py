"""SQLAlchemy engine/session setup. Postgres (Neon) only — for both local
dev and production, purely via DATABASE_URL."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def _normalize_url(url: str) -> str:
    # Neon/Heroku-style URLs often use "postgres://" or "postgresql://"; SQLAlchemy
    # 2.0 + psycopg (v3) wants the "postgresql+psycopg://" dialect prefix.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalize_url(settings.DATABASE_URL)

# pool_pre_ping guards against Neon suspending its compute after idling and
# the pool handing out a stale connection on the next request.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
