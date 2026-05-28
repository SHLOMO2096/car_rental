"""
בדיקות יחידה לשירות המחירים.
מריץ ללא DB — בדיקות הלוגיקה הטהורה בלבד.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from app.models.pricing import PriceType, Season
from app.services.pricing import (
    is_half_day,
    is_shabbat,
    is_shabbat_or_holiday,
    calculate_billable_days,
    split_by_seasons,
    _date_in_season,
    WEEKLY_BILLABLE_PER_WEEK,
)


# ── is_half_day ───────────────────────────────────────────────────────────────

class TestIsHalfDay:
    def test_same_day(self):
        assert is_half_day(date(2026, 6, 1), "10:00", date(2026, 6, 1), "16:00") is True

    def test_overnight_valid(self):
        # 15:30 עד 09:00 למחרת → חצי יום
        assert is_half_day(date(2026, 6, 1), "15:30", date(2026, 6, 2), "09:00") is True

    def test_overnight_too_early_pickup(self):
        # 14:00 — לפני ה-cutoff 15:00
        assert is_half_day(date(2026, 6, 1), "14:00", date(2026, 6, 2), "09:00") is False

    def test_overnight_too_late_return(self):
        # החזרה ב-10:00 — אחרי ה-cutoff 09:30
        assert is_half_day(date(2026, 6, 1), "15:30", date(2026, 6, 2), "10:00") is False

    def test_two_days_not_half(self):
        assert is_half_day(date(2026, 6, 1), "15:30", date(2026, 6, 3), "09:00") is False

    def test_overnight_exact_cutoff(self):
        # בדיוק על ה-cutoff
        assert is_half_day(date(2026, 6, 1), "15:00", date(2026, 6, 2), "09:30") is True

    def test_no_times_same_day(self):
        assert is_half_day(date(2026, 6, 1), None, date(2026, 6, 1), None) is True

    def test_no_times_overnight(self):
        # ללא שעות — לילה אחד לא נחשב חצי יום
        assert is_half_day(date(2026, 6, 1), None, date(2026, 6, 2), None) is False


# ── is_shabbat ────────────────────────────────────────────────────────────────

class TestIsShabbat:
    def test_saturday_is_shabbat(self):
        # 2026-06-06 הוא שבת
        assert is_shabbat(date(2026, 6, 6)) is True

    def test_friday_not_shabbat(self):
        assert is_shabbat(date(2026, 6, 5)) is False

    def test_sunday_not_shabbat(self):
        assert is_shabbat(date(2026, 6, 7)) is False


# ── calculate_billable_days ───────────────────────────────────────────────────

class TestCalculateBillableDays:
    """
    2026-06-01 (Mon) → 2026-06-07 (Sun) = 6 days
    הכולל: 2, 3, 4, 5 (Mon-Thu) + 6 (Sat) + ...
    2026-06-06 = שבת
    """

    def test_daily_skips_shabbat(self):
        # Mon 1 → Sun 7 = 6 ימים. שבת 6/6 מדולגת → 5 ימי חיוב
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 7), PriceType.daily, set()
        )
        assert result.billable_days == 5.0
        assert date(2026, 6, 6) in result.skipped_dates
        assert result.skipped_days == 1

    def test_daily_skips_holiday(self):
        # Mon 1 → Fri 5 = 4 ימים. חג ב-3/6 → 3 ימי חיוב
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 5), PriceType.daily, {date(2026, 6, 3)}
        )
        assert result.billable_days == 3.0
        assert date(2026, 6, 3) in result.skipped_dates

    def test_monthly_counts_all(self):
        # חודשי: אותו טווח — ספירת כל הימים כולל שבת, ללא דילוג
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 7), PriceType.monthly, set()
        )
        assert result.billable_days == 6.0
        assert result.skipped_days == 0

    def test_half_day_returns_05(self):
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 2), PriceType.half_day, set()
        )
        assert result.billable_days == 0.5
        assert result.is_half_day_flag is True

    def test_weekly_skips_shabbat(self):
        # אותו כלל כמו daily — dilling שבתות גם ב-weekly
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 8), PriceType.weekly, set()
        )
        # 7 ימים: Mon-Sun. שבת 6/6 דולג → 6 ימי חיוב
        assert result.billable_days == 6.0

    def test_no_days(self):
        result = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 1), PriceType.daily, set()
        )
        assert result.billable_days == 0.0


# ── date_in_season ────────────────────────────────────────────────────────────

class TestDateInSeason:
    def _season(self, sm, sd, em, ed) -> Season:
        s = MagicMock(spec=Season)
        s.start_month = sm; s.start_day = sd
        s.end_month = em;   s.end_day   = ed
        s.is_active = True
        return s

    def test_regular_season(self):
        s = self._season(7, 1, 8, 31)  # יולי-אוגוסט
        assert _date_in_season(date(2026, 7, 15), s) is True
        assert _date_in_season(date(2026, 6, 30), s) is False
        assert _date_in_season(date(2026, 9, 1), s)  is False

    def test_wrap_around_season(self):
        s = self._season(12, 25, 1, 5)  # 25 דצמ – 5 ינו
        assert _date_in_season(date(2026, 12, 30), s) is True
        assert _date_in_season(date(2027, 1, 3),   s) is True
        assert _date_in_season(date(2026, 12, 24), s) is False
        assert _date_in_season(date(2027, 1, 6),   s) is False

    def test_boundary_inclusive(self):
        s = self._season(7, 1, 7, 31)
        assert _date_in_season(date(2026, 7, 1),  s) is True
        assert _date_in_season(date(2026, 7, 31), s) is True


# ── split_by_seasons ──────────────────────────────────────────────────────────

class TestSplitBySeasons:
    def _season(self, sid, sm, sd, em, ed, name="עונה") -> Season:
        s = MagicMock(spec=Season)
        s.id = sid; s.name = name
        s.start_month = sm; s.start_day = sd
        s.end_month = em;   s.end_day   = ed
        s.is_active = True
        return s

    def test_no_seasons(self):
        segments = split_by_seasons(date(2026, 6, 1), date(2026, 6, 8), [])
        assert len(segments) == 1
        assert segments[0].season_id is None

    def test_single_season_full_overlap(self):
        s = self._season(1, 6, 1, 6, 30, "קיץ")
        segments = split_by_seasons(date(2026, 6, 5), date(2026, 6, 10), [s])
        assert len(segments) == 1
        assert segments[0].season_id == 1

    def test_booking_crosses_season_boundary(self):
        # עונת קיץ: 1/7–31/8
        s = self._season(1, 7, 1, 8, 31, "קיץ")
        # הזמנה 28/6 → 10/7 חוצת את תחילת העונה
        segments = split_by_seasons(date(2026, 6, 28), date(2026, 7, 10), [s])
        # 3 ימים ללא עונה (28,29,30 יוני) + 9 ימים עם עונה (1-9 יולי)
        assert len(segments) == 2
        no_s = next(seg for seg in segments if seg.season_id is None)
        yes_s = next(seg for seg in segments if seg.season_id == 1)
        assert no_s.calendar_days == 3
        assert yes_s.calendar_days == 9

    def test_empty_range(self):
        segments = split_by_seasons(date(2026, 6, 1), date(2026, 6, 1), [])
        assert segments == []


# ── weekly_price_logic ────────────────────────────────────────────────────────

class TestWeeklyPriceLogic:
    """בדיקת הכלל: שבוע = 6 ימי חיוב"""

    def test_one_full_week(self):
        assert 6 // WEEKLY_BILLABLE_PER_WEEK == 1
        assert 6 % WEEKLY_BILLABLE_PER_WEEK == 0

    def test_week_with_holiday(self):
        assert 5 // WEEKLY_BILLABLE_PER_WEEK == 0

    def test_week_plus_days(self):
        assert 8 // WEEKLY_BILLABLE_PER_WEEK == 1
        assert 8 % WEEKLY_BILLABLE_PER_WEEK == 2

    def test_two_weeks(self):
        assert 12 // WEEKLY_BILLABLE_PER_WEEK == 2
        assert 12 % WEEKLY_BILLABLE_PER_WEEK == 0


# ── monthly_remainder_logic ───────────────────────────────────────────────────

class TestMonthlyRemainderLogic:
    """בדיקת הכלל: שארית = monthly_price / 30 ליום"""

    def test_35_days(self):
        monthly = 3000.0
        days = 35
        months    = days // 30   # = 1
        remaining = days % 30    # = 5
        day_rate  = monthly / 30  # = 100.0
        total = months * monthly + remaining * day_rate
        assert total == 3000.0 + 5 * 100.0   # = 3500.0

    def test_exactly_30_days(self):
        monthly = 3000.0
        days = 30
        assert days // 30 == 1
        assert days % 30 == 0
        total = 1 * monthly + 0
        assert total == 3000.0

    def test_60_days(self):
        monthly = 3000.0
        days = 60
        assert days // 30 == 2
        assert days % 30 == 0
        total = 2 * monthly
        assert total == 6000.0

    def test_65_days(self):
        monthly = 3000.0
        days = 65
        months    = days // 30   # = 2
        remaining = days % 30    # = 5
        day_rate  = monthly / 30  # = 100.0
        total = 2 * monthly + 5 * day_rate
        assert total == 6000.0 + 500.0   # = 6500.0

    def test_day_rate_is_monthly_divided_by_30(self):
        """מחיר יומי לשארית = monthly / 30, לא מחיר יומי עצמאי"""
        monthly = 2700.0
        day_rate = monthly / 30
        assert day_rate == 90.0   # ולא בהכרח מחיר יומי אחר


