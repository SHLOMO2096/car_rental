from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.audit_log import log_audit_event
from app.db.session import get_db
from app.models.attendance import AttendanceShift
from app.models.audit_log import AuditSeverity
from app.models.user import User
from app.schemas.payroll import PayrollUserOut, PayrollRateUpdate, PayrollReportOut, PayrollRowOut

router = APIRouter()


@router.get("/users", response_model=list[PayrollUserOut])
def list_payroll_users(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PAYROLL_VIEW)),
):
    return db.query(User).order_by(User.is_active.desc(), User.full_name.asc()).all()


@router.patch("/users/{user_id}/hourly-rate", response_model=PayrollUserOut)
def update_hourly_rate(
    user_id: int,
    data: PayrollRateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PAYROLL_MANAGE)),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, detail="משתמש לא נמצא")

    if data.hourly_rate is not None and data.hourly_rate < 0:
        raise HTTPException(422, detail="שכר שעתי חייב להיות חיובי")

    before = {"id": u.id, "hourly_rate": u.hourly_rate}
    u.hourly_rate = data.hourly_rate
    db.commit()
    db.refresh(u)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="payroll.hourly_rate.update",
        entity_type="user",
        entity_id=str(u.id),
        before_obj=before,
        after_obj={"id": u.id, "hourly_rate": u.hourly_rate},
        ip_address=request.client.host if request.client else None,
        severity=AuditSeverity.warning,
    )

    return u


@router.get("/report", response_model=PayrollReportOut)
def payroll_report(
    date_from: Date,
    date_to: Date,
    user_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.PAYROLL_VIEW)),
):
    if date_to < date_from:
        raise HTTPException(422, detail="date_to חייב להיות אחרי date_from")

    # Business rule: only closed shifts are counted.
    q = db.query(AttendanceShift).filter(
        AttendanceShift.work_date >= date_from,
        AttendanceShift.work_date <= date_to,
        AttendanceShift.shift_end_at != None,  # noqa: E711
    )
    if user_id:
        q = q.filter(AttendanceShift.user_id == user_id)

    shifts = q.order_by(AttendanceShift.work_date.asc()).all()

    # Aggregate in Python for SQLite compatibility.
    by_user: dict[int, dict] = {}
    total_hours_all = 0.0
    total_pay_all = 0.0

    users = {u.id: u for u in db.query(User).all()}

    for s in shifts:
        if not s.shift_start_at or not s.shift_end_at:
            continue
        seconds = (s.shift_end_at - s.shift_start_at).total_seconds()
        hours = max(seconds / 3600.0, 0.0)

        u = users.get(s.user_id)
        if not u:
            continue
        rate = float(u.hourly_rate or 0.0)

        row = by_user.get(u.id)
        if not row:
            row = {
                "user_id": u.id,
                "full_name": u.full_name,
                "hourly_rate": rate,
                "shifts_count": 0,
                "total_hours": 0.0,
                "total_pay": 0.0,
            }
            by_user[u.id] = row

        row["shifts_count"] += 1
        row["total_hours"] += hours
        row["total_pay"] += hours * rate

        total_hours_all += hours
        total_pay_all += hours * rate

    rows = [PayrollRowOut(**v) for v in by_user.values()]
    rows.sort(key=lambda r: (r.full_name or "", r.user_id))

    return PayrollReportOut(
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        total_hours=total_hours_all,
        total_pay=total_pay_all,
    )

