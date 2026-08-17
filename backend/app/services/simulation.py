"""Simulation + notification engine.

Each call to run_simulation_cycle() advances the demo's simulated clock by
one day and generates one new TelemetryReading per vehicle, then evaluates
the notification rules against the new reading and any open maintenance
alerts. All "sending" is simulated — a DriverNotification row with
sent=True is the entire side effect.
"""
from __future__ import annotations

import datetime as dt
import random

from sqlalchemy.orm import Session

from app.constants import CITIES, CITY_RADIUS_DEGREES, NOTIFICATION_MESSAGES
from app.models import DriverNotification, MaintenanceAlert, SimulationState, TelemetryReading, Vehicle

OVERSPEED_THRESHOLD_KMH = 120.0
HARD_BRAKE_DELTA_KMH = 40.0
GPS_OFFLINE_PROBABILITY = 0.07
OVERSPEED_ROLL_PROBABILITY = 0.08
MAINTENANCE_DUE_SOON_WINDOW_DAYS = 7


def _jitter(lat: float, lng: float) -> tuple[float, float]:
    return (
        lat + random.uniform(-CITY_RADIUS_DEGREES, CITY_RADIUS_DEGREES),
        lng + random.uniform(-CITY_RADIUS_DEGREES, CITY_RADIUS_DEGREES),
    )


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def get_or_create_sim_state(db: Session) -> SimulationState:
    state = db.query(SimulationState).filter_by(singleton=1).first()
    if state is None:
        state = SimulationState(singleton=1, current_time=dt.datetime.now(dt.timezone.utc).replace(tzinfo=None), cycle_count=0)
        db.add(state)
        db.flush()
    return state


def _notify(
    db: Session, vehicle: Vehicle, notif_type: str, message: str, timestamp: dt.datetime
) -> DriverNotification | None:
    driver = vehicle.driver
    if driver is None:
        return None
    notif = DriverNotification(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        type=notif_type,
        message=message,
        timestamp=timestamp,
        sent=True,
    )
    db.add(notif)
    db.flush()
    return notif


def run_simulation_cycle(db: Session) -> dict:
    state = get_or_create_sim_state(db)
    state.current_time = state.current_time + dt.timedelta(days=1)
    state.cycle_count += 1
    sim_now = state.current_time
    today = sim_now.date()

    readings_created = 0
    notifications: list[DriverNotification] = []

    vehicles = db.query(Vehicle).all()
    for vehicle in vehicles:
        last_reading = (
            db.query(TelemetryReading)
            .filter_by(vehicle_id=vehicle.id)
            .order_by(TelemetryReading.timestamp.desc())
            .first()
        )
        city_lat, city_lng = CITIES.get(vehicle.base_city, (0.0, 0.0))

        if last_reading:
            base_fuel = last_reading.fuel_battery_level
            base_mileage = last_reading.mileage
            prev_speed = last_reading.speed_kmh
            prev_gps_active = last_reading.gps_active
            base_lat, base_lng = last_reading.lat, last_reading.lng
        else:
            base_fuel = random.uniform(40, 100)
            base_mileage = random.uniform(5000, 90000)
            prev_speed = 0.0
            prev_gps_active = True
            base_lat, base_lng = city_lat, city_lng

        goes_offline = random.random() < GPS_OFFLINE_PROBABILITY

        if goes_offline:
            # "No reading this cycle" in spirit: position/fuel/mileage stay put,
            # speed reads 0, and the row is flagged gps_active=False so history
            # (and the dashboard) shows the gap explicitly.
            lat, lng = base_lat, base_lng
            speed = 0.0
            fuel = base_fuel
            mileage = base_mileage
            gps_active = False
        else:
            lat, lng = _jitter(city_lat, city_lng)
            mileage = base_mileage + random.uniform(20, 400)
            fuel = _clamp(base_fuel + (random.uniform(15, 40) if random.random() < 0.25 else -random.uniform(2, 10)), 5, 100)
            speed = random.uniform(121, 150) if random.random() < OVERSPEED_ROLL_PROBABILITY else random.uniform(0, 105)
            gps_active = True

        reading = TelemetryReading(
            vehicle_id=vehicle.id,
            timestamp=sim_now,
            lat=round(lat, 6),
            lng=round(lng, 6),
            speed_kmh=round(speed, 1),
            fuel_battery_level=round(fuel, 1),
            mileage=round(mileage, 1),
            gps_active=gps_active,
        )
        db.add(reading)
        readings_created += 1

        # --- notification engine ---
        if gps_active:
            if speed > OVERSPEED_THRESHOLD_KMH and not (prev_gps_active and prev_speed > OVERSPEED_THRESHOLD_KMH):
                # Edge-triggered: only notify on the transition into overspeed,
                # not on every cycle a vehicle keeps cruising above the limit.
                msg = NOTIFICATION_MESSAGES["overspeed"].format(plate=vehicle.plate, speed=speed)
                notif = _notify(db, vehicle, "overspeed", msg, sim_now)
                if notif:
                    notifications.append(notif)
            if prev_gps_active and prev_speed > 0 and (prev_speed - speed) >= HARD_BRAKE_DELTA_KMH:
                msg = NOTIFICATION_MESSAGES["hard_brake"].format(plate=vehicle.plate, prev_speed=prev_speed, speed=speed)
                notif = _notify(db, vehicle, "hard_brake", msg, sim_now)
                if notif:
                    notifications.append(notif)
        elif prev_gps_active:
            # Only notify on the active -> offline transition, not every cycle
            # it stays offline.
            msg = NOTIFICATION_MESSAGES["gps_offline"].format(plate=vehicle.plate)
            notif = _notify(db, vehicle, "gps_offline", msg, sim_now)
            if notif:
                notifications.append(notif)

        due_soon_cutoff = today + dt.timedelta(days=MAINTENANCE_DUE_SOON_WINDOW_DAYS)
        for alert in db.query(MaintenanceAlert).filter_by(vehicle_id=vehicle.id, resolved=False).all():
            if alert.due_date < today and not alert.notified_overdue:
                msg = NOTIFICATION_MESSAGES["maintenance_overdue"].format(
                    plate=vehicle.plate, alert_type=alert.type, due_date=alert.due_date.isoformat()
                )
                notif = _notify(db, vehicle, "maintenance_overdue", msg, sim_now)
                if notif:
                    notifications.append(notif)
                alert.notified_overdue = True
            elif today <= alert.due_date <= due_soon_cutoff and not alert.notified_due_soon:
                msg = NOTIFICATION_MESSAGES["maintenance_due_soon"].format(
                    plate=vehicle.plate, alert_type=alert.type, due_date=alert.due_date.isoformat()
                )
                notif = _notify(db, vehicle, "maintenance_due_soon", msg, sim_now)
                if notif:
                    notifications.append(notif)
                alert.notified_due_soon = True

    db.commit()

    return {
        "simulated_date": today,
        "cycle": state.cycle_count,
        "readings_created": readings_created,
        "notifications_created": notifications,
    }
