# FleetMonitor Demo — Backend

FastAPI backend for FleetMonitor Demo. See the [root README](../README.md) for
the full project overview, architecture, and deployment instructions.

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then set DATABASE_URL to a Postgres/Neon connection string
uvicorn app.main:app --reload --port 8000
```

Postgres (Neon) is used for both local dev and production — there's no
SQLite fallback, and the app fails fast on startup if `DATABASE_URL` isn't
set. A free [Neon](https://neon.tech) project works fine for local dev too.

Tables are created and the database is auto-seeded with a synthetic fleet on
first startup if it's empty. Interactive API docs: http://localhost:8000/docs

To reseed from scratch, drop the tables (or point `DATABASE_URL` at a fresh
Neon branch/database) and run `python -m app.seed` — it also creates the
tables if they don't exist yet.

## Structure

- `app/models.py`, `app/schemas.py` — SQLAlchemy models / Pydantic schemas
- `app/constants.py` — cities, fictitious name/plate pools, alert types
- `app/seed.py` — synthetic fleet generator
- `app/services/simulation.py` — the simulated clock + notification engine (`POST /simulate`)
- `app/services/assistant.py` — `POST /assistant/ask` (Claude API or rule-based fallback)
- `app/routers/` — `vehicles`, `telemetry`, `alerts`, `notifications`, `simulate`, `assistant`
