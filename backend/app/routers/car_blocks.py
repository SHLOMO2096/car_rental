# ══════════════════════════════════════════════════════════════════════════════
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.audit_log import log_audit_event
from app.crud.booking import crud_booking
from app.crud.car_block import crud_car_block
from app.db.session import get_db
from app.models.audit_log import AuditSeverity
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.models.car_block import CarBlock
from app.models.user import User
from app.schemas.car_block import CarBlockCreate, CarBlockOut, CarBlockUpdate

router = APIRouter()


def _out(block: CarBlock) -> CarBlockOut:
    data = CarBlockOut.model_validate(block)
    data.created_by_name = block.created_by_user.full_name if block.created_by_user else None
    data.car_name = block.car.name if block.car else None
    data.car_plate = block.car.plate if block.car else None
    return data


def _require_car(db: Session, car_id: int) -> Car:
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    return car


def _active_bookings_in_range(db: Session, car_id: int, start: Date, end: Date) -> list[Booking]:
    """הזמנות פעילות שכבר תפוסות בתוך הטווח — השבתה לא תדרוס אותן בשקט."""
    return (
        db.query(Booking)
        .filter(
            Booking.car_id == car_id,
            Booking.deleted_at.is_(None),
            Booking.status == BookingStatus.active,
            Booking.start_date <= end,
            Booking.end_date >= start,
        )
        .order_by(Booking.start_date)
        .all()
    )


def _conflict_detail(bookings: list[Booking]) -> str:
    head = ", ".join(f"#{b.id} {b.customer_name} ({b.start_date}–{b.end_date})" for b in bookings[:3])
    more = f" ועוד {len(bookings) - 3}" if len(bookings) > 3 else ""
    return f"יש הזמנות פעילות בטווח הזה: {head}{more}. יש להעביר או לבטל אותן לפני ההשבתה."


@router.get("/", response_model=list[CarBlockOut])
def list_blocks(
    start: Date = Query(...),
    end: Date = Query(...),
    car_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CARS_VIEW)),
):
    return [_out(b) for b in crud_car_block.list_range(db, start, end, car_id=car_id)]


@router.post("/", response_model=CarBlockOut, status_code=201)
def create_block(
    payload: CarBlockCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CARS_MANAGE)),
):
    car = _require_car(db, payload.car_id)

    if crud_car_block.has_overlap(db, payload.car_id, payload.start_date, payload.end_date):
        raise HTTPException(409, "כבר קיימת השבתה שחופפת לטווח הזה")

    clashes = _active_bookings_in_range(db, payload.car_id, payload.start_date, payload.end_date)
    if clashes:
        raise HTTPException(409, _conflict_detail(clashes))

    block = CarBlock(
        car_id=payload.car_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason.value,
        note=payload.note,
        created_by=current_user.id,
    )
    db.add(block)
    db.commit()
    db.refresh(block)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car_block.create",
        entity_type="car_block",
        entity_id=str(block.id),
        after_obj={
            "car_id": car.id, "car_name": car.name, "plate": car.plate,
            "start_date": str(block.start_date), "end_date": str(block.end_date),
            "reason": block.reason, "note": block.note,
        },
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.warning,
    )
    return _out(block)


@router.patch("/{block_id}", response_model=CarBlockOut)
def update_block(
    block_id: int,
    payload: CarBlockUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CARS_MANAGE)),
):
    block = crud_car_block.get(db, block_id)
    if not block:
        raise HTTPException(404, "השבתה לא נמצאה")

    before = {
        "start_date": str(block.start_date), "end_date": str(block.end_date),
        "reason": block.reason, "note": block.note,
    }

    new_start = payload.start_date or block.start_date
    new_end = payload.end_date or block.end_date
    if new_end < new_start:
        raise HTTPException(422, "תאריך הסיום מוקדם מתאריך ההתחלה")

    if crud_car_block.has_overlap(db, block.car_id, new_start, new_end, exclude_id=block.id):
        raise HTTPException(409, "כבר קיימת השבתה שחופפת לטווח הזה")

    clashes = _active_bookings_in_range(db, block.car_id, new_start, new_end)
    if clashes:
        raise HTTPException(409, _conflict_detail(clashes))

    block.start_date = new_start
    block.end_date = new_end
    if payload.reason is not None:
        block.reason = payload.reason.value
    if payload.note is not None:
        block.note = payload.note
    block.updated_by = current_user.id
    db.commit()
    db.refresh(block)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car_block.update",
        entity_type="car_block",
        entity_id=str(block.id),
        before_obj=before,
        after_obj={
            "start_date": str(block.start_date), "end_date": str(block.end_date),
            "reason": block.reason, "note": block.note,
        },
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.info,
    )
    return _out(block)


@router.delete("/{block_id}", status_code=204)
def cancel_block(
    block_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CARS_MANAGE)),
):
    block = crud_car_block.get(db, block_id)
    if not block:
        raise HTTPException(404, "השבתה לא נמצאה")

    before = {
        "car_id": block.car_id,
        "start_date": str(block.start_date), "end_date": str(block.end_date),
        "reason": block.reason, "note": block.note,
    }
    # מחיקה רכה — כמו בהזמנות, כדי שהביטול יישאר בהיסטוריה.
    block.deleted_at = func.now()
    block.deleted_by = current_user.id
    db.commit()

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car_block.cancel",
        entity_type="car_block",
        entity_id=str(block_id),
        before_obj=before,
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.warning,
    )
    return None
