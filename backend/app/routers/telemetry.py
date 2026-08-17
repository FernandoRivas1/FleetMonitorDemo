from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import TelemetryReading, Vehicle

router = APIRouter(tags=["telemetry"])


@router.get("/vehicles/{vehicle_id}/telemetry", response_model=schemas.VehicleTelemetryOut)
def vehicle_telemetry(
    vehicle_id: int,
    limit: int = Query(14, ge=1, le=500, description="Most recent N readings"),
    db: Session = Depends(get_db),
):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    readings = (
        db.query(TelemetryReading)
        .filter_by(vehicle_id=vehicle_id)
        .order_by(TelemetryReading.timestamp.desc())
        .limit(limit)
        .all()
    )
    readings.reverse()  # oldest -> newest, ready for a chart
    return schemas.VehicleTelemetryOut(
        vehicle_id=vehicle_id,
        readings=[schemas.TelemetryOut.model_validate(r) for r in readings],
    )
