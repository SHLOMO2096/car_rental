import os
from datetime import date
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bootstrap.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.main import app
from app.db.session import Base, get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.car import Car, CarType
from app.models.booking import Booking, BookingStatus
from app.models.customer import Customer
from app.models.audit_log import AuditLog
from app.core.config import settings
from app.core.rate_limit import clear_rate_limits
from app.core import security as security_module
from app.routers import bookings as bookings_router
from app.routers import customers as customers_router
from app.routers import suggestions as suggestions_router

# ── DB in-memory לבדיקות ───────────────────────────────────────────────────
TEST_DB = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    TEST_DB,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    db = TestSession()
    yield db
    db.rollback()
    db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def admin_user(db):
    u = User(email="admin@test.com", full_name="Admin",
             hashed_pw=hash_password("Admin123!"), role=UserRole.admin)
    db.add(u); db.commit(); db.refresh(u)
    yield u
    db.rollback()
    db.query(Booking).filter(Booking.created_by == u.id).delete(synchronize_session=False)
    db.delete(u); db.commit()

@pytest.fixture
def admin_token(client, admin_user):
    r = client.post("/api/auth/login",
                    data={"username": "admin@test.com", "password": "Admin123!"},
                    headers={"Content-Type": "application/x-www-form-urlencoded"})
    return r.json()["access_token"]

@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
def agent_user(db):
    u = User(email="agent@test.com", full_name="Agent",
             hashed_pw=hash_password("Agent123!"), role=UserRole.agent)
    db.add(u); db.commit(); db.refresh(u)
    yield u
    db.rollback()
    db.query(Booking).filter(Booking.created_by == u.id).delete(synchronize_session=False)
    db.delete(u); db.commit()


@pytest.fixture
def agent_token(client, agent_user):
    r = client.post("/api/auth/login",
                    data={"username": "agent@test.com", "password": "Agent123!"},
                    headers={"Content-Type": "application/x-www-form-urlencoded"})
    return r.json()["access_token"]


@pytest.fixture
def agent_headers(agent_token):
    return {"Authorization": f"Bearer {agent_token}"}

@pytest.fixture
def sample_car(db):
    c = Car(name="Toyota Test", type=CarType.sedan, year=2022,
            plate="TEST-001", color="לבן", price_per_day=100.0)
    db.add(c); db.commit(); db.refresh(c)
    yield c
    db.rollback()
    db.query(Booking).filter(Booking.car_id == c.id).delete(synchronize_session=False)
    db.delete(c); db.commit()

# ── Auth Tests ─────────────────────────────────────────────────────────────────
class TestAuth:
    def test_login_success(self, client, admin_user):
        r = client.post("/api/auth/login",
                        data={"username":"admin@test.com","password":"Admin123!"},
                        headers={"Content-Type":"application/x-www-form-urlencoded"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client, admin_user):
        r = client.post("/api/auth/login",
                        data={"username":"admin@test.com","password":"wrong"},
                        headers={"Content-Type":"application/x-www-form-urlencoded"})
        assert r.status_code == 401

    def test_me(self, client, auth_headers):
        r = client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@test.com"

    def test_unauthorized_without_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401

# ── Cars Tests ─────────────────────────────────────────────────────────────────
class TestCars:
    def test_list_cars(self, client, auth_headers, sample_car):
        r = client.get("/api/cars/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_car(self, client, auth_headers, db):
        r = client.post("/api/cars/", json={
            "name":"Honda Test","type":"sedan","year":2023,
            "plate":"NEW-999","color":"אפור","price_per_day":150.0
        }, headers=auth_headers)
        assert r.status_code == 201
        assert r.json()["plate"] == "NEW-999"
        # cleanup
        car_id = r.json()["id"]
        db.execute(db.query(Car).filter(Car.id==car_id).statement)

    def test_duplicate_plate(self, client, auth_headers, sample_car):
        r = client.post("/api/cars/", json={
            "name":"Dup","type":"sedan","year":2022,
            "plate":"TEST-001","price_per_day":100
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_check_availability(self, client, auth_headers, sample_car):
        r = client.get(f"/api/cars/{sample_car.id}/availability",
                       params={"start":"2030-01-01","end":"2030-01-05"},
                       headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["available"] is True

    def test_permanent_delete_car_without_bookings(self, client, auth_headers, db):
        car = Car(
            name="Delete Me",
            type=CarType.sedan,
            year=2024,
            plate="DEL-100",
            color="שחור",
            price_per_day=180.0,
        )
        db.add(car)
        db.commit()
        db.refresh(car)

        deleted = client.delete(f"/api/cars/{car.id}/permanent", headers=auth_headers)
        assert deleted.status_code == 204
        assert db.query(Car).filter(Car.id == car.id).first() is None

    def test_permanent_delete_car_rejects_when_bookings_exist(self, client, auth_headers, sample_car):
        created = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "לקוח לרכב עם היסטוריה",
            "customer_has_no_email": True,
            "start_date": "2033-03-01",
            "end_date": "2033-03-04",
        }, headers=auth_headers)
        assert created.status_code == 201

        deleted = client.delete(f"/api/cars/{sample_car.id}/permanent", headers=auth_headers)
        assert deleted.status_code == 400

# ── Bookings Tests ─────────────────────────────────────────────────────────────
class TestBookings:
    def test_create_booking(self, client, auth_headers, sample_car):
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "ישראל ישראלי",
            "customer_has_no_email": True,
            "start_date": "2030-06-01",
            "end_date":   "2030-06-05",
        }, headers=auth_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["total_price"] == 400.0   # 4 ימים (הפרש תאריכים) × 100

    def test_overlap_conflict(self, client, auth_headers, sample_car):
        # יצירת הזמנה ראשונה
        client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "ראשון",
            "customer_has_no_email": True,
            "start_date": "2030-07-01",
            "end_date":   "2030-07-10",
        }, headers=auth_headers)
        # ניסיון לחפיפה
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "שני",
            "customer_has_no_email": True,
            "start_date": "2030-07-05",
            "end_date":   "2030-07-15",
        }, headers=auth_headers)
        assert r.status_code == 409

    def test_list_bookings(self, client, auth_headers):
        r = client.get("/api/bookings/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_booking_auto_creates_customer(self, client, auth_headers, sample_car, db):
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "לקוח חדש לא קיים",
            "customer_phone": "052-1112233",
            "customer_email": "new-customer@test.com",
            "start_date": "2030-08-01",
            "end_date": "2030-08-04",
        }, headers=auth_headers)
        assert r.status_code == 201
        created = r.json()
        assert created["customer_id"] is not None

        customer = db.query(Customer).filter(Customer.id == created["customer_id"]).first()
        assert customer is not None
        assert customer.name == "לקוח חדש לא קיים"

    def test_create_booking_requires_email_or_explicit_no_email(self, client, auth_headers, sample_car):
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "ללא מייל",
            "start_date": "2030-09-01",
            "end_date": "2030-09-03",
        }, headers=auth_headers)
        assert r.status_code == 422

    def test_create_booking_rejects_invalid_email(self, client, auth_headers, sample_car):
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "מייל לא תקין",
            "customer_email": "not-an-email",
            "start_date": "2030-09-11",
            "end_date": "2030-09-13",
        }, headers=auth_headers)
        assert r.status_code == 422

    def test_create_booking_with_no_email_sends_alert(self, client, auth_headers, sample_car, monkeypatch):
        alert_calls = []

        def fake_missing_email_alert(**kwargs):
            alert_calls.append(kwargs)
            return True

        monkeypatch.setattr(bookings_router, "send_missing_customer_email_alert", fake_missing_email_alert)

        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "ללא מייל במודע",
            "customer_has_no_email": True,
            "customer_phone": "0529991111",
            "start_date": "2030-10-01",
            "end_date": "2030-10-03",
        }, headers=auth_headers)
        assert r.status_code == 201
        assert len(alert_calls) == 1
        assert alert_calls[0]["customer_name"] == "ללא מייל במודע"


class TestCustomers:
    def test_search_customers(self, client, auth_headers, db):
        db.add(Customer(name="משה כהן", normalized_name="משה כהן", phone="0523334444", email="moshe@test.com"))
        db.add(Customer(name="שרה לוי", normalized_name="שרה לוי", phone="0529990000", email="sara@test.com"))
        db.commit()

        r = client.get("/api/customers/search", params={"q": "משה", "limit": 5}, headers=auth_headers)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert rows[0]["name"] == "משה כהן"

    def test_customer_history_includes_linked_and_legacy_matches(self, client, auth_headers, db, sample_car):
        customer = Customer(
            name="יוסי כהן",
            normalized_name="יוסי כהן",
            phone="0524445566",
            email="yossi@test.com",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

        linked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "customer_email": customer.email,
            "start_date": "2032-01-10",
            "end_date": "2032-01-12",
        }, headers=auth_headers)
        assert linked.status_code == 201

        legacy = Booking(
            car_id=sample_car.id,
            customer_name="יוסי כהן",
            customer_phone="0524445566",
            customer_email="yossi@test.com",
            start_date=date(2031, 12, 1),
            end_date=date(2031, 12, 4),
            total_price=300,
            status=BookingStatus.completed,
        )
        db.add(legacy)
        db.commit()

        r = client.get(f"/api/customers/{customer.id}/history", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["customer"]["id"] == customer.id
        assert body["summary"]["total_bookings"] >= 2
        booking_ids = {b["id"] for b in body["bookings"]}
        assert linked.json()["id"] in booking_ids
        assert legacy.id in booking_ids

    def test_import_customers_from_excel_with_flexible_headers(self, client, auth_headers):
        wb = Workbook()
        ws = wb.active
        ws.append(["לקוחות לייבוא"])
        ws.append(["שם לקוח", "טלפונים", "מייל", "כתובת", "תעודת זהות"])
        ws.append(["דני כהן", "052-1234567", "danny@test.com", "מודיעין", "123456789"])
        ws.append(["דני כהן", "052-1234567", "danny@test.com", "מודיעין", "123456789"])

        payload = BytesIO()
        wb.save(payload)
        payload.seek(0)

        r = client.post(
            "/api/customers/import",
            headers=auth_headers,
            files={"file": ("customers.xlsx", payload.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["processed"] == 1
        assert body["inserted"] == 1
        assert body["skipped"] == 0
        assert body["issues"] == []

        listed = client.get("/api/customers/search", params={"q": "123456789"}, headers=auth_headers)
        assert listed.status_code == 200
        assert listed.json()[0]["name"] == "דני כהן"
        assert listed.json()[0]["id_number"] == "123456789"

    def test_import_customers_reports_skipped_rows(self, client, auth_headers):
        csv_payload = "שם לקוח,טלפון,מייל\n,0521111111,a@test.com\nרות לוי,0522222222,invalid-mail\n"
        r = client.post(
            "/api/customers/import",
            headers=auth_headers,
            files={"file": ("customers.csv", csv_payload.encode("utf-8"), "text/csv")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["processed"] == 1
        assert body["skipped"] == 1
        assert len(body["issues"]) >= 2
        assert any(i["field"] == "name" and i["level"] == "error" for i in body["issues"])
        assert any(i["field"] == "email" and i["level"] == "warning" for i in body["issues"])

    def test_update_delete_and_email_customer(self, client, auth_headers, db, monkeypatch):
        sent_calls = []

        def fake_send_customer_message(**kwargs):
            sent_calls.append(kwargs)
            return True

        monkey_customer = Customer(
            name="לקוח לעריכה",
            normalized_name="לקוח לעריכה",
            phone="0527000000",
            email="edit@test.com",
        )
        db.add(monkey_customer)
        db.commit()
        db.refresh(monkey_customer)

        updated = client.patch(
            f"/api/customers/{monkey_customer.id}",
            json={"id_number": "301234567", "address": "ירושלים"},
            headers=auth_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["id_number"] == "301234567"

        monkeypatch.setattr(customers_router, "send_customer_message", fake_send_customer_message)
        emailed = client.post(
            f"/api/customers/{monkey_customer.id}/send-email",
            json={"subject": "שלום", "body": "בדיקת מייל"},
            headers=auth_headers,
        )
        assert emailed.status_code == 200
        assert sent_calls and sent_calls[0]["to"] == "edit@test.com"

        deleted = client.delete(f"/api/customers/{monkey_customer.id}", headers=auth_headers)
        assert deleted.status_code == 204
        assert db.query(Customer).filter(Customer.id == monkey_customer.id).first() is None

    def test_bulk_email_customers(self, client, auth_headers, db, monkeypatch):
        sent_calls = []

        def fake_send_customer_message(**kwargs):
            sent_calls.append(kwargs)
            return True

        monkeypatch.setattr(customers_router, "send_customer_message", fake_send_customer_message)

        def summarize_existing_rows(rows):
            seen = set()
            queued = 0
            skipped = 0
            for row in rows:
                email = (row.email or "").strip().lower()
                if not email or email in seen:
                    skipped += 1
                    continue
                seen.add(email)
                queued += 1
            return queued, skipped

        baseline_queued, baseline_skipped = summarize_existing_rows(
            db.query(Customer).filter(Customer.email.isnot(None)).order_by(Customer.id).all()
        )

        db.add_all([
            Customer(name="לקוח א", normalized_name="לקוח א", email="bulk-first@test.com"),
            Customer(name="לקוח ב", normalized_name="לקוח ב", email="bulk-second@test.com"),
            Customer(name="לקוח ללא מייל", normalized_name="לקוח ללא מייל", email=None),
            Customer(name="לקוח כפול", normalized_name="לקוח כפול", email="BULK-FIRST@test.com"),
        ])
        db.commit()

        emailed = client.post(
            "/api/customers/send-bulk-email",
            json={"subject": "מבצעים מיוחדים", "body": "יש לנו עדכון חשוב"},
            headers=auth_headers,
        )
        assert emailed.status_code == 200
        assert emailed.json()["queued"] == baseline_queued + 2
        assert emailed.json()["skipped"] == baseline_skipped + 1
        assert {call["to"] for call in sent_calls} >= {"bulk-first@test.com", "bulk-second@test.com"}

# ── Reports Tests ──────────────────────────────────────────────────────────────
class TestReports:
    def test_summary(self, client, auth_headers):
        r = client.get("/api/reports/summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "active" in data and "revenue" in data

    def test_monthly(self, client, auth_headers):
        r = client.get("/api/reports/monthly", params={"year":2030}, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestRBAC:
    def test_agent_can_access_reports(self, client, agent_headers):
        r = client.get("/api/reports/summary", headers=agent_headers)
        assert r.status_code == 200

    def test_agent_cannot_manage_users(self, client, agent_headers):
        r = client.get("/api/auth/users", headers=agent_headers)
        assert r.status_code == 403

    def test_agent_cannot_create_car(self, client, agent_headers):
        r = client.post("/api/cars/", json={
            "name": "Blocked Car", "type": "sedan", "year": 2023,
            "plate": "BLOCK-001", "price_per_day": 100
        }, headers=agent_headers)
        assert r.status_code == 403

    def test_agent_cannot_permanently_delete_car(self, client, agent_headers, sample_car):
        r = client.delete(f"/api/cars/{sample_car.id}/permanent", headers=agent_headers)
        assert r.status_code == 403

    def test_agent_cannot_send_bulk_customer_email(self, client, agent_headers):
        r = client.post(
            "/api/customers/send-bulk-email",
            json={"subject": "עדכון", "body": "טקסט"},
            headers=agent_headers,
        )
        assert r.status_code == 403

    def test_agent_booking_scope(self, client, db, agent_headers, auth_headers, sample_car):
        # admin creates booking A
        created_a = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Admin Booking",
            "customer_has_no_email": True,
            "start_date": "2031-01-01",
            "end_date": "2031-01-03",
        }, headers=auth_headers)
        assert created_a.status_code == 201

        # agent creates booking B
        created_b = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Agent Booking",
            "customer_has_no_email": True,
            "start_date": "2031-01-05",
            "end_date": "2031-01-07",
        }, headers=agent_headers)
        assert created_b.status_code == 201

        # agent should see all bookings in list
        listed = client.get("/api/bookings/", headers=agent_headers)
        assert listed.status_code == 200
        names = {x["customer_name"] for x in listed.json()}
        assert "Agent Booking" in names
        assert "Admin Booking" in names

        # agent cannot delete admin booking
        r_del = client.delete(f"/api/bookings/{created_a.json()['id']}", headers=agent_headers)
        assert r_del.status_code == 403

        # agent can delete own booking
        r_own_del = client.delete(f"/api/bookings/{created_b.json()['id']}", headers=agent_headers)
        assert r_own_del.status_code == 204

    def test_agent_can_delete_own_booking_and_audit_written(self, client, db, agent_headers, sample_car, monkeypatch):
        alert_calls = []

        def fake_delete_alert(**kwargs):
            alert_calls.append(kwargs)
            return True

        monkeypatch.setattr(bookings_router, "send_booking_delete_alert", fake_delete_alert)

        created = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Agent Delete",
            "customer_has_no_email": True,
            "start_date": "2031-02-01",
            "end_date": "2031-02-03",
        }, headers=agent_headers)
        assert created.status_code == 201

        booking_id = created.json()["id"]
        deleted = client.delete(f"/api/bookings/{booking_id}", headers=agent_headers)
        assert deleted.status_code == 204

        audit = db.query(AuditLog).filter(
            AuditLog.action == "booking.delete",
            AuditLog.entity_type == "booking",
            AuditLog.entity_id == str(booking_id),
        ).first()
        assert audit is not None
        assert len(alert_calls) == 1
        assert alert_calls[0]["booking_id"] == booking_id
        assert alert_calls[0]["customer_name"] == "Agent Delete"


class TestSuggestions:
    """Tests for the reassignment engine - Phase 4A/4B."""

    def _get_type_c_item(self, client, headers, car_id: int, start: str, end: str):
        resp = client.post("/api/suggestions/search", json={
            "car_id": car_id,
            "start_date": start,
            "end_date": end,
        }, headers=headers)
        assert resp.status_code == 200
        c_items = [x for x in resp.json() if x["type"] == "C"]
        assert c_items
        return c_items[0]

    def test_type_a_direct_available(self, client, auth_headers, sample_car):
        """Type A: requested car is free → score 100, type A returned first."""
        r = client.post("/api/suggestions/search", json={
            "car_id": sample_car.id,
            "start_date": "2040-01-01",
            "end_date":   "2040-01-05",
        }, headers=auth_headers)
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1
        top = results[0]
        assert top["type"] == "A"
        assert top["car_id"] == sample_car.id
        assert top["score"] == 100.0

    def test_type_b_when_requested_blocked(self, client, db, auth_headers, sample_car):
        """Type B: requested car is booked → return an alternative."""
        # Book the sample car for our target window
        client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "BlockerB",
            "customer_has_no_email": True,
            "start_date": "2040-03-01",
            "end_date":   "2040-03-10",
        }, headers=auth_headers)

        # Add a second car in the same group so there is a B alternative
        alt = Car(name="Alt Car", type=CarType.sedan, year=2022,
                  plate="ALT-B01", color="לבן", price_per_day=110.0,
                  group=sample_car.group)
        db.add(alt); db.commit(); db.refresh(alt)

        r = client.post("/api/suggestions/search", json={
            "car_id": sample_car.id,
            "start_date": "2040-03-05",
            "end_date":   "2040-03-08",
        }, headers=auth_headers)
        assert r.status_code == 200
        types = [x["type"] for x in r.json()]
        assert "B" in types

        # cleanup
        db.query(Car).filter(Car.id == alt.id).delete()
        db.commit()

    def test_type_c_one_step_reassignment(self, client, db, auth_headers, sample_car):
        """Type C: can free the requested car by moving its blocked booking."""
        # Book the sample car for the target window
        client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "BlockerC",
            "customer_has_no_email": True,
            "start_date": "2040-05-01",
            "end_date":   "2040-05-10",
        }, headers=auth_headers)

        # Add a free replacement car
        rep = Car(name="Rep Car", type=CarType.sedan, year=2023,
                  plate="REP-C01", color="אפור", price_per_day=105.0,
                  group=sample_car.group)
        db.add(rep); db.commit(); db.refresh(rep)

        r = client.post("/api/suggestions/search", json={
            "car_id": sample_car.id,
            "start_date": "2040-05-02",
            "end_date":   "2040-05-08",
        }, headers=auth_headers)
        assert r.status_code == 200
        types = [x["type"] for x in r.json()]
        assert "C" in types
        c_items = [x for x in r.json() if x["type"] == "C"]
        # All type-C results must be for "BlockerC" since it's the only blocker
        assert c_items[0]["affected_customer_name"] == "BlockerC"
        # The engine must propose some free replacement car
        assert c_items[0]["replacement_car_id"] is not None
        # The replacement must NOT be the blocked car itself
        assert c_items[0]["replacement_car_id"] != sample_car.id
        assert c_items[0]["apply_token"]

        # cleanup
        db.query(Car).filter(Car.id == rep.id).delete()
        db.commit()

    def test_no_car_or_group_returns_422(self, client, auth_headers):
        r = client.post("/api/suggestions/search", json={
            "start_date": "2040-01-01",
            "end_date":   "2040-01-05",
        }, headers=auth_headers)
        assert r.status_code == 422

    def test_agent_can_search_suggestions(self, client, agent_headers, sample_car):
        r = client.post("/api/suggestions/search", json={
            "car_id": sample_car.id,
            "start_date": "2041-01-01",
            "end_date":   "2041-01-05",
        }, headers=agent_headers)
        assert r.status_code == 200

    def test_apply_success_writes_audit_and_alert(self, client, db, auth_headers, sample_car, monkeypatch):
        alert_calls = []

        def fake_apply_alert(**kwargs):
            alert_calls.append(kwargs)
            return True

        monkeypatch.setattr(suggestions_router, "send_reassignment_apply_alert", fake_apply_alert)

        blocked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Apply Target",
            "customer_has_no_email": True,
            "start_date": "2042-01-10",
            "end_date": "2042-01-15",
        }, headers=auth_headers)
        assert blocked.status_code == 201
        booking_id = blocked.json()["id"]

        replacement = Car(
            name="Apply Replacement",
            type=CarType.sedan,
            year=2024,
            plate="APPLY-REP-01",
            color="לבן",
            price_per_day=120.0,
            group=sample_car.group,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        c_item = self._get_type_c_item(
            client,
            auth_headers,
            sample_car.id,
            "2042-01-11",
            "2042-01-13",
        )
        assert c_item["affected_booking_id"] == booking_id

        applied = client.post("/api/suggestions/apply", json={
            "apply_token": c_item["apply_token"],
            "operator_note": "manual apply in test",
        }, headers=auth_headers)
        assert applied.status_code == 200
        body = applied.json()
        assert body["applied"] is True
        assert body["from_car_id"] == sample_car.id
        assert body["to_car_id"] == c_item["replacement_car_id"]

        moved = db.query(Booking).filter(Booking.id == booking_id).first()
        assert moved is not None
        assert moved.car_id == c_item["replacement_car_id"]

        audit = db.query(AuditLog).filter(
            AuditLog.action == "suggestions.apply",
            AuditLog.entity_type == "booking_reassignment",
            AuditLog.entity_id == str(booking_id),
        ).first()
        assert audit is not None

        assert len(alert_calls) == 1
        assert alert_calls[0]["affected_booking_id"] == booking_id

        db.query(Car).filter(Car.id == replacement.id).delete()
        db.commit()

    def test_apply_agent_forbidden_outside_scope(self, client, db, auth_headers, agent_headers, sample_car):
        blocked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Admin Owned",
            "customer_has_no_email": True,
            "start_date": "2042-02-10",
            "end_date": "2042-02-15",
        }, headers=auth_headers)
        assert blocked.status_code == 201
        booking_id = blocked.json()["id"]

        replacement = Car(
            name="Agent Scope Replacement",
            type=CarType.sedan,
            year=2024,
            plate="APPLY-REP-02",
            color="אפור",
            price_per_day=120.0,
            group=sample_car.group,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        c_item = self._get_type_c_item(
            client,
            agent_headers,
            sample_car.id,
            "2042-02-11",
            "2042-02-13",
        )
        assert c_item["affected_booking_id"] == booking_id

        applied = client.post("/api/suggestions/apply", json={
            "apply_token": c_item["apply_token"],
        }, headers=agent_headers)
        assert applied.status_code == 403

        moved = db.query(Booking).filter(Booking.id == booking_id).first()
        assert moved is not None
        assert moved.car_id == sample_car.id

        db.query(Car).filter(Car.id == replacement.id).delete()
        db.commit()

    def test_apply_conflict_keeps_data_unchanged(self, client, db, auth_headers, sample_car):
        blocked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Blocked For Conflict",
            "customer_has_no_email": True,
            "start_date": "2042-03-10",
            "end_date": "2042-03-15",
        }, headers=auth_headers)
        assert blocked.status_code == 201
        booking_id = blocked.json()["id"]

        replacement = Car(
            name="Conflict Replacement",
            type=CarType.sedan,
            year=2024,
            plate="APPLY-REP-03",
            color="שחור",
            price_per_day=120.0,
            group=sample_car.group,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        c_item = self._get_type_c_item(
            client,
            auth_headers,
            sample_car.id,
            "2042-03-11",
            "2042-03-13",
        )
        assert c_item["affected_booking_id"] == booking_id

        # Make replacement unavailable after token issuance.
        conflict_booking = client.post("/api/bookings/", json={
            "car_id": c_item["replacement_car_id"],
            "customer_name": "Conflict Owner",
            "customer_has_no_email": True,
            "start_date": "2042-03-11",
            "end_date": "2042-03-14",
        }, headers=auth_headers)
        assert conflict_booking.status_code == 201

        applied = client.post("/api/suggestions/apply", json={
            "apply_token": c_item["apply_token"],
        }, headers=auth_headers)
        assert applied.status_code == 409

        unchanged = db.query(Booking).filter(Booking.id == booking_id).first()
        assert unchanged is not None
        assert unchanged.car_id == sample_car.id

        db.query(Car).filter(Car.id == replacement.id).delete()
        db.commit()

    def test_apply_rejects_tampered_token(self, client, db, auth_headers, sample_car):
        blocked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Tamper Target",
            "customer_has_no_email": True,
            "start_date": "2042-04-10",
            "end_date": "2042-04-15",
        }, headers=auth_headers)
        assert blocked.status_code == 201

        replacement = Car(
            name="Tamper Replacement",
            type=CarType.sedan,
            year=2024,
            plate="APPLY-REP-04",
            color="לבן",
            price_per_day=120.0,
            group=sample_car.group,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        c_item = self._get_type_c_item(
            client,
            auth_headers,
            sample_car.id,
            "2042-04-11",
            "2042-04-13",
        )
        # Tamper payload segment so signature verification must fail.
        token_parts = c_item["apply_token"].split(".")
        assert len(token_parts) == 3
        payload_segment = token_parts[1]
        token_parts[1] = ("A" if payload_segment[0] != "A" else "B") + payload_segment[1:]
        bad_token = ".".join(token_parts)

        applied = client.post("/api/suggestions/apply", json={
            "apply_token": bad_token,
        }, headers=auth_headers)
        assert applied.status_code == 401

        db.query(Car).filter(Car.id == replacement.id).delete()
        db.commit()

    def test_apply_rejects_expired_token(self, client, db, auth_headers, sample_car, monkeypatch):
        blocked = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Expired Token Target",
            "customer_has_no_email": True,
            "start_date": "2042-05-10",
            "end_date": "2042-05-15",
        }, headers=auth_headers)
        assert blocked.status_code == 201

        replacement = Car(
            name="Expired Token Replacement",
            type=CarType.sedan,
            year=2024,
            plate="APPLY-REP-05",
            color="כסוף",
            price_per_day=120.0,
            group=sample_car.group,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        # Force new suggestion tokens to be immediately expired.
        monkeypatch.setattr(security_module.settings, "SUGGESTION_APPLY_TOKEN_EXPIRE_MINUTES", -1)

        c_item = self._get_type_c_item(
            client,
            auth_headers,
            sample_car.id,
            "2042-05-11",
            "2042-05-13",
        )

        applied = client.post("/api/suggestions/apply", json={
            "apply_token": c_item["apply_token"],
        }, headers=auth_headers)
        assert applied.status_code == 401

        db.query(Car).filter(Car.id == replacement.id).delete()
        db.commit()

    def test_search_rate_limit_returns_429(self, client, auth_headers, sample_car, monkeypatch):
        clear_rate_limits()
        monkeypatch.setattr(settings, "SUGGESTIONS_SEARCH_RATE_LIMIT_PER_MINUTE", 2)

        payload = {
            "car_id": sample_car.id,
            "start_date": "2043-01-01",
            "end_date": "2043-01-03",
        }

        first = client.post("/api/suggestions/search", json=payload, headers=auth_headers)
        second = client.post("/api/suggestions/search", json=payload, headers=auth_headers)
        third = client.post("/api/suggestions/search", json=payload, headers=auth_headers)

        assert first.status_code == 200
        assert second.status_code == 200
        assert third.status_code == 429
        assert third.headers.get("Retry-After") is not None
        assert third.headers.get("X-RateLimit-Limit") == "2"
        assert third.headers.get("X-RateLimit-Remaining") == "0"

# ── Audit Tests ───────────────────────────────────────────────────────────────
class TestAudit:
    def test_admin_create_car_writes_audit(self, client, db, auth_headers):
        r = client.post("/api/cars/", json={
            "name": "Audit Car",
            "type": "sedan",
            "year": 2024,
            "plate": "AUDIT-001",
            "price_per_day": 200,
        }, headers=auth_headers)
        assert r.status_code == 201

        car_id = r.json()["id"]
        audit = db.query(AuditLog).filter(
            AuditLog.action == "car.create",
            AuditLog.entity_type == "car",
            AuditLog.entity_id == str(car_id),
        ).first()
        assert audit is not None

    def test_admin_update_user_writes_audit(self, client, db, auth_headers, agent_user):
        r = client.patch(f"/api/auth/users/{agent_user.id}", json={"is_active": False}, headers=auth_headers)
        assert r.status_code == 200

        audit = db.query(AuditLog).filter(
            AuditLog.action == "user.update",
            AuditLog.entity_type == "user",
            AuditLog.entity_id == str(agent_user.id),
        ).first()
        assert audit is not None
