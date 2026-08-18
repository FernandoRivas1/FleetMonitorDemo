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
    EV_PROBABILITY,
    EV_VEHICLE_MODELS,
    FIRST_NAMES,
    LAST_NAMES,
    MAINTENANCE_ALERT_TYPES,
    PLATE_LETTERS,
    STATUSES,
    VEHICLE_MODELS,
)
from app.database import Base, SessionLocal, engine
from app.models import Driver, MaintenanceAlert, SimulationState, TelemetryReading, Vehicle
from app.services.simulation import (
    LOCAL_STEP_DRIVING_RANGE_KM,
    LOCAL_STEP_IDLE_RANGE_KM,
    _advance_local_position,
    _heading_from_points,
    _roll_distance_km,
    _roll_fuel,
    _roll_speed_kmh,
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
        is_ev = random.random() < EV_PROBABILITY
        model = random.choice(EV_VEHICLE_MODELS if is_ev else VEHICLE_MODELS)

        vehicle = Vehicle(
            plate=_make_plate(used_plates),
            model=model,
            base_city=city,
            status=status,
            is_ev=is_ev,
        )
        db.add(vehicle)
        db.flush()  # assigns vehicle.id

        driver = Driver(
            name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            phone=_make_masked_phone(),
            vehicle_id=vehicle.id,
        )
        db.add(driver)

        # 14 days of historical telemetry, ending "today" (the sim clock's
        # start) — uses the same status-aware distance/speed/fuel model as
        # ongoing simulate() cycles, so the initial chart already looks
        # plausible instead of an independent random walk.
        fuel = random.uniform(40, 100)
        mileage = random.uniform(5000, 90000)
        lat, lng = lat0, lng0
        heading = None
        for days_ago in range(13, -1, -1):
            ts = now - dt.timedelta(days=days_ago)
            distance_km = _roll_distance_km(status)
            speed = _roll_speed_kmh(status, distance_km)
            fuel = _roll_fuel(fuel, distance_km)
            mileage += distance_km
            step_km = random.uniform(*LOCAL_STEP_DRIVING_RANGE_KM) if distance_km > 0 else random.uniform(*LOCAL_STEP_IDLE_RANGE_KM)
            new_lat, new_lng = _advance_local_position(lat, lng, lat0, lng0, heading, step_km)
            if (new_lat, new_lng) != (lat, lng):
                heading = _heading_from_points(lat, lng, new_lat, new_lng)
            lat, lng = new_lat, new_lng
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
    import sys

    from app.config import settings

    if "--reset" in sys.argv:
        # Drops and recreates every table — for a schema change (e.g. a new
        # column) against data that's entirely synthetic and disposable.
        print("Dropping and recreating all tables...")
        Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.query(Vehicle).first() is not None:
            print("Database already has vehicles — skipping seed. Run with --reset to start over.")
        else:
            seed_database(db, settings.FLEET_MIN, settings.FLEET_MAX)
            count = db.query(Vehicle).count()
            print(f"Seeded {count} vehicles.")
