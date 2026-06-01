"""
מחולל חגי ישראל — משתמש בספריית hdate.

החגים המאושרים לפי מפרט המערכת:
    - ראש השנה א' + ב'
    - יום כיפור
    - סוכות א' + ב'
    - שמיני עצרת / שמחת תורה
    - פסח א' + ב' + ז' + ח'
    - שבועות א' + ב'
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta

APPROVED_HOLIDAY_NAMES: set[str] = {
    "rosh_hashana_i",
    "rosh_hashana_ii",
    "yom_kippur",
    "sukkot",           # א' סוכות — ב' יתווסף ידנית
    "shmini_atzeret",
    "simchat_torah",
    "pesach",           # א' פסח — ב' יתווסף ידנית
    "pesach_vii",       # ז' פסח — ח' יתווסף ידנית
    "shavuot",          # א' שבועות — ב' יתווסף ידנית
}

HOLIDAY_HEBREW_NAMES: dict[str, str] = {
    "rosh_hashana_i":   "ראש השנה א'",
    "rosh_hashana_ii":  "ראש השנה ב'",
    "yom_kippur":       "יום כיפור",
    "sukkot":           "סוכות א'",
    "sukkot_ii":        "סוכות ב'",
    "shmini_atzeret":   "שמיני עצרת",
    "simchat_torah":    "שמחת תורה",
    "pesach":           "פסח א'",
    "pesach_ii":        "פסח ב'",
    "pesach_vii":       "פסח ז'",
    "pesach_viii":      "פסח ח'",
    "shavuot":          "שבועות א'",
    "shavuot_ii":       "שבועות ב'",
}

# חגים שלאחריהם יש להוסיף יום נוסף
_ADD_NEXT_DAY: dict[str, str] = {
    "sukkot":    "sukkot_ii",
    "pesach":    "pesach_ii",
    "pesach_vii": "pesach_viii",
    "shavuot":   "shavuot_ii",
}


@dataclass
class GeneratedHoliday:
    name: str
    date: date
    hebrew_year: int
    is_auto_generated: bool = True


def generate_holidays_for_year(gregorian_year: int) -> list[GeneratedHoliday]:
    """
    מחשב את חגי ישראל המאושרים לשנה גרגוריאנית נתונה.
    מחזיר רשימה ממוינת לפי תאריך.
    """
    from hdate import HDateInfo, HolidayTypes  # type: ignore[import]

    results: dict[date, GeneratedHoliday] = {}

    for year_offset in (0, 1):
        y = gregorian_year - year_offset
        d = date(y, 1, 1)
        end = date(y, 12, 31)
        while d <= end:
            info = HDateInfo(date=d, diaspora=False)
            if d.year == gregorian_year and info.holidays:
                for hol in info.holidays:
                    if (
                        hol.type == HolidayTypes.YOM_TOV
                        and hol.name in APPROVED_HOLIDAY_NAMES
                        and d not in results
                    ):
                        heb_year = _extract_hebrew_year(info)
                        results[d] = GeneratedHoliday(
                            name=HOLIDAY_HEBREW_NAMES.get(hol.name, hol.name),
                            date=d,
                            hebrew_year=heb_year,
                        )
                        # הוסף יום הבא (ב' סוכות / ב' פסח / ח' פסח / ב' שבועות)
                        next_key = _ADD_NEXT_DAY.get(hol.name)
                        if next_key:
                            next_day = d + timedelta(days=1)
                            if next_day not in results:
                                results[next_day] = GeneratedHoliday(
                                    name=HOLIDAY_HEBREW_NAMES[next_key],
                                    date=next_day,
                                    hebrew_year=heb_year,
                                )
            d += timedelta(days=1)

    return sorted(results.values(), key=lambda h: h.date)


def _extract_hebrew_year(info) -> int:
    try:
        if hasattr(info, "_hdate"):
            return int(info._hdate.year)
        return 0
    except Exception:
        return 0
