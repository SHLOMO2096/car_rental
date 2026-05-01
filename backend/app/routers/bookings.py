# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, UploadFile, File
from sqlalchemy.orm import Session
from datetime import date as Date
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.models.user import User, UserRole
from app.models.customer import Customer
from app.schemas.booking import BookingCreate, BookingUpdate, BookingOut
from app.crud.booking import crud_booking
from app.crud.customer import crud_customer
from app.core.permissions import Permissions
from app.core.security import (
    require_permission,
    require_booking_scope_or_admin,
)
from app.core.email import (
    send_booking_confirmation,
    send_booking_cancellation,
    send_booking_delete_alert,
    send_missing_customer_email_alert,
)
from app.crud.audit_log import log_audit_event
from app.models.audit_log import AuditSeverity
from app.services.google_drive import get_drive_service

router = APIRouter()


@router.get("/", response_model=list[BookingOut])
def list_bookings(
    status: str | None = None,
    car_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_VIEW)),
):
    q = db.query(Booking)
    if status:
        q = q.filter(Booking.status == status)
    if car_id:
        q = q.filter(Booking.car_id == car_id)
    return q.order_by(Booking.created_at.desc()).all()


@router.get("/calendar", response_model=list[BookingOut])
def calendar(
    start: Date,
    end: Date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_VIEW)),
):
    return crud_booking.get_range(db, start, end)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking: Booking = Depends(require_booking_scope_or_admin),
    _=Depends(require_permission(Permissions.BOOKINGS_VIEW)),
):
    return booking


@router.post("/", response_model=BookingOut, status_code=201)
def create_booking(
    data: BookingCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_CREATE)),
    request: Request = None,
):
    car = db.query(Car).filter(Car.id == data.car_id, Car.is_active == True).first()
    if not car:
        raise HTTPException(404, "רכב לא נמצא")
    if crud_booking.has_overlap(db, data.car_id, data.start_date, data.end_date):
        raise HTTPException(409, "הרכב כבר מושכר בתאריכים אלו")

    customer = None
    if data.customer_id:
        customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
        if not customer:
            raise HTTPException(404, "לקוח לא נמצא")
    else:
        customer = crud_customer.upsert_contact(
            db,
            name=data.customer_name,
            phone=data.customer_phone,
            email=str(data.customer_email) if data.customer_email else None,
        )

    payload = data.model_dump(exclude={"customer_has_no_email"})
    payload["customer_id"] = customer.id if customer else None

    booking = crud_booking.create_booking(db, payload, current_user.id, car)

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
    elif data.customer_has_no_email:
        bg.add_task(
            send_missing_customer_email_alert,
            booking_id=booking.id,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            customer_id_num=data.customer_id_num,
            car_name=car.name,
            start=str(data.start_date),
            end=str(data.end_date),
            actor_email=current_user.email,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="booking.create",
        entity_type="booking",
        entity_id=str(booking.id),
        after_obj=booking,
        ip_address=request.client.host if request and request.client else None,
    )
    return booking


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    data: BookingUpdate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_UPDATE)),
    request: Request = None,
):
    b = crud_booking.get(db, booking_id)
    if not b:
        raise HTTPException(404, "הזמנה לא נמצאה")
    if current_user.role == UserRole.agent and b.created_by != current_user.id:
        raise HTTPException(403, "אין הרשאה לערוך הזמנה זו")

    new_start  = data.start_date or b.start_date
    new_end    = data.end_date   or b.end_date
    new_car_id = data.car_id     or b.car_id

    # ── ולידציה: שינוי רכב ────────────────────────────────────────────────────
    if data.car_id and data.car_id != b.car_id:
        new_car = db.query(Car).filter(Car.id == data.car_id, Car.is_active == True).first()
        if not new_car:
            raise HTTPException(404, "רכב יעד לא נמצא או אינו פעיל")
        if crud_booking.has_overlap(db, data.car_id, b.start_date, b.end_date, exclude_id=b.id):
            raise HTTPException(409, "הרכב היעד כבר מושכר בתאריכים אלו")

    # ── ולידציה: שינוי תאריכים ────────────────────────────────────────────────
    if data.start_date or data.end_date:
        if data.start_date and data.start_date < Date.today():
            raise HTTPException(422, "לא ניתן לעדכן הזמנה לתאריך התחלה בעבר")
        if data.end_date and data.end_date < Date.today():
            raise HTTPException(422, "לא ניתן לעדכן הזמנה לתאריך סיום בעבר")
        if new_end < new_start:
            raise HTTPException(422, "תאריך סיום חייב להיות אחרי תאריך התחלה")
        if crud_booking.has_overlap(db, new_car_id, new_start, new_end, exclude_id=b.id):
            raise HTTPException(409, "הרכב כבר מושכר בתאריכים אלו")

    if data.customer_id is not None:
        exists = db.query(Customer).filter(Customer.id == data.customer_id).first()
        if not exists:
            raise HTTPException(404, "לקוח לא נמצא")

    before_state = {
        "id": b.id,
        "car_id": b.car_id,
        "created_by": b.created_by,
        "customer_name": b.customer_name,
        "start_date": str(b.start_date),
        "end_date": str(b.end_date),
        "status": b.status.value if hasattr(b.status, "value") else str(b.status),
        "total_price": b.total_price,
    }

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

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="booking.update",
        entity_type="booking",
        entity_id=str(updated.id),
        before_obj=before_state,
        after_obj=updated,
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning if data.status == BookingStatus.cancelled else AuditSeverity.info,
    )
    return updated


@router.delete("/{booking_id}", status_code=204)
def delete_booking(
    bg: BackgroundTasks,
    booking: Booking = Depends(require_booking_scope_or_admin),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_DELETE)),
    request: Request = None,
):
    before_state = {
        "id": booking.id,
        "car_id": booking.car_id,
        "created_by": booking.created_by,
        "customer_name": booking.customer_name,
        "start_date": str(booking.start_date),
        "end_date": str(booking.end_date),
        "status": booking.status.value if hasattr(booking.status, "value") else str(booking.status),
        "total_price": booking.total_price,
    }
    car_name = booking.car.name if booking.car else "לא ידוע"
    actor_email = current_user.email
    actor_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    crud_booking.delete(db, booking.id)
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="booking.delete",
        entity_type="booking",
        entity_id=str(booking.id),
        before_obj=before_state,
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )
    bg.add_task(
        send_booking_delete_alert,
        booking_id=booking.id,
        customer_name=before_state["customer_name"],
        car_name=car_name,
        start=before_state["start_date"],
        end=before_state["end_date"],
        actor_email=actor_email,
        actor_role=actor_role,
    )


# ══════════════════════════════════════════════════════════════════════════════


@router.post("/{booking_id}/upload-photo")
async def upload_booking_photo(
    booking_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_VIEW)),
):
    """Upload booking car photo to Google Drive"""
    booking = crud_booking.get(db, booking_id)
    if not booking:
        raise HTTPException(404, "הזמנה לא נמצאה")

    drive_service = get_drive_service()
    if not drive_service.is_available():
        raise HTTPException(
            503,
            "שירות Google Drive אינו זמין. יש ליצור קשר עם מנהל המערכת.",
        )

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "קובץ חייב להיות תמונה")

    # Read file
    file_contents = await file.read()
    if not file_contents:
        raise HTTPException(400, "הקובץ ריק")

    if len(file_contents) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(400, "הקובץ גדול מדי (מקסימום 10 MB)")

    # Upload to Google Drive
    car = booking.car
    result = drive_service.upload_booking_photo(
        file_bytes=file_contents,
        booking_id=booking_id,
        car_name=car.name if car else "Unknown",
        customer_name=booking.customer_name,
    )

    if not result:
        raise HTTPException(500, "נכשל העלאת הקובץ ל-Google Drive")

    booking.drive_link = result.get("link")
    db.commit()

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="booking.upload_photo",
        entity_type="booking",
        entity_id=str(booking_id),
        after_obj={
            "file_name": result.get("name"),
            "drive_link": result.get("link"),
        },
        ip_address=None,
    )

    return {
        "success": True,
        "message": "הקובץ הועלה בהצלחה",
        "file_id": result.get("id"),
        "file_name": result.get("name"),
        "link": result.get("link"),
        "created_at": result.get("created_at"),
    }


# ══════════════════════════════════════════════════════════════════════════════

