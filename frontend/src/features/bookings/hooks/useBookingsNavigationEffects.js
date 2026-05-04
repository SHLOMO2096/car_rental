import { useEffect } from "react";

import { makeEmptyForm } from "../utils/form";
import { todayISO, tomorrowISO } from "../utils/dates";

/**
 * מרוכז כאן כל הניווט דרך location.state (prefill/edit) כדי ש-BookingsPage יהיה נקי יותר.
 */
export function useBookingsNavigationEffects({ location, navigate, bookings, generalSettings, setForm, setEdit, setFormError, setModal, openEdit }) {
  // Prefill create form from navigation state
  useEffect(() => {
    const prefill = location.state?.bookingPrefill;
    if (!prefill) return;

    setForm({
      ...makeEmptyForm(generalSettings || {}),
      car_id: prefill.car_id || "",
      customer_id: prefill.customer_id ? String(prefill.customer_id) : "",
      customer_name: prefill.customer_name || "",
      customer_email: prefill.customer_email || "",
      customer_has_no_email: !prefill.customer_email,
      customer_phone: prefill.customer_phone || "",
      customer_id_num: prefill.customer_id_num || "",
      start_date: prefill.start_date || todayISO(),
      end_date: prefill.end_date || tomorrowISO(),
    });
    setEdit(null);
    setFormError("");
    setModal("create");
    navigate(location.pathname, { replace: true, state: {} });
  }, [generalSettings, location.pathname, location.state, navigate, setEdit, setForm, setFormError, setModal]);

  // Open edit from navigation state
  useEffect(() => {
    const editId = location.state?.bookingEditId;
    if (!editId) return;
    const target = bookings.find((b) => b.id === Number(editId));
    if (!target) return;
    openEdit(target);
    navigate(location.pathname, { replace: true, state: {} });
  }, [bookings, location.pathname, location.state, navigate, openEdit]);
}

