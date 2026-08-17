"""Environment-driven settings. All values are read from the process
environment (via a local .env in dev, real env vars on Render)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings:
    # SQLite locally by default; set DATABASE_URL to a Postgres/Neon URL in production.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./fleetmonitor.db")

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
