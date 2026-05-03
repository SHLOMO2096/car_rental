// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsAPI } from "../api/reports";
import { carsAPI } from "../api/cars";
import { bookingsAPI } from "../api/bookings";
import { settingsAPI } from "../api/settings";
import Confirm from "../components/ui/Confirm";
import { toast } from "../store/toast";
import { getUserFacingErrorMessage } from "../api/errors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useIsMobile } from "../hooks/useIsMobile";
import { getJewishDayMeta } from "../utils/jewishCalendar";

const MONTH_NAMES = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
const DAY_NAMES   = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MODEL_COLOR_PALETTE = [
  { bg:"#dbeafe", border:"#3b82f6", text:"#1d4ed8" },
  { bg:"#dcfce7", border:"#22c55e", text:"#15803d" },
  { bg:"#ffedd5", border:"#f97316", text:"#c2410c" },
  { bg:"#ede9fe", border:"#8b5cf6", text:"#6d28d9" },
  { bg:"#fce7f3", border:"#ec4899", text:"#be185d" },
  { bg:"#cffafe", border:"#06b6d4", text:"#0e7490" },
  { bg:"#fef3c7", border:"#f59e0b", text:"#b45309" },
  { bg:"#e0f2fe", border:"#0284c7", text:"#0369a1" },
  { bg:"#ecfccb", border:"#84cc16", text:"#4d7c0f" },
  { bg:"#f3e8ff", border:"#a855f7", text:"#7e22ce" },
];

function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
function pad2(n) { return String(n).padStart(2, "0"); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function diffDays(startISO, endISO) {
  const ms = fromISO(endISO) - fromISO(startISO);
  return Math.round(ms / 86400000);
}
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash) + value.charCodeAt(i);
  return Math.abs(hash);
}
function getModelTheme(model) {
  return MODEL_COLOR_PALETTE[hashString(model || "") % MODEL_COLOR_PALETTE.length];
}
function fmtDay(d) {
  const mn = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${mn[d.getMonth()]}`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);
  const [summary, setSummary]   = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [topCars, setTopCars]   = useState([]);
  const [cars, setCars]         = useState([]);
  const year = new Date().getFullYear();
  const todayBase = new Date();
  todayBase.setHours(0,0,0,0);
  const todayISO = toISO(todayBase);

  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [rangeStart, setRangeStart] = useState(toISO(addDays(todayBase, -2)));
  const [rangeEnd, setRangeEnd]     = useState(toISO(addDays(todayBase, 4)));
  const [categories, setCategories] = useState([]);

  const modelOptions = useMemo(
    () => [...new Set(cars.filter(c => c.is_active).map(c => c.name))].sort((a, b) => a.localeCompare(b, "he")),
    [cars]
  );
  const filteredCars = useMemo(
    () => cars.filter(c => {
      if (!c.is_active) return false;
      
      // Multi-category filter
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category || "");
      if (!matchesCategory) return false;

      // Multi-model filter
      const matchesModel = selectedModels.length === 0 || selectedModels.includes(c.name);
      if (!matchesModel) return false;

      return true;
    }),
    [cars, selectedModels, selectedCategories]
  );
  const visibleDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);

  function toggleModel(model) {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  }

  useEffect(() => {
    carsAPI.list().then(setCars).catch(() => setCars([]));
    settingsAPI.get("category_hierarchy").then(res => setCategories(res.value || [])).catch(() => {});
  }, []);

  useEffect(() => {
    // For API: pass first selected model or undefined (summary API takes single model)
    const modelParam = selectedModels.length === 1 ? selectedModels[0] : undefined;
    reportsAPI.summary(modelParam)
      .then(setSummary)
      .catch(() => setSummary({ total: 0, active: 0, revenue: 0 }));
    reportsAPI.monthly(year, modelParam)
      .then(rows => setMonthly(rows.map(r => ({ ...r, name: MONTH_NAMES[r.month - 1] }))))
      .catch(() => setMonthly([]));
    reportsAPI.topCars(5, modelParam)
      .then(setTopCars)
      .catch(() => setTopCars([]));
  }, [year, selectedModels]);

  function setStartAndKeepRange(nextStart) {
    setRangeStart(nextStart);
    if (nextStart > rangeEnd) setRangeEnd(nextStart);
  }

  function setEndWithGuard(nextEnd) {
    setRangeEnd(nextEnd < rangeStart ? rangeStart : nextEnd);
  }

  function applyPreset(days) {
    setRangeEnd(toISO(addDays(fromISO(rangeStart), days - 1)));
  }

  function shiftRange(days) {
    setRangeStart(prev => toISO(addDays(fromISO(prev), days)));
    setRangeEnd(prev => toISO(addDays(fromISO(prev), days)));
  }

  return (
    <div dir="rtl">
      <h1 style={{ fontSize:isMobile ? 20 : 24, fontWeight:800, marginBottom:isMobile ? 14 : 20 }}>לוח בקרה</h1>

      {/* ── Filter Panel ── */}
      <div style={{ ...cardStyle, padding:isMobile ? 12 : 16, marginBottom:20 }}>
        <div style={{ display:"flex", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>

          {/* Multi-category filter */}
          <div style={{ ...fieldWrap, minWidth: isMobile ? "100%" : 180 }}>
            <span style={fieldLabel}>סינון קטגוריות</span>
            <div style={multiSelectBox}>
              <label style={multiSelectItem(selectedCategories.length === 0)}>
                <input type="checkbox" checked={selectedCategories.length === 0} onChange={() => setSelectedCategories([])} />
                כל הקטגוריות
              </label>
              <div style={separator} />
              {categories.map(cat => (
                <label key={cat.name} style={multiSelectItem(selectedCategories.includes(cat.name))}>
                  <input type="checkbox" checked={selectedCategories.includes(cat.name)} 
                    onChange={() => setSelectedCategories(prev => prev.includes(cat.name) ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>

          {/* Multi-model filter */}
          <div style={{ ...fieldWrap, minWidth: isMobile ? "100%" : 220 }}>
            <span style={fieldLabel}>סינון דגמים</span>
            <div style={multiSelectBox}>
              <label style={multiSelectItem(selectedModels.length === 0)}>
                <input type="checkbox" checked={selectedModels.length === 0} onChange={() => setSelectedModels([])} />
                כל הדגמים
              </label>
              <div style={separator} />
              {modelOptions.map(model => (
                <label key={model} style={multiSelectItem(selectedModels.includes(model))}>
                  <input type="checkbox" checked={selectedModels.includes(model)} onChange={() => toggleModel(model)} />
                  {model}
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <label style={{ ...fieldWrap, minWidth:isMobile ? "100%" : 160 }}>
            <span style={fieldLabel}>מתאריך</span>
            <input type="date" value={rangeStart} onChange={(e) => setStartAndKeepRange(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ ...fieldWrap, minWidth:isMobile ? "100%" : 160 }}>
            <span style={fieldLabel}>עד תאריך</span>
            <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setEndWithGuard(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", width:isMobile ? "100%" : "auto" }}>
            <span style={fieldLabel}>טווח מהיר</span>
            {[7,14,30].map(days => (
              <button key={days} onClick={() => applyPreset(days)} style={days === visibleDays ? activeChip : chipStyle}>
                {days} ימים
              </button>
            ))}
            <button onClick={() => shiftRange(-7)} style={chipStyle}>◀ 7 ימים</button>
            <button onClick={() => shiftRange(7)} style={chipStyle}>7 ימים ▶</button>
          </div>

        </div>

        <div style={{ marginTop:10, fontSize:12, color:"#64748b" }}>
          מוצג כעת:
          {selectedCategories.length === 0 ? "כל הקטגוריות" : selectedCategories.join(", ")}
          {" · "}
          {selectedModels.length === 0 ? "כל הדגמים" : selectedModels.join(", ")}
          {" · "}
          <strong>{filteredCars.length}</strong> רכבים ·
          טווח: <strong>{visibleDays}</strong> ימים
        </div>
      </div>

      {/* ── Availability Grid (FIRST prominent element) ── */}
      <AvailabilityGrid cars={filteredCars} startDate={rangeStart} endDate={rangeEnd} navigate={navigate} isMobile={isMobile} />

      {/* ── Stats cards (below the grid) ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(180px,1fr))", gap:12, margin:"20px 0" }}>
        {[
          { label:"סה״כ הזמנות",  value: summary?.total   ?? "—", color:"#3b82f6", icon:"📋" },
          { label:"הזמנות פעילות",value: summary?.active  ?? "—", color:"#22c55e", icon:"✅" },
          { label:"הכנסות השנה",  value: summary ? `₪${Math.round(summary.revenue).toLocaleString()}` : "—", color:"#f59e0b", icon:"💰" },
          { label:"רכבים מוצגים",  value: filteredCars.length, color:"#8b5cf6", icon:"🚗" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", borderRadius:12, padding:isMobile ? "14px 16px" : "20px 24px",
               border:`1px solid ${s.color}30`, display:"flex", gap:12, alignItems:"center",
               boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: isMobile ? 24 : 32 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "2fr 1fr", gap:20, marginTop:4 }}>
        <div style={{ ...cardStyle, padding:isMobile ? 12 : 20 }}>
          <h3 style={cardTitle}>הכנסות חודשיות {year}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:12 }} />
              <YAxis tick={{ fontSize:12 }} tickFormatter={v => `₪${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => [`₪${v.toLocaleString()}`, "הכנסה"]} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...cardStyle, padding:isMobile ? 12 : 20 }}>
          <h3 style={cardTitle}>רכבים מובילים</h3>
          {topCars.length === 0 && <div style={{ color:"#94a3b8", fontSize:13 }}>אין נתונים להצגה</div>}
          {topCars.map((c, i) => (
            <div key={c.car_id} style={{ display:"flex", alignItems:"center", gap:10,
                 padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
              <span style={{ width:24, height:24, background:"#3b82f6", color:"#fff",
                   borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                   fontSize:12, fontWeight:700 }}>{i+1}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{c.name} <span style={{ color:"#64748b", fontWeight:700 }}>#{c.car_id}</span></div>
                <div style={{ fontSize:11, color:"#64748b" }}>{c.bookings} הזמנות</div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#22c55e" }}>
                ₪{Math.round(c.revenue).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Reassign Confirm Modal ─────────────────────────────────────────────────────
function ReassignModal({ booking, fromCar, toCar, loading, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
                  display:"flex", alignItems:"center", justifyContent:"center" }}
         onClick={onCancel}>
      <div dir="rtl" style={{ background:"#fff", borderRadius:16, padding:28, maxWidth:400,
                               width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}
           onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:22, marginBottom:8 }}>🔄 העברת הזמנה</div>
        <p style={{ fontSize:14, color:"#374151", marginBottom:4 }}>
          <strong>{booking.customer_name}</strong>
        </p>
        <p style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>
          📅 {booking.start_date} – {booking.end_date}
        </p>
        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0",
                      padding:"12px 16px", background:"#f1f5f9", borderRadius:10, fontSize:13 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
            <span style={{ color:"#dc2626", fontWeight:700 }}>🚗 {fromCar.name}</span>
            {fromCar.plate && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>🔢 {fromCar.plate}</span>}
          </div>
          <span style={{ color:"#64748b", fontSize:18, flex:1, textAlign:"center" }}>←</span>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
            <span style={{ color:"#16a34a", fontWeight:700 }}>🚗 {toCar.name}</span>
            {toCar.plate && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>🔢 {toCar.plate}</span>}
          </div>
        </div>
        <p style={{ fontSize:12, color:"#94a3b8", marginBottom:20 }}>
          לאחר האישור ההזמנה תועבר לרכב החדש ולא ניתן לבטל פעולה זו.
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} disabled={loading}
                  style={{ padding:"9px 20px", borderRadius:8, border:"1px solid #cbd5e1",
                           background:"#fff", color:"#374151", fontSize:13, cursor:"pointer" }}>
            ביטול
          </button>
          <button onClick={onConfirm} disabled={loading}
                  style={{ padding:"9px 20px", borderRadius:8, border:"none",
                           background: loading ? "#93c5fd" : "#2563eb", color:"#fff",
                           fontSize:13, fontWeight:700, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "מעדכן..." : "✔ אשר העברה"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingActionModal({ booking, carName, onEdit, onDelete, onCustomer, onClose }) {
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:420, width:"92%", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin:"0 0 8px", fontSize:18, color:"#1e293b" }}>פעולות על הזמנה קיימת</h3>
        <div style={{ fontSize:13, color:"#475569", marginBottom:4 }}><strong>לקוח:</strong> {booking.customer_name}</div>
        <div style={{ fontSize:13, color:"#475569", marginBottom:4 }}><strong>רכב:</strong> {carName}</div>
        <div style={{ fontSize:13, color:"#475569", marginBottom:16 }}><strong>תאריכים:</strong> {booking.start_date} - {booking.end_date}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
          <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff", color:"#374151", cursor:"pointer" }}>סגור</button>
          {onDelete && (
            <button onClick={onDelete} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#fee2e2", color:"#dc2626", fontWeight:700, cursor:"pointer" }}>🗑 מחק הזמנה</button>
          )}
          {booking.customer_id && onCustomer && (
            <button onClick={onCustomer} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#0f766e", color:"#fff", fontWeight:700, cursor:"pointer" }}>👤 פרטי לקוח</button>
          )}
          <button onClick={onEdit} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer" }}>עריכת הזמנה</button>
        </div>
      </div>
    </div>
  );
}

// ── Availability Grid ──────────────────────────────────────────────────────────
function AvailabilityGrid({ cars, startDate, endDate, navigate, isMobile }) {
  const [bookings, setBookings]     = useState([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [dragBooking, setDragBooking]   = useState(null);   // booking being dragged
  const [dragOverCarId, setDragOverCarId] = useState(null); // column being hovered
  const [confirmDrop, setConfirmDrop]   = useState(null);   // { booking, fromCar, toCar }
  const [dropLoading, setDropLoading]   = useState(false);
  const [bookingAction, setBookingAction] = useState(null); // { booking, carName }
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(null);

  const todayBase = new Date(); todayBase.setHours(0,0,0,0);
  const todayStr  = toISO(todayBase);
  const startBase = fromISO(startDate);
  const daysCount = Math.max(diffDays(startDate, endDate) + 1, 1);

  useEffect(() => {
    setLoadingGrid(true);
    bookingsAPI.calendar(startDate, endDate)
      .then(setBookings)
      .finally(() => setLoadingGrid(false));
  }, [startDate, endDate]);

  const activeCars = cars.filter(c => c.is_active);
  const dates      = Array.from({ length: daysCount }, (_, i) => addDays(startBase, i));

  // Build occupancy map: "YYYY-MM-DD:carId" → booking
  const occ = {};
  bookings.forEach(b => {
    if (b.status === "cancelled") return;
    dates.forEach(d => {
      const ds = toISO(d);
      if (ds >= b.start_date && ds <= b.end_date) {
        if (!occ[`${ds}:${b.car_id}`]) occ[`${ds}:${b.car_id}`] = [];
        occ[`${ds}:${b.car_id}`].push(b);
      }
    });
  });

  // ── Drag helpers ────────────────────────────────────────────────────────────
  function handleDragStart(e, b) {
    setDragBooking(b);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", b.id.toString());
  }

  function handleDragEnd() {
    setDragBooking(null);
    setDragOverCarId(null);
  }

  function handleDragOverCell(e, carId) {
    if (!dragBooking) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCarId(carId);
  }

  function handleDrop(e, targetCar) {
    e.preventDefault();
    setDragOverCarId(null);
    if (!dragBooking || targetCar.id === dragBooking.car_id) {
      setDragBooking(null);
      return;
    }

    // Collect all dates in the dragged booking's range
    const bookingStart = fromISO(dragBooking.start_date);
    const bookingEnd   = fromISO(dragBooking.end_date);
    const bookingDates = [];
    let cursor = new Date(bookingStart);
    while (cursor <= bookingEnd) {
      bookingDates.push(toISO(cursor));
      cursor = addDays(cursor, 1);
    }

    // Check for conflicts in target car
    const conflicts = bookingDates.filter(d => {
      const cells = occ[`${d}:${targetCar.id}`];
      if (!cells || cells.length === 0) return false;
      return cells.some(cell => {
          if (cell.id === dragBooking.id) return false;
          if (cell.end_date === dragBooking.start_date && d === cell.end_date) {
              const cellRet = cell.return_time || "08:00";
              const dragPick = dragBooking.pickup_time || "08:30";
              if (cellRet <= dragPick) return false;
          }
          if (cell.start_date === dragBooking.end_date && d === cell.start_date) {
              const cellPick = cell.pickup_time || "08:30";
              const dragRet = dragBooking.return_time || "08:00";
              if (cellPick >= dragRet) return false;
          }
          return true;
      });
    });

    if (conflicts.length > 0) {
      alert(
        `לא ניתן להעביר ל-${targetCar.name}:\n` +
        `ישנה הזמנה קיימת בתאריכים ${conflicts[0]} – ${conflicts[conflicts.length - 1]}`
      );
      setDragBooking(null);
      return;
    }

    const fromCar = activeCars.find(c => c.id === dragBooking.car_id) || { name: `רכב #${dragBooking.car_id}` };
    setConfirmDrop({ booking: dragBooking, fromCar, toCar: targetCar });
  }

  async function executeReassign() {
    if (!confirmDrop) return;
    setDropLoading(true);
    try {
      await bookingsAPI.update(confirmDrop.booking.id, { car_id: confirmDrop.toCar.id });
      const data = await bookingsAPI.calendar(startDate, endDate);
      setBookings(data);
    } catch (err) {
      alert("שגיאה בעדכון ההזמנה: " + (err?.response?.data?.detail || err.message || "שגיאה לא ידועה"));
    } finally {
      setDropLoading(false);
      setConfirmDrop(null);
      setDragBooking(null);
    }
  }

  async function executeDelete() {
    if (!confirmDeleteBooking) return;
    setLoadingGrid(true);
    try {
      await bookingsAPI.delete(confirmDeleteBooking.id);
      const data = await bookingsAPI.calendar(startDate, endDate);
      setBookings(data);
      toast.success("ההזמנה נמחקה בהצלחה");
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err));
    } finally {
      setLoadingGrid(false);
      setConfirmDeleteBooking(null);
    }
  }

  if (activeCars.length === 0) {
    return (
      <div style={{ ...cardStyle, padding:20, marginBottom:20, color:"#64748b" }}>
        אין רכבים להצגה עבור הסינון שנבחר.
      </div>
    );
  }

  return (
    <>
      {bookingAction && (
        <BookingActionModal
          booking={bookingAction.booking}
          carName={bookingAction.carName}
          onClose={() => setBookingAction(null)}
          onDelete={() => {
            setConfirmDeleteBooking(bookingAction.booking);
            setBookingAction(null);
          }}
          onEdit={() => {
            navigate("/bookings", { state: { bookingEditId: bookingAction.booking.id } });
            setBookingAction(null);
          }}
          onCustomer={() => {
            navigate("/customers", { state: { highlightCustomerId: bookingAction.booking.customer_id } });
            setBookingAction(null);
          }}
        />
      )}
      {confirmDrop && (
        <ReassignModal
          booking={confirmDrop.booking}
          fromCar={confirmDrop.fromCar}
          toCar={confirmDrop.toCar}
          loading={dropLoading}
          onConfirm={executeReassign}
          onCancel={() => { setConfirmDrop(null); setDragBooking(null); }}
        />
      )}
      <Confirm
        open={!!confirmDeleteBooking}
        message={`למחוק את ההזמנה של ${confirmDeleteBooking?.customer_name}? לא ניתן לבטל פעולה זו.`}
        confirmLabel="מחק הזמנה"
        confirmColor="#dc2626"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDeleteBooking(null)}
      />

    <div style={{ ...cardStyle, padding:0, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"14px 18px", borderBottom:"1px solid #e2e8f0", gap:12, flexWrap:"wrap" }}>
        <h3 style={{ ...cardTitle, margin:0 }}>📅 זמינות רכבים</h3>
        <div style={{ fontSize:12, color:"#64748b" }}>
          מציג מ־<strong>{startDate}</strong> עד <strong>{endDate}</strong>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, padding:"8px 18px", background:"#f8fafc",
                    borderBottom:"1px solid #e2e8f0", fontSize:11, color:"#64748b", flexWrap:"wrap" }}>
        <span><span style={dot("#dcfce7","#15803d")} />פנוי</span>
        <span><span style={dot("#fee2e2","#b91c1c")} />תפוס</span>
        <span><span style={dot("#dbeafe","#1d4ed8")} />יציאה היום</span>
        <span><span style={dot("#fef9c3","#854d0e")} />חזרה היום</span>
        <span><span style={dot("#e9d5ff","#7c3aed")} />חד-יומי</span>
        <span><span style={dot("#f3e8ff","#7c3aed")} />שבת</span>
        <span><span style={dot("#fee2e2","#dc2626")} />חג</span>
        <span><span style={dot("#bfdbfe","#2563eb")} />✥ גרור להעברה</span>
        <span><span style={dot("#e5e7eb","#64748b")} />עבר · לא ניתן להזמין</span>
        {loadingGrid && <span style={{ marginRight:"auto", color:"#94a3b8" }}>מרענן...</span>}
      </div>

      {/* Grid table */}
      <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:isMobile ? 380 : 480 }}>
        <table style={{ borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr>
              {/* Corner cell — sticky top + right (RTL freeze pane) */}
              <th style={{ ...gth, position:"sticky", top:0, right:0, zIndex:3,
                           background:"#f1f5f9", minWidth:74, borderLeft:"2px solid #cbd5e1" }}>תאריך</th>
              {activeCars.map(car => {
                const tc = getModelTheme(car.name);
                const isDragTarget = dragBooking && dragOverCarId === car.id && car.id !== dragBooking.car_id;
                return (
                  <th key={car.id} style={{ ...gth, minWidth:isMobile ? 78 : 62, position:"sticky", top:0, zIndex:2,
                                            background: isDragTarget ? "#bfdbfe" : tc.bg,
                                            borderBottom:`3px solid ${isDragTarget ? "#2563eb" : tc.border}`,
                                            transition:"background 0.15s" }}>
                    <div style={{ fontWeight:700, color: isDragTarget ? "#1d4ed8" : tc.text }}>{car.name}</div>
                    <div style={{ color: isDragTarget ? "#2563eb" : tc.border, fontWeight:500, fontSize:9, marginTop:2 }}>
                      {[`#${car.id}`, car.plate, car.make, car.group ? `קב׳ ${car.group}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const ds = toISO(date);
              const dayMeta = getJewishDayMeta(ds);
              const isToday = ds === todayStr;
              const isPastDay = ds < todayStr;
              return (
                <tr key={ds}>
                  {/* Date cell — sticky right (RTL) */}
                  <td style={{ ...gtd, fontWeight:600, whiteSpace:"nowrap",
                               position:"sticky", right:0, zIndex:1,
                               background: isPastDay ? "#f1f5f9" : (isToday ? "#fff7ed" : (dayMeta.isShabbat ? "#f3e8ff" : "#f8fafc")),
                               borderLeft:"2px solid #cbd5e1",
                               color: isPastDay ? "#94a3b8" : (isToday ? "#d97706" : "#374151") }}>
                    <div>{fmtDay(date)}</div>
                    <div style={{ fontSize:9, color:"#64748b", marginTop:2 }}>{dayMeta.hebrewDate}</div>
                    {(dayMeta.isShabbat || dayMeta.isHoliday || dayMeta.isErevChag) && (
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:3 }}>
                        {dayMeta.isShabbat && <span style={{ ...miniTag, background:"#7c3aed" }}>שבת</span>}
                        {dayMeta.isHoliday && <span style={{ ...miniTag, background:"#dc2626" }}>{dayMeta.holidayNames[0] || "חג"}</span>}
                        {dayMeta.isErevChag && <span style={{ ...miniTag, background:"#d97706" }}>ערב חג</span>}
                      </div>
                    )}
                     {isPastDay && <span style={{ fontSize:9, color:"#64748b", marginRight:4,
                                                background:"#e2e8f0", borderRadius:4,
                                                padding:"1px 4px" }}>עבר</span>}
                    {isToday && <span style={{ fontSize:9, color:"#f59e0b", marginRight:4,
                                               background:"#fef3c7", borderRadius:4,
                                               padding:"1px 4px" }}>היום</span>}
                  </td>
                  {activeCars.map(car => {
                    const cellBookings = occ[`${ds}:${car.id}`] || [];
                    const isDropColumn = dragBooking && dragOverCarId === car.id && car.id !== dragBooking?.car_id;

                    if (cellBookings.length === 0) {
                      return (
                        <td key={car.id}
                            title={isPastDay ? `לא ניתן להזמין את ${car.name} לתאריך עבר` : (dragBooking ? `שחרר להעברה ל-${car.name}` : `לחץ להזמנת ${car.name} ב-${ds}`)}
                            onClick={() => !dragBooking && !isPastDay && navigate("/bookings", {
                              state: { bookingPrefill: { car_id: car.id, start_date: ds } }
                            })}
                            onDragOver={e => handleDragOverCell(e, car.id)}
                            onDrop={e => handleDrop(e, car)}
                            onDragLeave={() => setDragOverCarId(null)}
                            style={{ ...gtd, textAlign:"center",
                                     background: isPastDay ? "#e5e7eb" : (isDropColumn ? "#bfdbfe" : "#dcfce7"),
                                     color: isPastDay ? "#64748b" : (isDropColumn ? "#1d4ed8" : "#15803d"),
                                     cursor: isPastDay ? "not-allowed" : (dragBooking ? "copy" : "pointer"),
                                     transition:"background 0.15s",
                                     outline: isPastDay ? "1px dashed #94a3b8" : (isDropColumn ? "2px dashed #2563eb" : "none"),
                                     outlineOffset:"-2px",
                                     boxShadow: dayMeta.isShabbat ? "inset 0 -2px 0 #7c3aed55" : (dayMeta.isHoliday ? "inset 0 -2px 0 #dc262655" : "none") }}
                            onMouseEnter={e => { if (!dragBooking && !isPastDay) { e.currentTarget.style.background="#bbf7d0"; e.currentTarget.style.fontWeight="700"; }}}
                            onMouseLeave={e => { if (!dragBooking && !isPastDay) { e.currentTarget.style.background="#dcfce7"; e.currentTarget.style.fontWeight="normal"; }}}>
                          {isPastDay ? "עבר" : (isDropColumn ? "⬇" : "✓")}
                        </td>
                      );
                    }

                    const isConflict = dragBooking && dragOverCarId === car.id && cellBookings.some(cell => {
                      if (cell.id === dragBooking.id) return false;
                      if (cell.end_date === dragBooking.start_date && ds === cell.end_date) {
                          const cellRet = cell.return_time || "08:00";
                          const dragPick = dragBooking.pickup_time || "08:30";
                          if (cellRet <= dragPick) return false;
                      }
                      if (cell.start_date === dragBooking.end_date && ds === cell.start_date) {
                          const cellPick = cell.pickup_time || "08:30";
                          const dragRet = dragBooking.return_time || "08:00";
                          if (cellPick >= dragRet) return false;
                      }
                      return true;
                    });

                    if (cellBookings.length > 1) {
                        return (
                            <td key={car.id}
                                onDragOver={e => handleDragOverCell(e, car.id)}
                                onDrop={e => handleDrop(e, car)}
                                onDragLeave={() => setDragOverCarId(null)}
                                style={{ ...gtd, padding: 2, textAlign:"center", background: isDropColumn ? (isConflict ? "#fecaca" : "#bfdbfe") : "#fef08a", outline: isConflict ? "2px solid #ef4444" : "none", outlineOffset: "-2px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
                                    {cellBookings.map(b => {
                                        const isDraggingThis = dragBooking?.id === b.id;
                                        return (
                                        <div key={b.id}
                                             title={`${b.customer_name} | ${b.start_date} ${b.pickup_time||""} - ${b.end_date} ${b.return_time||""}\n${isDraggingThis ? "גרור לרכב אחר להעברה" : ""}`}
                                             draggable={true}
                                             onDragStart={e => handleDragStart(e, b)}
                                             onDragEnd={handleDragEnd}
                                             onClick={e => {
                                                 e.stopPropagation();
                                                 if (dragBooking) return;
                                                 setBookingAction({ booking: b, carName: car.name || `רכב #${car.id}` });
                                             }}
                                             style={{ flex: 1, background: isDraggingThis ? "#e0f2fe" : "rgba(255,255,255,0.7)", borderRadius: 2, padding: "2px 4px", fontSize: 10, color: isDraggingThis ? "#0369a1" : "#854d0e", cursor: isDraggingThis ? "grabbing" : "grab", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "1px solid rgba(133,77,14,0.2)", opacity: isDraggingThis ? 0.7 : 1 }}>
                                             {b.customer_name?.split(" ")[0]}
                                        </div>
                                    )})}
                                </div>
                            </td>
                        );
                    }

                    const b = cellBookings[0];
                    const isFirst   = b.start_date === ds;
                    const isLast    = b.end_date   === ds;
                    const isSameDay = isFirst && isLast;
                    const isDragging = dragBooking?.id === b.id;

                    let bg, fg, label;
                    if (isSameDay) {
                      bg = "#e9d5ff"; fg = "#7c3aed";
                      label = <>⬦ חד-יומי<br/><small>{b.pickup_time||"08:30"}</small></>;
                    } else if (isFirst) {
                      bg = "#dbeafe"; fg = "#1d4ed8";
                      label = <>🚀 יציאה<br/><small>{b.pickup_time||"08:30"}</small></>;
                    } else if (isLast) {
                      bg = "#fef9c3"; fg = "#854d0e";
                      label = <>↩ חזרה<br/><small>{b.return_time||"08:00"}</small></>;
                    } else {
                      bg = "#fee2e2"; fg = "#b91c1c";
                      label = b.customer_name?.split(" ")[0] ?? "תפוס";
                    }

                    return (
                      <td key={car.id}
                          title={`${b.customer_name} | ${b.start_date} ${b.pickup_time||""} – ${b.end_date} ${b.return_time||""}\n${isDragging ? "גרור לרכב אחר להעברה" : ""}`}
                          onClick={() => {
                            if (dragBooking) return;
                            setBookingAction({ booking: b, carName: car.name || `רכב #${car.id}` });
                          }}
                          draggable={!!b}
                          onDragStart={e => handleDragStart(e, b)}
                          onDragEnd={handleDragEnd}
                          onDragOver={e => handleDragOverCell(e, car.id)}
                          onDrop={e => handleDrop(e, car)}
                          onDragLeave={() => setDragOverCarId(null)}
                          style={{ ...gtd, textAlign:"center",
                                   background: isDragging ? "#e0f2fe" :
                                               isConflict ? "#fecaca" :
                                               isDropColumn ? "#bfdbfe" : bg,
                                   color: isDragging ? "#0369a1" :
                                          isConflict ? "#991b1b" : fg,
                                   lineHeight:1.3,
                                   cursor: isDragging ? "grabbing" : "grab",
                                   opacity: isDragging ? 0.7 : 1,
                                   outline: isConflict ? "2px solid #ef4444" : "none",
                                   outlineOffset:"-2px",
                                   boxShadow: dayMeta.isShabbat ? "inset 0 -2px 0 #7c3aed55" : (dayMeta.isHoliday ? "inset 0 -2px 0 #dc262655" : "none"),
                                   transition:"background 0.15s, opacity 0.15s" }}>
                        {label}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}

const dot = (bg, fg) => ({
  display:"inline-block", width:10, height:10, borderRadius:2,
  background:bg, border:`1px solid ${fg}30`, marginLeft:4, verticalAlign:"middle",
});
const fieldWrap = { display:"flex", flexDirection:"column", gap:6, minWidth:160 };
const fieldLabel = { fontSize:12, color:"#64748b", fontWeight:600 };
const inputStyle = {
  border:"1px solid #cbd5e1", borderRadius:8, padding:"0 12px", fontSize:13,
  background:"#fff", color:"#0f172a", height:38, boxSizing:"border-box",
  display:"block",
};
const chipStyle = {
  padding:"8px 10px", borderRadius:999, border:"1px solid #cbd5e1", background:"#fff",
  color:"#334155", fontSize:12, fontWeight:600, cursor:"pointer",
};
const activeChip = { ...chipStyle, background:"#1d4ed8", color:"#fff", borderColor:"#1d4ed8" };
const gth = { padding:"8px 10px", fontWeight:700, borderBottom:"2px solid #e2e8f0",
              textAlign:"center", fontSize:11, color:"#475569", whiteSpace:"nowrap" };
const gtd = { padding:"7px 8px", borderBottom:"1px solid #f1f5f9", fontSize:12 };
const miniTag = { fontSize:8, fontWeight:700, color:"#fff", borderRadius:999, padding:"1px 5px" };
const cardStyle = { background:"#fff", borderRadius:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" };
const cardTitle = { margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" };
const multiSelectBox = {
  border:"1px solid #cbd5e1", borderRadius:8, background:"#fff",
  padding:"6px 10px", maxHeight:130, overflowY:"auto",
  display:"flex", flexDirection:"column", gap:4,
};
const multiSelectItem = (isSelected) => ({
  display:"flex", alignItems:"center", gap:6, cursor:"pointer",
  fontSize:13, fontWeight: isSelected ? 700 : 400,
  color: isSelected ? "#1d4ed8" : "#374151",
  padding:"2px 0"
});
const separator = { borderTop:"1px solid #f1f5f9", margin:"2px 0" };


// ══════════════════════════════════════════════════════════════════════════════
