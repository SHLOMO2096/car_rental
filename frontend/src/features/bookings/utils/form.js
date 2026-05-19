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


export function getEarliestAllowedPickupTime(startDate, now = new Date(), fallbackTime = DEFAULT_GENERAL_SETTINGS.default_pickup_time) {
  if (!startDate || startDate !== todayISO()) {
    return fallbackTime;
  }
  const roundedNow = getRoundedCurrentTime(now);
  return isTimeBefore(fallbackTime, roundedNow) ? roundedNow : fallbackTime;
}


export function isBookingStartInPast(form, now = new Date()) {
  if (!form?.start_date || !form?.start_time) return false;
  if (form.start_date !== todayISO()) return false;
  return isTimeBefore(form.start_time, `${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
}

export function makeEmptyForm(defaults = {}) {
  return {
    customer_id: "",
    car_id: "",
    customer_name: "",
    customer_email: "",
    customer_has_no_email: false,
    customer_phone: "",
    customer_id_num: "",
    start_date: todayISO(),
    start_time: defaults.default_pickup_time || DEFAULT_GENERAL_SETTINGS.default_pickup_time,
    end_date: tomorrowISO(),
    end_time: defaults.default_return_time || DEFAULT_GENERAL_SETTINGS.default_return_time,
    notes: "",
    operator_note: "",
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
  };
}

