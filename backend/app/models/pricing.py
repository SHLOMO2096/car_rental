import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Enum, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class PriceEntityType(str, enum.Enum):
    car      = "car"
    group    = "group"
    category = "category"
    global_  = "global"


class PriceType(str, enum.Enum):
    daily    = "daily"
    half_day = "half_day"
    weekly   = "weekly"
    monthly  = "monthly"


class Season(Base):
    """עונת מחיר — תקופה עם שמות בשנה (תומכת ב-wrap-around כגון 25/12–2/1)"""
    __tablename__ = "seasons"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False)      # "קיץ", "חגי תשרי"
    start_month = Column(Integer, nullable=False)           # 1–12
    start_day   = Column(Integer, nullable=False)           # 1–31
    end_month   = Column(Integer, nullable=False)           # 1–12
    end_day     = Column(Integer, nullable=False)           # 1–31
    # אם (end_month, end_day) < (start_month, start_day) → עונה חוצת שנה
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    price_rules = relationship("PriceRule", back_populates="season")


class PriceRule(Base):
    """כלל מחיר — ברמת רכב / קבוצה / קטגוריה / גלובלי, לסוג מחיר ועונה ספציפית"""
    __tablename__ = "price_rules"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), nullable=True)       # תיאור ידידותי (אופציונלי)
    entity_type  = Column(Enum(PriceEntityType), nullable=False, index=True)
    # entity_value: car_id (as str) / group letter / category name / None for global
    entity_value = Column(String(100), nullable=True, index=True)
    price_type   = Column(Enum(PriceType), nullable=False)
    price        = Column(Float, nullable=False)
    season_id    = Column(Integer, ForeignKey("seasons.id", ondelete="SET NULL"), nullable=True, index=True)
    priority     = Column(Integer, default=0, nullable=False)  # גבוה יותר ינצח בחפיפות
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    season = relationship("Season", back_populates="price_rules")

    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_value", "price_type", "season_id",
            name="uq_price_rule_entity_type_season"
        ),
        Index("ix_price_rules_entity", "entity_type", "entity_value", "price_type"),
    )


class SeasonalPriceRuleType(str, enum.Enum):
    discount_percent = "discount_percent"
    discount_fixed = "discount_fixed"
    surcharge_percent = "surcharge_percent"
    surcharge_fixed = "surcharge_fixed"


class SeasonalPriceRule(Base):
    """כלל מחיר עונתי — הנחה/תוספת לעונה, ברמת רכב/קבוצה/קטגוריה/גלובלי"""
    __tablename__ = "seasonal_price_rules"

    id           = Column(Integer, primary_key=True, index=True)
    season_id    = Column(Integer, ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type  = Column(Enum(PriceEntityType), nullable=False, index=True)
    entity_value = Column(String(100), nullable=True, index=True)
    rule_type    = Column(Enum(SeasonalPriceRuleType), nullable=False)
    value        = Column(Float, nullable=False)
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    season = relationship("Season")


class IsraeliHoliday(Base):
    """חג ישראלי — תאריך גרגוריאני של חגי ישראל שלא נחשבים בחיוב יומי/שבועי"""
    __tablename__ = "israeli_holidays"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(100), nullable=False)   # "ראש השנה", "יום כיפור"
    date              = Column(Date, unique=True, nullable=False, index=True)
    hebrew_year       = Column(Integer, nullable=True)        # שנה עברית
    is_auto_generated = Column(Boolean, default=False, nullable=False)
    # מי הוסיף ידנית (null = ייבוא אוטומטי)
    created_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])
