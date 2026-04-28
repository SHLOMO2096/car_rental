"""
Explainer – generates operator-facing Hebrew rationale for each suggestion.
"""
from datetime import date
from app.models.car import Car
from app.models.booking import Booking


def risk_label(score: float) -> str:
    if score >= 70:
        return "low"
    elif score >= 30:
        return "medium"
    return "high"


def explain_direct(
    candidate_car: Car,
    suggestion_type: str,
    requested_car_name: str | None,
    score: float,
) -> tuple[str, str, str]:
    """Returns (why, operator_summary, risk_level) for Type A / B."""
    risk = risk_label(score)
    if suggestion_type == "A":
        why = (
            f"הרכב המבוקש '{candidate_car.name}' "
            f"(לוחית: {candidate_car.plate}) פנוי בתאריכים אלו."
        )
        summary = f"✅ התאמה מלאה – {candidate_car.name}"
    else:
        ref = f"'{requested_car_name}'" if requested_car_name else "הרכב המבוקש"
        grp = candidate_car.group or "?"
        why = (
            f"{ref} אינו פנוי. '{candidate_car.name}' (קבוצה {grp}) "
            f"הוא חלופה זמינה."
        )
        summary = f"🔄 חלופה דומה – {candidate_car.name} (קבוצה {grp})"
    return why, summary, risk


def explain_reassignment(
    freed_car: Car,
    affected_booking: Booking,
    replacement_car: Car,
    score: float,
    today: date,
) -> tuple[str, str, str]:
    """Returns (why, operator_summary, risk_level) for Type C."""
    risk = risk_label(score)
    days = (affected_booking.start_date - today).days
    if days > 0:
        urgency = f"איסוף בעוד {days} ימ{'ים' if days != 1 else ''}"
    elif days == 0:
        urgency = "איסוף היום"
    else:
        urgency = "הזמנה בתאריך שעבר"

    orig_grp  = freed_car.group or "?"
    rep_grp   = replacement_car.group or "?"
    upgrade_note = ""
    if replacement_car.group and freed_car.group:
        from app.engine.scoring import group_rank
        if group_rank(replacement_car.group) > group_rank(freed_car.group):
            upgrade_note = " (שדרוג ללקוח הקיים)"
        elif group_rank(replacement_car.group) < group_rank(freed_car.group):
            upgrade_note = " (⚠️ שדרוג כלפי מטה ללקוח הקיים)"

    why = (
        f"ניתן להעביר את לקוח '{affected_booking.customer_name}' "
        f"לרכב '{replacement_car.name}' (קבוצה {rep_grp}){upgrade_note}, "
        f"ולפנות את '{freed_car.name}' (קבוצה {orig_grp}) לבקשה החדשה. "
        f"{urgency}."
    )
    summary = (
        f"🔀 שיבוץ מחדש – {freed_car.name} פנוי ← "
        f"{affected_booking.customer_name} עובר ל-{replacement_car.name}"
    )
    return why, summary, risk

