from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date
from app.crud.base import CRUDBase
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.schemas.booking import BookingCreate, BookingUpdate

class CRUDBooking(CRUDBase[Booking, BookingCreate, BookingUpdate]):

    def has_overlap(self, db: Session, car_id: int,
                    start: date, end: date, exclude_id: int | None = None) -> bool:
        q = db.query(Booking).filter(
            Booking.car_id    == car_id,
            Booking.status    == BookingStatus.active,
            Booking.start_date <= end,
            Booking.end_date   >= start,
        )
        if exclude_id:
            q = q.filter(Booking.id != exclude_id)
        return q.first() is not None

    def create_booking(self, db: Session, data: BookingCreate,
                       user_id: int, car: Car) -> Booking:
        days  = max((data.end_date - data.start_date).days, 1)
        total = car.price_per_day * days
        b = Booking(
            **data.model_dump(),
            created_by=user_id,
            total_price=total,
        )
        db.add(b); db.commit(); db.refresh(b)
        return b

    # ── Calendar: הזמנות לטווח תאריכים ────────────────────────────────────────
    def get_range(self, db: Session, start: date, end: date) -> list[Booking]:
        return (
            db.query(Booking)
            .filter(
                Booking.status    != BookingStatus.cancelled,
                Booking.start_date <= end,
                Booking.end_date   >= start,
            )
            .order_by(Booking.start_date)
            .all()
        )

    # ── Reports ────────────────────────────────────────────────────────────────
    def monthly_revenue(self, db: Session, year: int, user_id: int | None = None, model: str | None = None) -> list[dict]:
        q = (
            db.query(
                extract("month", Booking.start_date).label("month"),
                func.sum(Booking.total_price).label("revenue"),
                func.count(Booking.id).label("count"),
            )
            .join(Car, Booking.car_id == Car.id)
            .filter(
                extract("year", Booking.start_date) == year,
                Booking.status != BookingStatus.cancelled,
            )
        )
        if user_id is not None:
            q = q.filter(Booking.created_by == user_id)
        if model:
            q = q.filter(Car.name == model)
        rows = q.group_by("month").order_by("month").all()
        return [{"month": int(r.month), "revenue": float(r.revenue or 0),
                 "count": int(r.count)} for r in rows]

    def top_cars(self, db: Session, limit: int = 5, user_id: int | None = None, model: str | None = None) -> list[dict]:
        q = (
            db.query(
                Booking.car_id,
                Car.name,
                func.count(Booking.id).label("bookings"),
                func.sum(Booking.total_price).label("revenue"),
            )
            .join(Car)
            .filter(Booking.status != BookingStatus.cancelled)
        )
        if user_id is not None:
            q = q.filter(Booking.created_by == user_id)
        if model:
            q = q.filter(Car.name == model)
        rows = (
            q.group_by(Booking.car_id, Car.name)
            .order_by(func.count(Booking.id).desc())
            .limit(limit)
            .all()
        )
        return [{"car_id": r.car_id, "name": r.name,
                 "bookings": r.bookings, "revenue": float(r.revenue or 0)} for r in rows]

    def summary(self, db: Session, user_id: int | None = None, model: str | None = None) -> dict:
        q_base = db.query(func.count(Booking.id)).select_from(Booking)
        q_rev  = db.query(func.sum(Booking.total_price)).select_from(Booking)
        if user_id is not None:
            q_base = q_base.filter(Booking.created_by == user_id)
            q_rev  = q_rev.filter(Booking.created_by == user_id)
        if model:
            q_base = q_base.join(Car, Booking.car_id == Car.id).filter(Car.name == model)
            q_rev  = q_rev.join(Car, Booking.car_id == Car.id).filter(Car.name == model)
        total   = q_base.scalar()
        active  = q_base.filter(Booking.status == BookingStatus.active).scalar()
        revenue = q_rev.filter(Booking.status != BookingStatus.cancelled).scalar()
        return {"total": total, "active": active, "revenue": float(revenue or 0)}

crud_booking = CRUDBooking(Booking)
