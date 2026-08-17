"""FastAPI entrypoint: CORS, router wiring, and startup auto-seed.

Run locally with: uvicorn app.main:app --reload
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Vehicle
from app.routers import alerts, assistant, notifications, simulate, telemetry, vehicles
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.query(Vehicle).first() is None:
            seed_database(db, settings.FLEET_MIN, settings.FLEET_MAX)
    yield


app = FastAPI(
    title="FleetMonitor Demo API",
    description=(
        "Backend for FleetMonitor Demo — a synthetic fleet-monitoring dashboard. "
        "All vehicles, drivers, telemetry, and notifications are fictitious."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicles.router)
app.include_router(telemetry.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(simulate.router)
app.include_router(assistant.router)


@app.get("/")
def root():
    return {"name": "FleetMonitor Demo API", "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
