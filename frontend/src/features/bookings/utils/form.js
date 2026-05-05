import { todayISO, tomorrowISO } from "./dates";
import { DEFAULT_GENERAL_SETTINGS } from "../../../config/defaultSettings";

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
  };
}

