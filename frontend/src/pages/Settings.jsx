import { useEffect, useState } from "react";
import { settingsAPI } from "../api/settings";
import { payrollAPI } from "../api/payroll";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";
import { DEFAULT_GENERAL_SETTINGS } from "../config/defaultSettings";
import { useAuthStore } from "../store/auth";
import { Permissions } from "../permissions";

export default function Settings() {
  const can = useAuthStore((s) => s.can);
  const canManagePayroll = can(Permissions.PAYROLL_MANAGE);

  const [categories, setCategories] = useState([]);
  const [general, setGeneral] = useState(() => ({ ...DEFAULT_GENERAL_SETTINGS }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile(640);

  const [payrollUsers, setPayrollUsers] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [savingRateUserId, setSavingRateUserId] = useState(null);

  useEffect(() => {
    Promise.all([
      settingsAPI.get("category_hierarchy").catch(() => ({ value: [] })),
      settingsAPI.get("general_settings").catch(() => ({ value: null })),
    ]).then(([cats, gen]) => {
      setCategories(cats.value || []);
      if (gen.value) setGeneral(prev => ({ ...prev, ...gen.value }));
    })
      .catch(() => toast.error("נכשל בטעינת הגדרות"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canManagePayroll) return;
    setPayrollLoading(true);
    payrollAPI
      .listUsers()
      .then((u) => setPayrollUsers(u || []))
      .catch(() => toast.error("נכשל בטעינת שכר עובדים"))
      .finally(() => setPayrollLoading(false));
  }, [canManagePayroll]);

  async function saveHourlyRate(userId, hourlyRateValue) {
    const rate = hourlyRateValue === "" ? null : Number(hourlyRateValue);
    if (rate !== null && (Number.isNaN(rate) || rate < 0)) {
      toast.error("שכר שעתי לא תקין");
      return;
    }
    setSavingRateUserId(userId);
    try {
      const updated = await payrollAPI.updateHourlyRate(userId, rate);
      setPayrollUsers((prev) => prev.map((x) => (x.id === userId ? updated : x)));
      toast.success("עודכן שכר שעתי");
    } catch (e) {
      toast.error(e?.detail || "לא הצלחנו לעדכן שכר שעתי");
    } finally {
      setSavingRateUserId(null);
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      await settingsAPI.update("category_hierarchy", categories);
      await settingsAPI.update("general_settings", general);
      toast.success("ההגדרות נשמרו בהצלחה");
    } catch (e) {
      toast.error("נכשל בשמירת הגדרות");
    } finally {
      setSaving(false);
    }
  };


  const addCategory = () => {
    setCategories([...categories, { name: "", base_price: "", hybrid_price: "" }]);
  };

  const updateCategory = (index, field, value) => {
    const updated = [...categories];
    updated[index][field] = value;
    setCategories(updated);
  };

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  if (loading) return <div style={{ padding: 20 }}>טוען...</div>;

  return (
    <div dir="rtl" style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>הגדרות מערכת</h1>


      <div style={{ ...s.card, marginTop: 24 }}>
        <h2 style={s.cardTitle}>היררכיית קטגוריות ומחירים</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          הגדר מחירי בסיס לכל קטגוריה. ניתן להגדיר מחיר שונה לרכב היברידי בתוך אותה קטגוריה.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((c, i) => (
            <div key={i} style={{ ...s.filterRow, background: "#fdf4ff" }}>
              <div style={{ ...s.field, flex: 1.5 }}>
                <label style={s.label}>שם הקטגוריה</label>
                <input 
                  value={c.name} 
                  onChange={e => updateCategory(i, "name", e.target.value)} 
                  style={s.input} 
                  placeholder="למשל: מיני"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>מחיר בסיס (₪)</label>
                <input 
                  type="number" 
                  value={c.base_price} 
                  onChange={e => updateCategory(i, "base_price", e.target.value)} 
                  style={s.input} 
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>מחיר היברידי (₪)</label>
                <input 
                  type="number" 
                  value={c.hybrid_price} 
                  onChange={e => updateCategory(i, "hybrid_price", e.target.value)} 
                  style={s.input} 
                  placeholder="אופציונלי"
                />
              </div>
              <button onClick={() => removeCategory(i)} style={s.btnRemove}>🗑</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={addCategory} style={s.btnAdd}>+ הוסף קבוצה</button>
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 24 }}>
        <h2 style={s.cardTitle}>הגדרות כלליות</h2>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 20 }}>
          <div style={s.field}>
            <label style={s.label}>שעת איסוף ברירת מחדל</label>
            <input 
              type="time" 
              value={general.default_pickup_time} 
              onChange={e => setGeneral({ ...general, default_pickup_time: e.target.value })} 
              style={s.input} 
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>שעת החזרה ברירת מחדל</label>
            <input 
              type="time" 
              value={general.default_return_time} 
              onChange={e => setGeneral({ ...general, default_return_time: e.target.value })} 
              style={s.input} 
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>שעת סגירה (ערבי חג/שבת)</label>
            <input 
              type="time" 
              value={general.closure_time} 
              onChange={e => setGeneral({ ...general, closure_time: e.target.value })} 
              style={s.input} 
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>זמן חסד להחזרה (שעות)</label>
            <input 
              type="number" 
              value={general.grace_period_hours} 
              onChange={e => setGeneral({ ...general, grace_period_hours: e.target.value })} 
              style={s.input} 
              placeholder="למשל: 2"
            />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={s.field}>
            <label style={s.label}>אימיילים להתראות (מופרדים בפסיק)</label>
            <input 
              value={general.notification_emails} 
              onChange={e => setGeneral({ ...general, notification_emails: e.target.value })} 
              style={s.input} 
              placeholder="admin@example.com, manager@example.com"
            />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={s.field}>
            <label style={s.label}>תנאי שימוש (יופיעו באישור ההזמנה)</label>
            <textarea 
              value={general.terms_text} 
              onChange={e => setGeneral({ ...general, terms_text: e.target.value })} 
              style={{ ...s.input, height: 100, paddingTop: 10, resize: "vertical" }} 
              placeholder="למשל: יש להחזיר את הרכב נקי ועם מיכל דלק מלא..."
            />
          </div>
        </div>
      </div>

      {canManagePayroll && (
        <div style={{ ...s.card, marginTop: 24 }}>
          <h2 style={s.cardTitle}>שכר שעתי לעובדים</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            עריכה נשמרת מיידית (ביציאה מהשדה). השינוי מתועד בלוג הביקורת.
          </p>

          {payrollLoading ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>טוען עובדים...</div>
          ) : payrollUsers.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>אין עובדים להצגה.</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["שם", "אימייל", "פעיל", "שכר שעתי (₪)"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollUsers.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid #e2e8f0", opacity: u.is_active ? 1 : 0.55 }}>
                      <td style={s.td}><strong>{u.full_name}</strong></td>
                      <td style={s.td}>{u.email}</td>
                      <td style={s.td}>{u.is_active ? "כן" : "לא"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            defaultValue={u.hourly_rate ?? ""}
                            disabled={savingRateUserId === u.id}
                            onBlur={(e) => saveHourlyRate(u.id, e.target.value)}
                            style={{ ...s.input, width: isMobile ? "100%" : 160 }}
                            placeholder="ריק = ללא חישוב"
                          />
                          {savingRateUserId === u.id && (
                            <span style={{ color: "#64748b", fontSize: 12 }}>שומר...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", marginBottom: 40 }}>
        <button onClick={save} disabled={saving} style={{ ...s.btnSave, padding: "12px 32px", fontSize: 16 }}>
          {saving ? "שומר..." : "💾 שמור הכל"}
        </button>
      </div>
    </div>
  );
}

const s = {
  card: { background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  cardTitle: { margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#1e293b" },
  tableWrap: { overflow: "auto", borderRadius: 10, border: "1px solid #e2e8f0" },
  th: { padding: "12px 12px", textAlign: "right", fontSize: 12, color: "#475569", fontWeight: 900, whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 13, color: "#0f172a", verticalAlign: "top" },
  filterRow: {
    display: "flex", gap: 12, padding: 16, background: "#f8fafc", 
    borderRadius: 8, border: "1px solid #e2e8f0", flexWrap: "wrap", alignItems: "flex-end" 
  },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 140 },
  label: { fontSize: 12, fontWeight: 600, color: "#475569" },
  input: { padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, outline: "none" },
  btnRemove: { background: "#fee2e2", color: "#dc2626", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer", transition: "background 0.2s" },
  btnAdd: { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 },
  btnSave: { background: "#1d4ed8", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 700, transition: "opacity 0.2s" },
};
