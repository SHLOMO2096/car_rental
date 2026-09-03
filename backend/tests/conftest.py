"""
Fixtures משותפים לכל בדיקות ה-API.

היו קודם בתוך test_api.py, וקובץ בדיקות שני שייבא אותם משם גרם ל-pytest
לרשום את setup_db פעמיים — הטבלאות נמחקו באמצע הריצה, והכשל הופיע
כ-"no such table: users" בקובץ אחר לגמרי. conftest מבטיח הגדרה אחת.
"""
import os
from datetime import date, timedelta

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
