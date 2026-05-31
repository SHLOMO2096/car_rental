"""
שירות המחירים הראשי — לוגיקת חישוב מחיר הזמנה.

ארכיטקטורה:
    1. is_half_day()              — קביעת חצי יום
    2. _date_in_season()          — האם תאריך נמצא בעונה (תומך is_recurring)
    3. split_by_seasons()         — חלוקת טווח לקטעים לפי עונה
    4. _resolve_rule()            — חיפוש PriceRule לפי ירושה 3 רמות
    5. _apply_season_adjustment() — החלת ה-adjustment של העונה
    6. resolve_price()            — פונקציה ראשית: pure function, מחזירה PriceCalculateResponse
    7. calculate_total_price()    — wrapper עם Car object
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.pricing import (
    PriceEntityType,
    PriceRule,
    Season,
    SeasonRule,
    IsraeliHoliday,
)
from app.schemas.pricing import (
    BreakdownLine,
    PriceCalculateResponse,
)

MONTHLY_THRESHOLD_DAYS = 30


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ResolvedPrices:
    """4 שדות מחיר שנאספו לאחר ירושה בין רמות."""
    price_half_day: Optional[float]
    price_day:      Optional[float]
    price_week:     Optional[float]
    price_month:    Optional[float]
    exclude_sabbath_holidays: bool
    rule_id: Optional[int]

    def get(self, price_type: str) -> Optional[float]:
        return getattr(self, f"price_{price_type}", None)


@dataclass
class SeasonSegment:
    season: Optional[Season]
    start:  date
    end:    date    # exclusive

    @property
    def calendar_days(self) -> int:
        return (self.end - self.start).days

    @property
    def season_id(self) -> Optional[int]:
        return self.season.id if self.season else None

    @property
    def season_name(self) -> Optional[str]:
        return self.season.name if self.season else None


# ── 1. חצי יום ───────────────────────────────────────────────────────────────

def _parse_time(t: str) -> tuple[int, int]:
    h, m = t.split(":")
    return int(h), int(m)


def _hours_between(pickup_time: str, return_time: str) -> float:
    ph, pm = _parse_time(pickup_time)
    rh, rm = _parse_time(return_time)
    pickup_minutes = ph * 60 + pm
    return_minutes = rh * 60 + rm
    # החזרה ביום הבא
    if return_minutes <= pickup_minutes:
        return_minutes += 24 * 60
    return (return_minutes - pickup_minutes) / 60


def is_half_day(
    start_date: date,
    pickup_time: Optional[str],
    end_date: date,
    return_time: Optional[str],
) -> bool:
    """
    True אם ההשכרה נחשבת חצי יום:
      א. תאריך יציאה = תאריך חזרה
      ב. חזרה = יציאה + 1 יום AND הפרש שעות ≤ 16
    """
    if start_date == end_date:
        return True

    if end_date == start_date + timedelta(days=1):
        if pickup_time and return_time:
            return _hours_between(pickup_time, return_time) <= 16
        # ללא שעות — לילה אחד לא נחשב חצי יום
        return False

    return False


# ── 2. שבת / חג ───────────────────────────────────────────────────────────────

def is_shabbat(d: date) -> bool:
    return d.weekday() == 5   # Sat=5


def is_shabbat_or_holiday(d: date, holidays: set[date]) -> bool:
    return is_shabbat(d) or d in holidays


# ── 3. ימי חיוב ───────────────────────────────────────────────────────────────

def calculate_billable_days(
    start_date: date,
    end_date: date,          # exclusive
    exclude_sabbath: bool,
    holidays: set[date],
) -> tuple[float, list[date]]:
    """
    מחזיר (billable_days, skipped_dates).
    אם exclude_sabbath=False → סופר הכל.
    """
    total_cal = (end_date - start_date).days
    if total_cal <= 0:
        return 0.0, []

    if not exclude_sabbath:
        return float(total_cal), []

    billable = 0
    skipped: list[date] = []
    cur = start_date
    while cur < end_date:
        if is_shabbat_or_holiday(cur, holidays):
            skipped.append(cur)
        else:
            billable += 1
        cur += timedelta(days=1)

    return float(billable), skipped


# ── 4. חלוקה לפי עונות ────────────────────────────────────────────────────────

def _date_in_season(d: date, season: Season) -> bool:
    """
    האם תאריך d נמצא בתוך העונה.
    אם is_recurring=True — מתעלם מהשנה, משווה חודש+יום בלבד.
    """
    if not season.valid_from or not season.valid_until:
        return False

    if season.is_recurring:
        md = (d.month, d.day)
        ms = (season.valid_from.month,  season.valid_from.day)
        me = (season.valid_until.month, season.valid_until.day)
        if ms <= me:
            return ms <= md <= me
        # wrap-around (למשל 25/12 – 5/1)
        return md >= ms or md <= me
    else:
        return season.valid_from <= d <= season.valid_until


def _find_season_for_date(d: date, seasons: list[Season]) -> Optional[Season]:
    matching = [s for s in seasons if s.is_active and _date_in_season(d, s)]
    if not matching:
        return None
    # עדיפות: id גבוה יותר ינצח
    return max(matching, key=lambda s: s.id)


def split_by_seasons(
    start_date: date,
    end_date: date,
    seasons: list[Season],
) -> list[SeasonSegment]:
    """חותך [start_date, end_date) לקטעים רציפים, כל קטע עונה אחת."""
    if start_date >= end_date:
        return []

    segments: list[SeasonSegment] = []
    seg_start = start_date
    cur_season = _find_season_for_date(start_date, seasons)

    cur = start_date + timedelta(days=1)
    while cur < end_date:
        day_season = _find_season_for_date(cur, seasons)
        changed = (day_season is None) != (cur_season is None) or (
            day_season and cur_season and day_season.id != cur_season.id
        )
        if changed:
            segments.append(SeasonSegment(season=cur_season, start=seg_start, end=cur))
            seg_start  = cur
            cur_season = day_season
        cur += timedelta(days=1)

    segments.append(SeasonSegment(season=cur_season, start=seg_start, end=end_date))
    return segments


# ── 5. resolve_rule — ירושה 3 רמות ───────────────────────────────────────────

_ENTITY_LEVELS = [
    PriceEntityType.car,
    PriceEntityType.group,
    PriceEntityType.category,
    PriceEntityType.global_,
]


def _resolve_rule(
    db: Session,
    car: Car,
    season_id: Optional[int],
) -> Optional[PriceRule]:
    """
    מחפש PriceRule לפי ירושה: רכב → קבוצה → קטגוריה → גלובלי.
    לכל רמה — קודם עם season_id, אחר כך ללא עונה.
    מחזיר None אם לא נמצא כלום.
    """
    candidates: list[tuple[PriceEntityType, Optional[str], Optional[int]]] = [
        (PriceEntityType.car,      str(car.id),       season_id),
        (PriceEntityType.car,      str(car.id),       None),
        (PriceEntityType.group,    car.group,          season_id),
        (PriceEntityType.group,    car.group,          None),
        (PriceEntityType.category, car.category,       season_id),
        (PriceEntityType.category, car.category,       None),
        (PriceEntityType.global_,  None,               season_id),
        (PriceEntityType.global_,  None,               None),
    ]

    for entity_type, entity_value, s_id in candidates:
        if entity_value is None and entity_type != PriceEntityType.global_:
            continue

        q = db.query(PriceRule).filter(
            PriceRule.is_active   == True,    # noqa: E712
            PriceRule.entity_type == entity_type.value,
        )
        if entity_type == PriceEntityType.global_:
            q = q.filter(PriceRule.entity_value == None)  # noqa: E711
        else:
            q = q.filter(PriceRule.entity_value == entity_value)

        if s_id is not None:
            q = q.filter(PriceRule.season_id == s_id)
        else:
            q = q.filter(PriceRule.season_id == None)  # noqa: E711

        rule = q.order_by(PriceRule.priority.desc()).first()
        if rule:
            return rule

    return None


def _merge_rules(rules: list[PriceRule]) -> ResolvedPrices:
    """
    ממזג רשימת כללים (מהרמה הנמוכה לגבוהה) — לוקח את הערך הראשון שאינו null.
    """
    result = ResolvedPrices(
        price_half_day=None,
        price_day=None,
        price_week=None,
        price_month=None,
        exclude_sabbath_holidays=True,
        rule_id=rules[0].id if rules else None,
    )
    for rule in rules:
        if result.price_half_day is None and rule.price_half_day:
            result.price_half_day = rule.price_half_day
        if result.price_day is None and rule.price_day:
            result.price_day = rule.price_day
        if result.price_week is None and rule.price_week:
            result.price_week = rule.price_week
        if result.price_month is None and rule.price_month:
            result.price_month = rule.price_month
    return result


def resolve_prices(
    db: Session,
    car: Car,
    season_id: Optional[int],
) -> ResolvedPrices:
    """
    אוסף 4 שדות מחיר לאחר ירושה מלאה.
    שדה שנשאר None לאחר כל הרמות → יזרוק שגיאה ב-resolve_price.
    """
    # נאסוף כלל אחד לכל רמה ונמזג
    collected: list[PriceRule] = []
    seen_ids: set[int] = set()

    for entity_type, entity_value, s_id in [
        (PriceEntityType.car,      str(car.id),  season_id),
        (PriceEntityType.car,      str(car.id),  None),
        (PriceEntityType.group,    car.group,     season_id),
        (PriceEntityType.group,    car.group,     None),
        (PriceEntityType.category, car.category,  season_id),
        (PriceEntityType.category, car.category,  None),
        (PriceEntityType.global_,  None,          season_id),
        (PriceEntityType.global_,  None,          None),
    ]:
        if entity_value is None and entity_type != PriceEntityType.global_:
            continue

        q = db.query(PriceRule).filter(
            PriceRule.is_active   == True,    # noqa: E712
            PriceRule.entity_type == entity_type.value,
        )
        if entity_type == PriceEntityType.global_:
            q = q.filter(PriceRule.entity_value == None)  # noqa: E711
        else:
            q = q.filter(PriceRule.entity_value == entity_value)

        if s_id is not None:
            q = q.filter(PriceRule.season_id == s_id)
        else:
            q = q.filter(PriceRule.season_id == None)  # noqa: E711

        rule = q.order_by(PriceRule.priority.desc()).first()
        if rule and rule.id not in seen_ids:
            collected.append(rule)
            seen_ids.add(rule.id)

    if not collected:
        return ResolvedPrices(None, None, None, None, True, None)

    return _merge_rules(collected)


# ── 6. seasonal adjustment ────────────────────────────────────────────────────

def _season_applies_to_type(
    db: Session,
    season: Season,
    price_rule_id: Optional[int],
    price_type: str,     # "half_day" / "day" / "week" / "month"
) -> bool:
    """
    בודק אם לעונה יש season_rule שחל על price_rule_id ועל price_type זה.
    price_rule_id=None → בדוק גלובלי (season_rules.price_rule_id IS NULL).
    """
    q = db.query(SeasonRule).filter(SeasonRule.season_id == season.id)
    if price_rule_id is not None:
        q = q.filter(
            (SeasonRule.price_rule_id == price_rule_id) |
            (SeasonRule.price_rule_id == None)  # noqa: E711
        )
    else:
        q = q.filter(SeasonRule.price_rule_id == None)  # noqa: E711

    rules = q.all()
    if not rules:
        return False

    col_map = {
        "half_day": "applies_to_half_day",
        "day":      "applies_to_day",
        "week":     "applies_to_week",
        "month":    "applies_to_month",
    }
    attr = col_map.get(price_type, "applies_to_day")
    return any(getattr(r, attr) for r in rules)


def _apply_season_adjustment(
    season: Season,
    base_price: float,
) -> tuple[float, float]:
    """
    מחיל את ה-adjustment של העונה.
    מחזיר (adjusted_price, multiplier).
    """
    if not all([season.adjustment_type, season.adjustment_direction,
                season.adjustment_value is not None]):
        return base_price, 1.0

    val = season.adjustment_value
    if season.adjustment_type == "percent":
        if season.adjustment_direction == "add":
            multiplier = 1 + val / 100
        else:
            multiplier = 1 - val / 100
    else:  # fixed
        diff = val if season.adjustment_direction == "add" else -val
        multiplier = (base_price + diff) / base_price if base_price else 1.0

    adjusted = max(base_price * multiplier if season.adjustment_type == "percent"
                   else base_price + (val if season.adjustment_direction == "add" else -val),
                   0.0)
    return adjusted, multiplier


# ── 7. resolve_price — פונקציה ראשית pure ────────────────────────────────────

def resolve_price(
    vehicle_id: int,
    rental_start: date,
    rental_end: date,
    db: Session,
) -> PriceCalculateResponse:
    """
    Pure function — ללא side effects.
    מחשב מחיר מלא עם פירוט לפי קטעי עונה.
    """
    car = db.query(Car).filter(Car.id == vehicle_id, Car.is_active == True).first()  # noqa: E712
    if not car:
        raise ValueError(f"רכב {vehicle_id} לא נמצא")

    return _compute_price(db, car, rental_start, rental_end, None, None)


def calculate_total_price(
    db: Session,
    car: Car,
    start_date: date,
    end_date: date,
    pickup_time: Optional[str] = None,
    return_time: Optional[str] = None,
) -> PriceCalculateResponse:
    """Wrapper נוח עם Car object ישיר."""
    return _compute_price(db, car, start_date, end_date, pickup_time, return_time)


def _compute_price(
    db: Session,
    car: Car,
    start_date: date,
    end_date: date,
    pickup_time: Optional[str],
    return_time: Optional[str],
) -> PriceCalculateResponse:
    actual_days = max((end_date - start_date).days, 0)

    # ── קביעת סוג מחיר ──────────────────────────────────────────────────────
    if is_half_day(start_date, pickup_time, end_date, return_time):
        price_type = "half_day"
    elif actual_days >= MONTHLY_THRESHOLD_DAYS:
        price_type = "month"
    else:
        price_type = "day"   # week ייקבע בהמשך לפי ימי חיוב

    # ── חגים לטווח ──────────────────────────────────────────────────────────
    holidays: set[date] = {
        h.date for h in db.query(IsraeliHoliday).filter(
            IsraeliHoliday.date >= start_date,
            IsraeliHoliday.date <  end_date + timedelta(days=1),
        ).all()
    }

    # ── עונות פעילות ─────────────────────────────────────────────────────────
    seasons = db.query(Season).filter(Season.is_active == True).all()  # noqa: E712
    segments = split_by_seasons(start_date, end_date, seasons)

    # ── בדיקת weekly: אם יש מספיק ימי חיוב לפחות שבוע אחד ──────────────────
    if price_type == "day":
        # טעינת כלל בסיסי לבדיקת price_week
        test_prices = resolve_prices(db, car, None)
        if test_prices.price_week:
            # חישוב ימי חיוב כולל לבדיקה
            total_billable = sum(
                calculate_billable_days(s.start, s.end, True, holidays)[0]
                for s in segments
            )
            if total_billable >= 7:
                price_type = "week"

    # ── חישוב לכל קטע ───────────────────────────────────────────────────────
    breakdown: list[BreakdownLine] = []
    total = 0.0
    first_rule_id: Optional[int] = None
    total_billable_days = 0.0

    for seg in segments:
        line, subtotal = _calc_segment(
            db, car, seg, price_type, holidays,
        )
        breakdown.append(line)
        total += subtotal
        total_billable_days += line.billable_days
        if first_rule_id is None and line.unit_price > 0:
            prices = resolve_prices(db, car, seg.season_id)
            first_rule_id = prices.rule_id

    total_skipped = sum(len(line.skipped_dates) for line in breakdown)
    note = f"{total_skipped} יום/ימים לא חויבו (שבת / חג)" if total_skipped else None

    return PriceCalculateResponse(
        total=round(total, 2),
        breakdown=breakdown,
        note=note,
        price_type_used=price_type,
        billable_days=total_billable_days,
        actual_days=actual_days,
        price_rule_id=first_rule_id,
    )


def _calc_segment(
    db: Session,
    car: Car,
    seg: SeasonSegment,
    price_type: str,
    holidays: set[date],
) -> tuple[BreakdownLine, float]:
    """
    מחשב מחיר לקטע עונה אחד.
    מחזיר (BreakdownLine, subtotal).
    """
    prices = resolve_prices(db, car, seg.season_id)

    # בדיקת שלמות — שגיאה ברורה אם שדה חסר
    field_name = f"price_{price_type}"
    unit_price = prices.get(price_type)
    if unit_price is None:
        # fallback: car.price_per_day
        if car.price_per_day and price_type == "day":
            unit_price = float(car.price_per_day)
        else:
            missing_chain = f"רכב {car.id} → קבוצה {car.group} → קטגוריה {car.category} → גלובלי"
            raise ValueError(
                f"לא נמצא מחיר לסוג '{price_type}' לאחר חיפוש בכל רמות הירושה: {missing_chain}"
            )

    # ── seasonal adjustment ──────────────────────────────────────────────────
    multiplier = 1.0
    if seg.season and _season_applies_to_type(db, seg.season, prices.rule_id, price_type):
        unit_price, multiplier = _apply_season_adjustment(seg.season, unit_price)

    # ── חישוב ימי חיוב ──────────────────────────────────────────────────────
    exclude_shab = prices.exclude_sabbath_holidays and price_type not in ("month",)
    billable_days, skipped = calculate_billable_days(
        seg.start, seg.end, exclude_shab, holidays
    )
    cal_days = seg.calendar_days

    # ── subtotal לפי price_type ──────────────────────────────────────────────
    if price_type == "half_day":
        subtotal = unit_price
        label = f"חצי יום"

    elif price_type == "month":
        # monthly: cal_days (כולל שבתות)
        months    = cal_days // MONTHLY_THRESHOLD_DAYS
        remaining = cal_days % MONTHLY_THRESHOLD_DAYS
        day_rate  = unit_price / MONTHLY_THRESHOLD_DAYS
        subtotal  = months * unit_price + remaining * day_rate
        parts = []
        if months:
            parts.append(f"{months} חודשים")
        if remaining:
            parts.append(f"{remaining} ימים")
        label = ", ".join(parts) or "0 ימים"

    elif price_type == "week":
        weeks     = int(billable_days) // 7
        remaining = billable_days - weeks * 7
        day_unit  = prices.price_day or unit_price / 7
        subtotal  = weeks * unit_price + remaining * day_unit
        parts = []
        if weeks:
            parts.append(f"{weeks} שבועות")
        if remaining:
            parts.append(f"{remaining:.0f} ימים")
        label = ", ".join(parts) or "0 ימים"

    else:  # day
        subtotal = billable_days * unit_price
        label = f"{billable_days:.0f} ימי חיוב מתוך {cal_days}"

    season_label = f" | {seg.season_name}" if seg.season_name else ""
    if multiplier != 1.0:
        season_label += f" (×{multiplier:.3f})"
    full_label = label + season_label

    line = BreakdownLine(
        segment_start=seg.start,
        segment_end=seg.end,
        price_type=price_type,
        unit_price=round(unit_price, 2),
        season_multiplier=round(multiplier, 6),
        season_name=seg.season_name,
        subtotal=round(subtotal, 2),
        calendar_days=cal_days,
        billable_days=billable_days,
        skipped_dates=skipped,
        label=full_label,
    )
    return line, subtotal


# ── Snapshot ──────────────────────────────────────────────────────────────────

def price_result_to_breakdown_json(result: PriceCalculateResponse) -> str:
    """ממיר PriceCalculateResponse ל-JSON לשמירה ב-DB."""
    return json.dumps(result.model_dump(mode="json"), ensure_ascii=False)
