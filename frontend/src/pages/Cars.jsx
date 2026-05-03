import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFacingErrorMessage } from "../api/errors";
import { carsAPI } from "../api/cars";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";
import { Permissions } from "../permissions";
import { settingsAPI } from "../api/settings";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import Confirm from "../components/ui/Confirm";

const CAR_TYPES = [
  { value: "sedan",     label: "סדאן",      emoji: "🚗" },
  { value: "crossover", label: "קרוסאובר",  emoji: "🚙" },
  { value: "suv",       label: "SUV",        emoji: "🏎" },
  { value: "hatchback", label: "האצ׳בק",    emoji: "🚗" },
  { value: "mini",      label: "מיני",       emoji: "🚕" },
  { value: "hybrid",    label: "היברידי",    emoji: "🌿" },
  { value: "electric",  label: "חשמלי",      emoji: "⚡" },
  { value: "luxury",    label: "יוקרה",      emoji: "💎" },
  { value: "van",       label: "ואן",        emoji: "🚐" },
];
const typeMap = Object.fromEntries(CAR_TYPES.map(t => [t.value, t]));

const EMPTY_FORM = { 
  name:"", category:"", is_hybrid: false, year: new Date().getFullYear(),
  plate:"", color:"", price_per_day:"", test_date: "", description:"", image_url:"" 
};

export default function Cars() {
  const navigate = useNavigate();
  const [cars, setCars]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState("all");
  const [modal, setModal]       = useState(null);   // null | "create" | "edit"
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(null);
  const [editCar, setEditCar]   = useState(null);
  const [categories, setCategories] = useState([]);
  const [openFolders, setOpenFolders] = useState({}); // { categoryName: boolean }
  const canManageCars = useAuthStore(s => s.can(Permissions.CARS_MANAGE));
  const canDeleteCars = useAuthStore(s => s.can(Permissions.CARS_DELETE));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [carsList, settingsRes] = await Promise.all([
        carsAPI.list({ active_only: false }),
        settingsAPI.get("category_hierarchy").catch(() => ({ value: [] }))
      ]);
      setCars(carsList || []);
      const cats = settingsRes.value || [];
      setCategories(cats);
      
      // Open all folders by default
      const initialFolders = { "unassigned": true };
      cats.forEach(c => initialFolders[c.name] = true);
      setOpenFolders(initialFolders);
    } catch (e) {
      toast.error("נכשל בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cars.filter(c => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.name.includes(search) && !c.plate.includes(search)) return false;
    return true;
  });

  function openCreate() {
    setForm(EMPTY_FORM); setEditCar(null); setFormError(""); setModal("create");
  }
  function openEdit(car) {
    setForm({ 
      name: car.name, 
      category: car.category || "", 
      is_hybrid: !!car.is_hybrid,
      year: car.year, 
      plate: car.plate,
      color: car.color||"", 
      price_per_day: car.price_per_day || "",
      test_date: car.test_date || "",
      description: car.description||"", 
      image_url: car.image_url||"" 
    });
    setEditCar(car); setFormError(""); setModal("edit");
  }
  function closeModal() { setModal(null); setEditCar(null); }

  async function handleSave() {
    if (!form.name.trim())  return setFormError("יש להזין שם רכב");
    if (!form.plate.trim()) return setFormError("יש להזין לוחית רישוי");
    if (!form.price_per_day || +form.price_per_day <= 0) return setFormError("מחיר לא תקין");
    setSaving(true); setFormError("");
    try {
      const data = { 
        ...form, 
        year: +form.year, 
        price_per_day: form.price_per_day ? +form.price_per_day : null 
      };
      if (modal === "create") await carsAPI.create(data);
      else await carsAPI.update(editCar.id, data);
      await load(); closeModal();
      toast.success(modal === "create" ? "הרכב נוסף בהצלחה" : "פרטי הרכב עודכנו בהצלחה");
    } catch (e) {
      setFormError(getUserFacingErrorMessage(e));
    } finally { setSaving(false); }
  }

  async function handlePermanentDelete(car) {
    try {
      await carsAPI.deletePermanent(car.id);
      await load();
      toast.success("הרכב נמחק לצמיתות");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e), { title: "לא ניתן למחוק רכב לצמיתות" });
    } finally { setConfirmPermanentDelete(null); }
  }

  async function toggleActive(car) {
    try {
      await carsAPI.update(car.id, { is_active: !car.is_active });
      await load();
      toast.success(car.is_active ? "הרכב הושבת" : "הרכב הופעל מחדש");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    }
  }

  if (loading) return <Loader />;

  return (
    <div dir="rtl">
      {/* Header */}
      <div style={s.pageHeader}>
        <h1 style={s.h1}>ניהול רכבים</h1>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input placeholder="🔍 חיפוש שם / לוחית..." value={search}
            onChange={e => setSearch(e.target.value)} style={s.searchInput} />
          <select value={typeFilter} onChange={e => setType(e.target.value)} style={s.select}>
            <option value="all">כל הסוגים</option>
            {CAR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {canManageCars && (
            <button onClick={openCreate} style={s.btnPrimary}>+ הוסף רכב</button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <Chip label="סה״כ" value={cars.length} color="#3b82f6" />
        <Chip label="פעילים" value={cars.filter(c=>c.is_active).length} color="#22c55e" />
        <Chip label="לא פעילים" value={cars.filter(c=>!c.is_active).length} color="#94a3b8" />
      </div>

      {/* Folders (Grouped by Category) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {([...categories, { name: "ללא קטגוריה", internalKey: "unassigned" }]).map(cat => {
          const catName = cat.internalKey === "unassigned" ? "" : cat.name;
          const displayTitle = cat.internalKey === "unassigned" ? "רכבים ללא קטגוריה" : cat.name;
          const catCars = filtered.filter(c => (c.category || "") === catName);
          if (catCars.length === 0 && cat.internalKey !== "unassigned") return null;
          if (catCars.length === 0 && cat.internalKey === "unassigned" && filtered.length > 0) return null;

          const isOpen = openFolders[cat.name || "unassigned"];

          return (
            <div key={cat.name || "unassigned"} style={s.folderSection}>
              <div 
                style={s.folderHeader} 
                onClick={() => setOpenFolders(prev => ({ ...prev, [cat.name || "unassigned"]: !isOpen }))}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{isOpen ? "📂" : "📁"}</span>
                  <span style={{ fontWeight: 800, fontSize: 18 }}>{displayTitle}</span>
                  <span style={s.folderBadge}>{catCars.length}</span>
                </div>
                <span>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={s.grid}>
                  {catCars.map(car => {
                    const carCat = categories.find(c => c.name === car.category);
                    let displayPrice = car.price_per_day;
                    let isInherited = false;
                    if (!displayPrice && carCat) {
                      displayPrice = car.is_hybrid ? (carCat.hybrid_price || carCat.base_price) : carCat.base_price;
                      isInherited = true;
                    }

                    return (
                      <div key={car.id} style={{ ...s.card, opacity: car.is_active ? 1 : 0.55 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <span style={{ fontSize:32 }}>🚗</span>
                          <Badge label={car.is_active ? "פעיל" : "לא פעיל"}
                                 color={car.is_active ? "green" : "gray"} />
                        </div>
                        <div style={s.carName}>
                          {car.name}
                          {car.is_hybrid && <span title="היברידי" style={{ marginRight: 6 }}>🌿</span>}
                        </div>
                        <div style={s.carSub}>{car.plate} • {car.color} • {car.year}</div>
                        {car.test_date && (
                          <div style={{ fontSize: 11, color: "#e11d48", fontWeight: 600, marginTop: 4 }}>
                            🗓 טסט עד: {car.test_date}
                          </div>
                        )}
                        
                        <div style={s.price}>
                          ₪{Number(displayPrice || 0).toLocaleString()} / יום
                          {isInherited && <span style={s.priceHint}>(מחיר קטגוריה)</span>}
                        </div>
                        
                        <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
                          {car.is_active && (
                            <button
                              onClick={() => navigate("/bookings", {
                                state: { bookingPrefill: { car_id: car.id } }
                              })}
                              style={s.btnBook}>📅 הזמן
                            </button>
                          )}
                          {canManageCars && (
                            <>
                              <button onClick={() => openEdit(car)} style={s.btnEdit}>✏️ ערוך</button>
                              <button onClick={() => toggleActive(car)}
                                style={car.is_active ? s.btnWarn : s.btnSuccess}>
                                {car.is_active ? "⏸ השבת" : "▶ הפעל"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        
        {filtered.length === 0 && (
          <div style={s.empty}>לא נמצאו רכבים</div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={!!modal} onClose={closeModal}
        title={modal === "create" ? "הוספת רכב חדש" : "עריכת רכב"}>
        <div style={s.formGrid}>
          <Field label="שם רכב *">
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={s.input} />
          </Field>
          <Field label="קטגוריה *">
            <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} style={s.input}>
              <option value="">— ללא קטגוריה —</option>
              {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="סוג הנעה">
            <label style={{ display: "flex", alignItems: "center", gap: 8, height: "100%", cursor: "pointer" }}>
              <input type="checkbox" checked={form.is_hybrid} 
                onChange={e => setForm(f=>({...f,is_hybrid:e.target.checked}))} />
              <span style={{ fontSize: 14 }}>רכב היברידי 🌿</span>
            </label>
          </Field>
          <Field label="שנה *">
            <input type="number" value={form.year} min={1990} max={2030}
              onChange={e => setForm(f=>({...f,year:e.target.value}))} style={s.input} />
          </Field>
          <Field label="לוחית רישוי *">
            <input value={form.plate} onChange={e => setForm(f=>({...f,plate:e.target.value}))}
              style={s.input} disabled={modal==="edit"} />
          </Field>
          <Field label="צבע">
            <input value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))} style={s.input} />
          </Field>
          <Field label="מחיר ליום (₪)">
            <input type="number" value={form.price_per_day} min={0}
              placeholder="השאר ריק למחיר קטגוריה"
              onChange={e => setForm(f=>({...f,price_per_day:e.target.value}))} style={s.input} />
          </Field>
          <Field label="תאריך טסט">
            <input value={form.test_date} placeholder="למשל: 19/02/2027"
              onChange={e => setForm(f=>({...f,test_date:e.target.value}))} style={s.input} />
          </Field>
        </div>
        <Field label="תיאור">
          <textarea value={form.description} rows={2}
            onChange={e => setForm(f=>({...f,description:e.target.value}))}
            style={{...s.input, resize:"vertical"}} />
        </Field>
        {formError && <div style={s.errorBox}>{formError}</div>}
        <div style={s.modalFooter}>
          <button onClick={closeModal} style={s.btnSecondary}>ביטול</button>
          <button onClick={handleSave} disabled={saving} style={s.btnPrimary}>
            {saving ? "שומר..." : modal==="create" ? "הוסף רכב" : "שמור שינויים"}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Confirm open={!!confirmPermanentDelete}
        message={`למחוק לצמיתות את "${confirmPermanentDelete?.name}"? הפעולה אינה ניתנת לביטול, וזמינה רק לרכב ללא היסטוריית הזמנות.`}
        confirmLabel="מחק לצמיתות"
        onConfirm={() => handlePermanentDelete(confirmPermanentDelete)}
        onCancel={() => setConfirmPermanentDelete(null)} />
    </div>
  );
}

function Chip({ label, value, color }) {
  return (
    <div style={{ background:`${color}15`, border:`1px solid ${color}30`,
                  borderRadius:20, padding:"4px 14px", fontSize:13, color }}>
      {label}: <strong>{value}</strong>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}
function Loader() {
  return <div style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>טוען...</div>;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = {
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"center",
                marginBottom:20, flexWrap:"wrap", gap:12 },
  h1:         { fontSize:24, fontWeight:800, margin:0 },
  searchInput:{ padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, outline:"none", minWidth:220 },
  select:     { padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, cursor:"pointer", background:"#fff" },
  folderSection: { marginBottom: 12 },
  folderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", background: "#f8fafc", borderRadius: 12,
                  border: "1px solid #e2e8f0", cursor: "pointer", userSelect: "none",
                  transition: "background 0.2s" },
  folderBadge: { background: "#e2e8f0", color: "#475569", borderRadius: 12,
                 padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  grid:       { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap: 16, marginTop: 16 },
  card:       { background:"#fff", borderRadius:14, padding:18,
                border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
                transition:"transform 0.15s, box-shadow 0.15s" },
  carName:    { fontWeight:800, fontSize:16, marginTop:8 },
  carSub:     { fontSize:12, color:"#94a3b8", marginTop:2 },
  price:      { fontSize:15, fontWeight:700, color:"#1d4ed8", marginTop:6, display: "flex", alignItems: "center", gap: 6 },
  priceHint:  { fontSize:11, color: "#94a3b8", fontWeight: 400 },
  desc:       { fontSize:12, color:"#64748b", marginTop:6, lineHeight:1.5 },
  typeTag:    { background:"#eff6ff", color:"#3b82f6", borderRadius:20,
                padding:"2px 10px", fontSize:11, fontWeight:600 },
  btnPrimary: { background:"#1d4ed8", color:"#fff", border:"none", borderRadius:8,
                padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:14 },
  btnSecondary:{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0",
                 borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer" },
  btnEdit:    { background:"#eff6ff", color:"#3b82f6", border:"1px solid #bfdbfe",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnBook:    { background:"#f0fdf4", color:"#15803d", border:"1px solid #86efac",
                borderRadius:7, padding:"5px 12px", cursor:"pointer", fontSize:13, fontWeight:700 },
  btnWarn:    { background:"#fff7ed", color:"#c2410c", border:"1px solid #fed7aa",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnSuccess: { background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnDanger:  { background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  input:      { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, outline:"none", boxSizing:"border-box" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 },
  formGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:12 },
  modalFooter:{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 },
  errorBox:   { background:"#fef2f2", color:"#dc2626", borderRadius:8,
                padding:"10px 14px", fontSize:13, marginTop:8 },
  empty:      { gridColumn:"1/-1", textAlign:"center", padding:40, color:"#94a3b8" },
};
