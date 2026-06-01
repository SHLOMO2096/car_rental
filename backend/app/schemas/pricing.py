"""
Pydantic schemas למערכת המחירים.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime
from typing import Literal, Optional
from app.models.pricing import PriceEntityType


# ── Seasons ───────────────────────────────────────────────────────────────────

class SeasonBase(BaseModel):
    name:                 str  = Field(..., min_length=1, max_length=100)
    season_type:          Optional[Literal["peak", "low"]] = None
    valid_from:           Optional[date] = None
    valid_until:          Optional[date] = None
    is_recurring:         bool = False
    adjustment_type:      Optional[Literal["percent", "fixed"]] = None
    adjustment_direction: Optional[Literal["add", "subtract"]] = None
    adjustment_value:     Optional[float] = Field(None, ge=0)
    is_active:            bool = True

    @model_validator(mode="after")
    def validate_adjustment(self) -> "SeasonBase":
        has_adj = any([
            self.adjustment_type,
            self.adjustment_direction,
            self.adjustment_value is not None,
        ])
        if has_adj:
            if not all([self.adjustment_type, self.adjustment_direction,
                        self.adjustment_value is not None]):
                raise ValueError(
                    "adjustment_type, adjustment_direction, adjustment_value "
                    "חייבים להיות מוגדרים יחד"
                )
        return self


class SeasonCreate(SeasonBase):
    pass


class SeasonUpdate(BaseModel):
    name:                 Optional[str]   = Field(None, min_length=1, max_length=100)
    season_type:          Optional[Literal["peak", "low"]] = None
    valid_from:           Optional[date]  = None
    valid_until:          Optional[date]  = None
    is_recurring:         Optional[bool]  = None
    adjustment_type:      Optional[Literal["percent", "fixed"]] = None
    adjustment_direction: Optional[Literal["add", "subtract"]] = None
    adjustment_value:     Optional[float] = Field(None, ge=0)
    is_active:            Optional[bool]  = None


class SeasonOut(SeasonBase):
    id:         int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Price Rules ───────────────────────────────────────────────────────────────

class PriceRuleBase(BaseModel):
    name:                     Optional[str]          = Field(None, max_length=100)
    entity_type:              PriceEntityType
    entity_value:             Optional[str]          = Field(None, max_length=100)
    price_half_day:           Optional[float]        = Field(None, gt=0)
    price_day:                Optional[float]        = Field(None, gt=0)
    price_week:               Optional[float]        = Field(None, gt=0)
    price_month:              Optional[float]        = Field(None, gt=0)
    exclude_sabbath_holidays: bool                   = True
    season_id:                Optional[int]          = None
    priority:                 int                    = Field(0, ge=0)
    is_active:                bool                   = True

    @model_validator(mode="after")
    def validate_entity_value(self) -> "PriceRuleBase":
        if self.entity_type != PriceEntityType.global_ and not self.entity_value:
            raise ValueError("entity_value חובה לכל entity_type שאינו global")
        if self.entity_type == PriceEntityType.global_ and self.entity_value:
            raise ValueError("entity_value לא רלוונטי עבור entity_type=global")
        return self

    @model_validator(mode="after")
    def validate_at_least_one_price(self) -> "PriceRuleBase":
        if not any([self.price_half_day, self.price_day,
                    self.price_week, self.price_month]):
            raise ValueError("לפחות שדה מחיר אחד חייב להיות מוגדר")
        return self


class PriceRuleCreate(PriceRuleBase):
    pass


class PriceRuleUpdate(BaseModel):
    name:                     Optional[str]   = None
    price_half_day:           Optional[float] = Field(None, gt=0)
    price_day:                Optional[float] = Field(None, gt=0)
    price_week:               Optional[float] = Field(None, gt=0)
    price_month:              Optional[float] = Field(None, gt=0)
    exclude_sabbath_holidays: Optional[bool]  = None
    season_id:                Optional[int]   = None
    priority:                 Optional[int]   = Field(None, ge=0)
    is_active:                Optional[bool]  = None


class SeasonSummary(BaseModel):
    id:   int
    name: str
    model_config = {"from_attributes": True}


class PriceRuleOut(PriceRuleBase):
    id:         int
    created_at: datetime
    updated_at: Optional[datetime] = None
    season:     Optional[SeasonSummary] = None

    model_config = {"from_attributes": True}


# ── Season Rules ──────────────────────────────────────────────────────────────

class SeasonRuleCreate(BaseModel):
    season_id:          int
    price_rule_id:      Optional[int] = None   # null = חל על כל הכללים
    applies_to_half_day: bool = True
    applies_to_day:      bool = True
    applies_to_week:     bool = True
    applies_to_month:    bool = True


class SeasonRuleOut(SeasonRuleCreate):
    id:         int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Israeli Holidays ──────────────────────────────────────────────────────────

class IsraeliHolidayBase(BaseModel):
    name: str  = Field(..., min_length=1, max_length=100)
    date: date


class IsraeliHolidayCreate(IsraeliHolidayBase):
    pass


class IsraeliHolidayUpdate(BaseModel):
    name: Optional[str]  = Field(None, min_length=1, max_length=100)
    date: Optional[date] = None


class IsraeliHolidayOut(IsraeliHolidayBase):
    id:                int
    hebrew_year:       Optional[int]  = None
    is_auto_generated: bool
    created_by:        Optional[int]  = None
    created_at:        datetime

    model_config = {"from_attributes": True}


# ── Price Calculation ─────────────────────────────────────────────────────────

class PriceCalculateRequest(BaseModel):
    vehicle_id:  int
    rental_start: date
    rental_end:   date
    pickup_time:  Optional[str] = None   # "HH:MM"
    return_time:  Optional[str] = None   # "HH:MM"

    @model_validator(mode="after")
    def validate_dates(self) -> "PriceCalculateRequest":
        if self.rental_end < self.rental_start:
            raise ValueError("תאריך סיום חייב להיות אחרי תאריך התחלה")
        return self


class BreakdownLine(BaseModel):
    """שורת פירוט מחיר — קטע × ימים × מחיר ליחידה × מכפיל עונה"""
    segment_start:    date
    segment_end:      date
    price_type:       str               # half_day / day / week / month
    unit_price:       float
    season_multiplier: float = 1.0      # 1.0 = אין עונה
    season_name:      Optional[str] = None
    subtotal:         float
    # מטה-דאטה
    calendar_days:    int
    billable_days:    float
    skipped_dates:    list[date] = []
    label:            str = ""


class PriceCalculateResponse(BaseModel):
    total:     float
    breakdown: list[BreakdownLine]
    note:      Optional[str] = None
    # fields נוספים לשמירה ב-Booking snapshot
    price_type_used: Optional[str]  = None
    billable_days:   Optional[float] = None
    actual_days:     Optional[int]   = None
    price_rule_id:   Optional[int]   = None


# ── Holiday Generation ────────────────────────────────────────────────────────

class HolidayGenerateResponse(BaseModel):
    year:     int
    created:  int
    skipped:  int
    holidays: list[IsraeliHolidayOut]
