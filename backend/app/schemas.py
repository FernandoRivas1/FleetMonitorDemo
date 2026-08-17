"""Pydantic request/response schemas."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict


class DriverOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str


class TelemetryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: dt.datetime
    lat: float
    lng: float
    speed_kmh: float
    fuel_battery_level: float
    mileage: float
    gps_active: bool


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plate: str
    model: str
    base_city: str
    status: str
    driver: DriverOut | None
    current: TelemetryOut | None


class VehicleTelemetryOut(BaseModel):
    vehicle_id: int
    readings: list[TelemetryOut]


class MaintenanceAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int
    vehicle_plate: str
    type: str
    severity: str
    due_date: dt.date
    resolved: bool


class DriverNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int
    vehicle_plate: str
    driver_id: int
    driver_name: str
    type: str
    message: str
    timestamp: dt.datetime
    sent: bool


class SimulateResult(BaseModel):
    simulated_date: dt.date
    cycle: int
    readings_created: int
    notifications_created: list[DriverNotificationOut]


class AssistantAskRequest(BaseModel):
    question: str


class AssistantAskResponse(BaseModel):
    answer: str
    source: str  # "claude" | "rule_based"
