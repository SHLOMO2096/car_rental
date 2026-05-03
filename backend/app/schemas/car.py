# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
from app.models.car import CarType

class CarCreate(BaseModel):
    name:          str
    make:          Optional[str] = None
    type:          Optional[CarType] = None
    group:         Optional[str] = None
    year:          int
    plate:         str
    color:         Optional[str] = None
    price_per_day: Optional[float] = None
    category:      Optional[str] = None
    is_hybrid:     Optional[bool] = False
    test_date:     Optional[str] = None
    description:   Optional[str] = None
    image_url:     Optional[str] = None

    @field_validator("year")
    @classmethod
    def valid_year(cls, v):
        if not (1990 <= v <= 2030):
            raise ValueError("שנה לא תקינה")
        return v

    @field_validator("price_per_day")
    @classmethod
    def positive_price(cls, v):
        if v is not None and v <= 0:
            raise ValueError("מחיר חייב להיות חיובי")
        return v

class CarUpdate(BaseModel):
    name:          Optional[str]   = None
    make:          Optional[str]   = None
    type:          Optional[CarType] = None
    color:         Optional[str]   = None
    group:         Optional[str]   = None
    year:          Optional[int]   = None
    plate:         Optional[str]   = None
    category:      Optional[str]   = None
    is_hybrid:     Optional[bool]  = None
    test_date:     Optional[str]   = None
    price_per_day: Optional[float] = None
    description:   Optional[str]   = None
    image_url:     Optional[str]   = None
    is_active:     Optional[bool]  = None

class CarOut(BaseModel):
    id:            int
    name:          str
    make:          Optional[str]
    type:          Optional[CarType]
    group:         Optional[str]
    year:          int
    plate:         str
    color:         Optional[str]
    price_per_day: Optional[float]
    category:      Optional[str] = None
    is_hybrid:     Optional[bool] = False
    test_date:     Optional[str] = None
    description:   Optional[str]
    image_url:     Optional[str]
    is_active:     bool
    created_at:    datetime
    model_config = {"from_attributes": True}

# ══════════════════════════════════════════════════════════════════════════════
