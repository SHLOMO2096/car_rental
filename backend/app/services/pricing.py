"""
שירות המחירים הראשי — לוגיקת חישוב מחיר הזמנה.

ארכיטקטורה:
    1. is_half_day()          — קביעת חצי יום (אותו יום / לילה אחד)
    2. is_shabbat_or_holiday() — האם יום זה לא נספר לחיוב
    3. calculate_billable_days() — ימי חיוב אמיתיים לפי טווח + price_type
    4. split_by_seasons()     — חלוקת טווח לפי עונות (עם wrap-around)
    5. resolve_price()        — חיפוש מחיר לפי priority chain
    6. calculate_total_price() — חישוב מלא + פירוט

כלל שבת/חגים:
    • daily / weekly  → שבת + חגים מדולגים (לא נספרים לחיוב)
    • monthly (30+)   → כל הימים נספרים כולל שבתות
    • half_day        → 0.5 יום

כלל שבוע:
    • שבוע = תמיד 6 ימי חיוב
    • חישוב: weeks = billable_days // 6 ; remaining = billable_days % 6
    • total = weeks × weekly_price + remaining × daily_price
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.pricing import PriceType, PriceEntityType, PriceRule, Season
from app.schemas.pricing import (
    BreakdownLine,
    PriceCalculateResponse,
)

# ── קבועי תצורה (configurable בעתיד דרך system_settings) ─────────────────────

HALF_DAY_PICKUP_CUTOFF  = "15:00"   # מהשעה הזו → עשוי להיות חצי יום (לילה)
HALF_DAY_RETURN_CUTOFF  = "09:30"   # עד השעה הזו ביום הבא → חצי יום
MONTHLY_THRESHOLD_DAYS  = 30        # כמה ימים קלנדריים = חודש
WEEKLY_BILLABLE_PER_WEEK = 6        # ימי חיוב בשבוע (1 שבת = חינם)


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class BillableDaysResult:
    total_calendar_days: int
    billable_days: float             # 0.5 לחצי יום, מספר שלם/עשרוני אחרת
    skipped_days: int
    skipped_dates: list[date]
    is_half_day_flag: bool = False


@dataclass
class SeasonSegment:
    season_id: Optional[int]
    season_name: Optional[str]
    start: date
    end: date                        # exclusive (יום לא כלול בקטע)

    @property
    def calendar_days(self) -> int:
        return (self.end - self.start).days


# ── 1. חצי יום ───────────────────────────────────────────────────────────────

def _parse_time(t: str) -> tuple[int, int]:
    """HH:MM → (hour, minute)"""
    h, m = t.split(":")
    return int(h), int(m)


def is_half_day(
    start_date: date,
    pickup_time: Optional[str],
    end_date: date,
    return_time: Optional[str],
) -> bool:
    """
    מחזיר True אם ההשכרה נחשבת חצי יום:
      א. אותו יום: start_date == end_date
      ב. לילה אחד: end_date == start_date + 1 day
                   AND pickup_time >= HALF_DAY_PICKUP_CUTOFF  (לדוגמה, 15:00)
                   AND return_time <= HALF_DAY_RETURN_CUTOFF  (לדוגמה, 09:30)
    """
    if start_date == end_date:
        return True

    if end_date == start_date + timedelta(days=1):
        if pickup_time and return_time:
            pickup = _parse_time(pickup_time)
            ret    = _parse_time(return_time)
            cutoff_pickup = _parse_time(HALF_DAY_PICKUP_CUTOFF)
            cutoff_return = _parse_time(HALF_DAY_RETURN_CUTOFF)
            if pickup >= cutoff_pickup and ret <= cutoff_return:
                return True

    return False


# ── 2. שבת / חג ───────────────────────────────────────────────────────────────

def is_shabbat(d: date) -> bool:
    """שבת = יום שבת (weekday == 5 בפייתון: Mon=0 … Sat=5)"""
    return d.weekday() == 5


def is_shabbat_or_holiday(d: date, holidays: set[date]) -> bool:
    return is_shabbat(d) or d in holidays


# ── 3. ימי חיוב ───────────────────────────────────────────────────────────────

def calculate_billable_days(
    start_date: date,
    end_date: date,         # exclusive
    price_type: PriceType,
    holidays: set[date],
) -> BillableDaysResult:
    """
    מחשב את ימי החיוב בטווח [start_date, end_date).
    עבור monthly   → כולל הכל, ללא דילוג.
    עבור half_day  → תמיד 0.5.
    עבור daily/weekly → מדלג שבתות + חגים.
    """
    total_cal = (end_date - start_date).days

    if price_type == PriceType.half_day:
        return BillableDaysResult(
            total_calendar_days=total_cal,
            billable_days=0.5,
            skipped_days=0,
            skipped_dates=[],
            is_half_day_flag=True,
        )

    if price_type == PriceType.monthly:
        # חודשי: סופרים הכל
        return BillableDaysResult(
            total_calendar_days=total_cal,
            billable_days=float(total_cal),
            skipped_days=0,
            skipped_dates=[],
        )

    # daily / weekly → דלג שבתות + חגים
    billable = 0
    skipped_dates: list[date] = []
    cur = start_date
    while cur < end_date:
        if is_shabbat_or_holiday(cur, holidays):
            skipped_dates.append(cur)
        else:
            billable += 1
        cur += timedelta(days=1)

    return BillableDaysResult(
        total_calendar_days=total_cal,
        billable_days=float(billable),
        skipped_days=len(skipped_dates),
        skipped_dates=skipped_dates,
    )


# ── 4. חלוקה לפי עונות ────────────────────────────────────────────────────────

def _date_in_season(d: date, season: Season) -> bool:
    """האם תאריך d נמצא בתוך העונה (תומך ב-wrap-around)."""
    md = (d.month, d.day)
    ms = (season.start_month, season.start_day)
    me = (season.end_month,   season.end_day)

    if ms <= me:
        # עונה רגילה: start ≤ date ≤ end
        return ms <= md <= me
    else:
        # עונה חוצת שנה: date ≥ start OR date ≤ end
        return md >= ms or md <= me


def _find_season_for_date(d: date, seasons: list[Season]) -> Optional[Season]:
    """
    מחזיר את העונה בעלת ה-priority הגבוהה ביותר (מספר גבוה) שמכסה את d,
    או None אם אין עונה.
    """
    matching = [s for s in seasons if s.is_active and _date_in_season(d, s)]
    if not matching:
        return None
    return max(matching, key=lambda s: s.id)  # id כ-tiebreaker


def split_by_seasons(
    start_date: date,
    end_date: date,          # exclusive
    seasons: list[Season],
) -> list[SeasonSegment]:
    """
    חותך את הטווח [start_date, end_date) לקטעים רציפים —
    כל קטע שייך לעונה אחת (או ל-None = ברירת מחדל).
    """
    if start_date >= end_date:
        return []

    segments: list[SeasonSegment] = []
    seg_start = start_date
    cur_season = _find_season_for_date(start_date, seasons)

    cur = start_date + timedelta(days=1)
    while cur < end_date:
        day_season = _find_season_for_date(cur, seasons)
        # אם העונה השתנתה — סגור קטע קיים ופתח חדש
        if (day_season is None) != (cur_season is None) or (
            day_season is not None
            and cur_season is not None
            and day_season.id != cur_season.id
        ):
            segments.append(
                SeasonSegment(
                    season_id=cur_season.id if cur_season else None,
                    season_name=cur_season.name if cur_season else None,
                    start=seg_start,
                    end=cur,
                )
            )
            seg_start = cur
            cur_season = day_season
        cur += timedelta(days=1)

    # קטע אחרון
    segments.append(
        SeasonSegment(
            season_id=cur_season.id if cur_season else None,
            season_name=cur_season.name if cur_season else None,
            start=seg_start,
            end=end_date,
        )
    )
    return segments


# ── 5. resolve_price — priority chain ─────────────────────────────────────────

def resolve_price(
    db: Session,
    car: Car,
    price_type: PriceType,
    season_id: Optional[int],
) -> tuple[float, Optional[int]]:
    """
    מחפש מחיר לפי priority chain:
      car+season → car+default → group+season → group+default →
      category+season → category+default → global+season → global+default →
      car.price_per_day (fallback)

    מחזיר: (price, rule_id | None)
    """
    car_value     = str(car.id)
    group_value   = car.group
    category_value = car.category

    candidates = [
        (PriceEntityType.car,      car_value,      season_id),
        (PriceEntityType.car,      car_value,      None),
        (PriceEntityType.group,    group_value,    season_id),
        (PriceEntityType.group,    group_value,    None),
        (PriceEntityType.category, category_value, season_id),
        (PriceEntityType.category, category_value, None),
        (PriceEntityType.global_,  None,           season_id),
        (PriceEntityType.global_,  None,           None),
    ]

    for entity_type, entity_value, s_id in candidates:
        if entity_value is None and entity_type != PriceEntityType.global_:
            continue  # אין קבוצה/קטגוריה לרכב זה

        q = (
            db.query(PriceRule)
            .filter(
                PriceRule.is_active    == True,         # noqa: E712
                PriceRule.entity_type  == entity_type,
                PriceRule.price_type   == price_type,
            )
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
            return rule.price, rule.id

    # fallback: car.price_per_day
    fallback = float(car.price_per_day or 0)
    return fallback, None


# ── 6. חישוב מחיר לקטע (segment) ─────────────────────────────────────────────

def _calc_segment_price(
    db: Session,
    car: Car,
    segment: SeasonSegment,
    price_type: PriceType,
    holidays: set[date],
) -> tuple[float, BreakdownLine]:
    """
    מחשב מחיר לקטע עונה אחד ומחזיר (subtotal, BreakdownLine).
    """
    bd_result = calculate_billable_days(
        segment.start, segment.end, price_type, holidays
    )
    billable = bd_result.billable_days
    cal_days = segment.calendar_days

    # קבל מחיר
    unit_price, rule_id = resolve_price(db, car, price_type, segment.season_id)

    # חישוב לפי סוג מחיר
    if price_type == PriceType.half_day:
        subtotal = unit_price
        label = f"חצי יום ({segment.season_name or 'ברירת מחדל'})"

    elif price_type == PriceType.weekly:
        # שבוע = 6 ימי חיוב
        weeks    = int(billable) // WEEKLY_BILLABLE_PER_WEEK
        remaining = billable - weeks * WEEKLY_BILLABLE_PER_WEEK

        weekly_subtotal = weeks * unit_price

        # מחיר יומי לשארית
        daily_price, _  = resolve_price(db, car, PriceType.daily, segment.season_id)
        remaining_sub   = remaining * daily_price

        subtotal = weekly_subtotal + remaining_sub
        parts    = []
        if weeks:
            parts.append(f"{weeks} שבועות")
        if remaining:
            parts.append(f"{remaining:.0f} ימים")
        season_label = segment.season_name or "ברירת מחדל"
        label = f"{', '.join(parts)} ({season_label})"

    elif price_type == PriceType.monthly:
        # חודשי: cal_days (כולל שבתות), מחיר לחודש × חודשים + שארית לפי monthly/30 ליום
        months    = cal_days // MONTHLY_THRESHOLD_DAYS
        remaining = cal_days % MONTHLY_THRESHOLD_DAYS

        day_rate_from_monthly = unit_price / MONTHLY_THRESHOLD_DAYS  # ₪ ליום = monthly/30

        monthly_subtotal = months * unit_price
        remaining_sub    = remaining * day_rate_from_monthly

        subtotal = monthly_subtotal + remaining_sub
        parts    = []
        if months:
            parts.append(f"{months} חודשים")
        if remaining:
            parts.append(f"{remaining} ימים (₪{day_rate_from_monthly:.0f}/יום)")
        season_label = segment.season_name or "ברירת מחדל"
        label = f"{', '.join(parts)} ({season_label})"

    else:  # daily
        subtotal = billable * unit_price
        skipped_note = (
            f" | {bd_result.skipped_days} ימים דולגו"
            if bd_result.skipped_days
            else ""
        )
        season_label = segment.season_name or "ברירת מחדל"
        label = f"{billable:.0f} ימי חיוב מתוך {cal_days} ({season_label}){skipped_note}"

    return subtotal, BreakdownLine(
        label=label,
        season_name=segment.season_name,
        days=cal_days,
        billable_days=billable,
        skipped_dates=bd_result.skipped_dates,
        price_type=price_type,
        unit_price=unit_price,
        subtotal=round(subtotal, 2),
    )


# ── 7. calculate_total_price — הפונקציה הראשית ───────────────────────────────

def calculate_total_price(
    db: Session,
    car: Car,
    start_date: date,
    end_date: date,
    pickup_time: Optional[str] = None,
    return_time: Optional[str] = None,
) -> PriceCalculateResponse:
    """
    חישוב מחיר מלא להזמנה עם פירוט לפי עונות.

    Args:
        db          : DB session
        car         : אובייקט רכב
        start_date  : תאריך תחילת השכרה
        end_date    : תאריך סיום (exclusive — יום ההחזרה)
        pickup_time : שעת איסוף "HH:MM" (אופציונלי)
        return_time : שעת החזרה "HH:MM" (אופציונלי)

    Returns:
        PriceCalculateResponse עם total_price, breakdown, ומטא-דאטה
    """
    from app.models.pricing import IsraeliHoliday  # lazy import

    actual_days = max((end_date - start_date).days, 0)

    # ── קביעת סוג מחיר ──────────────────────────────────────────────────────
    if is_half_day(start_date, pickup_time, end_date, return_time):
        price_type = PriceType.half_day
    elif actual_days >= MONTHLY_THRESHOLD_DAYS:
        price_type = PriceType.monthly
    else:
        price_type = PriceType.daily  # ברירת מחדל; weekly מופעל לפי ימי-חיוב

    # ── טעינת חגים לטווח ────────────────────────────────────────────────────
    span_start = start_date
    span_end   = end_date + timedelta(days=1)  # buffer
    holiday_rows = (
        db.query(IsraeliHoliday)
        .filter(
            IsraeliHoliday.date >= span_start,
            IsraeliHoliday.date <  span_end,
        )
        .all()
    )
    holidays: set[date] = {h.date for h in holiday_rows}

    # ── חלוקה לפי עונות ─────────────────────────────────────────────────────
    seasons = db.query(Season).filter(Season.is_active == True).all()  # noqa: E712
    segments = split_by_seasons(start_date, end_date, seasons)

    # ── לפי weekly: בדוק אם יש מספיק ימי חיוב ──────────────────────────────
    if price_type == PriceType.daily:
        total_billable = sum(
            calculate_billable_days(s.start, s.end, PriceType.daily, holidays).billable_days
            for s in segments
        )
        if total_billable >= WEEKLY_BILLABLE_PER_WEEK:
            # בדוק שיש weekly_price מוגדר — אחרת נשאר ב-daily
            test_price, _ = resolve_price(db, car, PriceType.weekly, None)
            if test_price > 0:
                price_type = PriceType.weekly

    # ── חישוב לכל קטע ───────────────────────────────────────────────────────
    breakdown: list[BreakdownLine] = []
    total = 0.0
    total_billable_days = 0.0
    rule_id_used: Optional[int] = None

    for seg in segments:
        subtotal, line = _calc_segment_price(
            db, car, seg, price_type, holidays
        )
        breakdown.append(line)
        total += subtotal
        total_billable_days += line.billable_days
        if rule_id_used is None and line.unit_price > 0:
            _, rule_id_used = resolve_price(db, car, price_type, seg.season_id)

    # ── הודעה ───────────────────────────────────────────────────────────────
    total_skipped = sum(len(line.skipped_dates) for line in breakdown)
    note = None
    if total_skipped:
        note = (
            f"{total_skipped} יום/ימים לא חויבו (שבת / חג)"
        )

    return PriceCalculateResponse(
        total_price=round(total, 2),
        price_type_used=price_type,
        billable_days=total_billable_days,
        actual_days=actual_days,
        price_rule_id=rule_id_used,
        breakdown=breakdown,
        note=note,
    )


def price_result_to_breakdown_json(result: PriceCalculateResponse) -> str:
    """ממיר PriceCalculateResponse ל-JSON מחרוזת לשמירה ב-DB."""
    data = result.model_dump(mode="json")
    return json.dumps(data, ensure_ascii=False)

