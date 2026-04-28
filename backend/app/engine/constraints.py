"""
ConstraintEvaluator – hard rules that are NEVER violated.

All availability checks go through this module so the rest of the engine
stays free of raw SQL.
"""
from datetime import date
from sqlalchemy.orm import Session
from app.models.booking import Booking, BookingStatus


def is_car_available(
    db: Session,
    car_id: int,
    start: date,
    end: date,
    exclude_booking_id: int | None = None,
) -> bool:
    """Return True if *car_id* has no active booking that overlaps [start, end]."""
    q = db.query(Booking).filter(
        Booking.car_id == car_id,
        Booking.status == BookingStatus.active,
        Booking.start_date <= end,
        Booking.end_date >= start,
    )
    if exclude_booking_id is not None:
        q = q.filter(Booking.id != exclude_booking_id)
    return q.first() is None


def get_overlapping_bookings(
    db: Session,
    car_id: int,
    start: date,
    end: date,
) -> list[Booking]:
    """Return all active bookings that overlap [start, end] for *car_id*."""
    return (
        db.query(Booking)
        .filter(
            Booking.car_id == car_id,
            Booking.status == BookingStatus.active,
            Booking.start_date <= end,
            Booking.end_date >= start,
        )
        .all()
    )

