import Modal from "../../../components/ui/Modal";

import { s } from "../styles";
import { addDays, formatDateTime } from "../utils/dates";

export default function BookingFormModal({
  open,
  mode,
  form,
  setForm,
  cars,
  categories,
  customersLoading,
  customerMatches,
  onPickCustomer,
  isMobile,
  onClose,
  onSave,
  saving,
  formError,
  editBooking,
  preview,
}) {
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  return (
    <Modal open={open} onClose={onClose} title={isCreate ? "הזמנה חדשה" : "עריכת הזמנה"} wide>
      <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={s.label}>רכב *</label>
          <select
            value={form.car_id}
            onChange={(e) => setForm((f) => ({ ...f, car_id: e.target.value }))}
            style={s.input}
            disabled={isEdit}
          >
            <option value="">— בחר רכב —</option>
            {([...categories, { name: "ללא קטגוריה" }]).map((cat) => {
              const catCars = cars.filter(
                (c) => c.is_active && (c.category === cat.name || (!c.category && cat.name === "ללא קטגוריה")),
              );
              if (catCars.length === 0) return null;

              return (
                <optgroup key={cat.name} label={cat.name}>
                  {catCars.map((c) => {
                    let effectivePrice = c.price_per_day;
                    if (!effectivePrice) {
                      const carCat = categories.find((cc) => cc.name === c.category);
                      if (carCat) {
                        effectivePrice = c.is_hybrid ? carCat.hybrid_price || carCat.base_price : carCat.base_price;
                      }
                    }
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.plate}) {c.is_hybrid ? "🌿" : ""} — ₪{effectivePrice}/יום
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div>
          <label style={s.label}>שם לקוח *</label>
          <div style={{ position: "relative" }}>
            <input
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: "", customer_name: e.target.value, customer_id_num: "" }))}
              style={s.input}
              placeholder="הקלד לפחות 2 תווים לחיפוש לקוח"
            />
            {isCreate && form.customer_name.trim().length >= 2 && (
              <div style={s.customerDropdown}>
                {customersLoading && <div style={s.customerItemMuted}>מחפש לקוחות...</div>}
                {!customersLoading && customerMatches.length === 0 && (
                  <div style={s.customerItemMuted}>לא נמצא לקוח קיים, ייווצר לקוח חדש בשמירה</div>
                )}
                {!customersLoading &&
                  customerMatches.map((c) => (
                    <button key={c.id} type="button" style={s.customerItem} onClick={() => onPickCustomer(c)}>
                      <span style={{ fontWeight: 700 }}>{c.name}</span>
                      <span style={s.customerMeta}>
                        {[c.id_number, c.phone, c.email].filter(Boolean).join(" · ") || "ללא פרטי קשר"}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={s.label}>אימייל (לאישור)</label>
          <input
            type="email"
            value={form.customer_email}
            onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value, customer_has_no_email: false }))}
            style={s.input}
            disabled={form.customer_has_no_email}
            placeholder={form.customer_has_no_email ? "סומן שאין מייל ללקוח" : "name@example.com"}
          />
          {isCreate && (
            <label style={s.checkboxRow}>
              <input
                type="checkbox"
                checked={!!form.customer_has_no_email}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    customer_has_no_email: e.target.checked,
                    customer_email: e.target.checked ? "" : f.customer_email,
                  }))
                }
              />
              <span>אין מייל ללקוח</span>
            </label>
          )}
        </div>

        <div>
          <label style={s.label}>טלפון</label>
          <input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} style={s.input} />
        </div>

        <div>
          <label style={s.label}>מספר זהות</label>
          <input value={form.customer_id_num} onChange={(e) => setForm((f) => ({ ...f, customer_id_num: e.target.value }))} style={s.input} />
        </div>

        <div>
          <label style={s.label}>
            מתאריך * <span style={s.timeHint}>שעת איסוף</span>
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              style={{ ...s.input, flex: 2 }}
            />
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              style={{ ...s.input, flex: 1 }}
            />
          </div>
        </div>

        <div>
          <label style={s.label}>
            עד תאריך * <span style={s.timeHint}>שעת החזרה</span>
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="date"
              value={form.end_date}
              min={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              style={{ ...s.input, flex: 2 }}
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              style={{ ...s.input, flex: 1 }}
            />
          </div>

          {/* Quick duration buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {[
              { label: "שבוע", days: 7 },
              { label: "שבועיים", days: 14 },
              { label: "חודש", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  if (!form.start_date) return;
                  setForm((f) => ({ ...f, end_date: addDays(f.start_date, days) }));
                }}
                style={s.durationBtn}
              >
                {label} ({days} יום)
              </button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "1/-1" }}>
          <label style={s.label}>הערות</label>
          <textarea
            value={form.notes}
            rows={2}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            style={{ ...s.input, resize: "vertical" }}
          />
        </div>
      </div>

      {/* Price preview */}
      {preview?.show && (
        <div style={s.pricePreview}>
          💰 {preview.days} ימים × ₪{preview.pricePerDay} = <strong>₪{preview.total.toLocaleString()}</strong>
          {form.customer_email && <span style={{ marginRight: 12 }}>📧 אישור יישלח ללקוח</span>}
        </div>
      )}

      {formError && <div style={s.errorBox}>{formError}</div>}

      {/* Audit info strip — shown in edit mode */}
      {isEdit && editBooking && (
        <div
          style={{
            margin: "12px 0 0",
            padding: "8px 12px",
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 16px",
            fontSize: 11,
            color: "#64748b",
          }}
        >
          {editBooking.created_by_name && (
            <span>
              🧑‍💼 נוצר ע"י <strong>{editBooking.created_by_name}</strong>
            </span>
          )}
          {editBooking.created_at && <span>🕐 {formatDateTime(editBooking.created_at)}</span>}
          {editBooking.updated_at && <span>✏️ עודכן: {formatDateTime(editBooking.updated_at)}</span>}
        </div>
      )}

      <div style={s.modalFooter}>
        <button onClick={onClose} style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}>
          ביטול
        </button>
        <button onClick={onSave} disabled={saving} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>
          {saving ? "שומר..." : isCreate ? "אשר הזמנה" : "שמור שינויים"}
        </button>
      </div>
    </Modal>
  );
}

