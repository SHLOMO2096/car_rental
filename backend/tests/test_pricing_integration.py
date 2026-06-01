"""
בדיקות אינטגרציה — price_override flow ולוגיקת recalc.
מריצות ללא DB אמיתי — משתמשות ב-mock.
"""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch

from app.models.booking import BookingStatus
from app.schemas.pricing import PriceCalculateResponse, BreakdownLine


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_booking(**kwargs):
    b = MagicMock()
    b.id = 1
    b.car_id = 10
    b.start_date = date(2026, 6, 1)
    b.end_date   = date(2026, 6, 8)
    b.pickup_time = "10:00"
    b.return_time = "10:00"
    b.total_price = 700.0
    b.billable_days = 6.0
    b.actual_days = 7
    b.price_type_used = "day"
    b.price_rule_id = None
    b.price_breakdown_json = None
    b.price_override = None
    b.price_override_reason = None
    b.price_override_by = None
    b.price_override_at = None
    b.status = BookingStatus.active
    b.notes = None
    for k, v in kwargs.items():
        setattr(b, k, v)
    return b


def _make_car(price_per_day=100.0):
    car = MagicMock()
    car.id = 10
    car.group = "B"
    car.category = "משפחתי"
    car.price_per_day = price_per_day
    return car


def _make_pricing_result(total=600.0, billable=6.0, actual=7, price_type="day"):
    return PriceCalculateResponse(
        total=total,
        price_type_used=price_type,
        billable_days=billable,
        actual_days=actual,
        price_rule_id=42,
        breakdown=[
            BreakdownLine(
                segment_start=date(2026, 6, 1),
                segment_end=date(2026, 6, 8),
                price_type=price_type,
                unit_price=total / billable if billable else 0,
                season_multiplier=1.0,
                season_name=None,
                subtotal=total,
                calendar_days=actual,
                billable_days=billable,
                skipped_dates=[],
                label=f"{billable} ימי חיוב",
            )
        ],
        note=None,
    )


# ── BookingUpdate validation ──────────────────────────────────────────────────

class TestBookingUpdateSchema:
    def test_price_override_requires_reason(self):
        from app.schemas.booking import BookingUpdate
        with pytest.raises(Exception, match="סיבה"):
            BookingUpdate(price_override=500.0)

    def test_price_override_with_reason_ok(self):
        from app.schemas.booking import BookingUpdate
        data = BookingUpdate(price_override=500.0, price_override_reason="הנחת נאמנות")
        assert data.price_override == 500.0

    def test_price_override_zero_invalid(self):
        from app.schemas.booking import BookingUpdate
        with pytest.raises(Exception):
            BookingUpdate(price_override=0.0, price_override_reason="בדיקה")

    def test_no_override_is_ok(self):
        from app.schemas.booking import BookingUpdate
        data = BookingUpdate(notes="הערה")
        assert data.price_override is None


# ── CRUDBooking.create_booking ────────────────────────────────────────────────

class TestCRUDBookingCreate:
    def test_create_uses_pricing_service(self):
        from app.crud.booking import crud_booking

        car = _make_car()
        mock_result = _make_pricing_result(total=600.0, billable=6.0)

        db = MagicMock()
        db.add = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = {
            "car_id": 10,
            "customer_name": "ישראל ישראלי",
            "customer_email": "test@test.com",
            "customer_phone": None,
            "customer_id_num": None,
            "customer_id": None,
            "start_date": date(2026, 6, 1),
            "end_date": date(2026, 6, 8),
            "pickup_time": "10:00",
            "return_time": "10:00",
            "notes": None,
        }

        with patch("app.services.pricing.calculate_total_price", return_value=mock_result):
            with patch("app.services.pricing.price_result_to_breakdown_json",
                       return_value='{"test": 1}'):
                booking = crud_booking.create_booking(db, payload, user_id=1, car=car)

        db.add.assert_called_once()
        created = db.add.call_args[0][0]
        assert created.total_price == 600.0
        assert created.billable_days == 6.0
        assert created.actual_days == 7
        assert created.price_rule_id == 42
        assert created.price_breakdown_json == '{"test": 1}'

    def test_create_falls_back_on_pricing_error(self):
        from app.crud.booking import crud_booking

        car = _make_car(price_per_day=100.0)
        db = MagicMock()

        payload = {
            "car_id": 10,
            "customer_name": "לקוח בדיקה",
            "customer_email": None,
            "customer_phone": None,
            "customer_id_num": None,
            "customer_id": None,
            "start_date": date(2026, 6, 1),
            "end_date": date(2026, 6, 8),
            "pickup_time": None,
            "return_time": None,
            "notes": None,
        }

        with patch("app.services.pricing.calculate_total_price",
                   side_effect=Exception("DB error")):
            booking = crud_booking.create_booking(db, payload, user_id=1, car=car)

        created = db.add.call_args[0][0]
        assert created.total_price == 700.0   # fallback: 7 ימים × 100


# ── CRUDBooking.update ────────────────────────────────────────────────────────

class TestCRUDBookingUpdate:
    def test_recalc_triggered_on_date_change(self):
        from app.crud.booking import crud_booking

        booking = _make_booking()
        booking.car = _make_car()
        new_result = _make_pricing_result(total=500.0, billable=5.0, actual=6)

        db = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock(side_effect=lambda obj: None)

        with patch("app.services.pricing.calculate_total_price", return_value=new_result):
            with patch("app.services.pricing.price_result_to_breakdown_json",
                       return_value='{}'):
                crud_booking.update(db, booking, {"end_date": date(2026, 6, 7), "updated_by": 1})

        assert booking.total_price == 500.0
        assert booking.billable_days == 5.0

    def test_override_cleared_on_recalc(self):
        from app.crud.booking import crud_booking

        booking = _make_booking(
            price_override=999.0,
            price_override_reason="הנחה ישנה",
            price_override_by=5,
        )
        booking.car = _make_car()
        new_result = _make_pricing_result(total=500.0)

        db = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock(side_effect=lambda obj: None)

        with patch("app.services.pricing.calculate_total_price", return_value=new_result):
            with patch("app.services.pricing.price_result_to_breakdown_json",
                       return_value='{}'):
                crud_booking.update(db, booking, {"end_date": date(2026, 6, 7), "updated_by": 1})

        assert booking.price_override is None
        assert booking.price_override_reason is None

    def test_no_recalc_without_price_fields(self):
        from app.crud.booking import crud_booking

        booking = _make_booking(total_price=700.0)
        booking.car = _make_car()

        db = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock(side_effect=lambda obj: None)

        with patch("app.services.pricing.calculate_total_price") as mock_calc:
            crud_booking.update(db, booking, {"notes": "הערה חדשה", "updated_by": 1})
            mock_calc.assert_not_called()

        assert booking.total_price == 700.0
