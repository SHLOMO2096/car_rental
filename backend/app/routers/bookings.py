# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date as Date
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingUpdate, BookingOut
from app.crud.booking import crud_booking
from app.core.security import get_current_user, require_admin
from app.core.email import send_booking_confirmation, send_booking_cancellation

router = APIRouter()

@router.get("/", response_model=list[BookingOut])
def list_bookings(
    status: str | None = None,
    car_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Booking)
    if status:
        q = q.filter(Booking.status == status)
    if car_id:
        q = q.filter(Booking.car_id == car_id)
    return q.order_by(Booking.created_at.desc()).all()

@router.get("/calendar", response_model=list[BookingOut])
def calendar(start: Date, end: Date,
             db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud_booking.get_range(db, start, end)

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    b = crud_booking.get(db, booking_id)
    if not b:
        raise HTTPException(404, "הזמנה לא נמצאה")
    return b

@router.post("/", response_model=BookingOut, status_code=201)
def create_booking(data: BookingCreate, bg: BackgroundTasks,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    car = db.query(Car).filter(Car.id == data.car_id, Car.is_active == True).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    if crud_booking.has_overlap(db, data.car_id, data.start_date, data.end_date):
        raise HTTPException(409, "הרכב כבר מושכר בתאריכים אלו")

    booking = crud_booking.create_booking(db, data, current_user.id, car)

    if data.customer_email:
        bg.add_task(
            send_booking_confirmation,
            to=data.customer_email,
            customer_name=data.customer_name,
            car_name=car.name,
            start=str(data.start_date),
            end=str(data.end_date),
            total=booking.total_price,
            booking_id=booking.id,
        )
        booking.email_sent = True
        db.commit()
    return booking

@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(booking_id: int, data: BookingUpdate, bg: BackgroundTasks,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    b = crud_booking.get(db, booking_id)
    if not b:
        raise HTTPException(404, "הזמנה לא נמצאה")
    if current_user.role == UserRole.agent and b.created_by != current_user.id:
        raise HTTPException(403, "אין הרשאה לערוך הזמנה זו")

    new_start = data.start_date or b.start_date
    new_end   = data.end_date   or b.end_date
    if (data.start_date or data.end_date):
        if crud_booking.has_overlap(db, b.car_id, new_start, new_end, exclude_id=b.id):
            raise HTTPException(409, "הרכב כבר מושכר בתאריכים אלו")

    updated = crud_booking.update(db, b, data)

    # שליחת אימייל ביטול אם הסטטוס שונה לבוטל
    if data.status == BookingStatus.cancelled and b.customer_email:
        bg.add_task(
            send_booking_cancellation,
            to=b.customer_email,
            customer_name=b.customer_name,
            car_name=b.car.name,
            booking_id=b.id,
        )
    return updated

@router.delete("/{booking_id}", status_code=204)
def delete_booking(booking_id: int, db: Session = Depends(get_db),
                   _=Depends(require_admin)):
    b = crud_booking.get(db, booking_id)
    if not b:
        raise HTTPException(404, "הזמנה לא נמצאה")
    crud_booking.delete(db, booking_id)


# ══════════════════════════════════════════════════════════════════════════════
