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
