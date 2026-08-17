# FleetMonitor Demo — Backend

FastAPI backend for FleetMonitor Demo. See the [root README](../README.md) for
the full project overview, architecture, and deployment instructions.

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # SQLite by default, no edits needed for local dev
uvicorn app.main:app --reload --port 8000
```

The database is created and auto-seeded with a synthetic fleet on first
startup. Interactive API docs: http://localhost:8000/docs

To reseed from scratch, stop the server, delete `fleetmonitor.db`, and start
it again — or run `python -m app.seed` directly.

## Structure

- `app/models.py`, `app/schemas.py` — SQLAlchemy models / Pydantic schemas
- `app/constants.py` — cities, fictitious name/plate pools, alert types
- `app/seed.py` — synthetic fleet generator
- `app/services/simulation.py` — the simulated clock + notification engine (`POST /simulate`)
- `app/services/assistant.py` — `POST /assistant/ask` (Claude API or rule-based fallback)
- `app/routers/` — `vehicles`, `telemetry`, `alerts`, `notifications`, `simulate`, `assistant`
