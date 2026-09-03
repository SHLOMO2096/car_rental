"""
השבתה זמנית של רכב.

הבדיקות כאן מכסות את החוזה שאי אפשר לראות מהממשק: שהשבתה באמת חוסמת
הזמנה, שהיא נדחית כשכבר יש הזמנה פעילה בטווח, ושביטול משחרר את הטווח.
"""
import os
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bootstrap.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

# ה-fixtures מגיעים מ-tests/conftest.py

from app.core.rate_limit import clear_rate_limits


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    """
    כל בדיקה כאן מבצעת התחברות דרך ה-fixtures, ומגבלת הקצב על /auth/login
    היא גלובלית לתהליך. בלי איפוס, הקובץ הזה מיצה את המכסה והפיל בדיקות
    בקובץ אחר — כשל שנראה כמו KeyError: 'access_token' וללא קשר לנושא.
    """
    clear_rate_limits()
    yield
    clear_rate_limits()


TODAY = date.today()


def _d(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def _create_block(client, headers, car_id, start_off, end_off, reason="garage"):
    return client.post(
        "/api/car-blocks/",
        json={"car_id": car_id, "start_date": _d(start_off), "end_date": _d(end_off), "reason": reason},
        headers=headers,
    )


def _create_booking(client, headers, car_id, start_off, end_off):
    return client.post(
        "/api/bookings/",
        json={
            "car_id": car_id,
            "customer_name": "לקוח בדיקה",
            "customer_phone": "050-0000000",
            # הסכימה דורשת מייל או סימון מפורש שאין — אין ברירת מחדל שקטה
            "customer_has_no_email": True,
            "start_date": _d(start_off),
            "end_date": _d(end_off),
        },
        headers=headers,
    )


def test_create_block_defaults_to_single_day(client, auth_headers, sample_car):
    r = _create_block(client, auth_headers, sample_car.id, 3, 3)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["start_date"] == body["end_date"] == _d(3)
    assert body["reason"] == "garage"
    client.delete(f"/api/car-blocks/{body['id']}", headers=auth_headers)


def test_block_rejects_booking_in_range(client, auth_headers, sample_car):
    blk = _create_block(client, auth_headers, sample_car.id, 5, 7, reason="accident")
    assert blk.status_code == 201, blk.text

    r = _create_booking(client, auth_headers, sample_car.id, 6, 6)
    assert r.status_code == 409
    assert "מושבת" in r.json()["detail"]

    client.delete(f"/api/car-blocks/{blk.json()['id']}", headers=auth_headers)


def test_booking_allowed_outside_the_blocked_range(client, auth_headers, sample_car):
    blk = _create_block(client, auth_headers, sample_car.id, 5, 7)
    assert blk.status_code == 201

    r = _create_booking(client, auth_headers, sample_car.id, 9, 10)
    assert r.status_code in (200, 201), r.text

    client.delete(f"/api/bookings/{r.json()['id']}", headers=auth_headers)
    client.delete(f"/api/car-blocks/{blk.json()['id']}", headers=auth_headers)


def test_cancelling_a_block_frees_the_range(client, auth_headers, sample_car):
    blk = _create_block(client, auth_headers, sample_car.id, 12, 14)
    block_id = blk.json()["id"]

    blocked = _create_booking(client, auth_headers, sample_car.id, 13, 13)
    assert blocked.status_code == 409

    assert client.delete(f"/api/car-blocks/{block_id}", headers=auth_headers).status_code == 204

    ok = _create_booking(client, auth_headers, sample_car.id, 13, 13)
    assert ok.status_code in (200, 201), ok.text
    client.delete(f"/api/bookings/{ok.json()['id']}", headers=auth_headers)


def test_block_refused_when_an_active_booking_already_occupies_the_range(client, auth_headers, sample_car):
    bk = _create_booking(client, auth_headers, sample_car.id, 20, 22)
    assert bk.status_code in (200, 201), bk.text

    r = _create_block(client, auth_headers, sample_car.id, 21, 21)
    assert r.status_code == 409
    assert "הזמנות פעילות" in r.json()["detail"]

    client.delete(f"/api/bookings/{bk.json()['id']}", headers=auth_headers)


def test_overlapping_blocks_are_refused(client, auth_headers, sample_car):
    a = _create_block(client, auth_headers, sample_car.id, 30, 32)
    assert a.status_code == 201
    b = _create_block(client, auth_headers, sample_car.id, 32, 34)
    assert b.status_code == 409
    client.delete(f"/api/car-blocks/{a.json()['id']}", headers=auth_headers)


def test_extend_and_shorten_a_block(client, auth_headers, sample_car):
    blk = _create_block(client, auth_headers, sample_car.id, 40, 40)
    block_id = blk.json()["id"]

    ext = client.patch(f"/api/car-blocks/{block_id}", json={"end_date": _d(43)}, headers=auth_headers)
    assert ext.status_code == 200
    assert ext.json()["end_date"] == _d(43)

    short = client.patch(f"/api/car-blocks/{block_id}", json={"end_date": _d(41)}, headers=auth_headers)
    assert short.status_code == 200
    assert short.json()["end_date"] == _d(41)

    # אחרי הקיצור, יום 43 שוב פנוי להזמנה
    ok = _create_booking(client, auth_headers, sample_car.id, 43, 43)
    assert ok.status_code in (200, 201), ok.text

    client.delete(f"/api/bookings/{ok.json()['id']}", headers=auth_headers)
    client.delete(f"/api/car-blocks/{block_id}", headers=auth_headers)


def test_end_before_start_is_rejected(client, auth_headers, sample_car):
    r = client.post(
        "/api/car-blocks/",
        json={"car_id": sample_car.id, "start_date": _d(50), "end_date": _d(48)},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_list_returns_blocks_overlapping_the_window(client, auth_headers, sample_car):
    blk = _create_block(client, auth_headers, sample_car.id, 60, 62)
    block_id = blk.json()["id"]

    inside = client.get(f"/api/car-blocks/?start={_d(61)}&end={_d(61)}", headers=auth_headers)
    assert any(b["id"] == block_id for b in inside.json())

    outside = client.get(f"/api/car-blocks/?start={_d(70)}&end={_d(71)}", headers=auth_headers)
    assert all(b["id"] != block_id for b in outside.json())

    client.delete(f"/api/car-blocks/{block_id}", headers=auth_headers)
