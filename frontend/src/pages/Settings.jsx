import { useEffect, useState } from "react";
import { settingsAPI } from "../api/settings";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";

export default function Settings() {
  const [quickFilters, setQuickFilters] = useState([]);
  const [groupPrices, setGroupPrices] = useState([]);
  const [general, setGeneral] = useState({
    default_pickup_time: "08:30",
    default_return_time: "08:00",
    closure_time: "12:00"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile(640);

  useEffect(() => {
    Promise.all([
      settingsAPI.get("quick_filters").catch(() => ({ value: [] })),
      settingsAPI.get("group_prices").catch(() => ({ value: [] })),
      settingsAPI.get("general_settings").catch(() => ({ value: null })),
    ]).then(([filters, prices, gen]) => {
      setQuickFilters(filters.value || []);
      setGroupPrices(prices.value || []);
      if (gen.value) setGeneral(prev => ({ ...prev, ...gen.value }));
    })
      .catch(() => toast.error("נכשל בטעינת הגדרות"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsAPI.update("quick_filters", quickFilters);
      await settingsAPI.update("group_prices", groupPrices);
      await settingsAPI.update("general_settings", general);
      toast.success("ההגדרות נשמרו בהצלחה");
    } catch (e) {
      toast.error("נכשל בשמירת הגדרות");
    } finally {
      setSaving(false);
    }
  };

  const addFilter = () => {
    setQuickFilters([...quickFilters, { label: "חדש", max_price: "", type: "" }]);
  };

  const removeFilter = (index) => {
    setQuickFilters(quickFilters.filter((_, i) => i !== index));
  };

  const updateFilter = (index, field, value) => {
    const updated = [...quickFilters];
    updated[index][field] = value;
    setQuickFilters(updated);
  };

  const addGroupPrice = () => {
    setGroupPrices([...groupPrices, { group: "", price: "" }]);
  };

  const updateGroupPrice = (index, field, value) => {
    const updated = [...groupPrices];
    updated[index][field] = value;
    setGroupPrices(updated);
  };

  const removeGroupPrice = (index) => {
    setGroupPrices(groupPrices.filter((_, i) => i !== index));
  };

  if (loading) return <div style={{ padding: 20 }}>טוען...</div>;

  return (
    <div dir="rtl">
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>הגדרות מערכת</h1>

      <div style={s.card}>
        <h2 style={s.cardTitle}>ניהול סינונים מהירים (דשבורד)</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          כאן ניתן להגדיר את כפתורי הסינון המהיר שיופיעו בלוח הבקרה. 
          ניתן לסנן לפי מחיר מקסימלי או לפי סוג רכב (למשל hybrid).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {quickFilters.map((f, i) => (
            <div key={i} style={s.filterRow}>
              <div style={s.field}>
                <label style={s.label}>שם הסינון (Label)</label>
                <input 
                  value={f.label} 
                  onChange={e => updateFilter(i, "label", e.target.value)} 
                  style={s.input} 
                  placeholder="למשל: AB"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>מחיר עד (₪)</label>
                <input 
                  type="number" 
                  value={f.max_price} 
                  onChange={e => updateFilter(i, "max_price", e.target.value)} 
                  style={s.input} 
                  placeholder="השאר ריק אם לא רלוונטי"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>סוג רכב (Type)</label>
                <select 
                  value={f.type || ""} 
                  onChange={e => updateFilter(i, "type", e.target.value)} 
                  style={s.input}
                >
                  <option value="">— ללא —</option>
                  <option value="hybrid">Hybrid (היברידי)</option>
                  <option value="electric">Electric (חשמלי)</option>
                  <option value="luxury">Luxury (יוקרה)</option>
                  <option value="suv">SUV</option>
                  <option value="van">Van</option>
                </select>
              </div>
              <button onClick={() => removeFilter(i)} style={s.btnRemove}>🗑</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={addFilter} style={s.btnAdd}>+ הוסף סינון</button>
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 24 }}>
        <h2 style={s.cardTitle}>מחירון לפי קבוצת רכב</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          הגדר מחירי ברירת מחדל לכל קבוצה (A, B, C וכו'). מחירים אלו ישמשו את המערכת לחישובים אוטומטיים.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groupPrices.map((p, i) => (
            <div key={i} style={{ ...s.filterRow, background: "#fdf4ff" }}>
              <div style={s.field}>
                <label style={s.label}>קבוצה</label>
                <input 
                  value={p.group} 
                  onChange={e => updateGroupPrice(i, "group", e.target.value.toUpperCase())} 
                  style={s.input} 
                  placeholder="למשל: A"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>מחיר ליום (₪)</label>
                <input 
                  type="number" 
                  value={p.price} 
                  onChange={e => updateGroupPrice(i, "price", e.target.value)} 
                  style={s.input} 
                />
              </div>
              <button onClick={() => removeGroupPrice(i)} style={s.btnRemove}>🗑</button>
            </div>
          ))}
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
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} style={{ ...s.btnSave, padding: "12px 32px", fontSize: 16 }}>
          {saving ? "שומר..." : "💾 שמור הכל"}
        </button>
      </div>
    </div>
  );
}

const s = {
  card: { background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" },
  cardTitle: { margin: "0 0 10px", fontSize: 18, fontWeight: 700 },
  filterRow: { 
    display: "flex", gap: 12, padding: 16, background: "#f8fafc", 
    borderRadius: 8, border: "1px solid #e2e8f0", flexWrap: "wrap", alignItems: "flex-end" 
  },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 140 },
  label: { fontSize: 12, fontWeight: 600, color: "#475569" },
  input: { padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 },
  btnRemove: { background: "#fee2e2", color: "#dc2626", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" },
  btnAdd: { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 },
  btnSave: { background: "#1d4ed8", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 700 },
};
