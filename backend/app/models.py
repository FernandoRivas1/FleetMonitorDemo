"""SQLAlchemy ORM models. All data is synthetic — see README."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plate: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    model: Mapped[str] = mapped_column(String(64))
    base_city: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16))  # available | rented | maintenance

    driver: Mapped["Driver"] = relationship(back_populates="vehicle", uselist=False, cascade="all, delete-orphan")
    telemetry: Mapped[list["TelemetryReading"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")
    alerts: Mapped[list["MaintenanceAlert"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")
    notifications: Mapped[list["DriverNotification"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str] = mapped_column(String(32))  # fictitious, masked e.g. "+56 9 ****1234"
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), unique=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="driver")


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    timestamp: Mapped[dt.datetime] = mapped_column(DateTime, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    speed_kmh: Mapped[float] = mapped_column(Float)
    fuel_battery_level: Mapped[float] = mapped_column(Float)  # 0-100
    mileage: Mapped[float] = mapped_column(Float)  # cumulative km
    gps_active: Mapped[bool] = mapped_column(Boolean, default=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="telemetry")


class MaintenanceAlert(Base):
    __tablename__ = "maintenance_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    type: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(16))  # low | medium | high
    due_date: Mapped[dt.date] = mapped_column(Date)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    # Internal bookkeeping so the notification engine doesn't re-notify every cycle.
    notified_due_soon: Mapped[bool] = mapped_column(Boolean, default=False)
    notified_overdue: Mapped[bool] = mapped_column(Boolean, default=False)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="alerts")


class DriverNotification(Base):
    __tablename__ = "driver_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    type: Mapped[str] = mapped_column(String(32))  # hard_brake | overspeed | maintenance_due_soon | maintenance_overdue | gps_offline
    message: Mapped[str] = mapped_column(String(512))
    timestamp: Mapped[dt.datetime] = mapped_column(DateTime, index=True)
    sent: Mapped[bool] = mapped_column(Boolean, default=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="notifications")
    driver: Mapped["Driver"] = relationship()


class SimulationState(Base):
    """Single-row table tracking the demo's simulated clock, so repeated
    POST /simulate calls advance time deterministically instead of relying
    on real wall-clock days passing."""

    __tablename__ = "simulation_state"
    __table_args__ = (UniqueConstraint("singleton", name="uq_simulation_state_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    singleton: Mapped[int] = mapped_column(Integer, default=1)
    current_time: Mapped[dt.datetime] = mapped_column(DateTime)
    cycle_count: Mapped[int] = mapped_column(Integer, default=0)
