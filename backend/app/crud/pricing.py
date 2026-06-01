"""
CRUD operations עבור מודלי מחירים: Season, PriceRule, SeasonRule, IsraeliHoliday.
"""
from __future__ import annotations
from datetime import date
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.pricing import (
    Season, PriceRule, SeasonRule, IsraeliHoliday, PriceEntityType,
)
from app.schemas.pricing import (
    SeasonCreate, SeasonUpdate,
    PriceRuleCreate, PriceRuleUpdate,
    SeasonRuleCreate,
    IsraeliHolidayCreate, IsraeliHolidayUpdate,
)


# ── Seasons ───────────────────────────────────────────────────────────────────

class CRUDSeason(CRUDBase[Season, SeasonCreate, SeasonUpdate]):

    def get_active(self, db: Session) -> list[Season]:
        return (
            db.query(Season)
            .filter(Season.is_active == True)   # noqa: E712
            .order_by(Season.id)
            .all()
        )

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
        season_id: int | None = None,
        active_only: bool = True,
    ) -> list[PriceRule]:
        q = db.query(PriceRule)
        if active_only:
            q = q.filter(PriceRule.is_active == True)   # noqa: E712
        if entity_type is not None:
            q = q.filter(PriceRule.entity_type == entity_type.value)
        if entity_value is not None:
            q = q.filter(PriceRule.entity_value == entity_value)
        if season_id is not None:
            q = q.filter(PriceRule.season_id == season_id)
        return q.order_by(
            PriceRule.entity_type,
            PriceRule.entity_value,
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


crud_price_rule = CRUDPriceRule(PriceRule)


# ── Season Rules ──────────────────────────────────────────────────────────────

class CRUDSeasonRule(CRUDBase[SeasonRule, SeasonRuleCreate, SeasonRuleCreate]):

    def get_by_season(self, db: Session, season_id: int) -> list[SeasonRule]:
        return (
            db.query(SeasonRule)
            .filter(SeasonRule.season_id == season_id)
            .all()
        )

    def create(self, db: Session, obj_in: SeasonRuleCreate) -> SeasonRule:
        obj = SeasonRule(**obj_in.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj


crud_season_rule = CRUDSeasonRule(SeasonRule)


# ── Israeli Holidays ──────────────────────────────────────────────────────────

class CRUDIsraeliHoliday(CRUDBase[IsraeliHoliday, IsraeliHolidayCreate, IsraeliHolidayUpdate]):

    def get_by_year(self, db: Session, year: int) -> list[IsraeliHoliday]:
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
        holidays: list[dict],
    ) -> tuple[int, int]:
        created = 0
        skipped = 0
        for h in holidays:
            if self.get_by_date(db, h["date"]):
                skipped += 1
                continue
            db.add(IsraeliHoliday(
                name=h["name"],
                date=h["date"],
                hebrew_year=h.get("hebrew_year"),
                is_auto_generated=True,
            ))
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
