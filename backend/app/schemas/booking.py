# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel, EmailStr, model_validator, computed_field
from datetime import date, datetime
from typing import Optional, Any
from app.models.booking import BookingStatus
from app.schemas.car import CarOut

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
        if self.start_date < date.today():
            raise ValueError("לא ניתן ליצור הזמנה לתאריך עבר")
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
    notes:           Optional[str]           = None
    status:          Optional[BookingStatus] = None

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
    # ── Audit fields ──────────────────────────────────────────────────────────
    created_by:      Optional[int]      = None
    created_by_name: Optional[str]      = None   # שם היוצר (מה-relation)
    created_at:      datetime
    updated_at:      Optional[datetime] = None
    deleted_at:      Optional[datetime] = None
    deleted_by:      Optional[int]      = None
    deleted_by_name: Optional[str]      = None   # שם המוחק (מה-relation)
    # ── Relations ─────────────────────────────────────────────────────────────
    car:             Optional[CarOut] = None
    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj: Any, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        # מלא created_by_name מה-agent relation אם קיים
        if hasattr(obj, "agent") and obj.agent:
            instance.created_by_name = obj.agent.full_name
        # מלא deleted_by_name מה-deleted_by_user relation אם קיים
        if hasattr(obj, "deleted_by_user") and obj.deleted_by_user:
            instance.deleted_by_name = obj.deleted_by_user.full_name
        return instance


# Ensure nested schemas are fully resolved in Pydantic v2.
BookingOut.model_rebuild()
