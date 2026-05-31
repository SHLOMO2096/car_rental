"""
Router למערכת המחירים.

Endpoints:
    Seasons     : GET /seasons, POST /seasons, PUT /seasons/{id}, DELETE /seasons/{id}
    Rules       : GET /rules, POST /rules, PUT /rules/{id}, DELETE /rules/{id}
    Season-Rules: GET /season-rules, POST /season-rules, DELETE /season-rules/{id}
    Holidays    : GET /holidays, POST /holidays, PUT /holidays/{id},
                  DELETE /holidays/{id}, POST /holidays/generate/{year}
    Calc        : POST /calculate, GET /effective/{car_id}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from datetime import date

from app.db.session import get_db
from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.audit_log import log_audit_event
from app.crud.pricing import crud_season, crud_price_rule, crud_season_rule, crud_holiday
from app.models.audit_log import AuditSeverity
from app.models.car import Car
from app.models.pricing import PriceEntityType
from app.schemas.pricing import (
    SeasonCreate, SeasonUpdate, SeasonOut,
    PriceRuleCreate, PriceRuleUpdate, PriceRuleOut,
    SeasonRuleCreate, SeasonRuleOut,
    IsraeliHolidayCreate, IsraeliHolidayUpdate, IsraeliHolidayOut,
    PriceCalculateRequest, PriceCalculateResponse,
    HolidayGenerateResponse,
)
from app.services.pricing import calculate_total_price
from app.services.holiday_generator import generate_holidays_for_year

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# Seasons
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PRICING_VIEW)),
):
    if active_only:
        return crud_season.get_active(db)
    return crud_season.get_multi(db, limit=500)


@router.post("/seasons", response_model=SeasonOut, status_code=201)
def create_season(
    data: SeasonCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    season = crud_season.create(db, obj_in=data)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.season.create", entity_type="season",
        entity_id=str(season.id), after_obj=season,
        ip_address=request.client.host if request and request.client else None,
    )
    return season


@router.put("/seasons/{season_id}", response_model=SeasonOut)
def update_season(
    season_id: int,
    data: SeasonUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    season = crud_season.get(db, season_id)
    if not season:
        raise HTTPException(404, "עונה לא נמצאה")
    updated = crud_season.update(db, db_obj=season, obj_in=data)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.season.update", entity_type="season",
        entity_id=str(season_id), after_obj=updated,
        ip_address=request.client.host if request and request.client else None,
    )
    return updated


@router.delete("/seasons/{season_id}", status_code=204)
def delete_season(
    season_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    season = crud_season.get(db, season_id)
    if not season:
        raise HTTPException(404, "עונה לא נמצאה")
    active_rules = [r for r in season.price_rules if r.is_active]
    if active_rules:
        raise HTTPException(
            400,
            f"לא ניתן למחוק עונה עם {len(active_rules)} כללי מחיר פעילים. "
            "בטל תחילה את כל הכללים המשויכים לעונה זו."
        )
    crud_season.update(db, db_obj=season, obj_in=SeasonUpdate(is_active=False))
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.season.deactivate", entity_type="season",
        entity_id=str(season_id),
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Price Rules
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rules", response_model=list[PriceRuleOut])
def list_rules(
    entity_type: PriceEntityType | None = Query(None),
    entity_value: str | None = Query(None),
    season_id: int | None = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PRICING_VIEW)),
):
    return crud_price_rule.get_filtered(
        db,
        entity_type=entity_type,
        entity_value=entity_value,
        season_id=season_id,
        active_only=active_only,
    )


@router.post("/rules", response_model=PriceRuleOut, status_code=201)
def create_rule(
    data: PriceRuleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    if data.season_id:
        if not crud_season.get(db, data.season_id):
            raise HTTPException(404, f"עונה {data.season_id} לא נמצאה")

    try:
        rule = crud_price_rule.create(db, obj_in=data)
    except Exception as e:
        raise HTTPException(400, str(e))

    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.rule.create", entity_type="price_rule",
        entity_id=str(rule.id), after_obj=rule,
        ip_address=request.client.host if request and request.client else None,
    )
    return rule


@router.put("/rules/{rule_id}", response_model=PriceRuleOut)
def update_rule(
    rule_id: int,
    data: PriceRuleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    rule = crud_price_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(404, "כלל מחיר לא נמצא")
    before = {
        "price_day": rule.price_day, "price_week": rule.price_week,
        "price_month": rule.price_month, "is_active": rule.is_active,
    }
    updated = crud_price_rule.update(db, db_obj=rule, obj_in=data)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.rule.update", entity_type="price_rule",
        entity_id=str(rule_id), before_obj=before, after_obj=updated,
        ip_address=request.client.host if request and request.client else None,
    )
    return updated


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    rule = crud_price_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(404, "כלל מחיר לא נמצא")
    crud_price_rule.delete(db, rule_id)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.rule.delete", entity_type="price_rule",
        entity_id=str(rule_id),
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Season Rules
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/season-rules", response_model=list[SeasonRuleOut])
def list_season_rules(
    season_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
):
    if season_id is not None:
        return crud_season_rule.get_by_season(db, season_id)
    from app.models.pricing import SeasonRule
    return db.query(SeasonRule).order_by(SeasonRule.id).all()


@router.post("/season-rules", response_model=SeasonRuleOut, status_code=201)
def create_season_rule(
    data: SeasonRuleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    if not crud_season.get(db, data.season_id):
        raise HTTPException(404, f"עונה {data.season_id} לא נמצאה")
    if data.price_rule_id and not crud_price_rule.get(db, data.price_rule_id):
        raise HTTPException(404, f"כלל מחיר {data.price_rule_id} לא נמצא")

    rule = crud_season_rule.create(db, obj_in=data)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.season_rule.create", entity_type="season_rule",
        entity_id=str(rule.id), after_obj=rule,
        ip_address=request.client.host if request and request.client else None,
    )
    return rule


@router.delete("/season-rules/{rule_id}", status_code=204)
def delete_season_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    rule = crud_season_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(404, "כלל עונה לא נמצא")
    crud_season_rule.delete(db, rule_id)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.season_rule.delete", entity_type="season_rule",
        entity_id=str(rule_id),
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Israeli Holidays
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/holidays", response_model=list[IsraeliHolidayOut])
def list_holidays(
    year: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PRICING_VIEW)),
):
    if year:
        return crud_holiday.get_by_year(db, year)
    return crud_holiday.get_multi(db, limit=1000)


@router.post("/holidays", response_model=IsraeliHolidayOut, status_code=201)
def create_holiday(
    data: IsraeliHolidayCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    existing = crud_holiday.get_by_date(db, data.date)
    if existing:
        raise HTTPException(409, f"חג בתאריך {data.date} כבר קיים: {existing.name}")
    holiday = crud_holiday.create_manual(
        db, date_val=data.date, name=data.name, created_by=current_user.id
    )
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.holiday.create_manual", entity_type="holiday",
        entity_id=str(holiday.id), after_obj=holiday,
        ip_address=request.client.host if request and request.client else None,
    )
    return holiday


@router.put("/holidays/{holiday_id}", response_model=IsraeliHolidayOut)
def update_holiday(
    holiday_id: int,
    data: IsraeliHolidayUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    holiday = crud_holiday.get(db, holiday_id)
    if not holiday:
        raise HTTPException(404, "חג לא נמצא")
    if data.date and data.date != holiday.date:
        existing = crud_holiday.get_by_date(db, data.date)
        if existing:
            raise HTTPException(409, f"חג בתאריך {data.date} כבר קיים: {existing.name}")
    before = {"name": holiday.name, "date": str(holiday.date)}
    updated = crud_holiday.update(db, db_obj=holiday, obj_in=data)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.holiday.update", entity_type="holiday",
        entity_id=str(holiday_id), before_obj=before, after_obj=updated,
        ip_address=request.client.host if request and request.client else None,
    )
    return updated


@router.delete("/holidays/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    holiday = crud_holiday.get(db, holiday_id)
    if not holiday:
        raise HTTPException(404, "חג לא נמצא")
    crud_holiday.delete(db, holiday_id)
    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.holiday.delete", entity_type="holiday",
        entity_id=str(holiday_id),
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


@router.post("/holidays/generate/{year}", response_model=HolidayGenerateResponse)
def generate_holidays(
    year: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PRICING_MANAGE)),
    request: Request = None,
):
    if year < 1900 or year > 2100:
        raise HTTPException(400, "שנה לא תקינה (1900–2100)")

    try:
        generated = generate_holidays_for_year(year)
    except Exception as e:
        raise HTTPException(500, f"שגיאה בחישוב חגים: {e}")

    holidays_to_insert = [
        {"name": h.name, "date": h.date, "hebrew_year": h.hebrew_year}
        for h in generated
    ]
    created_count, skipped_count = crud_holiday.bulk_upsert_generated(db, holidays_to_insert)
    saved = crud_holiday.get_by_year(db, year)

    log_audit_event(
        db, actor_user_id=current_user.id,
        action="pricing.holidays.generate", entity_type="holiday",
        entity_id=str(year),
        after_obj={"year": year, "created": created_count, "skipped": skipped_count},
        ip_address=request.client.host if request and request.client else None,
    )
    return HolidayGenerateResponse(
        year=year,
        created=created_count,
        skipped=skipped_count,
        holidays=[IsraeliHolidayOut.model_validate(h) for h in saved],
    )


# ══════════════════════════════════════════════════════════════════════════════
# Price Calculation
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/calculate", response_model=PriceCalculateResponse)
def calculate_price(
    data: PriceCalculateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PRICING_VIEW)),
):
    """חישוב מחיר לפי רכב + תאריכים."""
    car = db.query(Car).filter(Car.id == data.vehicle_id, Car.is_active == True).first()  # noqa: E712
    if not car:
        raise HTTPException(404, "רכב לא נמצא")

    try:
        result = calculate_total_price(
            db=db,
            car=car,
            start_date=data.rental_start,
            end_date=data.rental_end,
            pickup_time=data.pickup_time,
            return_time=data.return_time,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    return result


@router.get("/effective/{car_id}", response_model=PriceCalculateResponse)
def get_effective_price(
    car_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    pickup_time: str | None = Query(None),
    return_time: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PRICING_VIEW)),
):
    """המחיר האפקטיבי לרכב ספציפי לטווח תאריכים נתון (GET עם query params)."""
    car = db.query(Car).filter(Car.id == car_id, Car.is_active == True).first()  # noqa: E712
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    if end_date < start_date:
        raise HTTPException(400, "תאריך סיום חייב להיות אחרי תאריך התחלה")

    try:
        result = calculate_total_price(
            db=db,
            car=car,
            start_date=start_date,
            end_date=end_date,
            pickup_time=pickup_time,
            return_time=return_time,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    return result
