import { useEffect, useState, useCallback } from "react";
import { pricingAPI } from "../api/pricing";
import { toast } from "../store/toast";
import { useAuthStore } from "../store/auth";
import { Permissions } from "../permissions";
import { carsAPI } from "../api/cars";

// ── קבועים ────────────────────────────────────────────────────────────────────
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                   "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const PRICE_TYPE_HE = { daily:"יומי", half_day:"חצי יום", weekly:"שבועי", monthly:"חודשי" };
const ENTITY_HE = { car:"רכב ספציפי", group:"דגם", category:"קטגוריה", global_:"גלובלי" };

// ── כניסה לעמוד ───────────────────────────────────────────────────────────────
export default function Pricing() {
  const can = useAuthStore(s => s.can);
  const canManage = can(Permissions.PRICING_MANAGE);
  const [tab, setTab] = useState("seasons");

  // סדר חדש: חגים (ימין ביותר), אחריו כללי מחיר, כללים עונתיים, עונות
  const tabs = [
    { id:"seasons",  label:"עונות מחיר",  icon:"🗓" },
    { id:"rules",    label:"כללי מחיר",   icon:"💰" },
    { id:"seasonal", label:"כללים עונתיים", icon:"📈" },
    { id:"holidays", label:"חגים",         icon:"✡️" },
  ];

  return (
    <div dir="rtl">
      <h2 style={{ margin:"0 0 20px", color:"#1e293b", fontSize:22, fontWeight:800 }}>
        💰 ניהול מחירים
      </h2>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, borderBottom:"2px solid #e2e8f0", paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background:"none", border:"none", cursor:"pointer",
            padding:"10px 18px", fontSize:14, fontWeight:700,
            color: tab===t.id ? "#2563eb" : "#64748b",
            borderBottom: tab===t.id ? "3px solid #2563eb" : "3px solid transparent",
            marginBottom:-2, transition:"all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "seasons"  && <SeasonsTab  canManage={canManage} />}
      {tab === "rules"    && <RulesTab    canManage={canManage} />}
      {tab === "holidays" && <HolidaysTab canManage={canManage} />}
      {tab === "seasonal" && <SeasonalRulesTab canManage={canManage} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — עונות
// ══════════════════════════════════════════════════════════════════════════════
function SeasonsTab({ canManage }) {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);  // null=סגור | {}=חדש | {id,...}=עריכה
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    pricingAPI.listSeasons()
      .then(setSeasons)
      .catch(() => toast.error("נכשל בטעינת עונות"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setForm({
    name:"", start_month:7, start_day:1, end_month:8, end_day:31, is_active:true
  });

  const openEdit = (s) => setForm({ ...s });

  const save = async () => {
    if (!form.name?.trim()) return toast.error("חובה להזין שם");
    setSaving(true);
    try {
      if (form.id) {
        await pricingAPI.updateSeason(form.id, form);
        toast.success("עונה עודכנה");
      } else {
        await pricingAPI.createSeason(form);
        toast.success("עונה נוצרה");
      }
      setForm(null); load();
    } catch(e) {
      toast.error(e?.detail || "שגיאה בשמירה");
    } finally { setSaving(false); }
  };

  const toggle = async (s) => {
    try {
      await pricingAPI.updateSeason(s.id, { is_active: !s.is_active });
      load();
    } catch(e) { toast.error(e?.detail || "שגיאה"); }
  };

  const remove = async (s) => {
    if (!confirm(`למחוק את העונה "${s.name}"?`)) return;
    try {
      await pricingAPI.deleteSeason(s.id);
      toast.success("עונה בוטלה"); load();
    } catch(e) { toast.error(e?.detail || "שגיאה במחיקה"); }
  };

  const isWrapAround = (s) =>
    s.end_month < s.start_month ||
    (s.end_month === s.start_month && s.end_day < s.start_day);

  return (
    <div>
      {canManage && (
        <button onClick={openNew} style={btnStyle("#2563eb")}>
          + עונה חדשה
        </button>
      )}

      {loading ? <Spinner /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16, marginTop:16 }}>
          {seasons.length === 0 && <p style={{ color:"#94a3b8" }}>אין עונות מוגדרות</p>}
          {seasons.map(s => (
            <div key={s.id} style={{
              background:"#fff", border:`1px solid ${s.is_active ? "#bfdbfe" : "#e2e8f0"}`,
              borderRadius:12, padding:18, opacity: s.is_active ? 1 : 0.6,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:15, color:"#1e293b" }}>{s.name}</div>
                  <div style={{ marginTop:6, fontSize:13, color:"#475569" }}>
                    {s.start_day}/{MONTHS_HE[s.start_month-1]} → {s.end_day}/{MONTHS_HE[s.end_month-1]}
                    {isWrapAround(s) && (
                      <span style={{ marginRight:6, background:"#fef3c7", color:"#92400e",
                        padding:"1px 6px", borderRadius:4, fontSize:11 }}>חוצת שנה</span>
                    )}
                  </div>
                </div>
                <span style={{
                  background: s.is_active ? "#dcfce7" : "#f1f5f9",
                  color: s.is_active ? "#166534" : "#64748b",
                  padding:"3px 8px", borderRadius:20, fontSize:12, fontWeight:700,
                }}>
                  {s.is_active ? "פעיל" : "לא פעיל"}
                </span>
              </div>
              {canManage && (
                <div style={{ display:"flex", gap:8, marginTop:14 }}>
                  <button onClick={() => openEdit(s)} style={smallBtn("#e0f2fe","#0369a1")}>✏️ ערוך</button>
                  <button onClick={() => toggle(s)} style={smallBtn("#f0fdf4","#16a34a")}>
                    {s.is_active ? "השבת" : "הפעל"}
                  </button>
                  <button onClick={() => remove(s)} style={smallBtn("#fef2f2","#dc2626")}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal עריכה/יצירה */}
      {form !== null && (
        <ModalOverlay onClose={() => setForm(null)}>
          <h3 style={{ margin:"0 0 16px", color:"#1e293b" }}>
            {form.id ? "✏️ עדכון עונה" : "➕ עונה חדשה"}
          </h3>
          <Field label="שם">
            <input value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} style={inputStyle} />
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="חודש התחלה">
              <MonthSelect value={form.start_month} onChange={v=>setForm({...form,start_month:+v})} />
            </Field>
            <Field label="יום התחלה">
              <input type="number" min={1} max={31} value={form.start_day||1}
                onChange={e=>setForm({...form,start_day:+e.target.value})} style={inputStyle} />
            </Field>
            <Field label="חודש סיום">
              <MonthSelect value={form.end_month} onChange={v=>setForm({...form,end_month:+v})} />
            </Field>
            <Field label="יום סיום">
              <input type="number" min={1} max={31} value={form.end_day||1}
                onChange={e=>setForm({...form,end_day:+e.target.value})} style={inputStyle} />
            </Field>
          </div>
          {isWrapAround(form) && (
            <div style={{ background:"#fef3c7", color:"#92400e", padding:"8px 12px",
              borderRadius:8, fontSize:13, marginTop:8 }}>
              ⚠️ עונה חוצת שנה ({form.start_day}/{MONTHS_HE[form.start_month-1]} → {form.end_day}/{MONTHS_HE[form.end_month-1]})
            </div>
          )}
          <ModalFooter saving={saving} onCancel={()=>setForm(null)} onSave={save} />
        </ModalOverlay>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — כללי מחיר
// ══════════════════════════════════════════════════════════════════════════════
function RulesTab({ canManage }) {
  const [rules, setRules]   = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  // שימוש ב-hook לטעינת carTree
  const { carTree } = useCarTree();

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

  const seasonName = (id) => id ? (seasons.find(s=>s.id===id)?.name || `עונה ${id}`) : "ברירת מחדל";

  const openNew = () => setForm({
    name:"", entity_type:"category", entity_value:"",
    price_type:"daily", price:"", season_id:null, priority:0, is_active:true
  });

  const save = async () => {
    if (!form.price || isNaN(+form.price) || +form.price <= 0) return toast.error("מחיר לא תקין");
    if (form.entity_type !== "global_" && !form.entity_value?.trim()) return toast.error("חובה להזין ערך זיהוי");
    setSaving(true);
    try {
      const payload = { ...form, price: +form.price };
      if (form.id) { await pricingAPI.updateRule(form.id, { price:+form.price, priority:+form.priority, is_active:form.is_active }); toast.success("כלל עודכן"); }
      else { await pricingAPI.createRule(payload); toast.success("כלל נוצר"); }
      setForm(null); load();
    } catch(e) {
      toast.error(e?.detail || "שגיאה בשמירה");
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!confirm("למחוק כלל זה?")) return;
    try { await pricingAPI.deleteRule(r.id); toast.success("נמחק"); load(); }
    catch(e) { toast.error(e?.detail || "שגיאה"); }
  };

  const filteredRules = filterType === "all" ? rules :
    rules.filter(r => r.entity_type === filterType);

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        {canManage && <button onClick={openNew} style={btnStyle("#2563eb")}>+ כלל חדש</button>}
        <div style={{ display:"flex", gap:6 }}>
          {["all","global_","category","group","car"].map(t => (
            <button key={t} onClick={()=>setFilterType(t)} style={{
              ...smallBtn(filterType===t?"#dbeafe":"#f1f5f9", filterType===t?"#1d4ed8":"#475569"),
              fontWeight: filterType===t ? 800 : 600,
            }}>
              {t==="all" ? "הכל" : ENTITY_HE[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                {["רמה","ערך","סוג מחיר","מחיר","עונה","עדיפות","סטטוס","פעולות"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"right", color:"#475569", fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 && (
                <tr><td colSpan={8} style={{ padding:16, color:"#94a3b8", textAlign:"center" }}>אין כללים</td></tr>
              )}
              {filteredRules.map(r => (
                <tr key={r.id} style={{ borderBottom:"1px solid #f1f5f9", opacity:r.is_active?1:0.5 }}>
                  <td style={td}><span style={badge("#e0f2fe","#0369a1")}>{ENTITY_HE[r.entity_type]||r.entity_type}</span></td>
                  <td style={td}>{r.entity_value || <em style={{color:"#94a3b8"}}>—</em>}</td>
                  <td style={td}><span style={badge("#f0fdf4","#15803d")}>{PRICE_TYPE_HE[r.price_type]||r.price_type}</span></td>
                  <td style={{...td, fontWeight:800, color:"#1e293b"}}>₪{r.price.toLocaleString()}</td>
                  <td style={td}>{r.season_id ? <span style={badge("#fef3c7","#92400e")}>{seasonName(r.season_id)}</span> : <span style={badge("#f8fafc","#94a3b8")}>ברירת מחדל</span>}</td>
                  <td style={{...td, textAlign:"center"}}>{r.priority}</td>
                  <td style={td}>
                    <span style={badge(r.is_active?"#dcfce7":"#f1f5f9", r.is_active?"#166534":"#64748b")}>
                      {r.is_active ? "פעיל" : "כבוי"}
                    </span>
                  </td>
                  <td style={td}>
                    {canManage && (
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>setForm({...r, price:`${r.price}`})} style={smallBtn("#e0f2fe","#0369a1")}>✏️</button>
                        <button onClick={()=>remove(r)} style={smallBtn("#fef2f2","#dc2626")}>🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form !== null && (
        <ModalOverlay onClose={()=>setForm(null)}>
          <h3 style={{ margin:"0 0 16px", color:"#1e293b" }}>
            {form.id ? "✏️ עדכון כלל" : "➕ כלל מחיר חדש"}
          </h3>

          {!form.id && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="רמה">
                  <select value={form.entity_type} onChange={e=>setForm({...form,entity_type:e.target.value,entity_value:""})} style={inputStyle}>
                    {Object.entries(ENTITY_HE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="סוג מחיר">
                  <select value={form.price_type} onChange={e=>setForm({...form,price_type:e.target.value})} style={inputStyle}>
                    {Object.entries(PRICE_TYPE_HE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>

              {form.entity_type !== "global_" && (
                <Field label={form.entity_type==="car" ? "בחר רכב" : form.entity_type==="model" ? "בחר דגם" : "שם קטגוריה"}>
                  {form.entity_type === "category" && (
                    <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
                      <option value="">בחר קטגוריה</option>
                      {(carTree && Object.keys(carTree).length > 0 ? Object.keys(carTree) : []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {(!carTree || Object.keys(carTree).length === 0) && <option disabled>אין קטגוריות זמינות</option>}
                    </select>
                  )}
                  {form.entity_type === "group" && (
                    <>
                      <select value={form.category||""} onChange={e=>setForm({...form,category:e.target.value,entity_value:""})} style={inputStyle}>
                        <option value="">בחר קטגוריה</option>
                        {(carTree && Object.keys(carTree).length > 0 ? Object.keys(carTree) : []).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {form.category && (
                        <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
                          <option value="">בחר דגם</option>
                          {carTree[form.category] && Object.keys(carTree[form.category]).map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                          {(!carTree[form.category] || Object.keys(carTree[form.category]).length === 0) && <option disabled>אין דגמים זמינים</option>}
                        </select>
                      )}
                    </>
                  )}
                  {form.entity_type === "car" && (
                    <>
                      <select value={form.category||""} onChange={e=>setForm({...form,category:e.target.value,model:"",entity_value:""})} style={inputStyle}>
                        <option value="">בחר קטגוריה</option>
                        {(carTree && Object.keys(carTree).length > 0 ? Object.keys(carTree) : []).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {form.category && (
                        <select value={form.model||""} onChange={e=>setForm({...form,model:e.target.value,entity_value:""})} style={inputStyle}>
                          <option value="">בחר דגם</option>
                          {carTree[form.category] && Object.keys(carTree[form.category]).map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                          {(!carTree[form.category] || !carTree[form.category][form.model] || carTree[form.category][form.model].length === 0) && <option disabled>אין רכבים זמינים</option>}
                        </select>
                      )}
                      {form.category && form.model && (
                        <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
                          <option value="">בחר רכב</option>
                          {carTree[form.category] && carTree[form.category][form.model] && carTree[form.category][form.model].map(car => (
                            <option key={car.plate} value={car.plate}>{car.name} ({car.plate})</option>
                          ))}
                          {(!carTree[form.category] || !carTree[form.category][form.model] || carTree[form.category][form.model].length === 0) && <option disabled>אין רכבים זמינים</option>}
                        </select>
                      )}
                    </>
                  )}
                </Field>
              )}

              <Field label="עונה (ריק = ברירת מחדל)">
                <select value={form.season_id||""} onChange={e=>setForm({...form,season_id:e.target.value?+e.target.value:null})} style={inputStyle}>
                  <option value="">ברירת מחדל (ללא עונה)</option>
                  {seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="מחיר (₪)">
              <input type="number" min={0.01} step={0.01} value={form.price||""} onChange={e=>setForm({...form,price:e.target.value})} style={inputStyle} />
            </Field>
            <Field label="עדיפות (גבוה=מנצח)">
              <input type="number" min={0} value={form.priority||0} onChange={e=>setForm({...form,priority:+e.target.value})} style={inputStyle} />
            </Field>
          </div>

          <Field label="">
            <label style={{ display:"flex", gap:8, alignItems:"center", cursor:"pointer" }}>
              <input type="checkbox" checked={!!form.is_active}
                onChange={e=>setForm({...form,is_active:e.target.checked})} />
              <span style={{ fontSize:13, color:"#374151" }}>כלל פעיל</span>
            </label>
          </Field>

          <ModalFooter saving={saving} onCancel={()=>setForm(null)} onSave={save} />
        </ModalOverlay>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — חגים
// ══════════════════════════════════════════════════════════════════════════════
function HolidaysTab({ canManage }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [year, setYear]         = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);

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
    } catch(e) {
      toast.error(e?.detail || "שגיאה בייבוא חגים");
    } finally { setGenerating(false); }
  };

  const remove = async (h) => {
    if (!confirm(`למחוק את "${h.name}" (${h.date})?`)) return;
    try { await pricingAPI.deleteHoliday(h.id); toast.success("נמחק"); load(); }
    catch(e) { toast.error(e?.detail || "שגיאה"); }
  };

  const save = async () => {
    if (!form.name?.trim()) return toast.error("חובה להזין שם");
    if (!form.date) return toast.error("חובה לבחור תאריך");
    setSaving(true);
    try {
      if (form.id) {
        await pricingAPI.updateHoliday(form.id, { name:form.name, date:form.date });
        toast.success("חג עודכן");
      } else {
        await pricingAPI.createHoliday({ name:form.name, date:form.date });
        toast.success("חג נוסף");
      }
      setForm(null); load();
    } catch(e) {
      toast.error(e?.detail || "שגיאה");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:16 }}>
        {canManage && (
          <>
            <button onClick={()=>setForm({name:"",date:""})} style={btnStyle("#2563eb")}>+ חג ידני</button>
            <button onClick={generate} disabled={generating} style={btnStyle("#0d9488")}>
              {generating ? "מייבא..." : `🔄 ייבוא אוטומטי ${year}`}
            </button>
          </>
        )}
        <div style={{ display:"flex", gap:6, alignItems:"center", marginRight:"auto" }}>
          <button onClick={()=>setYear(y=>y-1)} style={smallBtn("#f1f5f9","#475569")}>‹</button>
          <span style={{ fontWeight:700, color:"#1e293b", fontSize:15 }}>{year}</span>
          <button onClick={()=>setYear(y=>y+1)} style={smallBtn("#f1f5f9","#475569")}>›</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div>
          {holidays.length === 0 && (
            <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✡️</div>
              <div>אין חגים לשנת {year}</div>
              {canManage && <div style={{ fontSize:13, marginTop:4 }}>לחץ "ייבוא אוטומטי" להוספה</div>}
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {holidays.map(h => (
              <div key={h.id} style={{
                background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:14,
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <div>
                  <div style={{ fontWeight:700, color:"#1e293b", fontSize:14 }}>{h.name}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>
                    {new Date(h.date).toLocaleDateString("he-IL")}
                    <span style={{
                      marginRight:8, fontSize:11,
                      color: h.is_auto_generated ? "#0369a1" : "#15803d",
                    }}>
                      {h.is_auto_generated ? "⚙️ אוטו" : "✋ ידני"}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>setForm({...h})} style={smallBtn("#e0f2fe","#0369a1")}>✏️</button>
                    <button onClick={()=>remove(h)} style={smallBtn("#fef2f2","#dc2626")}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {form !== null && (
        <ModalOverlay onClose={()=>setForm(null)}>
          <h3 style={{ margin:"0 0 16px", color:"#1e293b" }}>
            {form.id ? "✏️ עדכון חג" : "➕ הוספת חג ידני"}
          </h3>
          <Field label="שם החג">
            <input value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} style={inputStyle} />
          </Field>
          <Field label="תאריך">
            <input type="date" value={form.date||""} onChange={e=>setForm({...form,date:e.target.value})} style={inputStyle} />
          </Field>
          <ModalFooter saving={saving} onCancel={()=>setForm(null)} onSave={save} />
        </ModalOverlay>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — כללים עונתיים
// ══════════════════════════════════════════════════════════════════════════════
function SeasonalRulesTab({ canManage }) {
  const [rules, setRules] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null=סגור | {}=חדש | {id,...}=עריכה
  const [saving, setSaving] = useState(false);
  const { carTree } = useCarTree();

  const load = useCallback(async () => {
    setLoading(true);
    Promise.all([
      pricingAPI.listSeasonalRules(),
      pricingAPI.listSeasons()
    ])
      .then(([rules, seasons]) => {
        setRules(rules);
        setSeasons(seasons);
      })
      .catch(() => toast.error("נכשל בטעינת כללים עונתיים"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

   const openNew = () => setForm({
     season_id: "",
     entity_type: "global_",
     entity_value: "",
     rule_type: "discount_percent",
     value: "",
     is_active: true
   });

  const openEdit = (r) => setForm({ ...r });

   const save = async () => {
     // ולידציה קשיחה
     if (!form.season_id || isNaN(+form.season_id)) return toast.error("חובה לבחור עונה");
     if (form.entity_type !== "global_" && !form.entity_value) return toast.error("חובה לבחור ערך ישות");
     if (form.value === "" || isNaN(+form.value)) return toast.error("ערך חובה (מספר)");
     setSaving(true);
     try {
       // שלח רק שדות רלוונטיים, ודא המרה ל-int/float
       const payload = {
         season_id: +form.season_id,
         entity_type: form.entity_type,
         entity_value: form.entity_type === "global_" ? null : form.entity_value,
         rule_type: form.rule_type,
         value: +form.value,
         is_active: form.is_active,
       };
       if (form.id) {
         await pricingAPI.updateSeasonalRule(form.id, payload);
         toast.success("כלל עודכן");
       } else {
         await pricingAPI.createSeasonalRule(payload);
         toast.success("כלל נוצר");
       }
       setForm(null);
       // רענון
       setLoading(true);
       const rules = await pricingAPI.listSeasonalRules();
       setRules(rules);
     } catch(e) {
       toast.error(e?.detail || "שגיאה בשמירה");
     } finally { setSaving(false); }
   };

  const remove = async (r) => {
    if (!confirm("למחוק את הכלל?")) return;
    try {
      await pricingAPI.deleteSeasonalRule(r.id);
      toast.success("כלל נמחק");
      setRules(rules => rules.filter(x => x.id !== r.id));
    } catch(e) { toast.error(e?.detail || "שגיאה במחיקה"); }
  };

  // פונקציה להצגת ערך ישות היררכי
  function EntityValuePicker({ form, setForm, carTree }) {
    if (form.entity_type === "global_") return null;
    if (form.entity_type === "category") {
      return (
        <Field label="קטגוריה">
          <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
            <option value="">בחר קטגוריה</option>
            {Object.keys(carTree).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </Field>
      );
    }
    if (form.entity_type === "group") {
      return (
        <>
          <Field label="קטגוריה">
            <select value={form.category||""} onChange={e=>setForm({...form,category:e.target.value,entity_value:""})} style={inputStyle}>
              <option value="">בחר קטגוריה</option>
              {Object.keys(carTree).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </Field>
          {form.category && (
            <Field label="דגם">
              <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
                <option value="">בחר דגם</option>
                {Object.keys(carTree[form.category]||{}).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </Field>
          )}
        </>
      );
    }
    if (form.entity_type === "car") {
      return (
        <>
          <Field label="קטגוריה">
            <select value={form.category||""} onChange={e=>setForm({...form,category:e.target.value,model:"",entity_value:""})} style={inputStyle}>
              <option value="">בחר קטגוריה</option>
              {Object.keys(carTree).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </Field>
          {form.category && (
            <Field label="דגם">
              <select value={form.model||""} onChange={e=>setForm({...form,model:e.target.value,entity_value:""})} style={inputStyle}>
                <option value="">בחר דגם</option>
                {Object.keys(carTree[form.category]||{}).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </Field>
          )}
          {form.category && form.model && (
            <Field label="רכב">
              <select value={form.entity_value||""} onChange={e=>setForm({...form,entity_value:e.target.value})} style={inputStyle}>
                <option value="">בחר רכב</option>
                {(carTree[form.category]?.[form.model]||[]).map(car => (
                  <option key={car.plate} value={car.plate}>{car.name} ({car.plate})</option>
                ))}
              </select>
            </Field>
          )}
        </>
      );
    }
    return null;
  }

  // פונקציה להצגת preview של הכלל
  function RulePreview({ form, seasons }) {
    if (!form) return null;
    const season = seasons.find(s => s.id === form.season_id)?.name || "[לא נבחרה עונה]";
    let entity = "";
    if (form.entity_type === "global_") entity = "כלל גלובלי";
    if (form.entity_type === "category") entity = `קטגוריה: ${form.entity_value||"[לא נבחרה]"}`;
    if (form.entity_type === "group") entity = form.category ? `דגם: ${form.entity_value||"[לא נבחר]"} (קטגוריה: ${form.category})` : "[בחר קטגוריה ודגם]";
    if (form.entity_type === "car") entity = form.category && form.model ? `רכב: ${form.entity_value||"[לא נבחר]"} (דגם: ${form.model}, קטגוריה: ${form.category})` : "[בחר קטגוריה, דגם ורכב]";
    const ruleTypeHe = {
      discount_percent: "הנחה באחוזים",
      discount_fixed: "הנחה קבועה",
      surcharge_percent: "תוספת באחוזים",
      surcharge_fixed: "תוספת קבועה"
    }[form.rule_type] || form.rule_type;
    return (
      <div style={{ background: "#f1f5f9", borderRadius: 8, padding: 12, margin: "12px 0", fontSize: 14 }}>
        <b>סיכום הכלל:</b> בעונה <b>{season}</b>, <b>{entity}</b>, <b>{ruleTypeHe}</b> <b>{form.value}</b> ({form.is_active ? "פעיל" : "לא פעיל"})
      </div>
    );
  }

  // פונקציה להצגת אימפקט בפועל (preview)
  function EffectivePricePreview() {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState({ season_id: "", entity_type: "global_", entity_value: "" });
    const { carTree } = useCarTree();
    const [error, setError] = useState("");

    const fetchPrice = async () => {
      setLoading(true); setError("");
      if (!params.season_id || isNaN(+params.season_id)) {
        setError("חובה לבחור עונה"); setLoading(false); return;
      }
      if (params.entity_type !== "global_" && !params.entity_value) {
        setError("חובה לבחור ערך ישות"); setLoading(false); return;
      }
      try {
        const payload = {
          ...params,
          season_id: +params.season_id,
        };
        if (["car"].includes(params.entity_type) && params.entity_value && !isNaN(+params.entity_value)) {
          payload.entity_value = +params.entity_value;
        }
        const res = await pricingAPI.effectiveEntityPrice(payload);
        setPreview(res);
      } catch(e) {
        setError(e?.detail || "שגיאה בחישוב");
        setPreview(null);
      } finally { setLoading(false); }
    };

    return (
      <div style={{ background: "#f1f5f9", borderRadius: 8, padding: 16, margin: "24px 0" }}>
        <b>בדיקת מחיר בפועל:</b>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
          <select value={params.season_id} onChange={e=>setParams(p=>({...p,season_id:e.target.value}))} style={inputStyle}>
            <option value="">בחר עונה</option>
            {seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={params.entity_type} onChange={e=>setParams(p=>({...p,entity_type:e.target.value,entity_value:""}))} style={inputStyle}>
            <option value="global_">גלובלי</option>
            <option value="category">קטגוריה</option>
            <option value="group">דגם</option>
            <option value="car">רכב</option>
          </select>
          {params.entity_type === "category" && (
            <select value={params.entity_value} onChange={e=>setParams(p=>({...p,entity_value:e.target.value}))} style={inputStyle}>
              <option value="">בחר קטגוריה</option>
              {Object.keys(carTree).map(cat=><option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}
          {params.entity_type === "group" && (
            <>
              <select value={params.category||""} onChange={e=>setParams(p=>({...p,category:e.target.value,entity_value:""}))} style={inputStyle}>
                <option value="">בחר קטגוריה</option>
                {Object.keys(carTree).map(cat=><option key={cat} value={cat}>{cat}</option>)}
              </select>
              {params.category && (
                <select value={params.entity_value} onChange={e=>setParams(p=>({...p,entity_value:e.target.value}))} style={inputStyle}>
                  <option value="">בחר דגם</option>
                  {Object.keys(carTree[params.category]||{}).map(model=><option key={model} value={model}>{model}</option>)}
                </select>
              )}
            </>
          )}
          {params.entity_type === "car" && (
            <>
              <select value={params.category||""} onChange={e=>setParams(p=>({...p,category:e.target.value,model:"",entity_value:""}))} style={inputStyle}>
                <option value="">בחר קטגוריה</option>
                {Object.keys(carTree).map(cat=><option key={cat} value={cat}>{cat}</option>)}
              </select>
              {params.category && (
                <select value={params.model||""} onChange={e=>setParams(p=>({...p,model:e.target.value,entity_value:""}))} style={inputStyle}>
                  <option value="">בחר דגם</option>
                  {Object.keys(carTree[params.category]||{}).map(model=><option key={model} value={model}>{model}</option>)}
                </select>
              )}
              {params.category && params.model && (
                <select value={params.entity_value} onChange={e=>setParams(p=>({...p,entity_value:e.target.value}))} style={inputStyle}>
                  <option value="">בחר רכב</option>
                  {(carTree[params.category]?.[params.model]||[]).map(car=>(
                    <option key={car.plate} value={car.plate}>{car.name} ({car.plate})</option>
                  ))}
                </select>
              )}
            </>
          )}
          <button onClick={fetchPrice} disabled={loading || !params.season_id || (params.entity_type!=="global_" && !params.entity_value)} style={btnStyle("#2563eb")}>חשב מחיר</button>
        </div>
        {loading && <div>⏳ מחשב...</div>}
        {error && <div style={{ color:"#dc2626" }}>{error}</div>}
        {preview && (
          <div style={{ background: "#fff", borderRadius: 8, padding: 12, marginTop: 10, fontSize: 15 }}>
            <b>מחיר בפועל:</b> ₪{preview.total_price?.toLocaleString()}
            {preview.breakdown && preview.breakdown.length > 0 && (
              <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>
                {preview.breakdown.map((b,i)=>(
                  <div key={i}>{b.label}</div>
                ))}
              </div>
            )}
            {preview.note && <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>{preview.note}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {canManage && (
        <button onClick={openNew} style={btnStyle("#2563eb")}>+ כלל עונתי חדש</button>
      )}
      <EffectivePricePreview />
      {loading ? <Spinner /> : (
        <table style={{ width:"100%", marginTop:16, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f1f5f9" }}>
              <th>עונה</th>
              <th>סוג ישות</th>
              <th>ערך ישות</th>
              <th>סוג כלל</th>
              <th>ערך</th>
              <th>פעיל</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr><td colSpan={7} style={{ color:"#94a3b8", textAlign:"center" }}>אין כללים עונתיים</td></tr>
            )}
            {rules.map(r => (
              <tr key={r.id} style={{ background: r.is_active ? "#fff" : "#f1f5f9" }}>
                <td>{seasons.find(s => s.id === r.season_id)?.name || r.season_id}</td>
                <td>{ENTITY_HE[r.entity_type]}</td>
                <td>{r.entity_value || "-"}</td>
                <td>{r.rule_type}</td>
                <td>{formatRuleValue(r.rule_type, r.value)}</td>
                <td>{r.is_active ? "כן" : "לא"}</td>
                <td>
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(r)} style={smallBtn("#e0f2fe","#0369a1")}>ערוך</button>
                      <button onClick={() => remove(r)} style={smallBtn("#fef2f2","#dc2626")}>מחק</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Modal עריכה/יצירה */}
      {form !== null && (
        <ModalOverlay onClose={() => setForm(null)}>
          <h3 style={{ margin:"0 0 16px", color:"#1e293b" }}>
            {form.id ? "✏️ עדכון כלל עונתי" : "➕ כלל עונתי חדש"}
          </h3>
          <Field label="עונה">
            <select value={form.season_id} onChange={e=>setForm({...form,season_id:+e.target.value})} style={inputStyle}>
              <option value="">בחר עונה</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="סוג ישות">
            <select value={form.entity_type} onChange={e=>setForm({...form,entity_type:e.target.value,entity_value:"",category:"",model:""})} style={inputStyle}>
              <option value="car">רכב ספציפי</option>
              <option value="group">דגם</option>
              <option value="category">קטגוריה</option>
              <option value="global_">גלובלי</option>
            </select>
          </Field>
          <EntityValuePicker form={form} setForm={setForm} carTree={carTree} />
          <Field label="סוג כלל">
            <select value={form.rule_type} onChange={e=>setForm({...form,rule_type:e.target.value})} style={inputStyle}>
              <option value="discount_percent">הנחה באחוזים</option>
              <option value="discount_fixed">הנחה קבועה</option>
              <option value="surcharge_percent">תוספת באחוזים</option>
              <option value="surcharge_fixed">תוספת קבועה</option>
            </select>
          </Field>
           <Field label="ערך">
             <input type="number" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} style={inputStyle} />
           </Field>
          <Field label="פעיל">
            <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})} />
          </Field>
          <RulePreview form={form} seasons={seasons} />
          <div style={{ display:"flex", gap:8, marginTop:18 }}>
            <button onClick={save} disabled={saving} style={btnStyle("#2563eb")}>שמור</button>
            <button onClick={()=>setForm(null)} style={btnStyle("#e5e7eb","#334155")}>ביטול</button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ══��═══════════════════════════════════════════════════════════════════════════
// רכיבי עזר
// ══════════════════════════════════════════════════════════════════��═══════════

function MonthSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={inputStyle}>
      {MONTHS_HE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
    </select>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#374151", marginBottom:4 }}>{label}</label>}
      {children}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(15,23,42,0.5)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:"#fff", borderRadius:14, padding:24,
        width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", direction:"rtl",
      }}>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ saving, onCancel, onSave }) {
  return (
    <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
      <button onClick={onCancel} disabled={saving} style={smallBtn("#f1f5f9","#475569")}>ביטו��</button>
      <button onClick={onSave}   disabled={saving} style={btnStyle("#2563eb")}>
        {saving ? "שומר..." : "שמור"}
      </button>
    </div>
  );
}

function Spinner() {
  return <div style={{ color:"#94a3b8", padding:24, textAlign:"center" }}>⏳ טוען...</div>;
}

// ── styles ────────────────────────────────────────────────────────────────────
const inputStyle = {
  width:"100%", padding:"8px 10px", borderRadius:7,
  border:"1px solid #d1d5db", fontSize:13, direction:"rtl",
  fontFamily:"inherit", boxSizing:"border-box",
};

const td = { padding:"10px 12px", color:"#374151" };

const badge = (bg, color) => ({
  background:bg, color, padding:"2px 8px", borderRadius:20,
  fontSize:12, fontWeight:700, display:"inline-block",
});

const btnStyle = (bg) => ({
  background:bg, color:"#fff", border:"none", borderRadius:8,
  padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer",
});

const smallBtn = (bg, color) => ({
  background:bg, color, border:`1px solid ${color}30`,
  borderRadius:7, padding:"5px 10px", fontSize:12, cursor:"pointer", fontWeight:600,
});

// טען רכבים ובנה עץ היררכי
function loadCars() {
  carsAPI.list().then((data) => {
    setCars(data);
    // בניית עץ היררכי: { [category]: { [group]: [cars] } }
    const tree = {};
    data.forEach(car => {
      const cat = car.category || "ללא קטגוריה";
      const model = car.model || car.group || "ללא דגם";
      if (!tree[cat]) tree[cat] = {};
      if (!tree[cat][model]) tree[cat][model] = [];
      tree[cat][model].push(car);
    });
    setCarTree(tree);
  });
}


// hook מותאם אישית לטעינת רכבים ובניית עץ היררכי
import { useEffect as useEffectReact } from "react";
function useCarTree() {
  const [cars, setCars] = useState([]);
  const [carTree, setCarTree] = useState({}); // היררכיה: קטגוריה > קבוצה > רכבים
  useEffectReact(() => {
    carsAPI.list().then((data) => {
      setCars(data);
      // בניית עץ היררכי: { [category]: { [model]: [cars] } }
      const tree = {};
      data.forEach(car => {
        const cat = car.category || "ללא קטגוריה";
        const model = car.name || "ללא דגם";
        if (!tree[cat]) tree[cat] = {};
        if (!tree[cat][model]) tree[cat][model] = [];
        tree[cat][model].push(car);
      });
      setCarTree(tree);
    });
  }, []);
  return { cars, carTree };
}

// Add helper for value display
function formatRuleValue(rule_type, value) {
  if (rule_type === "discount_percent") return `-${value}%`;
  if (rule_type === "discount_fixed") return `-${value}₪`;
  if (rule_type === "surcharge_percent") return `+${value}%`;
  if (rule_type === "surcharge_fixed") return `+${value}₪`;
  return value;
}
