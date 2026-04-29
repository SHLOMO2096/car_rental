from typing import Iterable

from sqlalchemy import or_, case, func
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.customer import Customer


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.strip().lower().split())


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    lowered = value.strip().lower()
    return lowered or None


def normalize_id_number(value: str | None) -> str | None:
    if not value:
        return None
    compact = "".join(ch for ch in str(value).strip().upper() if ch.isalnum())
    return compact or None


def _first_not_empty(values: Iterable[str | None]) -> str | None:
    for value in values:
        if value and str(value).strip():
            return str(value).strip()
    return None


class CRUDCustomer:
    @staticmethod
    def model_id_column():
        return Customer.id

    def list(self, db: Session, q: str | None = None, limit: int = 100) -> list[Customer]:
        query = db.query(Customer)
        if q and q.strip():
            q_clean = q.strip()
            q_lower = q_clean.lower()
            phone_digits = normalize_phone(q_clean)
            id_number = normalize_id_number(q_clean)
            query = query.filter(
                or_(
                    Customer.name.ilike(f"%{q_clean}%"),
                    Customer.normalized_name.like(f"%{q_lower}%"),
                    Customer.phone.ilike(f"%{q_clean}%"),
                    Customer.email.ilike(f"%{q_clean}%"),
                    Customer.id_number.ilike(f"%{id_number or q_clean}%"),
                )
            )

            # Boost exact and prefix matches for snappier autocomplete UX.
            query = query.order_by(
                case((Customer.normalized_name == q_lower, 0), else_=1),
                case((Customer.normalized_name.like(f"{q_lower}%"), 0), else_=1),
                case((Customer.phone == phone_digits, 0), else_=1),
                case((Customer.id_number == id_number, 0), else_=1),
                Customer.name.asc(),
            )
        else:
            query = query.order_by(Customer.name.asc())
        return query.limit(max(1, min(limit, 200))).all()

    def get_history(self, db: Session, customer: Customer, limit: int = 20) -> dict:
        normalized_name = normalize_name(customer.name)
        fallback_matchers = []
        if customer.email:
            fallback_matchers.append(Booking.customer_email == customer.email)
        if customer.phone:
            fallback_matchers.append(Booking.customer_phone == customer.phone)
        if customer.id_number:
            fallback_matchers.append(Booking.customer_id_num == customer.id_number)
        if normalized_name:
            fallback_matchers.append(
                func.lower(func.trim(Booking.customer_name)) == normalized_name
            )

        history_query = db.query(Booking)
        if fallback_matchers:
            history_query = history_query.filter(
                or_(
                    Booking.customer_id == customer.id,
                    (Booking.customer_id.is_(None) & or_(*fallback_matchers)),
                )
            )
        else:
            history_query = history_query.filter(Booking.customer_id == customer.id)

        all_bookings = history_query.order_by(Booking.start_date.desc(), Booking.id.desc()).all()
        total_revenue = sum(float(b.total_price or 0) for b in all_bookings if b.status != BookingStatus.cancelled)
        active_bookings = sum(1 for b in all_bookings if b.status == BookingStatus.active)

        return {
            "customer": customer,
            "summary": {
                "total_bookings": len(all_bookings),
                "active_bookings": active_bookings,
                "total_revenue": total_revenue,
                "last_booking_date": all_bookings[0].start_date if all_bookings else None,
            },
            "bookings": all_bookings[: max(1, min(limit, 100))],
        }

    def upsert_contact(
        self,
        db: Session,
        *,
        name: str,
        address: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        id_number: str | None = None,
    ) -> Customer | None:
        normalized = normalize_name(name)
        if not normalized:
            return None

        phone_norm = normalize_phone(phone)
        email_norm = normalize_email(email)
        id_number_norm = normalize_id_number(id_number)
        address_clean = address.strip() if isinstance(address, str) and address.strip() else None

        customer = None
        if email_norm:
            customer = db.query(Customer).filter(Customer.email == email_norm).first()
        if not customer and phone_norm:
            customer = db.query(Customer).filter(Customer.phone == phone_norm).first()
        if not customer and id_number_norm:
            customer = db.query(Customer).filter(Customer.id_number == id_number_norm).first()
        if not customer:
            customer = db.query(Customer).filter(Customer.normalized_name == normalized).first()

        if customer:
            customer.name = _first_not_empty([name, customer.name]) or customer.name
            customer.address = _first_not_empty([customer.address, address_clean])
            customer.phone = _first_not_empty([customer.phone, phone_norm])
            customer.email = _first_not_empty([customer.email, email_norm])
            customer.id_number = _first_not_empty([customer.id_number, id_number_norm])
            customer.normalized_name = normalize_name(customer.name)
            return customer

        customer = Customer(
            name=name.strip(),
            normalized_name=normalized,
            address=address_clean,
            phone=phone_norm,
            email=email_norm,
            id_number=id_number_norm,
        )
        db.add(customer)
        db.flush()
        return customer


crud_customer = CRUDCustomer()


