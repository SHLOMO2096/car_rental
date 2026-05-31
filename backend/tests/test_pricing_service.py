"""
בדיקות יחידה לשירות המחירים.
מריץ ללא DB — בדיקות הלוגיקה הטהורה בלבד.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock

from app.models.pricing import Season
from app.services.pricing import (
    is_half_day,
    is_shabbat,
    is_shabbat_or_holiday,
    calculate_billable_days,
    split_by_seasons,
    _date_in_season,
    MONTHLY_THRESHOLD_DAYS,
)


# ── is_half_day ───────────────────────────────────────────────────────────────

class TestIsHalfDay:
    def test_same_day(self):
        assert is_half_day(date(2026, 6, 1), "10:00", date(2026, 6, 1), "16:00") is True

    def test_overnight_16h_exactly(self):
        # 10:00 → 02:00 למחרת = 16 שעות בדיוק → חצי יום
        assert is_half_day(date(2026, 6, 1), "10:00", date(2026, 6, 2), "02:00") is True

    def test_overnight_under_16h(self):
        # 15:00 → 09:00 למחרת = 18 שעות → לא חצי יום
        assert is_half_day(date(2026, 6, 1), "15:00", date(2026, 6, 2), "09:00") is False

    def test_overnight_no_times(self):
        # ללא שעות — לילה אחד לא נחשב חצי יום
        assert is_half_day(date(2026, 6, 1), None, date(2026, 6, 2), None) is False

    def test_two_days_not_half(self):
        assert is_half_day(date(2026, 6, 1), "10:00", date(2026, 6, 3), "10:00") is False

    def test_same_day_no_times(self):
        assert is_half_day(date(2026, 6, 1), None, date(2026, 6, 1), None) is True

    def test_overnight_exactly_at_boundary(self):
        # 10:00 → 01:59 = 15h59m < 16h → חצי יום
        assert is_half_day(date(2026, 6, 1), "10:00", date(2026, 6, 2), "01:59") is True


# ── is_shabbat ────────────────────────────────────────────────────────────────

class TestIsShabbat:
    def test_saturday_is_shabbat(self):
        assert is_shabbat(date(2026, 6, 6)) is True

    def test_friday_not_shabbat(self):
        assert is_shabbat(date(2026, 6, 5)) is False

    def test_sunday_not_shabbat(self):
        assert is_shabbat(date(2026, 6, 7)) is False


# ── calculate_billable_days ───────────────────────────────────────────────────

class TestCalculateBillableDays:
    def test_exclude_shabbat(self):
        # Mon 1 → Sun 7 = 6 ימים. שבת 6/6 מדולגת → 5 ימי חיוב
        billable, skipped = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 7), exclude_sabbath=True, holidays=set()
        )
        assert billable == 5.0
        assert date(2026, 6, 6) in skipped

    def test_exclude_holiday(self):
        billable, skipped = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 5), exclude_sabbath=True,
            holidays={date(2026, 6, 3)}
        )
        assert billable == 3.0
        assert date(2026, 6, 3) in skipped

    def test_no_exclude_counts_all(self):
        # monthly: לא מדלג שבתות
        billable, skipped = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 7), exclude_sabbath=False, holidays=set()
        )
        assert billable == 6.0
        assert skipped == []

    def test_empty_range(self):
        billable, _ = calculate_billable_days(
            date(2026, 6, 1), date(2026, 6, 1), exclude_sabbath=True, holidays=set()
        )
        assert billable == 0.0


# ── _date_in_season ───────────────────────────────────────────────────────────

class TestDateInSeason:
    def _season(self, vf: date, vu: date, recurring: bool = True) -> Season:
        s = MagicMock(spec=Season)
        s.valid_from = vf
        s.valid_until = vu
        s.is_recurring = recurring
        s.is_active = True
        return s

    def test_recurring_regular(self):
        # עונת קיץ: 1 יולי – 31 אוגוסט (חוזרת שנתית)
        s = self._season(date(2000, 7, 1), date(2000, 8, 31), recurring=True)
        assert _date_in_season(date(2026, 7, 15), s) is True
        assert _date_in_season(date(2026, 6, 30), s) is False
        assert _date_in_season(date(2026, 9, 1),  s) is False

    def test_recurring_wrap_around(self):
        # 25 דצמ – 5 ינו (חוצת שנה, חוזרת)
        s = self._season(date(2000, 12, 25), date(2001, 1, 5), recurring=True)
        assert _date_in_season(date(2026, 12, 30), s) is True
        assert _date_in_season(date(2027, 1, 3),   s) is True
        assert _date_in_season(date(2026, 12, 24), s) is False
        assert _date_in_season(date(2027, 1, 6),   s) is False

    def test_non_recurring_uses_year(self):
        # עונה ספציפית לשנת 2026 בלבד
        s = self._season(date(2026, 7, 1), date(2026, 8, 31), recurring=False)
        assert _date_in_season(date(2026, 7, 15), s) is True
        assert _date_in_season(date(2027, 7, 15), s) is False

    def test_boundary_inclusive(self):
        s = self._season(date(2000, 7, 1), date(2000, 7, 31), recurring=True)
        assert _date_in_season(date(2026, 7, 1),  s) is True
        assert _date_in_season(date(2026, 7, 31), s) is True

    def test_no_dates_returns_false(self):
        s = MagicMock(spec=Season)
        s.valid_from = None
        s.valid_until = None
        s.is_recurring = True
        s.is_active = True
        assert _date_in_season(date(2026, 7, 1), s) is False


# ── split_by_seasons ──────────────────────────────────────────────────────────

class TestSplitBySeasons:
    def _season(self, sid: int, vf: date, vu: date, name: str = "עונה",
                recurring: bool = True) -> Season:
        s = MagicMock(spec=Season)
        s.id = sid
        s.name = name
        s.valid_from = vf
        s.valid_until = vu
        s.is_recurring = recurring
        s.is_active = True
        return s

    def test_no_seasons(self):
        segs = split_by_seasons(date(2026, 6, 1), date(2026, 6, 8), [])
        assert len(segs) == 1
        assert segs[0].season_id is None

    def test_single_season_full_overlap(self):
        s = self._season(1, date(2000, 6, 1), date(2000, 6, 30), "קיץ")
        segs = split_by_seasons(date(2026, 6, 5), date(2026, 6, 10), [s])
        assert len(segs) == 1
        assert segs[0].season_id == 1

    def test_crosses_season_boundary(self):
        # עונה: 1/7–31/8 (recurring)
        s = self._season(1, date(2000, 7, 1), date(2000, 8, 31), "קיץ")
        segs = split_by_seasons(date(2026, 6, 28), date(2026, 7, 10), [s])
        assert len(segs) == 2
        no_s  = next(seg for seg in segs if seg.season_id is None)
        yes_s = next(seg for seg in segs if seg.season_id == 1)
        assert no_s.calendar_days  == 3   # 28,29,30 יוני
        assert yes_s.calendar_days == 9   # 1–9 יולי

    def test_empty_range(self):
        assert split_by_seasons(date(2026, 6, 1), date(2026, 6, 1), []) == []


# ── monthly_algorithm ─────────────────────────────────────────────────────────

class TestMonthlyAlgorithm:
    def test_35_days(self):
        monthly = 3000.0
        days = 35
        months, remaining = divmod(days, MONTHLY_THRESHOLD_DAYS)
        day_rate = monthly / MONTHLY_THRESHOLD_DAYS
        assert months * monthly + remaining * day_rate == 3500.0

    def test_exactly_30_days(self):
        monthly = 3000.0
        months, remaining = divmod(30, MONTHLY_THRESHOLD_DAYS)
        assert months * monthly == 3000.0
        assert remaining == 0

    def test_65_days(self):
        monthly = 3000.0
        months, remaining = divmod(65, MONTHLY_THRESHOLD_DAYS)
        day_rate = monthly / MONTHLY_THRESHOLD_DAYS
        assert months * monthly + remaining * day_rate == 6500.0


# ── weekly_algorithm ──────────────────────────────────────────────────────────

class TestWeeklyAlgorithm:
    """שבוע = 7 ימי חיוב (billable days אחרי דילוג שבתות/חגים)."""

    def test_7_billable_days_is_one_week(self):
        weeks, rem = divmod(7, 7)
        assert weeks == 1
        assert rem == 0

    def test_6_billable_days_is_less_than_week(self):
        weeks, rem = divmod(6, 7)
        assert weeks == 0

    def test_10_billable_days(self):
        weeks, rem = divmod(10, 7)
        assert weeks == 1
        assert rem == 3

    def test_14_billable_days(self):
        weeks, rem = divmod(14, 7)
        assert weeks == 2
        assert rem == 0
