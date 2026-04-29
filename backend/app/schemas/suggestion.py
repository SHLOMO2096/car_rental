"""
Pydantic schemas for the Reassignment / Suggestions engine.
"""
from pydantic import BaseModel, model_validator
from datetime import date
from typing import Optional


class SuggestionRequest(BaseModel):
    """Input for the suggestions search endpoint.

    Supply either ``car_id`` (specific car) *or* ``group`` (car group letter).
    At least one must be provided.
    """
    car_id:     Optional[int] = None    # specific car (e.g. id=12)
    group:      Optional[str] = None    # group letter (e.g. "C")
    start_date: date
    end_date:   date

    @model_validator(mode="after")
    def require_car_or_group(self):
        if not self.car_id and not self.group:
            raise ValueError("חובה לציין car_id או group")
        if self.start_date >= self.end_date:
            raise ValueError("תאריך התחלה חייב להיות לפני תאריך הסיום")
        return self


class SuggestionResult(BaseModel):
    """One ranked suggestion returned by the engine."""
    type:       str             # "A" | "B" | "C"
    score:      float

    # The car that will serve the NEW request
    car_id:         int
    car_name:       str
    car_make:       Optional[str] = None
    car_group:      Optional[str] = None
    price_per_day:  float
    price_delta:    float       # vs. requested car; positive = upgrade, negative = downgrade

    # Type C only – the existing booking that would be moved
    affected_booking_id:            Optional[int]   = None
    affected_customer_name:         Optional[str]   = None
    affected_booking_start:         Optional[date]  = None
    affected_booking_end:           Optional[date]  = None
    affected_booking_total_price:   Optional[float] = None
    affected_booking_pickup_time:   Optional[str]   = None
    affected_booking_return_time:   Optional[str]   = None
    affected_booking_notes:         Optional[str]   = None
    affected_customer_phone:        Optional[str]   = None
    affected_customer_email:        Optional[str]   = None
    affected_customer_id_num:       Optional[str]   = None
    # The car the affected customer would be moved to (Type C)
    replacement_car_id:             Optional[int]   = None
    replacement_car_name:           Optional[str]   = None
    replacement_car_make:           Optional[str]   = None
    replacement_car_group:          Optional[str]   = None
    replacement_price_per_day:      Optional[float] = None
    replacement_price_delta:        Optional[float] = None  # vs. affected booking's original car
    apply_token:                    Optional[str]   = None

    why:             str    # machine rationale
    operator_summary: str   # short Hebrew UI copy
    risk_level:      str    # "low" | "medium" | "high"

    model_config = {"from_attributes": True}


class SuggestionApplyRequest(BaseModel):
    """Apply payload for a one-step reassignment suggestion (Type C)."""

    apply_token: str
    operator_note: Optional[str] = None



class SuggestionApplyResult(BaseModel):
    applied: bool
    affected_booking_id: int
    from_car_id: int
    to_car_id: int
    freed_car_id: int
    requested_start: date
    requested_end: date
    alert_enqueued: bool
    message: str

