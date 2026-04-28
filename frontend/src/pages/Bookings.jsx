import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserFacingErrorMessage, getRetryAfterSeconds } from "../api/errors";
import { bookingsAPI } from "../api/bookings";
import { carsAPI } from "../api/cars";
import { suggestionsAPI } from "../api/suggestions";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";
import { Permissions } from "../permissions";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import Confirm from "../components/ui/Confirm";

const STATUS_OPTIONS = [
  { value: "active",    label: "פעיל",    color: "green" },
  { value: "completed", label: "הושלם",   color: "blue"  },
  { value: "cancelled", label: "בוטל",    color: "gray"  },
];
const statusMap = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

function todayISO() { return new Date().toISOString().split("T")[0]; }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
function makeEmptyForm() {
  return {
    car_id: "", customer_name: "", customer_email: "",
    customer_phone: "", customer_id_num: "",
    start_date: todayISO(),    start_time: "08:00",
    end_date:   tomorrowISO(), end_time:   "08:00",
    notes: "",
  };
}

export default function Bookings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings]   = useState([]);
  const [cars, setCars]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [modal, setModal]         = useState(null);
  const [editBooking, setEdit]    = useState(null);
  const [form, setForm]           = useState(makeEmptyForm);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm]     = useState(null);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 15;
  const canDeleteBookings    = useAuthStore(s => s.can(Permissions.BOOKINGS_DELETE));
  const canApplySuggestions  = useAuthStore(s => s.can(Permissions.SUGGESTIONS_APPLY));

  // Smart conflict suggestions state
  const [conflictSuggestions, setConflictSuggestions] = useState([]);
  const [suggestionsLoading,  setSuggestionsLoading]  = useState(false);
  const [applyingToken,       setApplyingToken]       = useState(null);
  const [cooldownUntil,       setCooldownUntil]       = useState(null);
  const [cooldownSecs,        setCooldownSecs]        = useState(0);

  // Cooldown ticker
  useEffect(() => {
    if (!cooldownUntil) { setCooldownSecs(0); return; }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSecs(rem);
      if (rem <= 0) setCooldownUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const load = useCallback(() => {
    return Promise.all([
      bookingsAPI.list(),
      carsAPI.list({ active_only: false }),
    ]).then(([b, c]) => { setBookings(b); setCars(c); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const prefill = location.state?.bookingPrefill;
    if (!prefill) return;

    setForm({
      ...makeEmptyForm(),
      car_id: prefill.car_id || "",
      start_date: prefill.start_date || todayISO(),
      end_date: prefill.end_date || tomorrowISO(),
    });
    setEdit(null);
    setFormError("");
    setModal("create");
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

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
    setForm(makeEmptyForm()); setEdit(null); setFormError(""); setModal("create");
    setConflictSuggestions([]); setSuggestionsLoading(false);
  }
  function openEdit(b) {
    setForm({
      ...makeEmptyForm(),
      car_id: String(b.car_id), customer_name: b.customer_name,
      customer_email: b.customer_email||"", customer_phone: b.customer_phone||"",
      customer_id_num: b.customer_id_num||"", start_date: b.start_date,
      end_date: b.end_date, notes: b.notes||"",
    });
    setEdit(b); setFormError(""); setModal("edit");
    setConflictSuggestions([]); setSuggestionsLoading(false);
  }

  function buildBookingPayload(form, carId) {
    return {
      car_id:          carId,
      customer_name:   form.customer_name.trim() || null,
      customer_email:  form.customer_email.trim()  || null,
      customer_phone:  form.customer_phone.trim()  || null,
      customer_id_num: form.customer_id_num.trim() || null,
      start_date:      form.start_date || null,
      end_date:        form.end_date || null,
      pickup_time:     form.start_time || null,
      return_time:     form.end_time   || null,
      notes:           form.notes.trim()           || null,
    };
  }

  async function handleSave() {
    if (!form.car_id)           return setFormError("יש לבחור רכב");
    if (!form.customer_name.trim()) return setFormError("יש להזין שם לקוח");
    if (!form.start_date)       return setFormError("יש לבחור תאריך התחלה");
    if (!form.end_date)         return setFormError("יש לבחור תאריך סיום");
    if (form.end_date < form.start_date) return setFormError("תאריך סיום לפני תחילה");
    setSaving(true); setFormError(""); setConflictSuggestions([]);
    try {
      const data = buildBookingPayload(form, +form.car_id);
      if (modal === "create") await bookingsAPI.create(data);
      else await bookingsAPI.update(editBooking.id, data);
      await load(); setModal(null);
      toast.success(modal === "create" ? "ההזמנה נוצרה בהצלחה" : "ההזמנה עודכנה בהצלחה");
    } catch (e) {
      if (e.status === 409 && modal === "create") {
        setFormError("🔍 הרכב תפוס — מחפש חלופות חכמות...");
        fetchConflictSuggestions(form.car_id, form.start_date, form.end_date);
      } else {
        setFormError(getUserFacingErrorMessage(e));
      }
    } finally { setSaving(false); }
  }

  async function fetchConflictSuggestions(carId, start, end) {
    setSuggestionsLoading(true);
    try {
      const results = await suggestionsAPI.search({ car_id: Number(carId), start_date: start, end_date: end });
      setConflictSuggestions(results || []);
      setFormError(results?.length ? "הרכב תפוס בתאריכים אלו. בחר חלופה מוצעת:" : "הרכב תפוס בתאריכים אלו ולא נמצאו חלופות זמינות.");
    } catch (e) {
      const retryAfter = getRetryAfterSeconds(e);
      if (retryAfter > 0) setCooldownUntil(Date.now() + retryAfter * 1000);
      setFormError(getUserFacingErrorMessage(e));
    } finally { setSuggestionsLoading(false); }
  }

  async function handlePickAlternative(item) {
    if (item.type === "C") {
      if (!item.apply_token) return;
      setApplyingToken(item.apply_token);
      try {
        const res = await suggestionsAPI.apply({ apply_token: item.apply_token, operator_note: "Applied via smart booking" });
        await bookingsAPI.create(buildBookingPayload(form, res.freed_car_id));
        await load(); setModal(null); setConflictSuggestions([]);
        toast.success("שיבוץ מחדש הוחל וההזמנה נוצרה בהצלחה! 🎉");
      } catch (e) {
        setFormError(getUserFacingErrorMessage(e));
      } finally { setApplyingToken(null); }
    } else {
      setSaving(true);
      try {
        await bookingsAPI.create(buildBookingPayload(form, item.car_id));
        await load(); setModal(null); setConflictSuggestions([]);
        toast.success(`ההזמנה נוצרה בהצלחה עם ${item.car_name}`);
      } catch (e) {
        setFormError(getUserFacingErrorMessage(e));
      } finally { setSaving(false); }
    }
  }

  async function handleCancel(b) {
    try {
      await bookingsAPI.update(b.id, { status: "cancelled" });
      await load();
      toast.success("ההזמנה בוטלה בהצלחה");
    }
    catch (e) { toast.error(getUserFacingErrorMessage(e)); }
    finally { setConfirm(null); }
  }

  async function handleDelete(b) {
    try {
      await bookingsAPI.delete(b.id);
      await load();
      toast.success("ההזמנה נמחקה בהצלחה");
    }
    catch (e) { toast.error(getUserFacingErrorMessage(e)); }
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
                      {canDeleteBookings && (
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
      <Modal open={!!modal} onClose={() => { setModal(null); setConflictSuggestions([]); }}
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
            <label style={s.label}>מתאריך * <span style={s.timeHint}>שעת איסוף</span></label>
            <div style={{ display:"flex", gap:6 }}>
              <input type="date" value={form.start_date}
                onChange={e => setForm(f=>({...f,start_date:e.target.value}))}
                style={{...s.input, flex:2}} />
              <input type="time" value={form.start_time}
                onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
                style={{...s.input, flex:1}} />
            </div>
          </div>
          <div>
            <label style={s.label}>עד תאריך * <span style={s.timeHint}>שעת החזרה</span></label>
            <div style={{ display:"flex", gap:6 }}>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f=>({...f,end_date:e.target.value}))}
                style={{...s.input, flex:2}} />
              <input type="time" value={form.end_time}
                onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
                style={{...s.input, flex:1}} />
            </div>
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

        {/* ── Smart Conflict Suggestions ──────────────────────────── */}
        {suggestionsLoading && (
          <div style={s.suggestLoading}>⏳ מחפש חלופות חכמות...</div>
        )}
        {conflictSuggestions.length > 0 && (
          <div style={s.suggestPanel}>
            <div style={s.suggestTitle}>💡 חלופות זמינות</div>
            {cooldownSecs > 0 && (
              <div style={s.cooldownBox}>⏳ הגבלת קצב — נסה שוב בעוד {cooldownSecs} שניות</div>
            )}
            {conflictSuggestions.map((item, idx) => {
              const typeLabel = { A: "התאמה ישירה", B: "חלופה דומה", C: "שיבוץ מחדש" }[item.type] || item.type;
              const typeColor = { A: "#059669", B: "#1d4ed8", C: "#7c3aed" }[item.type] || "#475569";
              const canApply  = item.type === "C" && canApplySuggestions && !!item.apply_token;
              const busy      = applyingToken === item.apply_token;
              return (
                <div key={idx} style={s.suggestCard}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <div>
                      <span style={{ ...s.typeBadge, background: typeColor + "15", color: typeColor, borderColor: typeColor + "40" }}>
                        {typeLabel}
                      </span>
                      <span style={s.carName}>{item.car_name}</span>
                      {item.car_group && <span style={s.carMeta}> קבוצה {item.car_group}</span>}
                      <span style={s.carMeta}> · ₪{item.price_per_day}/יום</span>
                      {item.price_delta !== 0 && (
                        <span style={{ color: item.price_delta > 0 ? "#f59e0b" : "#059669", fontSize:11, marginRight:4 }}>
                          ({item.price_delta > 0 ? "+" : ""}₪{item.price_delta}/יום)
                        </span>
                      )}
                    </div>
                    <span style={s.riskBadge(item.risk_level)}>{item.risk_level}</span>
                  </div>
                  <div style={s.suggestSummary}>{item.operator_summary}</div>
                  {item.type === "C" && item.affected_customer_name && (
                    <div style={s.suggestMeta}>
                      🔄 הזמנת {item.affected_customer_name} תועבר לרכב: <strong>{item.replacement_car_name}</strong>
                    </div>
                  )}
                  <div style={{ marginTop:8, display:"flex", gap:6 }}>
                    {(item.type === "A" || item.type === "B") && (
                      <button disabled={saving || cooldownSecs > 0}
                        onClick={() => handlePickAlternative(item)}
                        style={{ ...s.btnAlt, background: typeColor }}>
                        {saving ? "שומר..." : `הזמן עם ${item.car_name}`}
                      </button>
                    )}
                    {canApply && (
                      <button disabled={busy || cooldownSecs > 0}
                        onClick={() => handlePickAlternative(item)}
                        style={{ ...s.btnAlt, background: "#7c3aed" }}>
                        {busy ? "מחיל שיבוץ..." : cooldownSecs > 0 ? `המתן ${cooldownSecs}s` : "החל שיבוץ והזמן →"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={s.modalFooter}>
          <button onClick={() => { setModal(null); setConflictSuggestions([]); }} style={s.btnSecondary}>ביטול</button>
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
  timeHint:   { fontSize:10, color:"#94a3b8", fontWeight:400, marginRight:4 },
  formGrid:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 },
  modalFooter:{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 },
  errorBox:   { background:"#fef2f2", color:"#dc2626", borderRadius:8,
                padding:"10px 14px", fontSize:13, marginTop:8 },
  pricePreview:{ background:"#eff6ff", color:"#1d4ed8", borderRadius:8,
                 padding:"10px 14px", fontSize:14, marginBottom:8 },
  pagination: { display:"flex", gap:6, justifyContent:"center", marginTop:16 },
  pageBtn:    { width:36, height:36, borderRadius:8, border:"1px solid #e2e8f0",
                cursor:"pointer", fontWeight:600, fontSize:13 },

  // Smart suggestions panel
  suggestLoading: { marginTop:10, padding:"10px 14px", background:"#fefce8",
                    border:"1px solid #fde68a", borderRadius:8, color:"#92400e", fontSize:13 },
  suggestPanel: { marginTop:10, border:"1px solid #e0e7ff", borderRadius:10, overflow:"hidden" },
  suggestTitle: { background:"#eef2ff", padding:"8px 14px", fontWeight:700,
                  fontSize:13, color:"#3730a3", borderBottom:"1px solid #e0e7ff" },
  suggestCard:  { padding:"12px 14px", borderBottom:"1px solid #f1f5f9", background:"#fff" },
  typeBadge:    { display:"inline-block", borderRadius:999, padding:"2px 8px", fontSize:11,
                  fontWeight:700, border:"1px solid", marginLeft:6 },
  carName:      { fontWeight:700, fontSize:14, color:"#0f172a" },
  carMeta:      { fontSize:11, color:"#64748b" },
  suggestSummary: { marginTop:5, fontSize:12, color:"#475569" },
  suggestMeta:  { marginTop:4, fontSize:11, color:"#7c3aed", fontWeight:600 },
  btnAlt:       { color:"#fff", border:"none", borderRadius:7, padding:"6px 14px",
                  fontWeight:700, cursor:"pointer", fontSize:12 },
  cooldownBox:  { padding:"6px 10px", background:"#fff7ed", border:"1px solid #fdba74",
                  color:"#9a3412", borderRadius:6, fontSize:12, marginBottom:6 },
  riskBadge: (level) => ({
    fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:999,
    background: level==="low" ? "#dcfce7" : level==="medium" ? "#fef9c3" : "#fee2e2",
    color:      level==="low" ? "#166534" : level==="medium" ? "#854d0e" : "#991b1b",
    flexShrink: 0,
  }),
};
