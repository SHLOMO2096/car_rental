from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional

from app.models.user import UserRole


class AttendanceClockInRequest(BaseModel):
    notes: Optional[str] = None


class AttendanceClockOutRequest(BaseModel):
    notes: Optional[str] = None


class AttendanceDeviceSessionOut(BaseModel):
    id: int
    shift_id: int
    device_id: str
    device_label: Optional[str] = None
    clock_in_at: datetime
    clock_out_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttendanceShiftOut(BaseModel):
    id: int
    user_id: int
    work_date: date
    shift_start_at: datetime
    shift_end_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttendanceStatusOut(BaseModel):
    open_shift: Optional[AttendanceShiftOut] = None
    open_device_sessions: list[AttendanceDeviceSessionOut] = []


class AttendanceClockInResponse(BaseModel):
    shift: AttendanceShiftOut
    device_session: AttendanceDeviceSessionOut
    # for convenience
    open_device_sessions: list[AttendanceDeviceSessionOut] = []


class AttendanceClockOutResponse(BaseModel):
    shift: AttendanceShiftOut
    device_session: AttendanceDeviceSessionOut
    open_device_sessions: list[AttendanceDeviceSessionOut] = []


# ── Admin/Manager reporting & retroactive adjustments ─────────────────────────


class AttendanceUserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class AttendanceShiftUpdate(BaseModel):
    shift_start_at: datetime
    shift_end_at: datetime
    work_date: Optional[date] = None


