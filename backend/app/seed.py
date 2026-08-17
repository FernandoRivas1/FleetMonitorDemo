"""Synthetic data generator. Creates ~15-20 fictitious vehicles spread across
the 8 base cities, each with one fictitious driver, 14 days of historical
telemetry, and a handful of maintenance alerts.

Run directly for local/manual (re)seeding:  python -m app.seed
"""
from __future__ import annotations

import datetime as dt
import random

from sqlalchemy.orm import Session

from app.constants import (
    CITIES,
    CITY_RADIUS_DEGREES,
    FIRST_NAMES,
    LAST_NAMES,
    MAINTENANCE_ALERT_TYPES,
    PLATE_LETTERS,
    STATUSES,
    VEHICLE_MODELS,
)
from app.database import Base, SessionLocal, engine
from app.models import Driver, MaintenanceAlert, SimulationState, TelemetryReading, Vehicle


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _jitter(lat: float, lng: float) -> tuple[float, float]:
    return (
        lat + random.uniform(-CITY_RADIUS_DEGREES, CITY_RADIUS_DEGREES),
        lng + random.uniform(-CITY_RADIUS_DEGREES, CITY_RADIUS_DEGREES),
    )


def _make_plate(used: set[str]) -> str:
    while True:
        letters = "".join(random.choice(PLATE_LETTERS) for _ in range(4))
        digits = f"{random.randint(10, 99)}"
        plate = f"{letters}-{digits}"
        if plate not in used:
            used.add(plate)
            return plate


def _make_masked_phone() -> str:
    # Fictitious, masked format: +56 9 ****1234
    return f"+56 9 ****{random.randint(1000, 9999)}"


def seed_database(db: Session, fleet_min: int, fleet_max: int) -> None:
    """Populate an empty database. Caller is responsible for checking the DB
    is actually empty first (see app.main's startup check)."""
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    db.add(SimulationState(singleton=1, current_time=now, cycle_count=0))

    fleet_size = random.randint(fleet_min, fleet_max)
    used_plates: set[str] = set()
    city_names = list(CITIES.keys())

    for _ in range(fleet_size):
        city = random.choice(city_names)
        lat0, lng0 = CITIES[city]
        status = random.choices(STATUSES, weights=[0.45, 0.40, 0.15])[0]

        vehicle = Vehicle(
            plate=_make_plate(used_plates),
            model=random.choice(VEHICLE_MODELS),
            base_city=city,
            status=status,
        )
        db.add(vehicle)
        db.flush()  # assigns vehicle.id

        driver = Driver(
            name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            phone=_make_masked_phone(),
            vehicle_id=vehicle.id,
        )
        db.add(driver)

        # 14 days of historical telemetry, ending "today" (the sim clock's start).
        fuel = random.uniform(40, 100)
        mileage = random.uniform(5000, 90000)
        for days_ago in range(13, -1, -1):
            ts = now - dt.timedelta(days=days_ago)
            lat, lng = _jitter(lat0, lng0)
            mileage += random.uniform(20, 380)
            fuel = _clamp(fuel + (random.uniform(15, 40) if random.random() < 0.25 else -random.uniform(2, 9)), 5, 100)
            speed = 0.0 if (status == "maintenance" and random.random() < 0.5) else random.uniform(0, 105)
            db.add(
                TelemetryReading(
                    vehicle_id=vehicle.id,
                    timestamp=ts,
                    lat=round(lat, 6),
                    lng=round(lng, 6),
                    speed_kmh=round(speed, 1),
                    fuel_battery_level=round(fuel, 1),
                    mileage=round(mileage, 1),
                    gps_active=True,
                )
            )

        # 0-2 maintenance alerts, due dates spread from a few days overdue to
        # a few weeks out so simulate() cycles show some escalating to overdue.
        n_alerts = random.choices([0, 1, 2], weights=[0.5, 0.35, 0.15])[0]
        for alert_type, severity in random.sample(MAINTENANCE_ALERT_TYPES, k=n_alerts):
            due_date = (now + dt.timedelta(days=random.randint(-5, 20))).date()
            db.add(
                MaintenanceAlert(
                    vehicle_id=vehicle.id,
                    type=alert_type,
                    severity=severity,
                    due_date=due_date,
                    resolved=False,
                )
            )

    db.commit()


if __name__ == "__main__":
    from app.config import settings

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.query(Vehicle).first() is not None:
            print("Database already has vehicles — skipping seed. Delete the DB file to reseed.")
        else:
            seed_database(db, settings.FLEET_MIN, settings.FLEET_MAX)
            count = db.query(Vehicle).count()
            print(f"Seeded {count} vehicles.")
