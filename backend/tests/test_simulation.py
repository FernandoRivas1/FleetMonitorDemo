"""Tests for the simulation and notification engine (app/services/simulation.py)."""
import datetime as dt
import math
import random

import pytest
from sqlalchemy import func

from app.constants import CITIES, CITY_RADIUS_DEGREES
from app.models import DriverNotification, MaintenanceAlert, SimulationState, TelemetryReading, Vehicle
from app.services import simulation


def _km_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.hypot(
        (lat1 - lat2) * simulation.KM_PER_DEG_LAT,
        (lng1 - lng2) * simulation.KM_PER_DEG_LAT * math.cos(math.radians(lat1)),
    )


# --- pure helpers ------------------------------------------------------------


@pytest.mark.parametrize("status", ["available", "rented", "maintenance"])
def test_parked_vehicle_reads_zero_speed(status):
    assert simulation._roll_speed_kmh(status, 0.0) == 0.0


def test_maintenance_test_drives_stay_at_service_bay_speeds():
    random.seed(1)
    low, high = simulation.MAINTENANCE_SPEED_RANGE
    for _ in range(200):
        assert low <= simulation._roll_speed_kmh("maintenance", 2.0) <= high


@pytest.mark.parametrize("base_fuel", [0.0, 3.0, 50.0, 99.0, 100.0])
def test_fuel_level_always_stays_between_5_and_100(base_fuel):
    random.seed(2)
    for distance in (0.0, 10.0, 500.0):
        assert 5 <= simulation._roll_fuel(base_fuel, distance) <= 100


def test_a_vehicle_that_drifted_too_far_is_pulled_back_toward_its_city():
    random.seed(3)
    city_lat, city_lng = next(iter(CITIES.values()))
    max_drift_km = CITY_RADIUS_DEGREES * simulation.KM_PER_DEG_LAT * simulation.MAX_DRIFT_MULTIPLIER
    # Start well outside the leash, heading straight away from the city.
    lat = city_lat + (max_drift_km * 2) / simulation.KM_PER_DEG_LAT
    before = _km_between(lat, city_lng, city_lat, city_lng)

    new_lat, new_lng = simulation._advance_local_position(lat, city_lng, city_lat, city_lng, 0.0, 2.0)

    assert _km_between(new_lat, new_lng, city_lat, city_lng) < before


# --- full cycles against the database ----------------------------------------


def _force_driving(monkeypatch, speed_kmh: float) -> None:
    """Make every vehicle drive at a fixed speed and never drop GPS."""
    monkeypatch.setattr(simulation, "GPS_OFFLINE_PROBABILITY", 0.0)
    monkeypatch.setattr(simulation, "_roll_distance_km", lambda status: 50.0)
    monkeypatch.setattr(simulation, "_roll_speed_kmh", lambda status, distance: speed_kmh)


def _notifications(db, notif_type: str) -> list[DriverNotification]:
    return db.query(DriverNotification).filter_by(type=notif_type).all()


def test_each_cycle_advances_one_day_and_adds_one_reading_per_vehicle(db_session):
    db = db_session
    start = db.query(SimulationState).one().current_time
    vehicles = db.query(Vehicle).count()
    readings_before = db.query(TelemetryReading).count()

    result = simulation.run_simulation_cycle(db)

    assert result["readings_created"] == vehicles
    assert db.query(TelemetryReading).count() == readings_before + vehicles
    assert db.query(SimulationState).one().current_time == start + dt.timedelta(days=1)


def test_overspeed_is_edge_triggered(db_session, monkeypatch):
    db = db_session
    _force_driving(monkeypatch, speed_kmh=60.0)
    simulation.run_simulation_cycle(db)
    db.query(DriverNotification).delete()
    db.commit()

    _force_driving(monkeypatch, speed_kmh=135.0)
    simulation.run_simulation_cycle(db)
    first = len(_notifications(db, "overspeed"))
    simulation.run_simulation_cycle(db)  # still speeding: no repeat notification

    vehicles_with_driver = sum(1 for v in db.query(Vehicle).all() if v.driver is not None)
    assert first == vehicles_with_driver
    assert len(_notifications(db, "overspeed")) == first


def test_hard_brake_is_detected(db_session, monkeypatch):
    db = db_session
    _force_driving(monkeypatch, speed_kmh=100.0)
    simulation.run_simulation_cycle(db)
    db.query(DriverNotification).delete()
    db.commit()

    _force_driving(monkeypatch, speed_kmh=100.0 - simulation.HARD_BRAKE_DELTA_KMH)
    simulation.run_simulation_cycle(db)

    assert _notifications(db, "hard_brake")


def test_gps_offline_notifies_once_per_outage(db_session, monkeypatch):
    db = db_session
    _force_driving(monkeypatch, speed_kmh=50.0)
    simulation.run_simulation_cycle(db)
    db.query(DriverNotification).delete()
    db.commit()

    monkeypatch.setattr(simulation, "GPS_OFFLINE_PROBABILITY", 1.0)
    simulation.run_simulation_cycle(db)
    first = len(_notifications(db, "gps_offline"))
    simulation.run_simulation_cycle(db)

    assert first > 0
    assert len(_notifications(db, "gps_offline")) == first


def test_overdue_maintenance_is_notified_exactly_once(db_session, monkeypatch):
    db = db_session
    _force_driving(monkeypatch, speed_kmh=50.0)
    today = db.query(SimulationState).one().current_time.date()
    vehicle = next(v for v in db.query(Vehicle).all() if v.driver is not None)
    db.query(MaintenanceAlert).delete()
    db.add(MaintenanceAlert(vehicle_id=vehicle.id, type="Brake pads", severity="high", due_date=today - dt.timedelta(days=3)))
    db.query(DriverNotification).delete()
    db.commit()

    simulation.run_simulation_cycle(db)
    simulation.run_simulation_cycle(db)

    overdue = _notifications(db, "maintenance_overdue")
    assert len(overdue) == 1
    assert overdue[0].vehicle_id == vehicle.id


def test_concurrent_cycles_are_serialized(db_session):
    """Regression: every open dashboard tab auto-simulates, so on the live
    demo several POST /simulate calls overlap. Without serialization they all
    read the same clock, advance it by one day in total, write duplicate
    readings for the same timestamp and can notify an overdue alert twice."""
    from concurrent.futures import ThreadPoolExecutor

    from app.database import SessionLocal

    start = db_session.query(SimulationState).one()
    start_time, start_cycle = start.current_time, start.cycle_count
    db_session.rollback()  # don't hold a snapshot while the workers run

    def one_cycle(_):
        with SessionLocal() as db:
            return simulation.run_simulation_cycle(db)["cycle"]

    with ThreadPoolExecutor(max_workers=4) as pool:
        cycles = sorted(pool.map(one_cycle, range(4)))

    state = db_session.query(SimulationState).one()
    assert cycles == [start_cycle + 1, start_cycle + 2, start_cycle + 3, start_cycle + 4]
    assert state.current_time == start_time + dt.timedelta(days=4)
    duplicate_timestamps = (
        db_session.query(TelemetryReading.vehicle_id, TelemetryReading.timestamp)
        .group_by(TelemetryReading.vehicle_id, TelemetryReading.timestamp)
        .having(func.count() > 1)
        .all()
    )
    assert duplicate_timestamps == []
