import { todayISO, tomorrowISO } from "./dates";
import { DEFAULT_GENERAL_SETTINGS } from "../../../config/defaultSettings";


function pad2(value) {
  return String(value).padStart(2, "0");
}


export function getRoundedCurrentTime(now = new Date(), stepMinutes = 30) {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % stepMinutes;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (stepMinutes - remainder));
  }
  if (rounded.getDate() !== now.getDate()) {
    return "23:59";
  }
  return `${pad2(rounded.getHours())}:${pad2(rounded.getMinutes())}`;
}


export function isTimeBefore(left, right) {
  return (left || "") < (right || "");
}


export function subtractMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - minutes);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}


// Native <input type="time"> renders AM/PM based on OS locale on some systems,
// regardless of the `lang` attribute. Typed 24h text input avoids that entirely.
// sanitizeTimeTyping keeps the field usable while typing (partial input allowed).
export function sanitizeTimeTyping(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// clampTimeValue normalizes to a valid 24h HH:MM on blur (00-23 : 00-59).
// 1-2 digits are read as the hour (e.g. "9" -> "09:00"), 3-4 as HHMM.
export function clampTimeValue(raw, fallback = "00:00") {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return fallback;
  const hourStr = digits.length <= 2 ? digits : digits.slice(0, 2);
  const minuteStr = digits.length <= 2 ? "0" : digits.slice(2, 4);
  const hour = Math.min(23, Math.max(0, Number(hourStr) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteStr) || 0));
  return `${pad2(hour)}:${pad2(minute)}`;
}


export function getEarliestAllowedPickupTime(startDate, now = new Date(), fallbackTime = DEFAULT_GENERAL_SETTINGS.default_pickup_time) {
  if (!startDate || startDate !== todayISO()) {
    return fallbackTime;
  }
  const roundedNow = getRoundedCurrentTime(now);
  return isTimeBefore(fallbackTime, roundedNow) ? roundedNow : fallbackTime;
}


// Non-blocking heads-up only — booking creation itself no longer restricts past dates/times.
export function isBookingStartInPast(form, now = new Date()) {
  if (!form?.start_date) return false;
  const today = todayISO();
  if (form.start_date < today) return true;
  if (form.start_date > today) return false;
  if (!form.start_time) return false;
  return isTimeBefore(form.start_time, `${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
}

export function makeEmptyForm(_defaults = {}) {
  const pickupTime = getRoundedCurrentTime();
  const returnTime = pickupTime;
  return {
    customer_id: "",
    car_id: "",
    customer_name: "",
    customer_email: "",
    customer_has_no_email: false,
    customer_phone: "",
    customer_id_num: "",
    start_date: todayISO(),
    start_time: pickupTime,
    end_date: tomorrowISO(),
    end_time: returnTime,
    notes: "",
    operator_note: "",
    price_override_enabled: false,
    price_override: "",
    price_override_reason: "",
  };
}

export function buildBookingPayload(form, carId, { mode = "create" } = {}) {
  return {
    car_id: carId,
    customer_id: form.customer_id ? Number(form.customer_id) : null,
    customer_name: form.customer_name.trim() || null,
    customer_email: form.customer_email.trim() || null,
    ...(mode === "create" ? { customer_has_no_email: !!form.customer_has_no_email } : {}),
    customer_phone: form.customer_phone.trim() || null,
    customer_id_num: form.customer_id_num.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    pickup_time: form.start_time || null,
    return_time: form.end_time || null,
    notes: form.notes.trim() || null,
    ...(mode === "edit" ? { operator_note: form.operator_note?.trim() || null } : {}),
    ...(form.price_override_enabled
      ? {
          price_override: Number(form.price_override),
          price_override_reason: form.price_override_reason.trim() || null,
        }
      : {}),
  };
}

