# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, BackgroundTasks, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.permissions import Permissions
from app.core.rate_limit import enforce_rate_limit
from app.core.security import require_permission
from app.core.email import send_reassignment_apply_alert
from app.crud.audit_log import log_audit_event
from app.models.audit_log import AuditSeverity
from app.schemas.suggestion import (
    SuggestionRequest,
    SuggestionResult,
    SuggestionApplyRequest,
    SuggestionApplyResult,
)
from app.engine.suggestions import search_suggestions, apply_suggestion

router = APIRouter()


@router.post("/search", response_model=list[SuggestionResult])
def suggestions_search(
    data: SuggestionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.SUGGESTIONS_VIEW)),
):
    """
    Search for vehicle alternatives / reassignment opportunities.

    Returns a ranked list of suggestions:
    - **Type A** – requested car is directly available.
    - **Type B** – a similar car (same or adjacent group) is free.
    - **Type C** – a one-step reassignment can free the requested car.
    """
    enforce_rate_limit(
        actor_id=current_user.id,
        scope="suggestions:search",
        limit_per_minute=settings.SUGGESTIONS_SEARCH_RATE_LIMIT_PER_MINUTE,
        window_seconds=settings.SUGGESTIONS_RATE_LIMIT_WINDOW_SECONDS,
        retention_seconds=settings.RATE_LIMIT_BUCKET_RETENTION_SECONDS,
    )
    return search_suggestions(db, data, actor_user_id=current_user.id)


@router.post("/apply", response_model=SuggestionApplyResult)
def suggestions_apply(
    data: SuggestionApplyRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.SUGGESTIONS_APPLY)),
    request: Request = None,
):
    """Apply a one-step reassignment suggestion (Type C) with revalidation."""
    enforce_rate_limit(
        actor_id=current_user.id,
        scope="suggestions:apply",
        limit_per_minute=settings.SUGGESTIONS_APPLY_RATE_LIMIT_PER_MINUTE,
        window_seconds=settings.SUGGESTIONS_RATE_LIMIT_WINDOW_SECONDS,
        retention_seconds=settings.RATE_LIMIT_BUCKET_RETENTION_SECONDS,
    )
    result = apply_suggestion(db, data, current_user=current_user)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="suggestions.apply",
        entity_type="booking_reassignment",
        entity_id=str(result["affected_booking_id"]),
        before_obj=result["before_state"],
        after_obj=result["after_state"],
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )

    bg.add_task(
        send_reassignment_apply_alert,
        affected_booking_id=result["affected_booking_id"],
        affected_customer_name=result["affected_customer_name"],
        blocked_car_name=result["blocked_car_name"],
        replacement_car_name=result["replacement_car_name"],
        requested_start=str(result["requested_start"]),
        requested_end=str(result["requested_end"]),
        actor_email=current_user.email,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        operator_note=data.operator_note,
    )

    return SuggestionApplyResult(
        applied=True,
        affected_booking_id=result["affected_booking_id"],
        from_car_id=result["from_car_id"],
        to_car_id=result["to_car_id"],
        freed_car_id=result["freed_car_id"],
        requested_start=result["requested_start"],
        requested_end=result["requested_end"],
        alert_enqueued=True,
        message="השיבוץ הוחל בהצלחה",
    )


# ══════════════════════════════════════════════════════════════════════════════
