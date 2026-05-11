from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import date as Date
from sqlalchemy.orm import Session

from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.attendance import crud_attendance
from app.crud.audit_log import log_audit_event
from app.db.session import get_db
from app.models.attendance import normalize_device_id, AttendanceShift
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
    AttendanceUserOut,
    AttendanceShiftUpdate,
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


# ── Admin/Manager: reporting & retroactive shift corrections ──────────────────


@router.get("/users", response_model=list[AttendanceUserOut])
def list_attendance_users(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.ATTENDANCE_VIEW_ALL)),
):
    return db.query(User).order_by(User.full_name.asc(), User.id.asc()).all()


@router.get("/shifts", response_model=list[AttendanceShiftOut])
def list_attendance_shifts(
    date_from: Date,
    date_to: Date,
    user_id: int | None = None,
    limit: int = 2000,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.ATTENDANCE_VIEW_ALL)),
):
    if date_to < date_from:
        raise HTTPException(422, detail="date_to חייב להיות אחרי date_from")

    limit = max(1, min(int(limit or 2000), 5000))

    q = db.query(AttendanceShift).filter(
        AttendanceShift.work_date >= date_from,
        AttendanceShift.work_date <= date_to,
    )
    if user_id is not None:
        q = q.filter(AttendanceShift.user_id == user_id)

    return (
        q.order_by(AttendanceShift.user_id.asc(), AttendanceShift.work_date.asc(), AttendanceShift.shift_start_at.asc())
        .limit(limit)
        .all()
    )


@router.patch("/shifts/{shift_id}", response_model=AttendanceShiftOut)
def update_attendance_shift(
    shift_id: int,
    data: AttendanceShiftUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.ATTENDANCE_MANAGE)),
):
    shift = db.query(AttendanceShift).filter(AttendanceShift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, detail="משמרת לא נמצאה")

    if data.shift_end_at < data.shift_start_at:
        raise HTTPException(422, detail="שעת סיום חייבת להיות אחרי שעת התחלה")

    before = {
        "id": shift.id,
        "user_id": shift.user_id,
        "work_date": shift.work_date,
        "shift_start_at": shift.shift_start_at,
        "shift_end_at": shift.shift_end_at,
    }

    shift.shift_start_at = data.shift_start_at
    shift.shift_end_at = data.shift_end_at
    shift.work_date = data.work_date or data.shift_start_at.date()

    db.commit()
    db.refresh(shift)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="attendance.shift.adjust",
        entity_type="attendance_shift",
        entity_id=str(shift.id),
        before_obj=before,
        after_obj=shift,
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.warning,
    )

    return shift


