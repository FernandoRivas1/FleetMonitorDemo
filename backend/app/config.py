"""Environment-driven settings. All values are read from the process
environment (via a local .env in dev, real env vars on Render)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Copy backend/.env.example to backend/.env and fill it in "
            f"(a Postgres/Neon connection string for {name})."
        )
    return value


class Settings:
    # Postgres (Neon) for both local dev and production — no SQLite fallback.
    # Set in backend/.env locally; set as a real env var on Render in production.
    DATABASE_URL: str = _require("DATABASE_URL")

    # Comma-separated list of origins allowed to call this API (the frontend's URL(s)).
    ALLOWED_ORIGINS: list[str] = _split_csv(
        os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        )
    )

    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY") or None
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")

    # Fleet size range for the seed script.
    FLEET_MIN: int = int(os.getenv("FLEET_MIN", "15"))
    FLEET_MAX: int = int(os.getenv("FLEET_MAX", "20"))


settings = Settings()
