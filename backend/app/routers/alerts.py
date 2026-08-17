from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import MaintenanceAlert, Vehicle

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=list[schemas.MaintenanceAlertOut])
def list_alerts(
    vehicle_id: int | None = None,
    unresolved_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(MaintenanceAlert)
    if vehicle_id is not None:
        q = q.filter_by(vehicle_id=vehicle_id)
    if unresolved_only:
        q = q.filter_by(resolved=False)
    alerts = q.order_by(MaintenanceAlert.due_date).all()

    plate_by_id = {v.id: v.plate for v in db.query(Vehicle).all()}
    return [
        schemas.MaintenanceAlertOut(
            id=a.id,
            vehicle_id=a.vehicle_id,
            vehicle_plate=plate_by_id.get(a.vehicle_id, "?"),
            type=a.type,
            severity=a.severity,
            due_date=a.due_date,
            resolved=a.resolved,
        )
        for a in alerts
    ]
