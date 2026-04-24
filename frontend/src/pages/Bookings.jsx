import { useEffect, useState, useCallback } from "react";
import { bookingsAPI } from "../api/bookings";
import { carsAPI } from "../api/cars";
import { useAuthStore } from "../store/auth";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import Confirm from "../components/ui/Confirm";

const STATUS_OPTIONS = [
  { value: "active",    label: "פעיל",    color: "green" },
  { value: "completed", label: "הושלם",   color: "blue"  },
  { value: "cancelled", label: "בוטל",    color: "gray"  },
];
const statusMap = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

const EMPTY_FORM = {
  car_id:"", customer_name:"", customer_email:"",
  customer_phone:"", customer_id_num:"",
  start_date:"", end_date:"", notes:"",
};

export default function Bookings() {
  const [bookings, setBookings]   = useState([]);
  const [cars, setCars]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [modal, setModal]         = useState(null);
  const [editBooking, setEdit]    = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm]     = useState(null);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 15;
  const isAdmin = useAuthStore(s => s.isAdmin());

  const load = useCallback(() => {
    Promise.all([
      bookingsAPI.list(),
      carsAPI.list({ active_only: false }),
    ]).then(([b, c]) => { setBookings(b); setCars(c); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const carsMap = Object.fromEntries(cars.map(c => [c.id, c]));

  const filtered = bookings.filter(b => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const car = carsMap[b.car_id];
      if (!b.customer_name.toLowerCase().includes(q) &&
          !(b.customer_phone||"").includes(q) &&
          !(car?.name||"").toLowerCase().includes(q) &&
          !(b.customer_id_num||"").includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  function openCreate() {
    setForm(EMPTY_FORM); setEdit(null); setFormError(""); setModal("create");
  }
  function openEdit(b) {
    setForm({
      car_id: String(b.car_id), customer_name: b.customer_name,
      customer_email: b.customer_email||"", customer_phone: b.customer_phone||"",
      customer_id_num: b.customer_id_num||"", start_date: b.start_date,
      end_date: b.end_date, notes: b.notes||"",
    });
    setEdit(b); setFormError(""); setModal("edit");
  }

  async function handleSave() {
    if (!form.car_id)           return setFormError("יש לבחור רכב");
    if (!form.customer_name.trim()) return setFormError("יש להזין שם לקוח");
    if (!form.start_date)       return setFormError("יש לבחור תאריך התחלה");
    if (!form.end_date)         return setFormError("יש לבחור תאריך סיום");
    if (form.end_date < form.start_date) return setFormError("תאריך סיום לפני תחילה");
    setSaving(true); setFormError("");
    try {
      const data = { ...form, car_id: +form.car_id };
      if (modal === "create") await bookingsAPI.create(data);
      else await bookingsAPI.update(editBooking.id, data);
      await load(); setModal(null);
    } catch (e) {
      setFormError(typeof e === "string" ? e : "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  async function handleCancel(b) {
    try { await bookingsAPI.update(b.id, { status: "cancelled" }); await load(); }
    catch (e) { alert(typeof e === "string" ? e : "שגיאה"); }
    finally { setConfirm(null); }
  }

  async function handleDelete(b) {
    try { await bookingsAPI.delete(b.id); await load(); }
    catch (e) { alert(typeof e === "string" ? e : "שגיאה"); }
    finally { setConfirm(null); }
  }

  // price preview
  const previewCar  = form.car_id ? carsMap[+form.car_id] : null;
  const days        = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / 86400000))
    : 0;
  const previewTotal = previewCar && days ? previewCar.price_per_day * days : 0;

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>טוען...</div>;

  return (
    <div dir="rtl">
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.h1}>ניהול הזמנות</h1>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input placeholder="🔍 לקוח, טלפון, רכב..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} style={s.searchInput} />
          <select value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(1); }} style={s.select}>
            <option value="all">כל הסטטוסים</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={openCreate} style={s.btnPrimary}>+ הזמנה חדשה</button>
        </div>
      </div>

      {/* Counter */}
      <div style={{ fontSize:13, color:"#64748b", marginBottom:14 }}>
        {filtered.length} הזמנות נמצאו
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              {["#","לקוח","רכב","מתאריך","עד תאריך","סכום","סטטוס","פעולות"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(b => {
              const car = carsMap[b.car_id];
              const st  = statusMap[b.status] || statusMap.cancelled;
              return (
                <tr key={b.id} style={s.tr}>
                  <td style={s.td}><span style={s.idBadge}>#{b.id}</span></td>
                  <td style={s.td}>
                    <div style={{ fontWeight:600 }}>{b.customer_name}</div>
                    {b.customer_phone && <div style={s.sub}>{b.customer_phone}</div>}
                    {b.customer_email && <div style={s.sub}>{b.customer_email}</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight:600 }}>{car?.name || "—"}</div>
                    {car && <div style={s.sub}>{car.plate}</div>}
                  </td>
                  <td style={s.td}>{formatDate(b.start_date)}</td>
                  <td style={s.td}>{formatDate(b.end_date)}</td>
                  <td style={s.td}>
                    <span style={{ fontWeight:700, color:"#1d4ed8" }}>
                      {b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <Badge label={st.label} color={st.color} />
                    {b.email_sent && <span title="אימייל נשלח" style={{ marginRight:4 }}>📧</span>}
                  </td>
                  <td style={s.td}>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => openEdit(b)} style={s.btnIcon} title="ערוך">✏️</button>
                      {b.status === "active" && (
                        <button onClick={() => setConfirm({ action:"cancel", item:b })}
                          style={s.btnIcon} title="בטל הזמנה">🚫</button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setConfirm({ action:"delete", item:b })}
                          style={s.btnIcon} title="מחק">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
                לא נמצאו הזמנות
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{
              ...s.pageBtn, background: p===page ? "#1d4ed8" : "#f1f5f9",
              color: p===page ? "#fff" : "#475569",
            }}>{p}</button>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal==="create" ? "הזמנה חדשה" : "עריכת הזמנה"} wide>
        <div style={s.formGrid}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={s.label}>רכב *</label>
            <select value={form.car_id} onChange={e => setForm(f=>({...f,car_id:e.target.value}))}
              style={s.input} disabled={modal==="edit"}>
              <option value="">— בחר רכב —</option>
              {cars.filter(c=>c.is_active).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.plate}) — ₪{c.price_per_day}/יום
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={s.label}>שם לקוח *</label>
            <input value={form.customer_name}
              onChange={e => setForm(f=>({...f,customer_name:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>אימייל (לאישור)</label>
            <input type="email" value={form.customer_email}
              onChange={e => setForm(f=>({...f,customer_email:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>טלפון</label>
            <input value={form.customer_phone}
              onChange={e => setForm(f=>({...f,customer_phone:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>מספר זהות</label>
            <input value={form.customer_id_num}
              onChange={e => setForm(f=>({...f,customer_id_num:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>מתאריך *</label>
            <input type="date" value={form.start_date}
              onChange={e => setForm(f=>({...f,start_date:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>עד תאריך *</label>
            <input type="date" value={form.end_date} min={form.start_date}
              onChange={e => setForm(f=>({...f,end_date:e.target.value}))} style={s.input} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={s.label}>הערות</label>
            <textarea value={form.notes} rows={2}
              onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              style={{...s.input, resize:"vertical"}} />
          </div>
        </div>

        {/* Price preview */}
        {previewTotal > 0 && (
          <div style={s.pricePreview}>
            💰 {days} ימים × ₪{previewCar.price_per_day} = <strong>₪{previewTotal.toLocaleString()}</strong>
            {form.customer_email && <span style={{ marginRight:12 }}>📧 אישור יישלח ללקוח</span>}
          </div>
        )}

        {formError && <div style={s.errorBox}>{formError}</div>}
        <div style={s.modalFooter}>
          <button onClick={() => setModal(null)} style={s.btnSecondary}>ביטול</button>
          <button onClick={handleSave} disabled={saving} style={s.btnPrimary}>
            {saving ? "שומר..." : modal==="create" ? "אשר הזמנה" : "שמור שינויים"}
          </button>
        </div>
      </Modal>

      {/* Confirm dialogs */}
      <Confirm
        open={confirm?.action === "cancel"}
        message={`לבטל את הזמנה #${confirm?.item?.id} של ${confirm?.item?.customer_name}?`}
        confirmLabel="בטל הזמנה" confirmColor="#f59e0b"
        onConfirm={() => handleCancel(confirm.item)}
        onCancel={() => setConfirm(null)} />
      <Confirm
        open={confirm?.action === "delete"}
        message={`למחוק לצמיתות את הזמנה #${confirm?.item?.id}?`}
        confirmLabel="מחק" confirmColor="#dc2626"
        onConfirm={() => handleDelete(confirm.item)}
        onCancel={() => setConfirm(null)} />
    </div>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

const s = {
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center",
                marginBottom:20, flexWrap:"wrap", gap:12 },
  h1:         { fontSize:24, fontWeight:800, margin:0 },
  searchInput:{ padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, outline:"none", minWidth:220 },
  select:     { padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, cursor:"pointer", background:"#fff" },
  tableWrap:  { background:"#fff", borderRadius:12, overflow:"auto",
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  table:      { width:"100%", borderCollapse:"collapse" },
  th:         { padding:"12px 14px", fontSize:12, fontWeight:700, color:"#475569",
                textAlign:"right", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" },
  tr:         { borderBottom:"1px solid #f1f5f9", transition:"background 0.1s" },
  td:         { padding:"12px 14px", fontSize:13, verticalAlign:"middle" },
  sub:        { fontSize:11, color:"#94a3b8", marginTop:1 },
  idBadge:    { background:"#f1f5f9", color:"#475569", borderRadius:6,
                padding:"2px 7px", fontSize:12, fontWeight:700 },
  btnIcon:    { background:"none", border:"none", cursor:"pointer", fontSize:16,
                padding:"2px 5px", borderRadius:5 },
  btnPrimary: { background:"#1d4ed8", color:"#fff", border:"none", borderRadius:8,
                padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:14 },
  btnSecondary:{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0",
                 borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer" },
  input:      { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0",
                fontSize:14, outline:"none", boxSizing:"border-box" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 },
  formGrid:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 },
  modalFooter:{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 },
  errorBox:   { background:"#fef2f2", color:"#dc2626", borderRadius:8,
                padding:"10px 14px", fontSize:13, marginTop:8 },
  pricePreview:{ background:"#eff6ff", color:"#1d4ed8", borderRadius:8,
                 padding:"10px 14px", fontSize:14, marginBottom:8 },
  pagination: { display:"flex", gap:6, justifyContent:"center", marginTop:16 },
  pageBtn:    { width:36, height:36, borderRadius:8, border:"1px solid #e2e8f0",
                cursor:"pointer", fontWeight:600, fontSize:13 },
};
