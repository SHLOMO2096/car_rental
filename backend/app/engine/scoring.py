"""
ScoringEngine – weighted scoring model from the spec.

Weights (tunable):
  direct exact match          +100
  same-class free alternative  +70
  upgrade for request          +20
  downgrade for request        -80
  upgrade for affected booking +30
  downgrade for affected       -80
  booking starts ≤24 h         -90
  booking starts ≤72 h         -40
  each extra move in chain     -25
"""
from datetime import date
from app.models.car import Car
from app.models.booking import Booking

# ── Group hierarchy ────────────────────────────────────────────────────────────
# Higher rank = more premium.
GROUP_ORDER: dict[str, int] = {
    "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "G": 6,
}


def group_rank(group: str | None) -> int:
    if not group:
        return 0
    return GROUP_ORDER.get(group.strip().upper(), 0)


# ── Type A / B ─────────────────────────────────────────────────────────────────
def score_direct(
    candidate_car: Car,
    requested_car: Car | None,
    requested_group: str | None,
    suggestion_type: str,          # "A" | "B"
) -> float:
    score = 0.0
    if suggestion_type == "A":
        score += 100.0
    else:  # "B"
        score += 70.0
        ref_rank = group_rank(
            requested_car.group if requested_car else requested_group
        )
        cand_rank = group_rank(candidate_car.group)
        if cand_rank > ref_rank:
            score += 20.0    # upgrade
        elif cand_rank < ref_rank:
            score -= 80.0    # downgrade
    return score


# ── Type C ────────────────────────────────────────────────────────────────────
def score_reassignment(
    freed_car: Car,
    affected_booking: Booking,
    replacement_car: Car,
    requested_car: Car | None,
    requested_group: str | None,
    today: date,
) -> float:
    """Score a one-step reassignment that frees *freed_car* for the new request."""
    score = 70.0   # base: we are freeing the requested slot

    # Disruption penalty – proximity of affected booking pickup
    days_until = (affected_booking.start_date - today).days
    if days_until <= 1:
        score -= 90.0
    elif days_until <= 3:
        score -= 40.0

    # Replacement quality for the affected customer
    orig_rank = group_rank(freed_car.group)
    rep_rank  = group_rank(replacement_car.group)
    if rep_rank > orig_rank:
        score += 30.0    # affected customer gets an upgrade → good
    elif rep_rank < orig_rank:
        score -= 80.0    # downgrade for affected customer → bad

    # Chain complexity: one extra move
    score -= 25.0

    return score

