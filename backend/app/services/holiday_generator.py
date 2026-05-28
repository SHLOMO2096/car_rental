"""
מחולל חגי ישראל — משתמש בספריית hdate לחישוב תאריכים גרגוריאניים של חגים עבריים.

החגים המאושרים (לפי הגדרת המערכת):
    - ראש השנה א' + ב'
    - יום כיפור
    - סוכות א' + ב'         (ב' = יום אחרי א', גם אם בישראל רק א' הוא יו"ט)
    - שמיני עצרת / שמחת תורה
    - פסח א' + ז'
    - שבועות
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta

# שמות חגים שה-hdate מחזיר, שאנחנו מאשרים:
APPROVED_HOLIDAY_NAMES: set[str] = {
    "rosh_hashana_i",
    "rosh_hashana_ii",
    "yom_kippur",
    "sukkot",       # א' סוכות — ב' יתווסף ידנית
    "shmini_atzeret",
    "simchat_torah",
    "pesach",       # א' פסח
    "pesach_vii",   # ז' פסח
    "shavuot",
}

# שמות קריאים בעברית (לשמירה ב-DB)
HOLIDAY_HEBREW_NAMES: dict[str, str] = {
    "rosh_hashana_i":   "ראש השנה א'",
    "rosh_hashana_ii":  "ראש השנה ב'",
    "yom_kippur":       "יום כיפור",
    "sukkot":           "סוכות א'",
    "sukkot_ii":        "סוכות ב'",      # נוסף ידנית
    "shmini_atzeret":   "שמיני עצרת",
    "simchat_torah":    "שמחת תורה",
    "pesach":           "פסח א'",
    "pesach_vii":       "פסח ז'",
    "shavuot":          "שבועות",
}


@dataclass
class GeneratedHoliday:
    name: str            # שם עברי קריא
    date: date
    hebrew_year: int     # שנה עברית
    is_auto_generated: bool = True


def generate_holidays_for_year(gregorian_year: int) -> list[GeneratedHoliday]:
    """
    מחשב את חגי ישראל המאושרים לשנה גרגוריאנית נתונה.
    מחזיר רשימה ממוינת לפי תאריך.

    מכיל תאריכים משנה עברית שמתחילה בחודש תשרי (ספטמבר/אוקטובר),
    ולכן מכסה שתי שנות לועזיות חלקיות.
    """
    from hdate import HDateInfo, HolidayTypes  # type: ignore[import]

    results: dict[date, GeneratedHoliday] = {}
    # סורק 2 שנים קלנדריות כדי לכסות את כל השנה העברית
    for year_offset in (0, 1):
        y = gregorian_year - year_offset
        d = date(y, 1, 1)
        end = date(y, 12, 31)
        while d <= end:
            info = HDateInfo(date=d, diaspora=False)
            # בדוק אם יום זה נמצא בשנה הגרגוריאנית המבוקשת
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
                        # סוכות: הוסף גם יום ב' (יום אחרי)
                        if hol.name == "sukkot":
                            next_day = d + timedelta(days=1)
                            if next_day not in results:
                                results[next_day] = GeneratedHoliday(
                                    name=HOLIDAY_HEBREW_NAMES["sukkot_ii"],
                                    date=next_day,
                                    hebrew_year=heb_year,
                                )
            d += timedelta(days=1)

    return sorted(results.values(), key=lambda h: h.date)


def _extract_hebrew_year(info) -> int:
    """מחלץ את השנה העברית מ-HDateInfo."""
    try:
        # info.hdate מחזיר מחרוזת כמו "א' תשרי ה' תשפ"ז"
        # נשלוף דרך HebrewDate
        heb = info.hdate
        # info._hdate הוא HebrewDate namedtuple: (year, month, day)
        if hasattr(info, "_hdate"):
            return int(info._hdate.year)
        # fallback: parse מהמחרוזת
        return 0
    except Exception:
        return 0

