"""
Pydantic schemas למערכת המחירים ההיררכית.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime
from typing import Optional
from app.models.pricing import PriceEntityType, PriceType, SeasonalPriceRuleType


# ── Seasons ───────────────────────────────────────────────────────────────────

class SeasonBase(BaseModel):
    name:        str = Field(..., min_length=1, max_length=100)
    start_month: int = Field(..., ge=1, le=12)
    start_day:   int = Field(..., ge=1, le=31)
    end_month:   int = Field(..., ge=1, le=12)
    end_day:     int = Field(..., ge=1, le=31)
    is_active:   bool = True


class SeasonCreate(SeasonBase):
    pass


class SeasonUpdate(BaseModel):
    name:        Optional[str] = Field(None, min_length=1, max_length=100)
    start_month: Optional[int] = Field(None, ge=1, le=12)
    start_day:   Optional[int] = Field(None, ge=1, le=31)
    end_month:   Optional[int] = Field(None, ge=1, le=12)
    end_day:     Optional[int] = Field(None, ge=1, le=31)
    is_active:   Optional[bool] = None


class SeasonOut(SeasonBase):
    id:         int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # האם העונה חוצת שנה (end < start)
    wraps_year: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_wraps_year(self) -> "SeasonOut":
        self.wraps_year = (
            (self.end_month, self.end_day)
            < (self.start_month, self.start_day)
        )
        return self


# ── Price Rules ───────────────────────────────────────────────────────────────

class PriceRuleBase(BaseModel):
    name:         Optional[str]             = Field(None, max_length=100)
    entity_type:  PriceEntityType
    entity_value: Optional[str]             = Field(None, max_length=100)
    price_type:   PriceType
    price:        float                     = Field(..., gt=0)
    season_id:    Optional[int]             = None
    priority:     int                       = Field(0, ge=0)
    is_active:    bool                      = True

    @model_validator(mode="after")
    def validate_entity_value(self) -> "PriceRuleBase":
        if self.entity_type != PriceEntityType.global_ and not self.entity_value:
            raise ValueError(
                "entity_value חובה לכל entity_type שאינו global"
            )
        if self.entity_type == PriceEntityType.global_ and self.entity_value:
            raise ValueError(
                "entity_value לא רלוונטי עבור entity_type=global"
            )
        return self


class PriceRuleCreate(PriceRuleBase):
    pass


class PriceRuleUpdate(BaseModel):
    name:         Optional[str]   = None
    price:        Optional[float] = Field(None, gt=0)
    season_id:    Optional[int]   = None
    priority:     Optional[int]   = Field(None, ge=0)
    is_active:    Optional[bool]  = None


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


# ── Israeli Holidays ──────────────────────────────────────────────────────────

class IsraeliHolidayBase(BaseModel):
    name:  str  = Field(..., min_length=1, max_length=100)
    date:  date


class IsraeliHolidayCreate(IsraeliHolidayBase):
    pass


class IsraeliHolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    date: Optional[date] = None


class IsraeliHolidayOut(IsraeliHolidayBase):
    id:                int
    hebrew_year:       Optional[int]      = None
    is_auto_generated: bool
    created_by:        Optional[int]      = None
    created_at:        datetime

    model_config = {"from_attributes": True}


# ── Price Calculation ─────────────────────────────────────────────────────────

class PriceCalculateRequest(BaseModel):
    car_id:      int
    start_date:  date
    end_date:    date
    pickup_time: Optional[str] = None   # "HH:MM"
    return_time: Optional[str] = None   # "HH:MM"

    @model_validator(mode="after")
    def validate_dates(self) -> "PriceCalculateRequest":
        if self.end_date < self.start_date:
            raise ValueError("תאריך סיום חייב להיות אחרי תאריך התחלה")
        return self


class BreakdownLine(BaseModel):
    """שורת פירוט מחיר — עונה/תקופה × ימים × מחיר ליחידה"""
    label:           str              # "3 ימים (קיץ)", "1 שבוע (רגיל)"
    season_name:     Optional[str]    # שם העונה, null = ברירת מחדל
    days:            int              # ימים קלנדריים בתקופה
    billable_days:   float            # ימי חיוב בפועל (אחרי דילוג שבתות/חגים)
    skipped_dates:   list[date]       # תאריכים שדולגו (שבתות / חגים)
    price_type:      PriceType        # סוג המחיר שהופעל
    unit_price:      float            # מחיר ליחידה (ליום / לשבוע / לחודש)
    subtotal:        float            # סכום חלקי


class PriceCalculateResponse(BaseModel):
    total_price:     float
    price_type_used: PriceType
    billable_days:   float            # סה"כ ימי חיוב
    actual_days:     int              # ימים קלנדריים
    price_rule_id:   Optional[int]    # id הכלל שהופעל (null = fallback)
    breakdown:       list[BreakdownLine]
    note:            Optional[str] = None  # הערה (לדוגמה "שבת אחת דולגה")


# ── Holiday Generation ────────────────────────────────────────────────────────

class HolidayGenerateResponse(BaseModel):
    year:    int
    created: int           # כמה חגים נוצרו
    skipped: int           # כמה כבר היו קיימים
    holidays: list[IsraeliHolidayOut]


# ── Seasonal Price Rules ─────────────────────────────────────────────────────
class SeasonalPriceRuleBase(BaseModel):
    season_id:    int
    entity_type:  PriceEntityType
    entity_value: str | None = None
    rule_type:    SeasonalPriceRuleType
    value:        float
    is_active:    bool = True

class SeasonalPriceRuleCreate(SeasonalPriceRuleBase):
    pass

class SeasonalPriceRuleUpdate(BaseModel):
    entity_type:  PriceEntityType | None = None
    entity_value: str | None = None
    rule_type:    SeasonalPriceRuleType | None = None
    value:        float | None = None
    is_active:    bool | None = None

class SeasonalPriceRuleOut(SeasonalPriceRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None
    
    model_config = {"from_attributes": True}
