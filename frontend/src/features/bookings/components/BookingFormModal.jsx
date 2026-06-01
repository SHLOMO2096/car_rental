import Modal from "../../../components/ui/Modal";

import { s } from "../styles";
import { addDays, formatDateTime, todayISO } from "../utils/dates";
import { getEarliestAllowedPickupTime, subtractMinutes } from "../utils/form";

function getEffectivePriceDay(car, priceRules) {
  if (!priceRules?.length) return null;
  const active = priceRules.filter((r) => r.is_active);
  const levels = [
    active.filter((r) => r.entity_type === "car" && r.entity_value === String(car.id)),
    active.filter((r) => r.entity_type === "model" && r.entity_value === car.name),
    active.filter((r) => r.entity_type === "category" && r.entity_value === car.category),
    active.filter((r) => r.entity_type === "global_"),
  ];
  for (const candidates of levels) {
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (b.priority > a.priority ? b : a));
    if (best.price_day != null) return best.price_day;
  }
  return null;
}

export default function BookingFormModal({
  open,
  mode,
  form,
  setForm,
  cars,
  categories,
  priceRules,
  customersLoading,
  customerMatches,
  onPickCustomer,
  isMobile,
  onClose,
  onSave,
  saving,
  formError,
  editBooking,
  auditHistory,
  auditLoading,
  currentUser,
  preview,
}) {
  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const earliestStartTime = getEarliestAllowedPickupTime(form.start_date, new Date(), form.start_time);
  const isCrossAgentEdit =
    isEdit &&
    currentUser?.role === "agent" &&
    editBooking?.created_by &&
    editBooking.created_by !== currentUser.id;

  const formatAuditAction = (action) => {
    switch (action) {
      case "booking.create":
        return "יצירה";
      case "booking.update":
        return "עריכה";
      case "booking.delete":
        return "מחיקה";
      case "booking.upload_photo":
        return "העלאת תמונה";
      default:
        return action;
    }
  };

  const summarizeAuditEntry = (entry) => {
    const changedFields = entry?.after_json?.changed_fields;
    const operatorNote = entry?.after_json?.operator_note;
    const parts = [];
    if (Array.isArray(changedFields) && changedFields.length) parts.push(`שדות: ${changedFields.join(", ")}`);
    if (operatorNote) parts.push(`הערה: ${operatorNote}`);
    return parts.join(" · ");
  };

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
                    const effectivePrice = getEffectivePriceDay(c, priceRules);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.plate}) {c.is_hybrid ? "🌿" : ""}{effectivePrice != null ? ` — ₪${effectivePrice}/יום` : ""}
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
            {isCreate && !form.customer_id && form.customer_name.trim().length >= 2 && (
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
              min={undefined}
              onChange={(e) =>
                setForm((f) => {
                  const newPickupTime = getEarliestAllowedPickupTime(e.target.value, new Date(), f.start_time);
                  return {
                    ...f,
                    start_date: e.target.value,
                    start_time: newPickupTime,
                    end_time: subtractMinutes(newPickupTime, 30),
                  };
                })
              }
              style={{ ...s.input, flex: 2 }}
            />
            <input
              type="time"
              value={form.start_time}
              min={undefined}
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

        {isCrossAgentEdit && (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>הערת מפעיל *</label>
            <textarea
              value={form.operator_note}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, operator_note: e.target.value }))}
              style={{ ...s.input, resize: "vertical", borderColor: "#fdba74", background: "#fff7ed" }}
              placeholder="הסבר קצר למה נדרשת עריכה של הזמנה שנוצרה על ידי סוכן אחר"
            />
          </div>
        )}
      </div>

      {/* Price preview */}
      {preview?.show && (
        <div style={s.pricePreview}>
          {preview.loading ? (
            <span>⏳ מחשב מחיר...</span>
          ) : preview.result ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>💰 תחשיב מחיר:</div>
              {preview.result.breakdown.map((line, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                  {line.label} — <strong>₪{line.subtotal.toLocaleString()}</strong>
                </div>
              ))}
              {preview.result.note && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  ℹ️ {preview.result.note}
                </div>
              )}
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}>
                סה&quot;כ: ₪{preview.result.total.toLocaleString()}
              </div>
              {form.customer_email && (
                <span style={{ marginTop: 4, display: "block", fontSize: 12 }}>📧 אישור יישלח ללקוח</span>
              )}
            </>
          ) : null}
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
          {editBooking.updated_by_name && (
            <span>
              ✏️ עודכן לאחרונה ע"י <strong>{editBooking.updated_by_name}</strong>
            </span>
          )}
          {editBooking.created_at && <span>🕐 {formatDateTime(editBooking.created_at)}</span>}
          {editBooking.updated_at && <span>✏️ עודכן: {formatDateTime(editBooking.updated_at)}</span>}
          {isCrossAgentEdit && <span style={{ color: "#b45309", fontWeight: 700 }}>⚠️ עריכת הזמנה של סוכן אחר</span>}
        </div>
      )}

      {isEdit && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            תיעוד פעולות אחרונות
          </div>
          <div style={{ padding: "8px 12px", display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }}>
            {auditLoading && <div style={{ fontSize: 12, color: "#64748b" }}>טוען היסטוריית שינויים...</div>}
            {!auditLoading && (!auditHistory || auditHistory.length === 0) && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>אין עדיין אירועי תיעוד להצגה</div>
            )}
            {!auditLoading &&
              auditHistory?.map((entry) => {
                const summary = summarizeAuditEntry(entry);
                const severityColor =
                  entry?.severity === "critical" ? "#b91c1c" : entry?.severity === "warning" ? "#b45309" : "#475569";
                return (
                  <div key={entry.id} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: severityColor }}>{formatAuditAction(entry.action)}</span>
                      <span style={{ color: "#64748b" }}>{formatDateTime(entry.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                      בוצע ע"י <strong>{entry.actor_user_name || `משתמש #${entry.actor_user_id || "לא ידוע"}`}</strong>
                    </div>
                    {summary && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{summary}</div>}
                  </div>
                );
              })}
          </div>
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

