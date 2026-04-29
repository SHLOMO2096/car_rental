from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.email import send_customer_message
from app.core.permissions import Permissions
from app.core.security import require_permission
from app.crud.audit_log import log_audit_event
from app.crud.customer import crud_customer, normalize_id_number, normalize_name, normalize_phone
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.customer import Customer
from app.models.audit_log import AuditSeverity
from app.schemas.customer import (
    CustomerBulkEmailRequest,
    CustomerBulkEmailResult,
    CustomerCreate,
    CustomerEmailRequest,
    CustomerHistoryOut,
    CustomerImportResultOut,
    CustomerOut,
    CustomerUpdate,
)
from app.services.customer_import import import_customers_to_db, load_rows_from_bytes, parse_customer_rows_with_report

router = APIRouter()


@router.get("/", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CUSTOMERS_VIEW)),
):
    return crud_customer.list(db, q=q, limit=limit)


@router.get("/search", response_model=list[CustomerOut])
def search_customers(
    q: str,
    limit: int = 8,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CUSTOMERS_VIEW)),
):
    return crud_customer.list(db, q=q, limit=limit)


@router.post("/", response_model=CustomerOut, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_MANAGE)),
    request: Request = None,
):
    customer = crud_customer.upsert_contact(
        db,
        name=data.name,
        address=data.address,
        phone=data.phone,
        email=str(data.email) if data.email else None,
        id_number=data.id_number,
    )
    if not customer:
        raise HTTPException(400, "שם לקוח חובה")
    db.commit()
    db.refresh(customer)
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.create",
        entity_type="customer",
        entity_id=str(customer.id),
        after_obj=customer,
        ip_address=request.client.host if request and request.client else None,
    )
    return customer


@router.post("/import", response_model=CustomerImportResultOut)
async def import_customers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_MANAGE)),
    request: Request = None,
):
    if not file.filename:
        raise HTTPException(400, "יש לבחור קובץ לייבוא")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "הקובץ ריק")
    try:
        parsed_rows, issues, skipped = parse_customer_rows_with_report(
            load_rows_from_bytes(file.filename, raw)
        )
        result = import_customers_to_db(db, parsed_rows, issues=issues, skipped=skipped)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.import",
        entity_type="customer_import",
        entity_id=file.filename,
        after_obj={"filename": file.filename, **result},
        ip_address=request.client.host if request and request.client else None,
    )
    return result


@router.post("/send-bulk-email", response_model=CustomerBulkEmailResult)
def send_bulk_email(
    data: CustomerBulkEmailRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_BULK_EMAIL)),
    request: Request = None,
):
    subject = data.subject.strip()
    body = data.body.strip()
    if not subject or not body:
        raise HTTPException(400, "נושא ותוכן ההודעה הם שדות חובה")

    audience = (data.audience or "all").strip().lower()

    if audience == "active":
        active_customer_ids = (
            db.query(Booking.customer_id)
            .filter(Booking.customer_id.isnot(None), Booking.status == BookingStatus.active)
            .distinct()
            .subquery()
        )
        customers = (
            db.query(Customer)
            .filter(Customer.email.isnot(None), Customer.id.in_(active_customer_ids))
            .order_by(Customer.id)
            .all()
        )
    elif audience == "with_bookings":
        customer_ids_with_bookings = (
            db.query(Booking.customer_id)
            .filter(Booking.customer_id.isnot(None))
            .distinct()
            .subquery()
        )
        customers = (
            db.query(Customer)
            .filter(Customer.email.isnot(None), Customer.id.in_(customer_ids_with_bookings))
            .order_by(Customer.id)
            .all()
        )
    else:
        customers = db.query(Customer).filter(Customer.email.isnot(None)).order_by(Customer.id).all()
    seen_emails: set[str] = set()
    queued = 0
    skipped = 0

    for customer in customers:
        email = (customer.email or "").strip().lower()
        if not email or email in seen_emails:
            skipped += 1
            continue

        seen_emails.add(email)
        bg.add_task(
            send_customer_message,
            to=email,
            customer_name=customer.name,
            subject=subject,
            body=body,
        )
        queued += 1

    if queued == 0:
        raise HTTPException(400, "לא נמצאו לקוחות עם כתובת מייל לשליחה")

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.bulk_email",
        entity_type="customer_broadcast",
        entity_id="all",
        after_obj={"subject": subject, "queued": queued, "skipped": skipped},
        ip_address=request.client.host if request and request.client else None,
    )
    return {"queued": queued, "skipped": skipped}


@router.get("/{customer_id}/history", response_model=CustomerHistoryOut)
def get_customer_history(
    customer_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.CUSTOMERS_VIEW)),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "לקוח לא נמצא")
    return crud_customer.get_history(db, customer, limit=limit)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_MANAGE)),
    request: Request = None,
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "לקוח לא נמצא")

    before_state = {
        "id": customer.id,
        "name": customer.name,
        "address": customer.address,
        "phone": customer.phone,
        "email": customer.email,
        "id_number": customer.id_number,
    }

    payload = data.model_dump(exclude_none=True)
    if "name" in payload:
        name = payload["name"].strip()
        if not name:
            raise HTTPException(400, "שם לקוח חובה")
        customer.name = name
        customer.normalized_name = normalize_name(name)
    if "address" in payload:
        customer.address = payload["address"].strip() if payload["address"] else None
    if "phone" in payload:
        customer.phone = normalize_phone(payload["phone"]) if payload["phone"] else None
    if "email" in payload:
        customer.email = str(payload["email"]).strip().lower() if payload["email"] else None
    if "id_number" in payload:
        customer.id_number = normalize_id_number(payload["id_number"]) if payload["id_number"] else None

    db.commit()
    db.refresh(customer)
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.update",
        entity_type="customer",
        entity_id=str(customer.id),
        before_obj=before_state,
        after_obj=customer,
        ip_address=request.client.host if request and request.client else None,
    )
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_MANAGE)),
    request: Request = None,
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "לקוח לא נמצא")

    before_state = {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "id_number": customer.id_number,
    }
    db.query(Booking).filter(Booking.customer_id == customer.id).update({Booking.customer_id: None})
    db.delete(customer)
    db.commit()
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.delete",
        entity_type="customer",
        entity_id=str(customer_id),
        before_obj=before_state,
        ip_address=request.client.host if request and request.client else None,
        severity=AuditSeverity.warning,
    )


@router.post("/{customer_id}/send-email")
def email_customer(
    customer_id: int,
    data: CustomerEmailRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(Permissions.CUSTOMERS_MANAGE)),
    request: Request = None,
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "לקוח לא נמצא")
    if not customer.email:
        raise HTTPException(400, "ללקוח אין כתובת מייל")
    if not data.subject.strip() or not data.body.strip():
        raise HTTPException(400, "נושא ותוכן ההודעה הם שדות חובה")

    bg.add_task(
        send_customer_message,
        to=customer.email,
        customer_name=customer.name,
        subject=data.subject.strip(),
        body=data.body.strip(),
    )
    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="customer.email",
        entity_type="customer",
        entity_id=str(customer.id),
        after_obj={"subject": data.subject.strip(), "to": customer.email},
        ip_address=request.client.host if request and request.client else None,
    )
    return {"sent": True}


