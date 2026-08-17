from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import Driver, Vehicle
from app.services.queries import notification_to_out
from app.services.simulation import run_simulation_cycle

router = APIRouter(tags=["simulate"])


@router.post("/simulate", response_model=schemas.SimulateResult)
def simulate(db: Session = Depends(get_db)):
    """Advance the simulated clock by one day: generates one new telemetry
    reading per vehicle (moving it a little within its city radius, varying
    speed/fuel), then runs the notification engine against the new readings
    and any open maintenance alerts."""
    result = run_simulation_cycle(db)

    plate_by_id = {v.id: v.plate for v in db.query(Vehicle).all()}
    name_by_id = {d.id: d.name for d in db.query(Driver).all()}
    notifications_out = [
        notification_to_out(n, plate_by_id, name_by_id) for n in result["notifications_created"]
    ]
    return schemas.SimulateResult(
        simulated_date=result["simulated_date"],
        cycle=result["cycle"],
        readings_created=result["readings_created"],
        notifications_created=notifications_out,
    )
