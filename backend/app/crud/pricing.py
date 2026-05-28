"""
CRUD operations עבור מודלי מחירים: Season, PriceRule, IsraeliHoliday.
"""
from __future__ import annotations
from datetime import date
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.pricing import Season, PriceRule, IsraeliHoliday, PriceEntityType, PriceType
from app.schemas.pricing import (
    SeasonCreate, SeasonUpdate,
    PriceRuleCreate, PriceRuleUpdate,
    IsraeliHolidayCreate, IsraeliHolidayUpdate,
)


# ── Seasons ───────────────────────────────────────────────────────────────────

class CRUDSeason(CRUDBase[Season, SeasonCreate, SeasonUpdate]):

    def get_active(self, db: Session) -> list[Season]:
        return db.query(Season).filter(Season.is_active == True).order_by(Season.id).all()  # noqa: E712

    def create(self, db: Session, obj_in: SeasonCreate) -> Season:
        obj = Season(**obj_in.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, db_obj: Season, obj_in: SeasonUpdate) -> Season:
        data = obj_in.model_dump(exclude_none=True)
        for k, v in data.items():
            setattr(db_obj, k, v)
        db.commit()
        db.refresh(db_obj)
        return db_obj


crud_season = CRUDSeason(Season)


# ── Price Rules ───────────────────────────────────────────────────────────────

class CRUDPriceRule(CRUDBase[PriceRule, PriceRuleCreate, PriceRuleUpdate]):

    def get_filtered(
        self,
        db: Session,
        *,
        entity_type: PriceEntityType | None = None,
        entity_value: str | None = None,
        price_type: PriceType | None = None,
        season_id: int | None = None,
        active_only: bool = True,
    ) -> list[PriceRule]:
        q = db.query(PriceRule)
        if active_only:
            q = q.filter(PriceRule.is_active == True)  # noqa: E712
        if entity_type is not None:
            q = q.filter(PriceRule.entity_type == entity_type)
        if entity_value is not None:
            q = q.filter(PriceRule.entity_value == entity_value)
        if price_type is not None:
            q = q.filter(PriceRule.price_type == price_type)
        if season_id is not None:
            q = q.filter(PriceRule.season_id == season_id)
        return q.order_by(
            PriceRule.entity_type,
            PriceRule.entity_value,
            PriceRule.price_type,
            PriceRule.priority.desc(),
        ).all()

    def create(self, db: Session, obj_in: PriceRuleCreate) -> PriceRule:
        obj = PriceRule(**obj_in.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, db_obj: PriceRule, obj_in: PriceRuleUpdate) -> PriceRule:
        data = obj_in.model_dump(exclude_none=True)
        for k, v in data.items():
            setattr(db_obj, k, v)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_matrix(self, db: Session) -> list[PriceRule]:
        """כל הכללים הפעילים ממוינים לתצוגת מטריצה."""
        return (
            db.query(PriceRule)
            .filter(PriceRule.is_active == True)  # noqa: E712
            .order_by(
                PriceRule.entity_type,
                PriceRule.entity_value,
                PriceRule.season_id,
                PriceRule.price_type,
            )
            .all()
        )


crud_price_rule = CRUDPriceRule(PriceRule)


# ── Israeli Holidays ──────────────────────────────────────────────────────────

class CRUDIsraeliHoliday(CRUDBase[IsraeliHoliday, IsraeliHolidayCreate, IsraeliHolidayUpdate]):

    def get_by_year(self, db: Session, year: int) -> list[IsraeliHoliday]:
        """כל החגים שהתאריך שלהם נמצא בשנה גרגוריאנית נתונה."""
        return (
            db.query(IsraeliHoliday)
            .filter(
                IsraeliHoliday.date >= date(year, 1, 1),
                IsraeliHoliday.date <= date(year, 12, 31),
            )
            .order_by(IsraeliHoliday.date)
            .all()
        )

    def get_in_range(self, db: Session, start: date, end: date) -> list[IsraeliHoliday]:
        """חגים בטווח תאריכים."""
        return (
            db.query(IsraeliHoliday)
            .filter(IsraeliHoliday.date >= start, IsraeliHoliday.date <= end)
            .order_by(IsraeliHoliday.date)
            .all()
        )

    def get_by_date(self, db: Session, d: date) -> IsraeliHoliday | None:
        return db.query(IsraeliHoliday).filter(IsraeliHoliday.date == d).first()

    def create_manual(
        self,
        db: Session,
        date_val: date,
        name: str,
        created_by: int | None = None,
    ) -> IsraeliHoliday:
        obj = IsraeliHoliday(
            name=name,
            date=date_val,
            is_auto_generated=False,
            created_by=created_by,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def bulk_upsert_generated(
        self,
        db: Session,
        holidays: list[dict],   # [{"name": str, "date": date, "hebrew_year": int}]
    ) -> tuple[int, int]:
        """
        מוסיף חגים שנוצרו אוטומטית.
        מחזיר (created_count, skipped_count).
        """
        created = 0
        skipped = 0
        for h in holidays:
            existing = self.get_by_date(db, h["date"])
            if existing:
                skipped += 1
                continue
            obj = IsraeliHoliday(
                name=h["name"],
                date=h["date"],
                hebrew_year=h.get("hebrew_year"),
                is_auto_generated=True,
            )
            db.add(obj)
            created += 1
        if created:
            db.commit()
        return created, skipped

    def update(self, db: Session, db_obj: IsraeliHoliday, obj_in: IsraeliHolidayUpdate) -> IsraeliHoliday:
        data = obj_in.model_dump(exclude_none=True)
        for k, v in data.items():
            setattr(db_obj, k, v)
        db.commit()
        db.refresh(db_obj)
        return db_obj


crud_holiday = CRUDIsraeliHoliday(IsraeliHoliday)

