import os
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.car import Car, CarType
from app.core import rate_limit as rate_limit_module
from app.core.rate_limit import clear_rate_limits


TEST_DB = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    TEST_DB,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _ensure_redis_or_skip(redis_url: str) -> None:
    try:
        import redis

        client = redis.Redis.from_url(redis_url, decode_responses=True)
        client.ping()
    except Exception as exc:
        pytest.skip(f"Redis is unavailable for API integration test: {exc}")


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def isolate_rate_limit_store(monkeypatch):
    monkeypatch.setattr(rate_limit_module, "_STORE", None)
    monkeypatch.setattr(rate_limit_module, "_STORE_BACKEND", None)
    clear_rate_limits()
    yield
    monkeypatch.setattr(rate_limit_module, "_STORE", None)
    monkeypatch.setattr(rate_limit_module, "_STORE_BACKEND", None)
    clear_rate_limits()


@pytest.fixture
def db():
    db = TestSession()
    yield db
    db.rollback()
    db.close()


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def auth_headers(client, db):
    email = f"admin-{uuid4().hex[:8]}@test.com"
    u = User(
        email=email,
        full_name="Admin",
        hashed_pw=hash_password("Admin123!"),
        role=UserRole.admin,
    )
    db.add(u)
    db.commit()

    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": "Admin123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_car(db):
    plate = f"TST-{uuid4().hex[:8]}"
    c = Car(
        name="Redis API Test Car",
        type=CarType.sedan,
        year=2024,
        plate=plate,
        color="white",
        price_per_day=100.0,
        group="C",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_suggestions_search_rate_limit_uses_redis_backend(client, auth_headers, sample_car, monkeypatch):
    redis_url = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/15")
    _ensure_redis_or_skip(redis_url)

    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setattr(settings, "RATE_LIMIT_REDIS_URL", redis_url)
    monkeypatch.setattr(settings, "RATE_LIMIT_REDIS_KEY_PREFIX", f"rl-api-{uuid4().hex}")
    monkeypatch.setattr(settings, "SUGGESTIONS_SEARCH_RATE_LIMIT_PER_MINUTE", 2)
    monkeypatch.setattr(settings, "SUGGESTIONS_RATE_LIMIT_WINDOW_SECONDS", 60)

    payload = {
        "car_id": sample_car.id,
        "start_date": datetime(2045, 1, 1).date().isoformat(),
        "end_date": datetime(2045, 1, 3).date().isoformat(),
    }

    first = client.post("/api/suggestions/search", json=payload, headers=auth_headers)
    second = client.post("/api/suggestions/search", json=payload, headers=auth_headers)
    third = client.post("/api/suggestions/search", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.headers.get("X-RateLimit-Limit") == "2"
    assert third.headers.get("X-RateLimit-Remaining") == "0"
    assert third.headers.get("Retry-After") is not None

