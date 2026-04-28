# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel, EmailStr, model_validator
from datetime import date, datetime
from typing import Optional
from app.models.booking import BookingStatus
from app.schemas.car import CarOut

class BookingCreate(BaseModel):
    car_id:          int
    customer_name:   str
    customer_email:  Optional[EmailStr] = None
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
        return self

class BookingUpdate(BaseModel):
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
    email_sent:      bool
    created_at:      datetime
    car:             Optional[CarOut] = None
    model_config = {"from_attributes": True}


# Ensure nested schemas are fully resolved in Pydantic v2.
BookingOut.model_rebuild()
