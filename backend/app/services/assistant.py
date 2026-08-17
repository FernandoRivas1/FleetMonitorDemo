"""POST /assistant/ask logic: builds a fleet-state summary and answers in
English, either via the Claude API (if ANTHROPIC_API_KEY is set) or a
free rule-based fallback."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.constants import CITIES
from app.models import DriverNotification, MaintenanceAlert, Vehicle
from app.services.queries import latest_readings_map

SYSTEM_PROMPT = (
    "You are the FleetMonitor Demo assistant, embedded in a fleet-management "
    "dashboard for a fictitious rental-vehicle fleet in Chile. Answer the "
    "operator's question in English, concisely (a couple of sentences unless "
    "a short list is clearly better), using only the fleet summary given to "
    "you. All vehicles, drivers, and events are synthetic demo data. Do not "
    "invent vehicles, drivers, or events beyond what the summary lists."
)


def build_fleet_summary(db: Session) -> str:
    vehicles = db.query(Vehicle).all()
    readings = latest_readings_map(db)

    by_status: dict[str, int] = {}
    by_city: dict[str, int] = {}
    low_energy: list[str] = []
    gps_offline: list[str] = []
    for v in vehicles:
        by_status[v.status] = by_status.get(v.status, 0) + 1
        by_city[v.base_city] = by_city.get(v.base_city, 0) + 1
        reading = readings.get(v.id)
        if reading and reading.fuel_battery_level < 20:
            low_energy.append(f"{v.plate} ({reading.fuel_battery_level:.0f}%)")
        if reading and not reading.gps_active:
            gps_offline.append(v.plate)

    plate_by_id = {v.id: v.plate for v in vehicles}

    alerts = db.query(MaintenanceAlert).filter_by(resolved=False).all()
    alert_lines = [
        f"{plate_by_id.get(a.vehicle_id, '?')}: {a.type} (due {a.due_date}, severity {a.severity})"
        for a in alerts
    ]

    recent_notifs = (
        db.query(DriverNotification).order_by(DriverNotification.timestamp.desc()).limit(10).all()
    )
    notif_lines = [f"[{n.type}] {plate_by_id.get(n.vehicle_id, '?')}: {n.message}" for n in recent_notifs]

    return "\n".join(
        [
            f"Total vehicles: {len(vehicles)}",
            "By status: " + (", ".join(f"{k}={v}" for k, v in by_status.items()) or "none"),
            "By city: " + (", ".join(f"{k}={v}" for k, v in by_city.items()) or "none"),
            "Vehicles with low fuel/battery (<20%): " + (", ".join(low_energy) or "none"),
            "Vehicles with GPS offline: " + (", ".join(gps_offline) or "none"),
            "Unresolved maintenance alerts: " + ("; ".join(alert_lines) or "none"),
            "Recent notifications (most recent first): " + ("; ".join(notif_lines) or "none"),
        ]
    )


def _rule_based_answer(db: Session, question: str) -> str:
    q = question.lower()
    vehicles = db.query(Vehicle).all()
    readings = latest_readings_map(db)
    plate_by_id = {v.id: v.plate for v in vehicles}

    if "mainten" in q or "alert" in q:
        alerts = db.query(MaintenanceAlert).filter_by(resolved=False).all()
        if not alerts:
            return "No vehicles currently have unresolved maintenance alerts."
        names = [f"{plate_by_id.get(a.vehicle_id, '?')} ({a.type})" for a in alerts[:6]]
        more = "…" if len(alerts) > 6 else ""
        return f"There are {len(alerts)} unresolved maintenance alerts: {', '.join(names)}{more}."

    if any(k in q for k in ("fuel", "battery", "charge", "energy")):
        low = [
            f"{v.plate} ({r.fuel_battery_level:.0f}%)"
            for v in vehicles
            if (r := readings.get(v.id)) and r.fuel_battery_level < 20
        ]
        return (
            f"There are {len(low)} vehicles with a low level (<20%): {', '.join(low)}."
            if low
            else "No vehicles currently have a low fuel/battery level."
        )

    if any(k in q for k in ("notification", "event", "brak", "speed", "driv")):
        recent = db.query(DriverNotification).order_by(DriverNotification.timestamp.desc()).limit(5).all()
        if not recent:
            return "No driver notifications have been generated yet — try running a simulation cycle (POST /simulate)."
        lines = [f"{plate_by_id.get(n.vehicle_id, '?')}: {n.type}" for n in recent]
        return "Most recent notifications: " + "; ".join(lines) + "."

    for city in CITIES:
        if city.lower() in q:
            in_city = [v for v in vehicles if v.base_city == city]
            available = sum(1 for v in in_city if v.status == "available")
            rented = sum(1 for v in in_city if v.status == "rented")
            maintenance = sum(1 for v in in_city if v.status == "maintenance")
            return (
                f"In {city} there are {len(in_city)} vehicles: {available} available, "
                f"{rented} rented, {maintenance} in maintenance."
            )

    if any(k in q for k in ("gps", "offline", "transmit")):
        offline = [v.plate for v in vehicles if (r := readings.get(v.id)) and not r.gps_active]
        return (
            f"{len(offline)} vehicle(s) are not transmitting GPS: {', '.join(offline)}."
            if offline
            else "All vehicles are currently transmitting GPS."
        )

    available = sum(1 for v in vehicles if v.status == "available")
    rented = sum(1 for v in vehicles if v.status == "rented")
    maintenance = sum(1 for v in vehicles if v.status == "maintenance")
    return (
        f"Fleet summary: {len(vehicles)} total vehicles — {available} available, {rented} rented, "
        f"{maintenance} in maintenance, across {len(CITIES)} cities."
    )


def _claude_answer(db: Session, question: str) -> str | None:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    summary = build_fleet_summary(db)
    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=400,
        system=[{"type": "text", "text": SYSTEM_PROMPT}],
        output_config={"effort": "low"},
        messages=[
            {
                "role": "user",
                "content": f"Current fleet state:\n{summary}\n\nQuestion: {question}",
            }
        ],
    )
    if response.stop_reason == "refusal":
        return None
    for block in response.content:
        if block.type == "text":
            return block.text
    return None


def answer_question(db: Session, question: str) -> tuple[str, str]:
    """Returns (answer, source) where source is "claude" or "rule_based"."""
    if settings.ANTHROPIC_API_KEY:
        try:
            answer = _claude_answer(db, question)
            if answer:
                return answer, "claude"
        except Exception:
            # Any SDK/network error falls back to the free rule-based path
            # rather than failing the request.
            pass
    return _rule_based_answer(db, question), "rule_based"
