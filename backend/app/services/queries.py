"""Small shared query helpers used by multiple routers/services."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas
from app.models import DriverNotification, TelemetryReading


def notification_to_out(
    n: DriverNotification, plate_by_id: dict[int, str], name_by_id: dict[int, str]
) -> schemas.DriverNotificationOut:
    return schemas.DriverNotificationOut(
        id=n.id,
        vehicle_id=n.vehicle_id,
        vehicle_plate=plate_by_id.get(n.vehicle_id, "?"),
        driver_id=n.driver_id,
        driver_name=name_by_id.get(n.driver_id, "?"),
        type=n.type,
        message=n.message,
        timestamp=n.timestamp,
        sent=n.sent,
    )


def latest_readings_map(db: Session) -> dict[int, TelemetryReading]:
    """One query returning each vehicle's most recent TelemetryReading,
    keyed by vehicle_id. Avoids an N+1 query per vehicle."""
    subq = (
        db.query(TelemetryReading.vehicle_id, func.max(TelemetryReading.timestamp).label("max_ts"))
        .group_by(TelemetryReading.vehicle_id)
        .subquery()
    )
    rows = (
        db.query(TelemetryReading)
        .join(
            subq,
            (TelemetryReading.vehicle_id == subq.c.vehicle_id) & (TelemetryReading.timestamp == subq.c.max_ts),
        )
        .all()
    )
    return {r.vehicle_id: r for r in rows}
