import { useEffect, useState } from "react";
import { carsAPI } from "../api/cars";
import { useAuthStore } from "../store/auth";
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

const EMPTY_FORM = { name:"", type:"sedan", year: new Date().getFullYear(),
                     plate:"", color:"", price_per_day:"", description:"", image_url:"" };

export default function Cars() {
  const [cars, setCars]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState("all");
  const [modal, setModal]       = useState(null);   // null | "create" | "edit"
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm]   = useState(null);   // car to delete
  const [editCar, setEditCar]   = useState(null);
  const isAdmin = useAuthStore(s => s.isAdmin());

  const load = () => carsAPI.list({ active_only: false })
    .then(setCars).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = cars.filter(c => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.name.includes(search) && !c.plate.includes(search)) return false;
    return true;
  });

  function openCreate() {
    setForm(EMPTY_FORM); setEditCar(null); setFormError(""); setModal("create");
  }
  function openEdit(car) {
    setForm({ name: car.name, type: car.type, year: car.year, plate: car.plate,
              color: car.color||"", price_per_day: car.price_per_day,
              description: car.description||"", image_url: car.image_url||"" });
    setEditCar(car); setFormError(""); setModal("edit");
  }
  function closeModal() { setModal(null); setEditCar(null); }

  async function handleSave() {
    if (!form.name.trim())  return setFormError("יש להזין שם רכב");
    if (!form.plate.trim()) return setFormError("יש להזין לוחית רישוי");
    if (!form.price_per_day || +form.price_per_day <= 0) return setFormError("מחיר לא תקין");
    setSaving(true); setFormError("");
    try {
      const data = { ...form, year: +form.year, price_per_day: +form.price_per_day };
      if (modal === "create") await carsAPI.create(data);
      else await carsAPI.update(editCar.id, data);
      await load(); closeModal();
    } catch (e) {
      setFormError(typeof e === "string" ? e : "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  async function handleDelete(car) {
    try {
      await carsAPI.delete(car.id);
      await load();
    } catch (e) {
      alert(typeof e === "string" ? e : "לא ניתן למחוק רכב זה");
    } finally { setConfirm(null); }
  }

  async function toggleActive(car) {
    await carsAPI.update(car.id, { is_active: !car.is_active });
    await load();
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
          {isAdmin && (
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

      {/* Grid */}
      <div style={s.grid}>
        {filtered.map(car => {
          const t = typeMap[car.type] || { emoji:"🚗", label: car.type };
          return (
            <div key={car.id} style={{ ...s.card, opacity: car.is_active ? 1 : 0.55 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <span style={{ fontSize:36 }}>{t.emoji}</span>
                <Badge label={car.is_active ? "פעיל" : "לא פעיל"}
                       color={car.is_active ? "green" : "gray"} />
              </div>
              <div style={s.carName}>{car.name}</div>
              <div style={s.carSub}>{car.plate} • {car.color} • {car.year}</div>
              <div style={{ display:"flex", gap:6, margin:"8px 0" }}>
                <span style={s.typeTag}>{t.label}</span>
              </div>
              <div style={s.price}>₪{car.price_per_day.toLocaleString()} / יום</div>
              {car.description && (
                <div style={s.desc}>{car.description}</div>
              )}
              {isAdmin && (
                <div style={{ display:"flex", gap:6, marginTop:12 }}>
                  <button onClick={() => openEdit(car)} style={s.btnEdit}>✏️ ערוך</button>
                  <button onClick={() => toggleActive(car)}
                    style={car.is_active ? s.btnWarn : s.btnSuccess}>
                    {car.is_active ? "⏸ השבת" : "▶ הפעל"}
                  </button>
                  <button onClick={() => setConfirm(car)} style={s.btnDanger}>🗑</button>
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
          <Field label="סוג *">
            <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} style={s.input}>
              {CAR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
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
          <Field label="מחיר ליום (₪) *">
            <input type="number" value={form.price_per_day} min={1}
              onChange={e => setForm(f=>({...f,price_per_day:e.target.value}))} style={s.input} />
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
      <Confirm open={!!confirm}
        message={`האם למחוק את "${confirm?.name}"? לא ניתן לבטל פעולה זו.`}
        onConfirm={() => handleDelete(confirm)}
        onCancel={() => setConfirm(null)} />
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
  grid:       { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 },
  card:       { background:"#fff", borderRadius:14, padding:18,
                border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
                transition:"transform 0.15s, box-shadow 0.15s" },
  carName:    { fontWeight:800, fontSize:16, marginTop:8 },
  carSub:     { fontSize:12, color:"#94a3b8", marginTop:2 },
  price:      { fontSize:15, fontWeight:700, color:"#1d4ed8", marginTop:6 },
  desc:       { fontSize:12, color:"#64748b", marginTop:6, lineHeight:1.5 },
  typeTag:    { background:"#eff6ff", color:"#3b82f6", borderRadius:20,
                padding:"2px 10px", fontSize:11, fontWeight:600 },
  btnPrimary: { background:"#1d4ed8", color:"#fff", border:"none", borderRadius:8,
                padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:14 },
  btnSecondary:{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0",
                 borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer" },
  btnEdit:    { background:"#eff6ff", color:"#3b82f6", border:"1px solid #bfdbfe",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnWarn:    { background:"#fff7ed", color:"#c2410c", border:"1px solid #fed7aa",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnSuccess: { background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  btnDanger:  { background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca",
                borderRadius:7, padding:"5px 10px", cursor:"pointer", fontSize:13 },
  input:      { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, outline:"none", boxSizing:"border-box" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 },
  formGrid:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 },
  modalFooter:{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 },
  errorBox:   { background:"#fef2f2", color:"#dc2626", borderRadius:8,
                padding:"10px 14px", fontSize:13, marginTop:8 },
  empty:      { gridColumn:"1/-1", textAlign:"center", padding:40, color:"#94a3b8" },
};
