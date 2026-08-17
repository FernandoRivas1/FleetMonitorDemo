from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import Vehicle
from app.services.queries import latest_readings_map

router = APIRouter(tags=["vehicles"])


@router.get("/vehicles", response_model=list[schemas.VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    vehicles = db.query(Vehicle).order_by(Vehicle.id).all()
    readings = latest_readings_map(db)
    return [
        schemas.VehicleOut(
            id=v.id,
            plate=v.plate,
            model=v.model,
            base_city=v.base_city,
            status=v.status,
            driver=schemas.DriverOut.model_validate(v.driver) if v.driver else None,
            current=schemas.TelemetryOut.model_validate(readings[v.id]) if v.id in readings else None,
        )
        for v in vehicles
    ]
