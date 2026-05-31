from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, datetime, timezone
from app.crud.base import CRUDBase
from app.models.booking import Booking, BookingStatus
from app.models.car import Car
from app.schemas.booking import BookingCreate, BookingUpdate

# שדות שכאשר מתעדכנים — מצריכים חישוב מחדש של המחיר
_PRICE_RECALC_FIELDS = {"start_date", "end_date", "car_id", "pickup_time", "return_time"}


class CRUDBooking(CRUDBase[Booking, BookingCreate, BookingUpdate]):

    # --- legacy fallback (משמש רק כ-fallback אם PricingService לא זמין) ---
    def get_effective_price(self, db: Session, car: Car) -> float:
        price = car.price_per_day
        if not price:
            from app.models.settings import SystemSetting
            setting = db.query(SystemSetting).filter(SystemSetting.key == "category_hierarchy").first()
            if setting and setting.value:
                cat_config = next((c for c in setting.value if c.get("name") == car.category), None)
                if cat_config:
                    if car.is_hybrid:
                        price = float(cat_config.get("hybrid_price") or cat_config.get("base_price") or 0)
                    else:
                        price = float(cat_config.get("base_price") or 0)
        return float(price or 0)

    def has_overlap(self, db: Session, car_id: int,
                    start: date, end: date,
                    pickup_time: str | None = None, return_time: str | None = None,
                    exclude_id: int | None = None) -> bool:
        q = db.query(Booking).filter(
            Booking.car_id    == car_id,
            Booking.deleted_at == None,  # noqa: E711
            Booking.status    == BookingStatus.active,
            Booking.start_date <= end,
            Booking.end_date   >= start,
        )
        if exclude_id:
            q = q.filter(Booking.id != exclude_id)
            
        overlapping = q.all()
        if not overlapping:
            return False
            
        new_pt = pickup_time or "08:30"
        new_rt = return_time or "08:00"
        
        for b in overlapping:
            b_pt = b.pickup_time or "08:30"
            b_rt = b.return_time or "08:00"
            
            # If they just touch exactly on the boundary dates, check the times:
            # If the new booking starts exactly when the old one ends:
            if b.end_date == start and b_rt <= new_pt:
                continue
                
            # If the new booking ends exactly when the old one starts:
            if b.start_date == end and b_pt >= new_rt:
                continue
                
            return True
            
        return False

    def create_booking(self, db: Session, data: BookingCreate | dict,
                       user_id: int, car: Car) -> Booking:
        from app.services.pricing import calculate_total_price, price_result_to_breakdown_json

        payload = data.model_dump() if hasattr(data, "model_dump") else dict(data)

        # חישוב מחיר דרך PricingService
        try:
            pricing_result = calculate_total_price(
                db=db,
                car=car,
                start_date=payload["start_date"],
                end_date=payload["end_date"],
                pickup_time=payload.get("pickup_time"),
                return_time=payload.get("return_time"),
            )
            total_price       = pricing_result.total
            billable_days     = pricing_result.billable_days
            actual_days       = pricing_result.actual_days
            price_type_used   = pricing_result.price_type_used
            price_rule_id     = pricing_result.price_rule_id
            breakdown_json    = price_result_to_breakdown_json(pricing_result)
        except Exception:
            # fallback לחישוב ישן אם PricingService נכשל
            days = max((payload["end_date"] - payload["start_date"]).days, 1)
            total_price     = self.get_effective_price(db, car) * days
            billable_days   = float(days)
            actual_days     = days
            price_type_used = None
            price_rule_id   = None
            breakdown_json  = None

        b = Booking(
            **payload,
            created_by=user_id,
            total_price=total_price,
            billable_days=billable_days,
            actual_days=actual_days,
            price_type_used=price_type_used,
            price_rule_id=price_rule_id,
            price_breakdown_json=breakdown_json,
        )
        db.add(b); db.commit(); db.refresh(b)
        return b

    # ── Soft Delete ────────────────────────────────────────────────────────────
    def soft_delete(self, db: Session, booking: Booking, user_id: int) -> Booking:
        booking.deleted_at = datetime.now(timezone.utc)
        booking.deleted_by = user_id
        db.commit()
        db.refresh(booking)
        return booking

    def get(self, db: Session, id: int) -> Booking | None:
        """מחזיר הזמנה בלבד אם לא נמחקה (soft delete)."""
        return (
            db.query(Booking)
            .filter(Booking.id == id, Booking.deleted_at == None)  # noqa: E711
            .first()
        )

    # ── Calendar: הזמנות לטווח תאריכים ────────────────────────────────────────
    def get_range(self, db: Session, start: date, end: date) -> list[Booking]:
        return (
            db.query(Booking)
            .filter(
                Booking.deleted_at == None,          # noqa: E711
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
                Booking.deleted_at == None,          # noqa: E711
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
            .filter(
                Booking.deleted_at == None,  # noqa: E711
                Booking.status != BookingStatus.cancelled,
            )
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
        q_base = db.query(func.count(Booking.id)).select_from(Booking).filter(Booking.deleted_at == None)  # noqa: E711
        q_rev  = db.query(func.sum(Booking.total_price)).select_from(Booking).filter(Booking.deleted_at == None)  # noqa: E711
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

    # ── Dashboard KPIs (non-admin safe) ────────────────────────────────────────
    def kpi_counts(self, db: Session) -> dict:
        """Lightweight counts used by the main dashboard (total + active only)."""
        q = db.query(func.count(Booking.id)).filter(Booking.deleted_at == None)  # noqa: E711
        total = int(q.scalar() or 0)
        active = int(q.filter(Booking.status == BookingStatus.active).scalar() or 0)
        return {"total": total, "active": active}

    def update(self, db: Session, db_obj: Booking, obj_in: BookingUpdate | dict) -> Booking:
        from app.services.pricing import calculate_total_price, price_result_to_breakdown_json

        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # הסר שדות override — מנוהלים בנפרד מה-router
        update_data.pop("price_override", None)
        update_data.pop("price_override_reason", None)

        needs_recalc = any(f in update_data for f in _PRICE_RECALC_FIELDS)

        # החל עדכון שדות
        for k, v in update_data.items():
            setattr(db_obj, k, v)
        db.flush()  # ודא שהשינויים נגישים לחישוב

        if needs_recalc:
            # כשמחשבים מחדש — מנקים override קיים
            if db_obj.price_override is not None:
                db_obj.price_override        = None
                db_obj.price_override_reason = None
                db_obj.price_override_by     = None
                db_obj.price_override_at     = None

            try:
                result = calculate_total_price(
                    db=db,
                    car=db_obj.car,
                    start_date=db_obj.start_date,
                    end_date=db_obj.end_date,
                    pickup_time=db_obj.pickup_time,
                    return_time=db_obj.return_time,
                )
                db_obj.total_price         = result.total
                db_obj.billable_days       = result.billable_days
                db_obj.actual_days         = result.actual_days
                db_obj.price_type_used     = result.price_type_used
                db_obj.price_rule_id       = result.price_rule_id
                db_obj.price_breakdown_json = price_result_to_breakdown_json(result)
            except Exception:
                # fallback
                days = max((db_obj.end_date - db_obj.start_date).days, 1)
                db_obj.total_price = self.get_effective_price(db, db_obj.car) * days

        db.commit()
        db.refresh(db_obj)
        return db_obj

crud_booking = CRUDBooking(Booking)
