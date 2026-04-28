import os

import pytest
from fastapi.testclient import TestClient
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
from app.models.booking import Booking
from app.models.audit_log import AuditLog
from app.core.config import settings
from app.core.rate_limit import clear_rate_limits
from app.core import security as security_module
from app.routers import bookings as bookings_router
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

# ── Bookings Tests ─────────────────────────────────────────────────────────────
class TestBookings:
    def test_create_booking(self, client, auth_headers, sample_car):
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "ישראל ישראלי",
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
            "start_date": "2030-07-01",
            "end_date":   "2030-07-10",
        }, headers=auth_headers)
        # ניסיון לחפיפה
        r = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "שני",
            "start_date": "2030-07-05",
            "end_date":   "2030-07-15",
        }, headers=auth_headers)
        assert r.status_code == 409

    def test_list_bookings(self, client, auth_headers):
        r = client.get("/api/bookings/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

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

    def test_agent_booking_scope(self, client, db, agent_headers, auth_headers, sample_car):
        # admin creates booking A
        created_a = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Admin Booking",
            "start_date": "2031-01-01",
            "end_date": "2031-01-03",
        }, headers=auth_headers)
        assert created_a.status_code == 201

        # agent creates booking B
        created_b = client.post("/api/bookings/", json={
            "car_id": sample_car.id,
            "customer_name": "Agent Booking",
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
