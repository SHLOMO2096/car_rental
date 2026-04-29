"""
CandidateGenerator – produces Type A, B, C suggestion candidates.

Type A – Exact requested car is directly available.
Type B – A different car (same or adjacent group) is directly available.
Type C – One blocking booking on the target car can be safely moved to
         another free car, thus freeing the target.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.booking import Booking, BookingStatus
from app.engine.constraints import is_car_available, get_overlapping_bookings
from app.engine.scoring import score_direct, score_reassignment, group_rank
from app.engine.explainer import explain_direct, explain_reassignment
from app.core.security import create_suggestion_apply_token
from app.schemas.suggestion import SuggestionResult

MAX_SUGGESTIONS = 10


# ── helpers ────────────────────────────────────────────────────────────────────

def _active_cars(db: Session) -> list[Car]:
    return db.query(Car).filter(Car.is_active == True).all()


def _price_delta(candidate: Car, ref_car: Car | None, ref_group: str | None) -> float:
    """Positive = candidate costs more (upgrade impression), negative = cheaper."""
    if ref_car:
        return round(candidate.price_per_day - ref_car.price_per_day, 2)
    return 0.0


# ── main generator ─────────────────────────────────────────────────────────────

def generate_suggestions(
    db: Session,
    car_id: int | None,
    group: str | None,
    start: date,
    end: date,
    today: date,
    actor_user_id: int,
) -> list[SuggestionResult]:

    results: list[SuggestionResult] = []

    # Resolve requested car ──────────────────────────────────────────────────
    requested_car: Car | None = None
    if car_id:
        requested_car = (
            db.query(Car).filter(Car.id == car_id, Car.is_active == True).first()
        )

    target_group: str | None = group or (
        requested_car.group if requested_car else None
    )

    all_cars = _active_cars(db)

    # ────────────────────────────────────────────────────────────────────────
    # Type A – exact car is free
    # ────────────────────────────────────────────────────────────────────────
    if requested_car and is_car_available(db, requested_car.id, start, end):
        score = 100.0
        why, summary, risk = explain_direct(
            requested_car, "A", requested_car.name, score
        )
        results.append(
            SuggestionResult(
                type="A",
                score=score,
                car_id=requested_car.id,
                car_name=requested_car.name,
                car_make=requested_car.make,
                car_group=requested_car.group,
                price_per_day=requested_car.price_per_day,
                price_delta=0.0,
                why=why,
                operator_summary=summary,
                risk_level=risk,
            )
        )
        # Perfect match – return immediately, no need to look further
        return results

    # ────────────────────────────────────────────────────────────────────────
    # Type B – same-or-adjacent group, directly free
    # ────────────────────────────────────────────────────────────────────────
    for car in all_cars:
        if requested_car and car.id == requested_car.id:
            continue
        if not is_car_available(db, car.id, start, end):
            continue

        # Group filter: allow same group or upgrade; skip hard downgrades
        if target_group and car.group:
            car_rank = group_rank(car.group)
            tgt_rank = group_rank(target_group)
            if car_rank < tgt_rank - 1:
                continue   # more than one step down → skip

        score = score_direct(car, requested_car, target_group, "B")
        why, summary, risk = explain_direct(
            car, "B",
            requested_car.name if requested_car else None,
            score,
        )
        results.append(
            SuggestionResult(
                type="B",
                score=score,
                car_id=car.id,
                car_name=car.name,
                car_make=car.make,
                car_group=car.group,
                price_per_day=car.price_per_day,
                price_delta=_price_delta(car, requested_car, target_group),
                why=why,
                operator_summary=summary,
                risk_level=risk,
            )
        )

    # ────────────────────────────────────────────────────────────────────────
    # Type C – one-step reassignment
    # Find cars in the target group that are blocked, then check if their
    # blocking booking can be safely moved to another free car.
    # ────────────────────────────────────────────────────────────────────────
    if requested_car:
        blocked_cars: list[Car] = [requested_car]
    elif target_group:
        blocked_cars = [c for c in all_cars if c.group == target_group]
    else:
        blocked_cars = []

    for blocked_car in blocked_cars:
        overlapping: list[Booking] = get_overlapping_bookings(
            db, blocked_car.id, start, end
        )
        for affected_booking in overlapping:
            # Eagerly load the car relationship if not loaded
            if affected_booking.car is None:
                affected_booking.car = blocked_car

            # Search for a free replacement for the affected booking
            for replacement in all_cars:
                if replacement.id == blocked_car.id:
                    continue
                if not is_car_available(
                    db,
                    replacement.id,
                    affected_booking.start_date,
                    affected_booking.end_date,
                    exclude_booking_id=affected_booking.id,
                ):
                    continue

                # Don't offer a hard downgrade for the affected customer
                orig_rank = group_rank(blocked_car.group)
                rep_rank  = group_rank(replacement.group)
                if rep_rank < orig_rank - 1:
                    continue

                score = score_reassignment(
                    blocked_car,
                    affected_booking,
                    replacement,
                    requested_car,
                    target_group,
                    today,
                )
                why, summary, risk = explain_reassignment(
                    blocked_car, affected_booking, replacement, score, today
                )
                results.append(
                    SuggestionResult(
                        type="C",
                        score=score,
                        car_id=blocked_car.id,
                        car_name=blocked_car.name,
                        car_make=blocked_car.make,
                        car_group=blocked_car.group,
                        price_per_day=blocked_car.price_per_day,
                        price_delta=_price_delta(
                            blocked_car, requested_car, target_group
                        ),
                        # Affected booking – full details for informed decision
                        affected_booking_id=affected_booking.id,
                        affected_customer_name=affected_booking.customer_name,
                        affected_booking_start=affected_booking.start_date,
                        affected_booking_end=affected_booking.end_date,
                        affected_booking_total_price=affected_booking.total_price,
                        affected_booking_pickup_time=affected_booking.pickup_time,
                        affected_booking_return_time=affected_booking.return_time,
                        affected_booking_notes=affected_booking.notes,
                        affected_customer_phone=affected_booking.customer_phone,
                        affected_customer_email=affected_booking.customer_email,
                        affected_customer_id_num=affected_booking.customer_id_num,
                        # Replacement car details
                        replacement_car_id=replacement.id,
                        replacement_car_name=replacement.name,
                        replacement_car_make=replacement.make,
                        replacement_car_group=replacement.group,
                        replacement_price_per_day=replacement.price_per_day,
                        replacement_price_delta=round(
                            replacement.price_per_day - blocked_car.price_per_day, 2
                        ),
                        apply_token=create_suggestion_apply_token(
                            actor_user_id,
                            {
                                "blocked_car_id": blocked_car.id,
                                "affected_booking_id": affected_booking.id,
                                "replacement_car_id": replacement.id,
                                "requested_start": str(start),
                                "requested_end": str(end),
                            },
                        ),
                        why=why,
                        operator_summary=summary,
                        risk_level=risk,
                    )
                )
                break   # one replacement per blocked booking is enough

    # ── Deduplicate by (car_id, affected_booking_id), keep best score ─────
    seen: dict[tuple, SuggestionResult] = {}
    for r in results:
        key = (r.car_id, r.affected_booking_id)
        if key not in seen or r.score > seen[key].score:
            seen[key] = r

    ranked = sorted(seen.values(), key=lambda x: x.score, reverse=True)
    return ranked[:MAX_SUGGESTIONS]

