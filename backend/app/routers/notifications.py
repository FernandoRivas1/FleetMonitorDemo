from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import Driver, DriverNotification, Vehicle
from app.services.queries import notification_to_out

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[schemas.DriverNotificationOut])
def list_notifications(
    vehicle_id: int | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(DriverNotification)
    if vehicle_id is not None:
        q = q.filter_by(vehicle_id=vehicle_id)
    notifications = q.order_by(DriverNotification.timestamp.desc()).limit(limit).all()

    plate_by_id = {v.id: v.plate for v in db.query(Vehicle).all()}
    name_by_id = {d.id: d.name for d in db.query(Driver).all()}
    return [notification_to_out(n, plate_by_id, name_by_id) for n in notifications]
