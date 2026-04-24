# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date as Date
from app.db.session import get_db
from app.models.car import Car
from app.models.booking import Booking, BookingStatus
from app.schemas.car import CarCreate, CarUpdate, CarOut
from app.core.security import get_current_user, require_admin

router = APIRouter()

@router.get("/", response_model=list[CarOut])
def list_cars(
    type: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Car)
    if active_only:
        q = q.filter(Car.is_active == True)
    if type:
        q = q.filter(Car.type == type)
    return q.order_by(Car.name).all()

@router.get("/{car_id}", response_model=CarOut)
def get_car(car_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    return car

@router.post("/", response_model=CarOut, status_code=201)
def create_car(data: CarCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(Car).filter(Car.plate == data.plate).first():
        raise HTTPException(400, "לוחית רישוי כבר קיימת")
    car = Car(**data.model_dump())
    db.add(car); db.commit(); db.refresh(car)
    return car

@router.patch("/{car_id}", response_model=CarOut)
def update_car(car_id: int, data: CarUpdate,
               db: Session = Depends(get_db), _=Depends(require_admin)):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(car, k, v)
    db.commit(); db.refresh(car)
    return car

@router.delete("/{car_id}", status_code=204)
def delete_car(car_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    future = db.query(Booking).filter(
        Booking.car_id == car_id,
        Booking.status == BookingStatus.active,
        Booking.end_date >= Date.today(),
    ).count()
    if future:
        raise HTTPException(400, "לא ניתן למחוק רכב עם הזמנות פעילות")
    car.is_active = False
    db.commit()

@router.get("/{car_id}/availability")
def availability(car_id: int, start: Date, end: Date,
                 db: Session = Depends(get_db), _=Depends(get_current_user)):
    conflict = db.query(Booking).filter(
        Booking.car_id == car_id,
        Booking.status == BookingStatus.active,
        Booking.start_date <= end,
        Booking.end_date   >= start,
    ).first()
    return {"available": conflict is None}


# ══════════════════════════════════════════════════════════════════════════════
