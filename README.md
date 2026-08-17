# FleetMonitor Demo

A fleet-monitoring dashboard for a fictitious vehicle-rental company with a
simulated presence across 8 Chilean cities: a live map, a filterable vehicle
overview, per-vehicle telemetry/alerts/notifications, and a chat assistant
that answers questions about the fleet in plain English.

This is a **portfolio/demo project**. Read the disclaimers below before
treating anything in it as real.

## ⚠️ Important disclaimers

- **All data is 100% synthetic.** Every vehicle, license plate, driver name,
  phone number, telemetry reading, maintenance alert, and notification is
  randomly generated. None of it refers to a real company, person, or vehicle.
- **The geographic distribution is illustrative only.** The 8 base cities and
  vehicle counts are placeholders to demonstrate a multi-city fleet UI — they
  do not represent any real business's operations or fleet size.
- **All driver and notification data is fictitious.** No SMS/WhatsApp/push
  provider is integrated — "sending a notification" means writing a database
  record that the frontend displays as a feed. No message is ever sent to a
  real phone number.
- **Development was assisted by Claude Code and Claude Design** (Anthropic).
  The frontend was implemented from a Claude Design handoff; the backend,
  simulation engine, and this README were built with Claude Code.

## The problem this demonstrates

Fleet operators need a single view of where their vehicles are, which ones
need attention (low fuel/battery, overdue maintenance, a GPS device that's
gone quiet), and a fast way to ask "what's going on with my fleet right now"
without digging through tables. FleetMonitor Demo is a compact, runnable
example of that: a backend that simulates a live fleet and raises the same
kinds of alerts a real telematics platform would, in front of a dashboard
that surfaces them on a map, in a searchable list, and in a chat interface.

## Architecture

```
┌──────────────────────┐        HTTPS / JSON        ┌───────────────────────────┐
│   frontend/           │ ──────────────────────────▶ │   backend/                │
│   React + Vite        │ ◀────────────────────────── │   FastAPI + SQLAlchemy    │
│   deployed on Vercel   │                              │   deployed on Render      │
└──────────────────────┘                              └─────────────┬─────────────┘
                                                                     │
                                                        SQLite (dev) │ Postgres/Neon (prod)
                                                                     ▼
                                                          vehicles, drivers,
                                                          telemetry, alerts,
                                                          notifications
```

- The frontend polls the backend (and lets you trigger it manually via the
  **Simulate** button) to advance a simulated clock by one day per call,
  generating one new telemetry reading per vehicle and running the
  notification engine against it.
- The backend has no scheduler of its own — `POST /simulate` is what advances
  time. This keeps the demo cheap to host (no background worker) and lets a
  visitor watch alerts escalate from "due soon" to "overdue" in seconds
  instead of days.
- `POST /assistant/ask` builds a text summary of current fleet state
  (counts by status/city, low-fuel vehicles, open alerts, recent
  notifications) and either sends it to the Claude API for a natural-language
  answer, or — if no API key is configured — answers with a small built-in
  rule-based responder at no API cost.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Leaflet (map) |
| Backend | Python + FastAPI, SQLAlchemy 2.0 |
| Database | SQLite locally, Postgres (Neon) in production |
| AI assistant | Claude API (`anthropic` SDK), with a free rule-based fallback |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## Repository structure

```
frontend/     React + Vite dashboard (see frontend/README.md)
backend/      FastAPI backend (see backend/README.md)
render.yaml   Render Blueprint for the backend
```

## Running it locally

You need both the backend and frontend running. Two terminals:

**1. Backend** (see [`backend/README.md`](backend/README.md) for detail):

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # or: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                            # or: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The database is created and auto-seeded with a synthetic fleet on first
startup — nothing else to run. API docs at http://localhost:8000/docs.

**2. Frontend** (see [`frontend/README.md`](frontend/README.md) for detail):

```bash
cd frontend
npm install
copy .env.example .env                            # or: cp .env.example .env
npm run dev
```

Open http://localhost:5173. It talks to the backend at `http://localhost:8000`
by default (set via `VITE_API_URL` in `frontend/.env` if different).

Click **Simulate** in the header to advance the simulated fleet by a day and
watch new telemetry, alerts, and notifications appear — the app also does
this automatically every 20 seconds so the demo stays "alive" without input.

## Environment variables

### Backend (`backend/.env`, see `backend/.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite locally; a Postgres/Neon connection string in production | `sqlite:///./fleetmonitor.db` |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the API (CORS) | `http://localhost:5173,...` |
| `ANTHROPIC_API_KEY` | Optional. Enables Claude-powered answers in `/assistant/ask` | unset (falls back to rule-based) |
| `ANTHROPIC_MODEL` | Claude model used for the assistant | `claude-opus-5` |
| `FLEET_MIN` / `FLEET_MAX` | Synthetic fleet size range used by the seed script | `15` / `20` |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | URL of the backend API | `http://localhost:8000` |

**Never commit a real `.env` file or any credentials** — both are excluded by
`.gitignore`; only the `.env.example` templates are tracked.

## Deploying

### Backend → Render

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, point it at this repo. Render
   reads [`render.yaml`](render.yaml) and creates a Python web service rooted
   at `backend/`.
   - If you'd rather set it up by hand instead of via Blueprint: **New → Web
     Service**, root directory `backend`, build command
     `pip install -r requirements.txt`, start command
     `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check path `/health`.
3. Set the environment variables Render prompts for:
   - `DATABASE_URL` — your Neon (or other Postgres) connection string. Get one
     free at [neon.tech](https://neon.tech): create a project, copy the
     connection string (it works as-is — the backend normalizes the
     `postgres://`/`postgresql://` scheme itself).
   - `ALLOWED_ORIGINS` — your Vercel frontend URL, e.g.
     `https://your-app.vercel.app` (add `http://localhost:5173` too if you
     want local dev to keep working against the deployed backend).
   - `ANTHROPIC_API_KEY` — optional; leave unset to use the free rule-based
     assistant fallback.
4. Deploy. The database schema is created and auto-seeded on first boot — no
   migration step needed for this demo.
5. Note the deployed URL (e.g. `https://fleetmonitor-demo-backend.onrender.com`)
   — the frontend needs it next.

> Render's free tier spins down after inactivity; the first request after a
> while can take ~30-60s to wake it up.

### Frontend → Vercel

1. In the Vercel dashboard: **New Project**, import this repo.
2. Set **Root Directory** to `frontend` (Vercel auto-detects the Vite preset
   from there).
3. Add an environment variable: `VITE_API_URL` = your Render backend URL from
   above (e.g. `https://fleetmonitor-demo-backend.onrender.com`, no trailing
   slash).
4. Deploy. Once it's live, go back to Render and make sure `ALLOWED_ORIGINS`
   includes this exact Vercel URL, then redeploy the backend if you changed it.

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/vehicles` | GET | All vehicles with current position, status, and driver |
| `/vehicles/{id}/telemetry` | GET | Telemetry history for one vehicle (`?limit=`, default 14) |
| `/alerts` | GET | Maintenance alerts (`?vehicle_id=`, `?unresolved_only=true`) |
| `/notifications` | GET | Driver notifications, most recent first (`?vehicle_id=`, `?limit=`) |
| `/simulate` | POST | Advance the simulated clock by one day; runs the notification engine |
| `/assistant/ask` | POST | `{"question": "..."}` → natural-language answer about the fleet |
| `/health` | GET | Health check |

Full interactive docs (Swagger UI) are served at `/docs` on any running
instance.

## The simulation & notification engine

Each `POST /simulate` call:

1. Advances an internal simulated clock by one day.
2. Generates one new telemetry reading per vehicle — position moves slightly
   within a radius of its base city, speed and fuel/battery vary.
3. Evaluates notification rules against the new reading and any open
   maintenance alerts, each de-duplicated so a vehicle isn't re-notified for
   the same ongoing condition every cycle:
   - **`overspeed`** — simulated speed exceeds 120 km/h (edge-triggered)
   - **`hard_brake`** — a sharp deceleration versus the previous reading
   - **`maintenance_due_soon`** — an open alert's due date falls within 7
     simulated days
   - **`maintenance_overdue`** — an open alert's due date has passed
   - **`gps_offline`** — a small random chance (~7%) a vehicle produces no
     real reading that cycle, transitioning it to "not transmitting"
4. Writes each triggered notification as a `DriverNotification` record with
   `sent = true` — this *is* the "sending," no external API is called.
