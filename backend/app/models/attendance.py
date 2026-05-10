import uuid

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class AttendanceShift(Base):
    __tablename__ = "attendance_shifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Shift boundaries (UTC)
    shift_start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    shift_end_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Useful for reporting/grouping (derived by server timezone policy)
    work_date = Column(Date, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    device_sessions = relationship(
        "AttendanceDeviceSession",
        back_populates="shift",
        cascade="all, delete-orphan",
    )


class AttendanceDeviceSession(Base):
    __tablename__ = "attendance_device_sessions"

    id = Column(Integer, primary_key=True, index=True)

    shift_id = Column(Integer, ForeignKey("attendance_shifts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Stable identifier per browser/device (sent by client via X-Device-Id)
    device_id = Column(String(64), nullable=False, index=True)
    device_label = Column(String(255), nullable=True)

    clock_in_at = Column(DateTime(timezone=True), nullable=False, index=True)
    clock_out_at = Column(DateTime(timezone=True), nullable=True, index=True)

    clock_in_ip = Column(String(64), nullable=True)
    clock_out_ip = Column(String(64), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shift = relationship("AttendanceShift", back_populates="device_sessions")
    user = relationship("User")


def normalize_device_id(device_id: str | None) -> str | None:
    """Normalize device id: accept UUIDs/strings, trim whitespace; return None if empty."""
    if not device_id:
        return None
    v = str(device_id).strip()
    if not v:
        return None
    # If a UUID-like string was sent, normalize its formatting.
    try:
        return str(uuid.UUID(v))
    except Exception:
        return v

