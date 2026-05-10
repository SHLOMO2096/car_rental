from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class PayrollUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    hourly_rate: Optional[float] = None

    model_config = {"from_attributes": True}


class PayrollRateUpdate(BaseModel):
    hourly_rate: Optional[float] = None


class PayrollRowOut(BaseModel):
    user_id: int
    full_name: str
    hourly_rate: float
    shifts_count: int
    total_hours: float
    total_pay: float


class PayrollReportOut(BaseModel):
    date_from: date
    date_to: date
    rows: list[PayrollRowOut]
    total_hours: float
    total_pay: float


class PayrollShiftOut(BaseModel):
    id: int
    user_id: int
    work_date: date
    shift_start_at: datetime
    shift_end_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PayrollShiftUpdate(BaseModel):
    shift_start_at: datetime
    shift_end_at: datetime
    work_date: Optional[date] = None


