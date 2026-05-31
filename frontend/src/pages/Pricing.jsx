import { useEffect, useState, useCallback, useMemo } from "react";
import { pricingAPI } from "../api/pricing";
import { carsAPI } from "../api/cars";
import { toast } from "../store/toast";
import { useAuthStore } from "../store/auth";
import { Permissions } from "../permissions";
import Modal from "../components/ui/Modal";
import { useIsMobile } from "../hooks/useIsMobile";

// ── קבועים ────────────────────────────────────────────────────────────────────
const ENTITY_HE = {
  car: "רכב ספציפי",
  model: "דגם",
  category: "קטגוריה",
  global_: "גלובלי",
};

const PRICE_FIELDS = [
  { key: "price_half_day", label: "חצי יום" },
  { key: "price_day",      label: "יום" },
  { key: "price_week",     label: "שבוע" },
  { key: "price_month",    label: "חודש" },
];

// ── hook: עץ רכבים ────────────────────────────────────────────────────────────
function useCarTree() {
  const [carTree, setCarTree] = useState({});
  const [allCars, setAllCars] = useState([]);
  useEffect(() => {
    carsAPI.list().then(data => {
      setAllCars(data);
      const tree = {};
      data.forEach(car => {
        const cat   = car.category || "ללא קטגוריה";
        const model = car.name    || "ללא דגם";
        if (!tree[cat]) tree[cat] = {};
        if (!tree[cat][model]) tree[cat][model] = [];
        tree[cat][model].push(car);
      });
      setCarTree(tree);
    }).catch(() => {});
  }, []);
  return { carTree, allCars };
}

// ══════════════════════════════════════════════════════════════════════════════
// עמוד ראשי
// ══════════════════════════════════════════════════════════════════════════════
export default function Pricing() {
  const can = useAuthStore(s => s.can);
  const canManage = can(Permissions.PRICING_MANAGE);
  const isMobile  = useIsMobile(640);
  const [tab, setTab] = useState("seasons");

  const tabs = [
    { id: "seasons",      label: "עונות מחיר",   icon: "🗓" },
    { id: "rules",        label: "כללי מחיר",    icon: "💰" },
    { id: "season-rules", label: "כללי עונה",    icon: "📈" },
    { id: "holidays",     label: "חגים",          icon: "✡️" },
  ];

  return (
    <div dir="rtl">
      <h2 style={{ margin: "0 0 20px", color: "#1e293b", fontSize: 22, fontWeight: 800 }}>
        💰 ניהול מחירים
      </h2>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24,
        borderBottom: "2px solid #e2e8f0",
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: isMobile ? "10px 12px" : "10px 18px",
            fontSize: isMobile ? 13 : 14, fontWeight: 700, whiteSpace: "nowrap",
            color: tab === t.id ? "#2563eb" : "#64748b",
            borderBottom: tab === t.id ? "3px solid #2563eb" : "3px solid transparent",
            marginBottom: -2, transition: "all 0.15s", flexShrink: 0,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "seasons"      && <SeasonsTab    canManage={canManage} isMobile={isMobile} />}
      {tab === "rules"        && <RulesTab      canManage={canManage} isMobile={isMobile} />}
      {tab === "season-rules" && <SeasonRulesTab canManage={canManage} isMobile={isMobile} />}
      {tab === "holidays"     && <HolidaysTab   canManage={canManage} isMobile={isMobile} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — עונות מחיר
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_SEASON = {
  name: "", season_type: "peak",
  valid_from: "", valid_until: "",
  is_recurring: true,
  adjustment_type: null, adjustment_direction: null, adjustment_value: "",
  is_active: true,
};

function SeasonsTab({ canManage, isMobile }) {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    pricingAPI.listSeasons()
      .then(setSeasons)
      .catch(() => toast.error("נכשל בטעינת עונות"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => setForm({ ...EMPTY_SEASON });
  const openEdit = (s) => setForm({
    ...s,
    valid_from:  s.valid_from  || "",
    valid_until: s.valid_until || "",
    adjustment_value: s.adjustment_value ?? "",
  });

  const save = async () => {
    if (!form.name?.trim())  return toast.error("חובה להזין שם");
    if (!form.valid_from)    return toast.error("חובה להזין תאריך התחלה");
    if (!form.valid_until)   return toast.error("חובה להזין תאריך סיום");
    const hasAdj = form.adjustment_type || form.adjustment_direction || form.adjustment_value !== "";
    if (hasAdj && !(form.adjustment_type && form.adjustment_direction && form.adjustment_value !== ""))
      return toast.error("מלא את כל שדות ההתאמה או השאר ריקים");

    setSaving(true);
    try {
      const payload = {
        name:                 form.name.trim(),
        season_type:          form.season_type || null,
        valid_from:           form.valid_from,
        valid_until:          form.valid_until,
        is_recurring:         !!form.is_recurring,
        adjustment_type:      form.adjustment_type || null,
        adjustment_direction: form.adjustment_direction || null,
        adjustment_value:     form.adjustment_value !== "" ? +form.adjustment_value : null,
        is_active:            form.is_active !== false,
      };
      if (form.id) {
        await pricingAPI.updateSeason(form.id, payload);
        toast.success("עונה עודכנה");
      } else {
        await pricingAPI.createSeason(payload);
        toast.success("עונה נוצרה");
      }
      setForm(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "שגיאה בשמירה");
    } finally { setSaving(false); }
  };

  const remove = async (s) => {
    if (!confirm(`למחוק את "${s.name}"?`)) return;
    try {
      await pricingAPI.deleteSeason(s.id);
      toast.success("עונה בוטלה"); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "שגיאה במחיקה"); }
  };

  const currentYear = new Date().getFullYear();
  const fmtDateCurrentYear = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}/${currentYear}`;
  };
  const fmtDateFull = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
  };

  return (
    <div>
      {canManage && (
        <button onClick={openNew} style={btn("#2563eb")}>+ עונה חדשה</button>
      )}

      {loading ? <Spinner /> : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14, marginTop: 16,
        }}>
          {seasons.length === 0 && (
            <p style={{ color: "#94a3b8" }}>אין עונות מוגדרות</p>
          )}
          {seasons.map(s => (
            <div key={s.id} style={{
              background: "#fff",
              border: `1px solid ${s.is_active ? "#bfdbfe" : "#e2e8f0"}`,
              borderRadius: 12, padding: 16,
              opacity: s.is_active ? 1 : 0.6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", marginBottom: 4 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {s.is_recurring
                      ? `${fmtDateCurrentYear(s.valid_from)} – ${fmtDateCurrentYear(s.valid_until)} (חוזר שנתי)`
                      : `${fmtDateFull(s.valid_from)} – ${fmtDateFull(s.valid_until)}`
                    }
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {s.season_type && (
                    <span style={badgeStyle(s.season_type === "peak" ? "#fef3c7" : "#e0f2fe",
                                            s.season_type === "peak" ? "#92400e" : "#0369a1")}>
                      {s.season_type === "peak" ? "⬆ שיא" : "⬇ שפל"}
                    </span>
                  )}
                  <span style={badgeStyle(s.is_active ? "#dcfce7" : "#f1f5f9",
                                          s.is_active ? "#166534" : "#64748b")}>
                    {s.is_active ? "פעיל" : "כבוי"}
                  </span>
                </div>
              </div>

              {s.adjustment_type && s.adjustment_value != null && (
                <div style={{ marginTop: 8 }}>
                  <span style={badgeStyle(
                    s.adjustment_direction === "add" ? "#f0fdf4" : "#fff1f2",
                    s.adjustment_direction === "add" ? "#15803d" : "#be123c",
                  )}>
                    {s.adjustment_direction === "add" ? "+" : "−"}
                    {s.adjustment_value}
                    {s.adjustment_type === "percent" ? "%" : "₪"}
                  </span>
                </div>
              )}

              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => openEdit(s)} style={smallBtn("#e0f2fe", "#0369a1")}>✏️ ערוך</button>
                  <button onClick={() => remove(s)}   style={smallBtn("#fef2f2", "#dc2626")}>🗑 מחק</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)}
             title={form?.id ? "✏️ עדכון עונה" : "➕ עונה חדשה"}>
        {form && <SeasonForm form={form} setForm={setForm} saving={saving}
                             onSave={save} onCancel={() => setForm(null)} isMobile={isMobile} />}
      </Modal>
    </div>
  );
}

function SeasonForm({ form, setForm, saving, onSave, onCancel, isMobile }) {
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const hasAdj = !!(form.adjustment_type);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="שם העונה *">
        <input value={form.name || ""} onChange={e => f("name", e.target.value)}
               style={inp} placeholder="קיץ, חגי תשרי..." />
      </Field>

      <Field label="סוג עונה">
        <div style={{ display: "flex", gap: 12 }}>
          {[["peak", "⬆ עונת שיא"], ["low", "⬇ עונת שפל"]].map(([val, lbl]) => (
            <label key={val} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
              <input type="radio" name="season_type" value={val}
                     checked={form.season_type === val}
                     onChange={() => f("season_type", val)} />
              {lbl}
            </label>
          ))}
        </div>
      </Field>

      <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
        <ToggleSwitch checked={!!form.is_recurring}
                      onChange={v => f("is_recurring", v)} />
        <span style={{ fontSize: 13, color: "#374151" }}>חוזר שנתי (התעלם מהשנה)</span>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="מתאריך *">
          <input type="date" value={form.valid_from || ""}
                 onChange={e => f("valid_from", e.target.value)} style={inp} />
          {form.is_recurring && form.valid_from && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
              יוצג: {fmtMonthDay(form.valid_from)}
            </div>
          )}
        </Field>
        <Field label="עד תאריך *">
          <input type="date" value={form.valid_until || ""}
                 onChange={e => f("valid_until", e.target.value)} style={inp} />
          {form.is_recurring && form.valid_until && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
              יוצג: {fmtMonthDay(form.valid_until)}
            </div>
          )}
        </Field>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", marginBottom: hasAdj ? 12 : 0 }}>
          <ToggleSwitch checked={hasAdj}
                        onChange={v => setForm(prev => ({
                          ...prev,
                          adjustment_type:      v ? "percent" : null,
                          adjustment_direction: v ? "add"     : null,
                          adjustment_value:     v ? prev.adjustment_value : "",
                        }))} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>התאמת מחיר לעונה</span>
        </label>

        {hasAdj && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {[["add", "תוספת"], ["subtract", "הנחה"]].map(([val, lbl]) => (
                <label key={val} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                  <input type="radio" name="adj_dir" value={val}
                         checked={form.adjustment_direction === val}
                         onChange={() => f("adjustment_direction", val)} />
                  {lbl}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[["percent", "אחוזים (%)"], ["fixed", "סכום קבוע (₪)"]].map(([val, lbl]) => (
                <label key={val} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                  <input type="radio" name="adj_type" value={val}
                         checked={form.adjustment_type === val}
                         onChange={() => f("adjustment_type", val)} />
                  {lbl}
                </label>
              ))}
            </div>
            <Field label={`ערך (${form.adjustment_type === "percent" ? "%" : "₪"})`}>
              <input type="number" min={0} step={form.adjustment_type === "percent" ? 1 : 0.01}
                     value={form.adjustment_value} onChange={e => f("adjustment_value", e.target.value)}
                     style={inp} placeholder="0" />
            </Field>
          </div>
        )}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={form.is_active !== false}
               onChange={e => f("is_active", e.target.checked)} />
        <span style={{ fontSize: 13, color: "#374151" }}>עונה פעילה</span>
      </label>

      <FormFooter saving={saving} onCancel={onCancel} onSave={onSave} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — כללי מחיר (עץ צדדי + פאנל עריכה)
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_RULE = {
  name: "", entity_type: "category", entity_value: "",
  price_half_day: "", price_day: "", price_week: "", price_month: "",
  exclude_sabbath_holidays: true,
  season_id: null, priority: 0, is_active: true,
};

function RulesTab({ canManage, isMobile }) {
  const [rules,       setRules]       = useState([]);
  const [seasons,     setSeasons]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [openCats,    setOpenCats]    = useState({});
  const [openGroups,  setOpenGroups]  = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { carTree, allCars } = useCarTree();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        pricingAPI.listRules({ active_only: false }),
        pricingAPI.listSeasons(),
      ]);
      setRules(r); setSeasons(s);
    } catch { toast.error("נכשל בטעינת כללי מחיר"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (r) => setForm({
    ...r,
    price_half_day: r.price_half_day ?? "",
    price_day:      r.price_day      ?? "",
    price_week:     r.price_week     ?? "",
    price_month:    r.price_month    ?? "",
  });
  const openNew   = (defaults = {}) => setForm({ ...EMPTY_RULE, ...defaults });
  const closeForm = () => setForm(null);

  const save = async () => {
    if (form.entity_type !== "global_" && !form.entity_value?.trim())
      return toast.error("חובה לבחור ערך ישות");
    const hasPrices = PRICE_FIELDS.some(f => form[f.key] !== "" && form[f.key] !== null);
    if (!hasPrices) return toast.error("יש להזין לפחות מחיר אחד");

    setSaving(true);
    try {
      const toNum = v => (v !== "" && v !== null ? +v : null);
      const payload = {
        name:                     form.name || null,
        entity_type:              form.entity_type,
        entity_value:             form.entity_type === "global_" ? null : form.entity_value,
        price_half_day:           toNum(form.price_half_day),
        price_day:                toNum(form.price_day),
        price_week:               toNum(form.price_week),
        price_month:              toNum(form.price_month),
        exclude_sabbath_holidays: !!form.exclude_sabbath_holidays,
        season_id:                form.season_id || null,
        priority:                 +form.priority || 0,
        is_active:                form.is_active !== false,
      };
      if (form.id) {
        await pricingAPI.updateRule(form.id, payload);
        toast.success("כלל עודכן");
      } else {
        await pricingAPI.createRule(payload);
        toast.success("כלל נוצר");
      }
      setForm(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "שגיאה בשמירה");
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!confirm("למחוק כלל זה?")) return;
    try { await pricingAPI.deleteRule(r.id); toast.success("נמחק"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "שגיאה"); }
  };

  const ruleFor = (type, val) =>
    rules.find(r => r.entity_type === type && r.entity_value === (val ?? null) && r.is_active);
  const globalRule = ruleFor("global_", null);

  const hasOverride = (type, val) => {
    const r = ruleFor(type, val);
    return !!(r && PRICE_FIELDS.some(f => r[f.key] != null));
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div style={{
      display: "flex", overflow: "hidden", position: "relative",
      border: "1px solid #e2e8f0", borderRadius: 10,
      height: "calc(100dvh - 190px)", minHeight: 460,
    }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 25 }}
        />
      )}

      {/* ── LEFT: main panel ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", background: "#f8fafc" }}>

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 5,
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#374151",
            }}
          >
            ☰ היררכיה
          </button>
        )}

        {form ? (
          /* Edit / create panel */
          <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {form.id ? "עריכת כלל מחיר" : "כלל מחיר חדש"}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {form.entity_type === "global_"
                    ? "גלובלי"
                    : `${ENTITY_HE[form.entity_type] || ""}: ${form.entity_value || ""}`}
                </div>
              </div>
              <button
                onClick={closeForm}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, borderRadius: 4, fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <PriceRuleForm
                form={form} setForm={setForm}
                seasons={seasons} carTree={carTree} allCars={allCars}
                saving={saving} onSave={save} onCancel={closeForm}
                onDelete={form.id && canManage ? () => { remove(form); closeForm(); } : null}
                isMobile={isMobile}
              />
            </div>
          </div>
        ) : (
          /* Empty state */
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "#9ca3af", gap: 10,
            paddingTop: isMobile ? 56 : 0,
          }}>
            <div style={{
              width: 48, height: 48, border: "2px solid #e2e8f0", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>💰</div>
            <p style={{ fontSize: 13, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
              בחר כלל מחיר מהעץ להצגה ועריכה
              {canManage && <><br />או לחץ על "כלל חדש" להוספה</>}
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT: sidebar tree ──────────────────────────────────────────── */}
      <div style={{
        width: 290, background: "#fff",
        borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        ...(isMobile ? {
          position: "fixed", top: 0, bottom: 0,
          right: sidebarOpen ? 0 : -300,
          zIndex: 26,
          transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: sidebarOpen ? "-4px 0 20px rgba(0,0,0,0.15)" : "none",
          width: 280,
        } : {}),
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: "12px 14px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            הירכיה
          </span>
          {canManage && (
            <button
              onClick={() => { openNew(); closeSidebar(); }}
              style={{ ...btn("#2563eb"), padding: "5px 10px", fontSize: 12 }}
            >
              + כלל חדש
            </button>
          )}
        </div>

        {/* Global rule quick row */}
        {globalRule && (
          <div
            onClick={() => { openEdit(globalRule); closeSidebar(); }}
            style={{
              padding: "8px 14px", borderBottom: "1px solid #f3f4f6",
              cursor: "pointer", background: "#fefce8",
              display: "flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#fef9c3"}
            onMouseLeave={e => e.currentTarget.style.background = "#fefce8"}
          >
            <span style={{ flex: 1, fontSize: 12, color: "#854d0e", fontWeight: 600 }}>🌐 כלל גלובלי</span>
            <span style={{ fontSize: 10, color: "#92400e", background: "#fef3c7", padding: "1px 5px", borderRadius: 3 }}>עקיפה</span>
          </div>
        )}

        {/* Tree */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {Object.keys(carTree).length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 12, padding: 14 }}>אין רכבים מוגדרים</p>
            )}

            {Object.entries(carTree).map(([cat, models]) => {
              const isOpen    = !!openCats[cat];
              const catRule   = ruleFor("category", cat);
              const totalCars = Object.values(models).reduce((s, cars) => s + cars.length, 0);

              return (
                <div key={cat} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  {/* Category row */}
                  <div
                    style={{ display: "flex", alignItems: "center", padding: "7px 14px", gap: 5, userSelect: "none" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <span
                      style={{ flex: 1, fontWeight: 700, fontSize: 13, color: "#111827", cursor: "pointer" }}
                      onClick={() => setOpenCats(p => ({ ...p, [cat]: !p[cat] }))}
                    >
                      {cat}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onClick={() => { openEdit(catRule || { ...EMPTY_RULE, entity_type: "category", entity_value: cat }); closeSidebar(); }}
                          style={rowActionBtn} title="ערוך כלל קטגוריה"
                        >✏️</button>
                        <button
                          onClick={() => { openNew({ entity_type: "category", entity_value: cat }); closeSidebar(); }}
                          style={rowActionBtn} title="כלל חדש לקטגוריה"
                        >＋</button>
                      </>
                    )}
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                      {totalCars} כללים
                    </span>
                  </div>

                  {/* Models */}
                  {isOpen && Object.entries(models).map(([mdl, cars]) => {
                    const grpKey    = `${cat}|${mdl}`;
                    const isGrpOpen = !!openGroups[grpKey];
                    const grpRule   = ruleFor("model", mdl);

                    return (
                      <div key={mdl}>
                        {/* Model row */}
                        <div
                          style={{ display: "flex", alignItems: "center", padding: "6px 14px", paddingRight: 26, gap: 5, userSelect: "none" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                          onMouseLeave={e => e.currentTarget.style.background = ""}
                        >
                          <span
                            style={{ flex: 1, fontSize: 13, color: "#374151", cursor: "pointer" }}
                            onClick={() => setOpenGroups(p => ({ ...p, [grpKey]: !p[grpKey] }))}
                          >
                            {mdl}
                          </span>
                          {canManage && (
                            <>
                              <button
                                onClick={() => { openEdit(grpRule || { ...EMPTY_RULE, entity_type: "model", entity_value: mdl }); closeSidebar(); }}
                                style={rowActionBtn} title="ערוך כלל דגם"
                              >✏️</button>
                              <button
                                onClick={() => { openNew({ entity_type: "model", entity_value: mdl }); closeSidebar(); }}
                                style={rowActionBtn} title="כלל חדש לדגם"
                              >＋</button>
                            </>
                          )}
                          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{cars.length}</span>
                        </div>

                        {/* Car rows */}
                        {isGrpOpen && cars.map(car => {
                          const carRule       = ruleFor("car", String(car.id));
                          const carHasOverride = !!(carRule && PRICE_FIELDS.some(f => carRule[f.key] != null));
                          const isSelected    = form?.entity_type === "car" && form?.entity_value === String(car.id);

                          return (
                            <div
                              key={car.id}
                              onClick={() => { openEdit(carRule || { ...EMPTY_RULE, entity_type: "car", entity_value: String(car.id) }); closeSidebar(); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "5px 14px", paddingRight: 38,
                                cursor: "pointer", userSelect: "none",
                                background: isSelected ? "#eff6ff" : "",
                                borderRight: isSelected ? "2px solid #2563eb" : "2px solid transparent",
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f9fafb"; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ""; }}
                            >
                              <div style={{
                                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                background: isSelected ? "#2563eb" : carHasOverride ? "#f59e0b" : "#d1d5db",
                              }} />
                              <span style={{
                                flex: 1, fontSize: 12, minWidth: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                color: isSelected ? "#1d4ed8" : "#4b5563",
                              }}>
                                {car.plate}
                              </span>
                              <span style={{
                                fontSize: 10, flexShrink: 0,
                                color: carHasOverride ? "#92400e" : "#9ca3af",
                                background: carHasOverride ? "#fef3c7" : "none",
                                padding: carHasOverride ? "1px 5px" : 0,
                                borderRadius: 3,
                              }}>
                                {carHasOverride ? "עקיפה" : "יורש"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceRuleForm({ form, setForm, seasons, carTree, allCars, saving, onSave, onCancel, onDelete, isMobile }) {
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* רמת תחולה */}
      <Field label="רמת תחולה">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ENTITY_HE).map(([val, lbl]) => (
            <label key={val} style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
              <input type="radio" name="entity_type" value={val}
                     checked={form.entity_type === val}
                     onChange={() => f("entity_type", val)} />
              {lbl}
            </label>
          ))}
        </div>
      </Field>

      {/* בחירת ישות */}
      {form.entity_type === "category" && (
        <Field label="קטגוריה *">
          <select value={form.entity_value || ""} onChange={e => f("entity_value", e.target.value)} style={inp}>
            <option value="">בחר קטגוריה</option>
            {Object.keys(carTree).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </Field>
      )}
      {form.entity_type === "model" && (
        <Field label="דגם *">
          <select value={form.entity_value || ""} onChange={e => f("entity_value", e.target.value)} style={inp}>
            <option value="">בחר דגם</option>
            {[...new Set(allCars.map(c => c.name).filter(Boolean))].sort().map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      )}
      {form.entity_type === "car" && (
        <Field label="רכב *">
          <select value={form.entity_value || ""} onChange={e => f("entity_value", e.target.value)} style={inp}>
            <option value="">בחר רכב</option>
            {allCars.map(car => (
              <option key={car.id} value={String(car.id)}>
                {car.name} ({car.plate})
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* 4 שדות מחיר */}
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
          מחירים (מלא לפחות שדה אחד)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
          {PRICE_FIELDS.map(({ key, label }) => {
            const hasValue = form[key] !== "" && form[key] != null;
            return (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</label>
                <input
                  type="number" min={0.01} step={0.01}
                  value={form[key] ?? ""}
                  onChange={e => f(key, e.target.value)}
                  placeholder="יורש"
                  style={{
                    ...inp,
                    border: `1px solid ${hasValue ? "#f59e0b" : "#d1d5db"}`,
                    background: hasValue ? "#fffbeb" : "#fff",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* שורת הגדרות */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="עונה (ריק = ברירת מחדל)">
          <select value={form.season_id || ""} onChange={e => f("season_id", e.target.value ? +e.target.value : null)} style={inp}>
            <option value="">ברירת מחדל</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="עדיפות">
          <input type="number" min={0} value={form.priority || 0}
                 onChange={e => f("priority", +e.target.value)} style={inp} />
        </Field>
      </div>

      {/* exclude_sabbath_holidays */}
      <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
        <ToggleSwitch checked={!!form.exclude_sabbath_holidays}
                      onChange={v => f("exclude_sabbath_holidays", v)} />
        <span style={{ fontSize: 13, color: "#374151" }}>
          לא לחשב שבתות וחגים (ימים אסורים במלאכה)
        </span>
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={form.is_active !== false}
               onChange={e => f("is_active", e.target.checked)} />
        <span style={{ fontSize: 13, color: "#374151" }}>כלל פעיל</span>
      </label>

      <FormFooter saving={saving} onCancel={onCancel} onSave={onSave} onDelete={onDelete} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — כללי עונה (season_rules)
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_SEASON_RULE = {
  season_id: "",
  price_rule_ids: [],   // מערך — multi-select בעת יצירה
  applies_to_half_day: true,
  applies_to_day:      true,
  applies_to_week:     true,
  applies_to_month:    true,
};

const APPLIES_FIELDS = [
  { key: "applies_to_half_day", label: "חצי יום" },
  { key: "applies_to_day",      label: "יום" },
  { key: "applies_to_week",     label: "שבוע" },
  { key: "applies_to_month",    label: "חודש" },
];

function SeasonRulesTab({ canManage, isMobile }) {
  const [srules,  setSrules]  = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [prules,  setPrules]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(null);  // null=סגור | {mode:'create'|'edit', ...}
  const [saving,  setSaving]  = useState(false);
  const { allCars } = useCarTree();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, s, pr] = await Promise.all([
        pricingAPI.listSeasonRules(),
        pricingAPI.listSeasons(),
        pricingAPI.listRules({ active_only: true }),
      ]);
      setSrules(sr); setSeasons(s); setPrules(pr);
    } catch { toast.error("נכשל בטעינת כללי עונה"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // מסיר כללי-רכב שהדגם שלהם כבר מכוסה בכלל-דגם
  const deduplicatedRules = useMemo(() => {
    const modelRuleValues = new Set(
      prules.filter(r => r.entity_type === "model").map(r => r.entity_value)
    );
    return prules.filter(r => {
      if (r.entity_type !== "car") return true;
      // כשallCars עדיין לא נטען — מסתיר כל כלל-רכב (safe fallback)
      if (allCars.length === 0) return false;
      const car = allCars.find(c => String(c.id) === r.entity_value);
      if (!car) return true;
      return !modelRuleValues.has(car.name || "");
    });
  }, [prules, allCars]);

  const openNew  = () => setForm({ mode: "create", ...EMPTY_SEASON_RULE });
  const openEdit = (sr) => setForm({
    mode: "edit",
    id:   sr.id,
    season_id:           sr.season_id,
    price_rule_ids:      sr.price_rule_id ? [sr.price_rule_id] : [],
    applies_to_half_day: sr.applies_to_half_day,
    applies_to_day:      sr.applies_to_day,
    applies_to_week:     sr.applies_to_week,
    applies_to_month:    sr.applies_to_month,
  });

  const applyPayload = (overrides = {}) => ({
    season_id:           +form.season_id,
    applies_to_half_day: !!form.applies_to_half_day,
    applies_to_day:      !!form.applies_to_day,
    applies_to_week:     !!form.applies_to_week,
    applies_to_month:    !!form.applies_to_month,
    ...overrides,
  });

  const save = async () => {
    if (!form.season_id) return toast.error("חובה לבחור עונה");
    setSaving(true);
    try {
      if (form.mode === "edit") {
        const prId = form.price_rule_ids[0] ?? null;
        await pricingAPI.updateSeasonRule(form.id, applyPayload({ price_rule_id: prId ? +prId : null }));
        toast.success("כלל עונה עודכן");
      } else {
        // יצירה: אם אין בחירה ספציפית → null (כל הכללים), אחרת שורה לכל כלל נבחר
        if (form.price_rule_ids.length === 0) {
          await pricingAPI.createSeasonRule(applyPayload({ price_rule_id: null }));
        } else {
          await Promise.all(
            form.price_rule_ids.map(rid =>
              pricingAPI.createSeasonRule(applyPayload({ price_rule_id: +rid }))
            )
          );
        }
        toast.success("כלל עונה נוצר");
      }
      setForm(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "שגיאה בשמירה");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("למחוק כלל עונה זה?")) return;
    try { await pricingAPI.deleteSeasonRule(id); toast.success("נמחק"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "שגיאה"); }
  };

  const seasonName = id => seasons.find(s => s.id === id)?.name || `עונה ${id}`;
  const ruleName   = id => {
    const r = prules.find(r => r.id === id);
    if (!r) return `כלל ${id}`;
    return `${ENTITY_HE[r.entity_type] || r.entity_type}: ${r.entity_value || "גלובלי"}`;
  };

  const toggleRuleId = (id) => {
    const sid = String(id);
    setForm(p => ({
      ...p,
      price_rule_ids: p.price_rule_ids.includes(sid)
        ? p.price_rule_ids.filter(x => x !== sid)
        : [...p.price_rule_ids, sid],
    }));
  };

  const isCreateMode = form?.mode === "create";

  return (
    <div>
      {canManage && (
        <button onClick={openNew} style={btn("#2563eb")}>+ כלל עונה חדש</button>
      )}

      {loading ? <Spinner /> : (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["עונה", "כלל מחיר", "חצי יום", "יום", "שבוע", "חודש", "פעולות"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {srules.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, color: "#94a3b8", textAlign: "center" }}>
                  אין כללי עונה מוגדרים
                </td></tr>
              )}
              {srules.map(sr => (
                <tr key={sr.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}><span style={badgeStyle("#fef3c7", "#92400e")}>{seasonName(sr.season_id)}</span></td>
                  <td style={tdStyle}>{sr.price_rule_id ? ruleName(sr.price_rule_id) : <em style={{ color: "#94a3b8" }}>כל הכללים</em>}</td>
                  {APPLIES_FIELDS.map(({ key }) => (
                    <td key={key} style={{ ...tdStyle, textAlign: "center" }}>{sr[key] ? "✅" : "—"}</td>
                  ))}
                  <td style={tdStyle}>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(sr)} style={smallBtn("#e0f2fe", "#0369a1")}>✏️</button>
                        <button onClick={() => remove(sr.id)} style={smallBtn("#fef2f2", "#dc2626")}>🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)}
             title={isCreateMode ? "➕ כלל עונה חדש" : "✏️ עדכון כלל עונה"}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* עונה */}
            <Field label="עונה *">
              <select value={form.season_id}
                      onChange={e => setForm(p => ({ ...p, season_id: e.target.value }))}
                      style={inp}>
                <option value="">בחר עונה</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            {/* בחירת כללי מחיר */}
            <Field label={isCreateMode ? "כללי מחיר (ריק = כל הכללים)" : "כלל מחיר"}>
              <div style={{
                border: "1px solid #d1d5db", borderRadius: 7, maxHeight: 220,
                overflowY: "auto", background: "#fff",
              }}>
                {/* "כל הכללים" — רק בעת יצירה */}
                {isCreateMode && (
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", cursor: "pointer", fontSize: 13,
                    borderBottom: "1px solid #f1f5f9",
                    background: form.price_rule_ids.length === 0 ? "#eff6ff" : "",
                  }}>
                    <input type="checkbox"
                           checked={form.price_rule_ids.length === 0}
                           onChange={() => setForm(p => ({ ...p, price_rule_ids: [] }))} />
                    <em style={{ color: "#6b7280" }}>כל הכללים</em>
                  </label>
                )}
                {deduplicatedRules.filter(r => r.entity_type !== "model" && r.entity_type !== "car").map(r => {
                  const sid = String(r.id);
                  const checked = form.price_rule_ids.includes(sid);
                  return (
                    <label key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      borderBottom: "1px solid #f1f5f9",
                      background: checked ? "#eff6ff" : "",
                    }}>
                      <input
                        type={isCreateMode ? "checkbox" : "radio"}
                        checked={checked}
                        onChange={() => isCreateMode
                          ? toggleRuleId(r.id)
                          : setForm(p => ({ ...p, price_rule_ids: [sid] }))}
                      />
                      <span style={{ color: "#374151" }}>
                        {ENTITY_HE[r.entity_type] || r.entity_type}: {r.entity_value || "גלובלי"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {isCreateMode && form.price_rule_ids.length > 0 && (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  {form.price_rule_ids.length} נבחרו — ייווצרו {form.price_rule_ids.length} רשומות
                </div>
              )}
            </Field>

            {/* סוגי מחיר */}
            <Field label="חל על סוגי מחיר">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {APPLIES_FIELDS.map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={!!form[key]}
                           onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </Field>

            <FormFooter saving={saving} onCancel={() => setForm(null)} onSave={save} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — חגים
// ══════════════════════════════════════════════════════════════════════════════
function HolidaysTab({ canManage, isMobile }) {
  const [holidays,   setHolidays]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [form,       setForm]       = useState(null);
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    pricingAPI.listHolidays(year)
      .then(setHolidays)
      .catch(() => toast.error("נכשל בטעינת חגים"))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!confirm(`לייבא חגים לשנת ${year} אוטומטית?`)) return;
    setGenerating(true);
    try {
      const result = await pricingAPI.generateHolidays(year);
      toast.success(`נוצרו ${result.created} חגים, ${result.skipped} כבר קיימים`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "שגיאה בייבוא"); }
    finally { setGenerating(false); }
  };

  const remove = async (h) => {
    if (!confirm(`למחוק את "${h.name}"?`)) return;
    try { await pricingAPI.deleteHoliday(h.id); toast.success("נמחק"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "שגיאה"); }
  };

  const save = async () => {
    if (!form.name?.trim()) return toast.error("חובה להזין שם");
    if (!form.date)         return toast.error("חובה לבחור תאריך");
    setSaving(true);
    try {
      if (form.id) {
        await pricingAPI.updateHoliday(form.id, { name: form.name, date: form.date });
        toast.success("חג עודכן");
      } else {
        await pricingAPI.createHoliday({ name: form.name, date: form.date });
        toast.success("חג נוסף");
      }
      setForm(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "שגיאה"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {canManage && (
          <>
            <button onClick={() => setForm({ name: "", date: "" })} style={btn("#2563eb")}>+ חג ידני</button>
            <button onClick={generate} disabled={generating} style={btn("#0d9488")}>
              {generating ? "מייבא..." : `🔄 ייבוא אוטומטי ${year}`}
            </button>
          </>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: "auto" }}>
          <button onClick={() => setYear(y => y - 1)} style={smallBtn("#f1f5f9", "#475569")}>‹</button>
          <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, minWidth: 40, textAlign: "center" }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={smallBtn("#f1f5f9", "#475569")}>›</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {holidays.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✡️</div>
              <div>אין חגים לשנת {year}</div>
              {canManage && <div style={{ fontSize: 13, marginTop: 4 }}>לחץ "ייבוא אוטומטי" להוספה</div>}
            </div>
          )}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10,
          }}>
            {holidays.map(h => (
              <div key={h.id} style={{
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: 14,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {new Date(h.date).toLocaleDateString("he-IL")}
                    <span style={{ marginRight: 8, fontSize: 11, color: h.is_auto_generated ? "#0369a1" : "#15803d" }}>
                      {h.is_auto_generated ? "⚙️ אוטו" : "✋ ידני"}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setForm({ ...h })} style={smallBtn("#e0f2fe", "#0369a1")}>✏️</button>
                    <button onClick={() => remove(h)}         style={smallBtn("#fef2f2", "#dc2626")}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)}
             title={form?.id ? "✏️ עדכון חג" : "➕ הוספת חג ידני"}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="שם החג">
              <input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
            </Field>
            <Field label="תאריך">
              <input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} />
            </Field>
            <FormFooter saving={saving} onCancel={() => setForm(null)} onSave={save} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// רכיבי עזר משותפים
// ══════════════════════════════════════════════════════════════════════════════

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 0 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function FormFooter({ saving, onCancel, onSave, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
      {onDelete && (
        <button onClick={onDelete} disabled={saving}
                style={{ ...smallBtn("#fef2f2", "#dc2626"), marginLeft: "auto" }}>
          🗑 מחק כלל
        </button>
      )}
      <button onClick={onCancel} disabled={saving} style={smallBtn("#f1f5f9", "#475569")}>ביטול</button>
      <button onClick={onSave}   disabled={saving} style={btn("#2563eb")}>
        {saving ? "שומר..." : "שמור"}
      </button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: "pointer",
        background: checked ? "#2563eb" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        right: checked ? 3 : undefined,
        left:  checked ? undefined : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "all 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </div>
  );
}

function Spinner() {
  return <div style={{ color: "#94a3b8", padding: 32, textAlign: "center" }}>⏳ טוען...</div>;
}

function fmtMonthDay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── styles ────────────────────────────────────────────────────────────────────
const inp = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: "1px solid #d1d5db", fontSize: 13, direction: "rtl",
  fontFamily: "inherit", boxSizing: "border-box", outline: "none",
};

const tdStyle = { padding: "10px 12px", color: "#374151" };

const badgeStyle = (bg, color) => ({
  background: bg, color,
  padding: "2px 8px", borderRadius: 20,
  fontSize: 11, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap",
});

const btn = (bg) => ({
  background: bg, color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  whiteSpace: "nowrap",
});

const smallBtn = (bg, color) => ({
  background: bg, color, border: `1px solid ${color}30`,
  borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer",
  fontWeight: 600, whiteSpace: "nowrap",
});

const rowActionBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: "#9ca3af", padding: "2px 4px", borderRadius: 3,
  fontSize: 12, lineHeight: 1, flexShrink: 0,
};
