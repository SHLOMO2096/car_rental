import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class PriceEntityType(str, enum.Enum):
    car      = "car"
    model    = "model"
    category = "category"
    global_  = "global"


class Season(Base):
    """עונת מחיר — תקופה עם תאריכי DATE + אפשרות חזרה שנתית."""
    __tablename__ = "seasons"

    id                   = Column(Integer, primary_key=True, index=True)
    name                 = Column(String(100), nullable=False)
    season_type          = Column(String(10), nullable=True)   # peak / low
    valid_from           = Column(Date, nullable=True)
    valid_until          = Column(Date, nullable=True)
    # כשמסומן — המערכת מתעלמת מהשנה ומשווה חודש+יום בלבד
    is_recurring         = Column(Boolean, default=False, nullable=False)
    # adjustment חל על כלל המחיר שמשויך לעונה דרך season_rules
    adjustment_type      = Column(String(10), nullable=True)   # percent / fixed
    adjustment_direction = Column(String(10), nullable=True)   # add / subtract
    adjustment_value     = Column(Float, nullable=True)
    is_active            = Column(Boolean, default=True, nullable=False)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    price_rules  = relationship("PriceRule", back_populates="season")
    season_rules = relationship("SeasonRule", back_populates="season",
                                cascade="all, delete-orphan")


class PriceRule(Base):
    """
    כלל מחיר — ברמת רכב / קבוצה / קטגוריה / גלובלי.
    4 שדות מחיר נפרדים (nullable) במקום שורה לכל price_type.
    """
    __tablename__ = "price_rules"

    id                       = Column(Integer, primary_key=True, index=True)
    name                     = Column(String(100), nullable=True)
    entity_type              = Column(String(20), nullable=False, index=True)
    entity_value             = Column(String(100), nullable=True, index=True)
    # 4 שדות מחיר — null = לא מוגדר, יורש מרמה גבוהה יותר
    price_half_day           = Column(Float, nullable=True)
    price_day                = Column(Float, nullable=True)
    price_week               = Column(Float, nullable=True)
    price_month              = Column(Float, nullable=True)
    exclude_sabbath_holidays = Column(Boolean, default=True, nullable=False)
    season_id                = Column(Integer, ForeignKey("seasons.id", ondelete="SET NULL"),
                                      nullable=True, index=True)
    priority                 = Column(Integer, default=0, nullable=False)
    is_active                = Column(Boolean, default=True, nullable=False)
    created_at               = Column(DateTime(timezone=True), server_default=func.now())
    updated_at               = Column(DateTime(timezone=True), onupdate=func.now())

    season       = relationship("Season", back_populates="price_rules")
    season_rules = relationship("SeasonRule", back_populates="price_rule")

    __table_args__ = (
        Index("ix_price_rules_entity", "entity_type", "entity_value"),
    )


class SeasonRule(Base):
    """
    קישור עונה → כלל מחיר ספציפי (או לכל הכללים אם price_rule_id=NULL).
    מגדיר אילו סוגי מחיר מקבלים את ה-adjustment של העונה.
    """
    __tablename__ = "season_rules"

    id                  = Column(Integer, primary_key=True, index=True)
    season_id           = Column(Integer, ForeignKey("seasons.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    price_rule_id       = Column(Integer, ForeignKey("price_rules.id", ondelete="CASCADE"),
                                 nullable=True, index=True)
    applies_to_half_day = Column(Boolean, default=True, nullable=False)
    applies_to_day      = Column(Boolean, default=True, nullable=False)
    applies_to_week     = Column(Boolean, default=True, nullable=False)
    applies_to_month    = Column(Boolean, default=True, nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    season     = relationship("Season", back_populates="season_rules")
    price_rule = relationship("PriceRule", back_populates="season_rules")


class IsraeliHoliday(Base):
    """חג ישראלי — תאריך גרגוריאני של חגי ישראל שלא נחשבים בחיוב יומי/שבועי."""
    __tablename__ = "israeli_holidays"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(100), nullable=False)
    date              = Column(Date, unique=True, nullable=False, index=True)
    hebrew_year       = Column(Integer, nullable=True)
    is_auto_generated = Column(Boolean, default=False, nullable=False)
    created_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])
