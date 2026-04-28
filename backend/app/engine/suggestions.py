from __future__ import annotations
from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.engine.candidates import generate_suggestions
from app.engine.constraints import is_car_available
from app.core.security import decode_suggestion_apply_token
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.models.user import UserRole
from app.schemas.suggestion import SuggestionRequest, SuggestionResult, SuggestionApplyRequest


def search_suggestions(
    db: Session,
    request: SuggestionRequest,
    actor_user_id: int,
    today: date | None = None,
) -> list[SuggestionResult]:
    """Run the full suggestion pipeline and return ranked results."""
    if today is None:
        from datetime import date as _date

        today = _date.today()
    return generate_suggestions(
        db=db,
        car_id=request.car_id,
        group=request.group,
        start=request.start_date,
        end=request.end_date,
        today=today,
        actor_user_id=actor_user_id,
    )


def apply_suggestion(
    db: Session,
    data: SuggestionApplyRequest,
    *,
    current_user,
) -> dict:
    """Apply Type-C reassignment in a single transaction.

    Moves one existing booking from blocked car -> replacement car after
    revalidating constraints and actor scope.
    """
    try:
        token_data = decode_suggestion_apply_token(data.apply_token, current_user.id)
        blocked_car_id = int(token_data["blocked_car_id"])
        affected_booking_id = int(token_data["affected_booking_id"])
        replacement_car_id = int(token_data["replacement_car_id"])
        requested_start = date.fromisoformat(token_data["requested_start"])
        requested_end = date.fromisoformat(token_data["requested_end"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="קישור ההצעה לא תקין או פג תוקף")

    affected = db.query(Booking).filter(Booking.id == affected_booking_id).first()
    if not affected:
        raise HTTPException(status_code=404, detail="הזמנה לא נמצאה")

    if affected.status != BookingStatus.active:
        raise HTTPException(status_code=409, detail="ניתן לשבץ מחדש רק הזמנה פעילה")

    if affected.car_id != blocked_car_id:
        raise HTTPException(status_code=409, detail="ההזמנה כבר לא משויכת לרכב החסום")

    if current_user.role != UserRole.admin and affected.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="אין הרשאה להחיל שיבוץ מחדש על הזמנה זו")

    blocked_car = db.query(Car).filter(Car.id == blocked_car_id, Car.is_active == True).first()
    if not blocked_car:
        raise HTTPException(status_code=404, detail="הרכב החסום לא נמצא או לא פעיל")

    replacement = db.query(Car).filter(Car.id == replacement_car_id, Car.is_active == True).first()
    if not replacement:
        raise HTTPException(status_code=404, detail="הרכב החלופי לא נמצא או לא פעיל")

    overlaps_request = (
        affected.start_date <= requested_end and affected.end_date >= requested_start
    )
    if not overlaps_request:
        raise HTTPException(status_code=409, detail="ההזמנה לא חוסמת את חלון הבקשה הנוכחי")

    # Revalidate replacement availability at apply time.
    if not is_car_available(
        db,
        replacement.id,
        affected.start_date,
        affected.end_date,
        exclude_booking_id=affected.id,
    ):
        raise HTTPException(status_code=409, detail="הרכב החלופי כבר תפוס בטווח התאריכים")

    before_state = {
        "booking_id": affected.id,
        "customer_name": affected.customer_name,
        "created_by": affected.created_by,
        "status": affected.status.value if hasattr(affected.status, "value") else str(affected.status),
        "start_date": str(affected.start_date),
        "end_date": str(affected.end_date),
        "car_id": affected.car_id,
        "car_name": blocked_car.name,
        "requested_start": str(requested_start),
        "requested_end": str(requested_end),
        "operator_note": data.operator_note,
    }

    from_car_id = affected.car_id
    affected.car_id = replacement.id

    try:
        db.commit()
        db.refresh(affected)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="החלת השיבוץ נכשלה עקב התנגשות בנתונים")

    after_state = {
        "booking_id": affected.id,
        "customer_name": affected.customer_name,
        "created_by": affected.created_by,
        "status": affected.status.value if hasattr(affected.status, "value") else str(affected.status),
        "start_date": str(affected.start_date),
        "end_date": str(affected.end_date),
        "car_id": affected.car_id,
        "car_name": replacement.name,
        "requested_start": str(requested_start),
        "requested_end": str(requested_end),
        "operator_note": data.operator_note,
    }

    return {
        "affected_booking_id": affected.id,
        "from_car_id": from_car_id,
        "to_car_id": replacement.id,
        "freed_car_id": blocked_car.id,
        "requested_start": requested_start,
        "requested_end": requested_end,
        "before_state": before_state,
        "after_state": after_state,
        "affected_customer_name": affected.customer_name,
        "blocked_car_name": blocked_car.name,
        "replacement_car_name": replacement.name,
    }
