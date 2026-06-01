# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel, EmailStr, model_validator
from datetime import date, datetime
from typing import Optional, Any
from app.models.booking import BookingStatus
from app.schemas.car import CarOut


def parse_booking_time(value: Optional[str]) -> Optional[datetime.time]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError as exc:
        raise ValueError("שעת האיסוף/החזרה חייבת להיות בפורמט HH:MM") from exc


def ensure_booking_start_not_in_past(start_date: date, pickup_time: Optional[str]) -> None:
    parsed_pickup_time = parse_booking_time(pickup_time)
    if start_date != date.today() or parsed_pickup_time is None:
        return

    now_time = datetime.now().replace(second=0, microsecond=0).time()
    if parsed_pickup_time < now_time:
        raise ValueError("לא ניתן ליצור או לעדכן הזמנה להיום בשעת איסוף שכבר עברה")

class BookingCreate(BaseModel):
    car_id:          int
    customer_id:     Optional[int]      = None
    customer_name:   str
    customer_email:  Optional[EmailStr] = None
    customer_has_no_email: bool         = False
    customer_phone:  Optional[str]      = None
    customer_id_num: Optional[str]      = None
    start_date:      date
    end_date:        date
    pickup_time:     Optional[str]      = None   # "HH:MM"
    return_time:     Optional[str]      = None   # "HH:MM"
    notes:           Optional[str]      = None

    @model_validator(mode="after")
    def dates_valid(self):
        if self.end_date < self.start_date:
            raise ValueError("תאריך סיום חייב להיות אחרי תאריך התחלה")
        if self.customer_has_no_email and self.customer_email:
            raise ValueError("לא ניתן לסמן שאין מייל וגם להזין כתובת מייל")
        if not self.customer_has_no_email and not self.customer_email:
            raise ValueError("יש להזין כתובת מייל תקינה או לסמן שאין מייל ללקוח")
        return self

class BookingUpdate(BaseModel):
    car_id:          Optional[int]           = None
    customer_id:     Optional[int]           = None
    customer_name:   Optional[str]           = None
    customer_email:  Optional[EmailStr]      = None
    customer_phone:  Optional[str]           = None
    customer_id_num: Optional[str]           = None
    start_date:      Optional[date]          = None
    end_date:        Optional[date]          = None
    pickup_time:     Optional[str]           = None
    return_time:     Optional[str]           = None
    operator_note:   Optional[str]           = None
    notes:           Optional[str]           = None
    status:          Optional[BookingStatus] = None
    # ── Price Override ─────────────────────────────────────────────────────────
    # שינוי ידני של מחיר — חייב ללוות תיעוד ב-price_override_reason
    # כל שינוי נרשם ב-audit_log אוטומטית
    price_override:        Optional[float] = None
    price_override_reason: Optional[str]   = None

    @model_validator(mode="after")
    def validate_override(self) -> "BookingUpdate":
        if self.price_override is not None and not self.price_override_reason:
            raise ValueError(
                "חובה לספק סיבה (price_override_reason) בעת שינוי מחיר ידני"
            )
        if self.price_override is not None and self.price_override <= 0:
            raise ValueError("מחיר override חייב להיות חיובי")
        return self


class BookingDeleteRequest(BaseModel):
    operator_note: Optional[str] = None

class BookingOut(BaseModel):
    id:              int
    car_id:          int
    customer_id:     Optional[int] = None
    customer_name:   str
    customer_email:  Optional[str] = None
    customer_phone:  Optional[str] = None
    customer_id_num: Optional[str] = None
    start_date:      date
    end_date:        date
    pickup_time:     Optional[str] = None
    return_time:     Optional[str] = None
    total_price:     Optional[float] = None
    status:          BookingStatus
    notes:           Optional[str] = None
    drive_link:      Optional[str] = None
    email_sent:      bool
    # ── Pricing details ────────────────────────────────────────────────────────
    billable_days:           Optional[float]     = None   # ימי חיוב (אחרי דילוג שבת/חג)
    actual_days:             Optional[int]        = None   # ימים קלנדריים
    price_type_used:         Optional[str]         = None   # half_day / day / week / month
    price_rule_id:           Optional[int]        = None   # id הכלל שהופעל
    price_breakdown_json:    Optional[str]        = None   # פירוט JSON
    # ── Price Override ─────────────────────────────────────────────────────────
    # שינוי ידני מתועד — כל override נרשם ב-audit_log
    price_override:          Optional[float]     = None
    price_override_reason:   Optional[str]       = None
    price_override_by:       Optional[int]       = None
    price_override_at:       Optional[datetime]  = None
    price_override_by_name:  Optional[str]       = None   # שם המשתמש שביצע override
    # ── Audit fields ──────────────────────────────────────────────────────────
    created_by:      Optional[int]      = None
    created_by_name: Optional[str]      = None
    updated_by:      Optional[int]      = None
    updated_by_name: Optional[str]      = None
    created_at:      datetime
    updated_at:      Optional[datetime] = None
    deleted_at:      Optional[datetime] = None
    deleted_by:      Optional[int]      = None
    deleted_by_name: Optional[str]      = None
    # ── Relations ─────────────────────────────────────────────────────────────
    car:             Optional[CarOut] = None
    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj: Any, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        if hasattr(obj, "agent") and obj.agent:
            instance.created_by_name = obj.agent.full_name
        if hasattr(obj, "updated_by_user") and obj.updated_by_user:
            instance.updated_by_name = obj.updated_by_user.full_name
        if hasattr(obj, "deleted_by_user") and obj.deleted_by_user:
            instance.deleted_by_name = obj.deleted_by_user.full_name
        if hasattr(obj, "price_override_user") and obj.price_override_user:
            instance.price_override_by_name = obj.price_override_user.full_name
        return instance


# Ensure nested schemas are fully resolved in Pydantic v2.
BookingOut.model_rebuild()
