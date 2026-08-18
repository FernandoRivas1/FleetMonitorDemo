"""Simulation + notification engine.

Each call to run_simulation_cycle() advances the demo's simulated clock by
one day and generates one new TelemetryReading per vehicle, then evaluates
the notification rules against the new reading and any open maintenance
alerts. All "sending" is simulated — a DriverNotification row with
sent=True is the entire side effect.

Movement/speed/mileage/fuel are generated together from one daily "distance
driven" figure per vehicle (status-dependent) instead of independently, so a
vehicle's odometer, fuel level, and on-map position stay mutually
consistent — a parked vehicle doesn't drift across town or burn fuel, and a
vehicle that logged 120km doesn't show a flat battery from nowhere.
"""
from __future__ import annotations

import datetime as dt
import math
import random

from sqlalchemy.orm import Session

from app.constants import CITIES, CITY_RADIUS_DEGREES, NOTIFICATION_MESSAGES
from app.models import DriverNotification, MaintenanceAlert, SimulationState, TelemetryReading, Vehicle

OVERSPEED_THRESHOLD_KMH = 120.0
HARD_BRAKE_DELTA_KMH = 40.0
GPS_OFFLINE_PROBABILITY = 0.07
OVERSPEED_ROLL_PROBABILITY = 0.08
MAINTENANCE_DUE_SOON_WINDOW_DAYS = 7

KM_PER_DEG_LAT = 111.0
# How far a vehicle's on-map position is allowed to drift from its base city
# before movement starts biasing back toward the center — a generous multiple
# of the city's own scatter radius, so it reads as "still near this city"
# rather than "wandered across the country".
MAX_DRIFT_MULTIPLIER = 1.4

# Daily distance actually driven (km) — feeds the odometer and fuel use.
# On-map position moves by a much smaller "local step" regardless of this,
# since the dashboard shows an approximate last-known spot within the city,
# not a breadcrumb trail of the whole trip.
RENTED_DISTANCE_RANGE = (15.0, 160.0)
AVAILABLE_TRIP_PROBABILITY = 0.3  # otherwise parked, distance 0
AVAILABLE_DISTANCE_RANGE = (1.0, 15.0)
MAINTENANCE_TRIP_PROBABILITY = 0.3  # a short test drive; otherwise sitting in the shop
MAINTENANCE_DISTANCE_RANGE = (0.5, 3.0)
MAINTENANCE_SPEED_RANGE = (10.0, 30.0)  # lot/service-bay speeds, not open road

LOCAL_STEP_DRIVING_RANGE_KM = (0.3, 2.5)
LOCAL_STEP_IDLE_RANGE_KM = (0.0, 0.3)  # GPS jitter while parked

FUEL_CONSUMPTION_PER_KM_RANGE = (0.12, 0.22)  # % tank per km driven
IDLE_DRAIN_RANGE = (0.0, 0.5)  # % while parked (self-discharge / measurement noise)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _heading_from_points(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Bearing (radians) from point 1 to point 2, flat-earth approximation —
    fine at the few-km scale these steps operate at."""
    dlat = lat2 - lat1
    dlng = (lng2 - lng1) * math.cos(math.radians((lat1 + lat2) / 2))
    if dlat == 0 and dlng == 0:
        return random.uniform(0, 2 * math.pi)
    return math.atan2(dlng, dlat)


def _advance_local_position(
    lat: float, lng: float, city_lat: float, city_lng: float, prev_heading: float | None, step_km: float
) -> tuple[float, float]:
    """Moves (lat, lng) by step_km in a heading close to prev_heading (a
    gentle turn, not an independent random jump), with a soft leash back
    toward the base city if it's drifted too far."""
    heading = (prev_heading if prev_heading is not None else random.uniform(0, 2 * math.pi))
    heading += random.uniform(-0.5, 0.5)  # ~±28° turn per day

    dist_from_center_km = math.hypot(
        (lat - city_lat) * KM_PER_DEG_LAT,
        (lng - city_lng) * KM_PER_DEG_LAT * math.cos(math.radians(city_lat)),
    )
    max_drift_km = CITY_RADIUS_DEGREES * KM_PER_DEG_LAT * MAX_DRIFT_MULTIPLIER
    if dist_from_center_km > max_drift_km:
        heading = _heading_from_points(lat, lng, city_lat, city_lng) + random.uniform(-0.3, 0.3)

    dlat = (step_km / KM_PER_DEG_LAT) * math.cos(heading)
    lng_scale = KM_PER_DEG_LAT * math.cos(math.radians(lat))
    dlng = (step_km / lng_scale) * math.sin(heading) if lng_scale else 0.0
    return lat + dlat, lng + dlng


def _roll_distance_km(status: str) -> float:
    if status == "available":
        return random.uniform(*AVAILABLE_DISTANCE_RANGE) if random.random() < AVAILABLE_TRIP_PROBABILITY else 0.0
    if status == "maintenance":
        return random.uniform(*MAINTENANCE_DISTANCE_RANGE) if random.random() < MAINTENANCE_TRIP_PROBABILITY else 0.0
    return random.uniform(*RENTED_DISTANCE_RANGE)  # rented


def _roll_speed_kmh(status: str, distance_km: float) -> float:
    if distance_km <= 0:
        return 0.0
    if status == "maintenance":
        return random.uniform(*MAINTENANCE_SPEED_RANGE)
    if status == "rented" and random.random() < OVERSPEED_ROLL_PROBABILITY:
        return random.uniform(121, 150)
    return random.uniform(20, 95)


def _roll_fuel(base_fuel: float, distance_km: float) -> float:
    if distance_km > 0:
        consumption = distance_km * random.uniform(*FUEL_CONSUMPTION_PER_KM_RANGE)
        fuel = base_fuel - consumption
    else:
        fuel = base_fuel - random.uniform(*IDLE_DRAIN_RANGE)

    # Refuel/recharge events get more likely the lower the tank/battery is —
    # occasional routine top-ups too, so a full tank isn't the only way out.
    if fuel < 25 and random.random() < 0.45:
        fuel = random.uniform(70, 100)
    elif fuel < 45 and random.random() < 0.15:
        fuel = random.uniform(60, 95)
    elif random.random() < 0.04:
        fuel = random.uniform(80, 100)

    return _clamp(fuel, 5, 100)


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
        last_two = (
            db.query(TelemetryReading)
            .filter_by(vehicle_id=vehicle.id)
            .order_by(TelemetryReading.timestamp.desc())
            .limit(2)
            .all()
        )
        last_reading = last_two[0] if last_two else None
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

        prev_heading = None
        if len(last_two) == 2:
            newer, older = last_two
            prev_heading = _heading_from_points(older.lat, older.lng, newer.lat, newer.lng)

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
            distance_km = _roll_distance_km(vehicle.status)
            speed = _roll_speed_kmh(vehicle.status, distance_km)
            fuel = _roll_fuel(base_fuel, distance_km)
            mileage = base_mileage + distance_km

            step_km = random.uniform(*LOCAL_STEP_DRIVING_RANGE_KM) if distance_km > 0 else random.uniform(*LOCAL_STEP_IDLE_RANGE_KM)
            lat, lng = _advance_local_position(base_lat, base_lng, city_lat, city_lng, prev_heading, step_km)
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
