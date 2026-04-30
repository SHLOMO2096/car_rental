import { HDate, HebrewCalendar } from "@hebcal/core";

function toLocalDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const d = new Date(`${dateInput}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function hebrewText(event) {
  try {
    return event.render("he");
  } catch {
    return event.getDesc();
  }
}

export function getJewishDayMeta(dateInput) {
  const date = toLocalDate(dateInput);
  if (!date) {
    return {
      isShabbat: false,
      isHoliday: false,
      isErevChag: false,
      closureAtNoon: false,
      holidayNames: [],
      erevNames: [],
      hebrewDate: "",
    };
  }

  const hdate = new HDate(date);
  const events = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
  const normalized = events.map((event) => ({
    en: event.getDesc(),
    he: hebrewText(event),
  }));

  const erevEvents = normalized.filter((item) => item.en.startsWith("Erev "));
  const holidayEvents = normalized.filter((item) => !item.en.startsWith("Erev "));
  const isShabbat = date.getDay() === 6;

  const hebrewDate = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return {
    isShabbat,
    isHoliday: holidayEvents.length > 0,
    isErevChag: erevEvents.length > 0,
    closureAtNoon: isShabbat || erevEvents.length > 0,
    holidayNames: holidayEvents.map((item) => item.he),
    erevNames: erevEvents.map((item) => item.he),
    hebrewDate,
  };
}

export function isAfterClosureTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hh, mm] = value.split(":").map(Number);
  return (hh * 60 + mm) > 12 * 60;
}

