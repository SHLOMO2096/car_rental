# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import date as Date
from app.db.session import get_db
from app.models.car import Car
from app.models.booking import Booking, BookingStatus
from app.schemas.car import CarCreate, CarUpdate, CarOut
from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.audit_log import log_audit_event
from app.models.audit_log import AuditSeverity

router = APIRouter()


@router.get("/", response_model=list[CarOut])
def list_cars(
    type: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CARS_VIEW)),
):
    q = db.query(Car)
    if active_only:
        q = q.filter(Car.is_active == True)
    if type:
        q = q.filter(Car.type == type)
    return q.order_by(Car.name).all()


@router.get("/{car_id}", response_model=CarOut)
def get_car(
    car_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CARS_VIEW)),
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    return car


@router.post("/", response_model=CarOut, status_code=201)
def create_car(
    data: CarCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CARS_MANAGE)),
    request: Request = None,
):
    if db.query(Car).filter(Car.plate == data.plate).first():
        raise HTTPException(400, "לוחית רישוי כבר קיימת")
    car = Car(**data.model_dump())
    db.add(car)
    db.commit()
    db.refresh(car)
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car.create",
        entity_type="car",
        entity_id=str(car.id),
        after_obj=car,
        ip_address=request.client.host if request and request.client else None,
    )
    return car


@router.patch("/{car_id}", response_model=CarOut)
def update_car(
    car_id: int,
    data: CarUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CARS_MANAGE)),
    request: Request = None,
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    before_state = {
        "id": car.id,
        "name": car.name,
        "type": car.type.value if hasattr(car.type, "value") else str(car.type),
        "year": car.year,
        "plate": car.plate,
        "color": car.color,
        "price_per_day": car.price_per_day,
        "is_active": car.is_active,
    }
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(car, k, v)
    db.commit()
    db.refresh(car)
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car.update",
        entity_type="car",
        entity_id=str(car.id),
        before_obj=before_state,
        after_obj=car,
        ip_address=request.client.host if request and request.client else None,
    )
    return car


@router.delete("/{car_id}", status_code=204)
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CARS_MANAGE)),
    request: Request = None,
):
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
    before_state = {
        "id": car.id,
        "name": car.name,
        "type": car.type.value if hasattr(car.type, "value") else str(car.type),
        "year": car.year,
        "plate": car.plate,
        "is_active": car.is_active,
    }
    car.is_active = False
    db.commit()
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car.deactivate",
        entity_type="car",
        entity_id=str(car.id),
        before_obj=before_state,
        after_obj=car,
        ip_address=request.client.host if request and request.client else None,
    )


@router.delete("/{car_id}/permanent", status_code=204)
def permanently_delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CARS_DELETE)),
    request: Request = None,
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")

    booking_count = db.query(Booking).filter(Booking.car_id == car_id).count()
    if booking_count:
        raise HTTPException(400, "לא ניתן למחוק רכב לצמיתות כאשר קיימת היסטוריית הזמנות")

    before_state = {
        "id": car.id,
        "name": car.name,
        "type": car.type.value if hasattr(car.type, "value") else str(car.type),
        "year": car.year,
        "plate": car.plate,
        "is_active": car.is_active,
    }
    db.delete(car)
    db.commit()
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="car.delete_permanent",
        entity_type="car",
        entity_id=str(car_id),
        before_obj=before_state,
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


@router.get("/{car_id}/availability")
def availability(
    car_id: int,
    start: Date,
    end: Date,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CARS_VIEW)),
):
    conflict = db.query(Booking).filter(
        Booking.car_id == car_id,
        Booking.status == BookingStatus.active,
        Booking.start_date <= end,
        Booking.end_date >= start,
    ).first()
    return {"available": conflict is None}


# ══════════════════════════════════════════════════════════════════════════════
