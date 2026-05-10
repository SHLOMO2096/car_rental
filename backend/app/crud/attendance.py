from datetime import datetime, timezone, date

from sqlalchemy.orm import Session

from app.models.attendance import AttendanceShift, AttendanceDeviceSession


class CRUDAttendance:
    # ── Shifts ─────────────────────────────────────────────────────────────────
    def get_open_shift(self, db: Session, user_id: int) -> AttendanceShift | None:
        return (
            db.query(AttendanceShift)
            .filter(AttendanceShift.user_id == user_id, AttendanceShift.shift_end_at == None)  # noqa: E711
            .order_by(AttendanceShift.shift_start_at.desc())
            .first()
        )

    def create_shift(self, db: Session, user_id: int) -> AttendanceShift:
        now = datetime.now(timezone.utc)
        shift = AttendanceShift(
            user_id=user_id,
            shift_start_at=now,
            shift_end_at=None,
            work_date=date.today(),
        )
        db.add(shift)
        db.commit()
        db.refresh(shift)
        return shift

    # ── Device sessions ────────────────────────────────────────────────────────
    def get_open_device_session(self, db: Session, *, user_id: int, device_id: str) -> AttendanceDeviceSession | None:
        return (
            db.query(AttendanceDeviceSession)
            .filter(
                AttendanceDeviceSession.user_id == user_id,
                AttendanceDeviceSession.device_id == device_id,
                AttendanceDeviceSession.clock_out_at == None,  # noqa: E711
            )
            .order_by(AttendanceDeviceSession.clock_in_at.desc())
            .first()
        )

    def list_open_device_sessions(self, db: Session, *, shift_id: int) -> list[AttendanceDeviceSession]:
        return (
            db.query(AttendanceDeviceSession)
            .filter(
                AttendanceDeviceSession.shift_id == shift_id,
                AttendanceDeviceSession.clock_out_at == None,  # noqa: E711
            )
            .order_by(AttendanceDeviceSession.clock_in_at.asc())
            .all()
        )

    def clock_in(
        self,
        db: Session,
        *,
        user_id: int,
        device_id: str,
        device_label: str | None = None,
        ip_address: str | None = None,
        notes: str | None = None,
    ) -> tuple[AttendanceShift, AttendanceDeviceSession, list[AttendanceDeviceSession]]:
        """Clock-in for a specific device.

        Rules:
        - A user can have a single open shift.
        - A user can have multiple open device sessions (different device_id).
        - For the SAME device_id, clock-in is idempotent (if already open, return existing).
        """
        shift = self.get_open_shift(db, user_id)
        if not shift:
            shift = self.create_shift(db, user_id)

        existing = self.get_open_device_session(db, user_id=user_id, device_id=device_id)
        if existing:
            open_sessions = self.list_open_device_sessions(db, shift_id=shift.id)
            return shift, existing, open_sessions

        now = datetime.now(timezone.utc)
        sess = AttendanceDeviceSession(
            shift_id=shift.id,
            user_id=user_id,
            device_id=device_id,
            device_label=device_label,
            clock_in_at=now,
            clock_out_at=None,
            clock_in_ip=ip_address,
            notes=notes,
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        open_sessions = self.list_open_device_sessions(db, shift_id=shift.id)
        return shift, sess, open_sessions

    def clock_out(
        self,
        db: Session,
        *,
        user_id: int,
        device_id: str,
        ip_address: str | None = None,
        notes: str | None = None,
    ) -> tuple[AttendanceShift, AttendanceDeviceSession, list[AttendanceDeviceSession]]:
        open_sess = self.get_open_device_session(db, user_id=user_id, device_id=device_id)
        if not open_sess:
            raise ValueError("אין נוכחות פתוחה במכשיר זה")

        shift = db.query(AttendanceShift).filter(AttendanceShift.id == open_sess.shift_id).first()
        if not shift or shift.shift_end_at is not None:
            raise ValueError("לא נמצאה משמרת פתוחה")

        now = datetime.now(timezone.utc)
        open_sess.clock_out_at = now
        open_sess.clock_out_ip = ip_address
        if notes:
            open_sess.notes = notes
        db.commit()
        db.refresh(open_sess)

        open_sessions = self.list_open_device_sessions(db, shift_id=shift.id)
        if len(open_sessions) == 0:
            shift.shift_end_at = now
            db.commit()
            db.refresh(shift)

        return shift, open_sess, open_sessions

    def end_shift(
        self,
        db: Session,
        *,
        user_id: int,
        ip_address: str | None = None,
    ) -> tuple[AttendanceShift, list[AttendanceDeviceSession]]:
        shift = self.get_open_shift(db, user_id)
        if not shift:
            raise ValueError("אין משמרת פתוחה")

        now = datetime.now(timezone.utc)
        open_sessions = self.list_open_device_sessions(db, shift_id=shift.id)

        for sess in open_sessions:
            sess.clock_out_at = now
            sess.clock_out_ip = ip_address

        shift.shift_end_at = now
        db.commit()
        db.refresh(shift)

        # refresh sessions list (now closed, but return what was closed)
        closed = (
            db.query(AttendanceDeviceSession)
            .filter(AttendanceDeviceSession.shift_id == shift.id)
            .order_by(AttendanceDeviceSession.clock_in_at.asc())
            .all()
        )
        return shift, closed


crud_attendance = CRUDAttendance()

