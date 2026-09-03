// ══════════════════════════════════════════════════════════════════════════════
// דיאלוג יצירת הזמנה עצמאי.
//
// חולץ מ-BookingsPage כדי שהדשבורד יוכל ליצור הזמנה *במקום*, בלי לנווט
// ללשונית ההזמנות ולאבד את הסינונים ואת טווח התאריכים שהמשתמש בחר.
// הוא טוען בעצמו את מה שטופס ההזמנה צריך (רכבים, קטגוריות, כללי מחיר),
// ולכן אפשר להרכיב אותו בכל מסך בשורה אחת.
import { useCallback, useEffect, useState } from "react";

import { bookingsAPI } from "../../api/bookings";
import { carsAPI } from "../../api/cars";
import { customersAPI } from "../../api/customers";
import { pricingAPI } from "../../api/pricing";
import { settingsAPI } from "../../api/settings";
import { getUserFacingErrorMessage } from "../../api/errors";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuthStore } from "../../store/auth";
import { toast } from "../../store/toast";

import BookingFormModal from "./components/BookingFormModal";
import { useBookingPricePreview } from "./hooks/useBookingPricePreview";
import { useCustomerAutocomplete } from "./hooks/useCustomerAutocomplete";
import { buildBookingPayload, makeEmptyForm } from "./utils/form";

export default function BookingCreateDialog({ open, prefill, onClose, onCreated }) {
  const isMobile = useIsMobile(900);
  const currentUser = useAuthStore((s) => s.user);

  const [form, setForm] = useState(() => makeEmptyForm({}));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [cars, setCars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceRules, setPriceRules] = useState([]);

  // נטען פעם אחת בפתיחה הראשונה — לא בכל פתיחה, כדי שלחיצה על תא בגריד
  // תפתח טופס מיידית ולא תמתין לרשת.
  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => {
    if (!open || loadedOnce) return;
    setLoadedOnce(true);
    carsAPI.list().then(setCars).catch(() => {});
    settingsAPI.get("category_hierarchy").then((r) => setCategories(r?.value || [])).catch(() => {});
    pricingAPI.listRules?.().then(setPriceRules).catch(() => {});
  }, [open, loadedOnce]);

  // כל פתיחה מתחילה מטופס נקי עם הרכב והתאריך שנבחרו בגריד.
  useEffect(() => {
    if (!open) return;
    setFormError("");
    setForm(() => {
      const base = makeEmptyForm({});
      if (!prefill) return base;
      return {
        ...base,
        car_id: prefill.car_id != null ? String(prefill.car_id) : base.car_id,
        start_date: prefill.start_date || base.start_date,
        end_date: prefill.end_date || prefill.start_date || base.end_date,
      };
    });
  }, [open, prefill?.car_id, prefill?.start_date]);

  const { customerMatches, customersLoading, clearCustomerMatches } = useCustomerAutocomplete({
    modal: open ? "create" : null,
    customerId: form.customer_id,
    customerName: form.customer_name,
    searchCustomers: customersAPI.search,
  });

  const carsMap = Object.fromEntries(cars.map((c) => [c.id, c]));
  const pricePreview = useBookingPricePreview({ form, carsMap });

  const pickCustomer = useCallback((customer) => {
    setForm((f) => ({
      ...f,
      customer_id: String(customer.id),
      customer_name: customer.name || "",
      customer_email: customer.email || "",
      customer_has_no_email: !customer.email,
      customer_phone: customer.phone || "",
      customer_id_num: customer.id_number || "",
    }));
    clearCustomerMatches();
  }, [clearCustomerMatches]);

  async function handleSave() {
    if (!form.car_id) return setFormError("יש לבחור רכב");
    if (!form.customer_name?.trim()) return setFormError("יש להזין שם לקוח");

    setSaving(true);
    setFormError("");
    try {
      const payload = buildBookingPayload(form, +form.car_id, { mode: "create" });
      const created = await bookingsAPI.create(payload);
      toast.success("ההזמנה נוצרה");
      clearCustomerMatches();
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      // 409 מגיע גם על חפיפה להזמנה וגם על רכב מושבת — ההודעה מהשרת
      // מבחינה בין השניים, ולכן היא מוצגת כפי שהיא.
      setFormError(getUserFacingErrorMessage(e, "שמירת ההזמנה נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BookingFormModal
      open={open}
      mode="create"
      form={form}
      setForm={setForm}
      cars={cars}
      categories={categories}
      priceRules={priceRules}
      customersLoading={customersLoading}
      customerMatches={customerMatches}
      onPickCustomer={pickCustomer}
      isMobile={isMobile}
      saving={saving}
      formError={formError}
      editBooking={null}
      auditHistory={[]}
      auditLoading={false}
      currentUser={currentUser}
      onClose={() => {
        clearCustomerMatches();
        onClose?.();
      }}
      onSave={handleSave}
      preview={{ show: pricePreview.show, loading: pricePreview.loading, result: pricePreview.result }}
    />
  );
}
