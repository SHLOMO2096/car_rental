from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.attendance import crud_attendance
from app.crud.audit_log import log_audit_event
from app.db.session import get_db
from app.models.attendance import normalize_device_id
from app.models.audit_log import AuditSeverity
from app.models.user import User
from app.schemas.attendance import (
    AttendanceClockInRequest,
    AttendanceClockInResponse,
    AttendanceClockOutRequest,
    AttendanceClockOutResponse,
    AttendanceStatusOut,
    AttendanceShiftOut,
    AttendanceDeviceSessionOut,
)

router = APIRouter()


def _get_device_id(request: Request) -> str:
    raw = request.headers.get("X-Device-Id") or request.headers.get("x-device-id")
    device_id = normalize_device_id(raw)
    if not device_id:
        raise HTTPException(status_code=400, detail="חסר X-Device-Id")
    if len(device_id) > 64:
        raise HTTPException(status_code=400, detail="X-Device-Id ארוך מדי")
    return device_id


def _get_device_label(request: Request) -> str | None:
    label = request.headers.get("X-Device-Label") or request.headers.get("x-device-label")
    if not label:
        return None
    v = str(label).strip()
    return v[:255] if v else None


@router.get("/me/status", response_model=AttendanceStatusOut)
def my_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.ATTENDANCE_VIEW)),
):
    shift = crud_attendance.get_open_shift(db, current_user.id)
    if not shift:
        return AttendanceStatusOut(open_shift=None, open_device_sessions=[])

    open_sessions = crud_attendance.list_open_device_sessions(db, shift_id=shift.id)
    return AttendanceStatusOut(
        open_shift=AttendanceShiftOut.model_validate(shift),
        open_device_sessions=[AttendanceDeviceSessionOut.model_validate(s) for s in open_sessions],
    )


@router.post("/clock-in", response_model=AttendanceClockInResponse)
def clock_in(
    data: AttendanceClockInRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.ATTENDANCE_CLOCK)),
):
    device_id = _get_device_id(request)
    device_label = _get_device_label(request)

    shift, sess, open_sessions = crud_attendance.clock_in(
        db,
        user_id=current_user.id,
        device_id=device_id,
        device_label=device_label,
        ip_address=request.client.host if request.client else None,
        notes=data.notes,
    )

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="attendance.clock_in",
        entity_type="attendance_device_session",
        entity_id=str(sess.id),
        after_obj=sess,
        ip_address=request.client.host if request.client else None,
    )

    return AttendanceClockInResponse(
        shift=AttendanceShiftOut.model_validate(shift),
        device_session=AttendanceDeviceSessionOut.model_validate(sess),
        open_device_sessions=[AttendanceDeviceSessionOut.model_validate(s) for s in open_sessions],
    )


@router.post("/clock-out", response_model=AttendanceClockOutResponse)
def clock_out(
    data: AttendanceClockOutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.ATTENDANCE_CLOCK)),
):
    device_id = _get_device_id(request)

    try:
        shift, sess, open_sessions = crud_attendance.clock_out(
            db,
            user_id=current_user.id,
            device_id=device_id,
            ip_address=request.client.host if request.client else None,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="attendance.clock_out",
        entity_type="attendance_device_session",
        entity_id=str(sess.id),
        before_obj={"id": sess.id},
        after_obj=sess,
        ip_address=request.client.host if request.client else None,
    )

    return AttendanceClockOutResponse(
        shift=AttendanceShiftOut.model_validate(shift),
        device_session=AttendanceDeviceSessionOut.model_validate(sess),
        open_device_sessions=[AttendanceDeviceSessionOut.model_validate(s) for s in open_sessions],
    )


@router.post("/end-shift", response_model=AttendanceStatusOut)
def end_shift(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.ATTENDANCE_CLOCK)),
):
    try:
        shift, closed_sessions = crud_attendance.end_shift(
            db,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="attendance.end_shift",
        entity_type="attendance_shift",
        entity_id=str(shift.id),
        after_obj=shift,
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.warning,
    )

    # After ending shift, status has no open shift.
    return AttendanceStatusOut(open_shift=None, open_device_sessions=[])

