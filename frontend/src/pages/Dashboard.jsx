// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsAPI } from "../api/reports";
import { carsAPI } from "../api/cars";
import { bookingsAPI } from "../api/bookings";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  const [summary, setSummary]   = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [topCars, setTopCars]   = useState([]);
  const [cars, setCars]         = useState([]);
  const year = new Date().getFullYear();
  const todayBase = new Date();
  todayBase.setHours(0,0,0,0);

  const [selectedModel, setSelectedModel] = useState("");
  const [rangeStart, setRangeStart] = useState(toISO(addDays(todayBase, -2)));
  const [rangeEnd, setRangeEnd]     = useState(toISO(addDays(todayBase, 4)));

  const modelOptions = useMemo(
    () => [...new Set(cars.filter(c => c.is_active).map(c => c.name))].sort((a, b) => a.localeCompare(b, "he")),
    [cars]
  );
  const filteredCars = useMemo(
    () => cars.filter(c => c.is_active && (!selectedModel || c.name === selectedModel)),
    [cars, selectedModel]
  );
  const visibleDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);

  useEffect(() => {
    carsAPI.list().then(setCars).catch(() => setCars([]));
  }, []);

  useEffect(() => {
    reportsAPI.summary(selectedModel || undefined)
      .then(setSummary)
      .catch(() => setSummary({ total: 0, active: 0, revenue: 0 }));
    reportsAPI.monthly(year, selectedModel || undefined)
      .then(rows => setMonthly(rows.map(r => ({ ...r, name: MONTH_NAMES[r.month - 1] }))))
      .catch(() => setMonthly([]));
    reportsAPI.topCars(5, selectedModel || undefined)
      .then(setTopCars)
      .catch(() => setTopCars([]));
  }, [year, selectedModel]);

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
      <h1 style={{ fontSize:24, fontWeight:800, marginBottom:24 }}>לוח בקרה</h1>

      <div style={{ ...cardStyle, padding:16, marginBottom:20 }}>
        <div style={{ display:"flex", gap:12, alignItems:"end", flexWrap:"wrap" }}>
          <label style={fieldWrap}>
            <span style={fieldLabel}>דגם</span>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={inputStyle}>
              <option value="">כל הדגמים</option>
              {modelOptions.map(model => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>

          <label style={fieldWrap}>
            <span style={fieldLabel}>מתאריך</span>
            <input type="date" value={rangeStart} onChange={(e) => setStartAndKeepRange(e.target.value)} style={inputStyle} />
          </label>

          <label style={fieldWrap}>
            <span style={fieldLabel}>עד תאריך</span>
            <input type="date" value={rangeEnd} onChange={(e) => setEndWithGuard(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
            <span style={fieldLabel}>טווח מהיר</span>
            {[7,14,30].map(days => (
              <button key={days} onClick={() => applyPreset(days)} style={days === visibleDays ? activeChip : chipStyle}>
                {days} ימים
              </button>
            ))}
            <button onClick={() => shiftRange(-7)} style={chipStyle}>7 ימים אחורה</button>
            <button onClick={() => shiftRange(7)} style={chipStyle}>7 ימים קדימה</button>
          </div>
        </div>

        <div style={{ marginTop:10, fontSize:12, color:"#64748b" }}>
          מוצג כעת: <strong>{selectedModel || "כל הדגמים"}</strong> · טווח: <strong>{visibleDays}</strong> ימים
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:16, marginBottom:32 }}>
        {[
          { label:"סה״כ הזמנות",  value: summary?.total   ?? "—", color:"#3b82f6", icon:"📋" },
          { label:"הזמנות פעילות",value: summary?.active  ?? "—", color:"#22c55e", icon:"✅" },
          { label:"הכנסות השנה",  value: summary ? `₪${Math.round(summary.revenue).toLocaleString()}` : "—", color:"#f59e0b", icon:"💰" },
          { label:"רכבים מוצגים",  value: filteredCars.length,      color:"#8b5cf6", icon:"🚗" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", borderRadius:12, padding:"20px 24px",
               border:`1px solid ${s.color}30`, display:"flex", gap:14, alignItems:"center",
               boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize:32 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:"#94a3b8" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Availability Grid */}
      <AvailabilityGrid cars={filteredCars} startDate={rangeStart} endDate={rangeEnd} navigate={navigate} />

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginTop:20 }}>
        <div style={cardStyle}>
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

         <div style={cardStyle}>
           <h3 style={cardTitle}>רכבים מובילים</h3>
          {topCars.length === 0 && <div style={{ color:"#94a3b8", fontSize:13 }}>אין נתונים להצגה</div>}
          {topCars.map((c, i) => (
            <div key={c.car_id} style={{ display:"flex", alignItems:"center", gap:10,
                 padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
              <span style={{ width:24, height:24, background:"#3b82f6", color:"#fff",
                   borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                   fontSize:12, fontWeight:700 }}>{i+1}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{c.name}</div>
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

// ── Availability Grid ──────────────────────────────────────────────────────────
function AvailabilityGrid({ cars, startDate, endDate, navigate }) {
  const [bookings, setBookings]   = useState([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

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
        occ[`${ds}:${b.car_id}`] = b;
      }
    });
  });

  if (activeCars.length === 0) {
    return (
      <div style={{ ...cardStyle, padding:20, marginBottom:20, color:"#64748b" }}>
        אין רכבים להצגה עבור הסינון שנבחר.
      </div>
    );
  }

  return (
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
        {loadingGrid && <span style={{ marginRight:"auto", color:"#94a3b8" }}>מרענן...</span>}
      </div>

      {/* Grid table */}
      <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:480 }}>
        <table style={{ borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr>
              {/* Corner cell — sticky top + right (RTL freeze pane) */}
              <th style={{ ...gth, position:"sticky", top:0, right:0, zIndex:3,
                           background:"#f1f5f9", minWidth:74, borderLeft:"2px solid #cbd5e1" }}>תאריך</th>
              {activeCars.map(car => {
                const tc = getModelTheme(car.name);
                return (
                  <th key={car.id} style={{ ...gth, minWidth:62, position:"sticky", top:0, zIndex:2,
                                            background: tc.bg, borderBottom:`3px solid ${tc.border}` }}>
                    <div style={{ fontWeight:700, color: tc.text }}>{car.name}</div>
                    <div style={{ color: tc.border, fontWeight:500, fontSize:9, marginTop:2 }}>
                      {[car.make, car.group ? `קב׳ ${car.group}` : null, car.plate].filter(Boolean).join(" · ")}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const ds = toISO(date);
              const isToday = ds === todayStr;
              return (
                <tr key={ds}>
                  {/* Date cell — sticky right (RTL) */}
                  <td style={{ ...gtd, fontWeight:600, whiteSpace:"nowrap",
                               position:"sticky", right:0, zIndex:1,
                               background: isToday ? "#fff7ed" : "#f8fafc",
                               borderLeft:"2px solid #cbd5e1",
                               color: isToday ? "#d97706" : "#374151" }}>
                    {fmtDay(date)}
                    {isToday && <span style={{ fontSize:9, color:"#f59e0b", marginRight:4,
                                               background:"#fef3c7", borderRadius:4,
                                               padding:"1px 4px" }}>היום</span>}
                  </td>
                  {activeCars.map(car => {
                    const b  = occ[`${ds}:${car.id}`];
                    if (!b) {
                      return (
                        <td key={car.id}
                            title={`לחץ להזמנת ${car.name} ב-${ds}`}
                            onClick={() => navigate("/bookings", {
                              state: { bookingPrefill: { car_id: car.id, start_date: ds } }
                            })}
                            style={{ ...gtd, textAlign:"center", background:"#dcfce7",
                                     color:"#15803d", cursor:"pointer" }}
                            onMouseEnter={e => { e.currentTarget.style.background="#bbf7d0"; e.currentTarget.style.fontWeight="700"; }}
                            onMouseLeave={e => { e.currentTarget.style.background="#dcfce7"; e.currentTarget.style.fontWeight="normal"; }}>
                          ✓
                        </td>
                      );
                    }
                    const isFirst   = b.start_date === ds;
                    const isLast    = b.end_date   === ds;
                    const isSameDay = isFirst && isLast;
                    let bg, fg, label;
                    if (isSameDay) {
                      bg = "#e9d5ff"; fg = "#7c3aed";
                      label = <>⬦ חד-יומי<br/><small>{b.pickup_time||"08:00"}</small></>;
                    } else if (isFirst) {
                      bg = "#dbeafe"; fg = "#1d4ed8";
                      label = <>🚀 יציאה<br/><small>{b.pickup_time||"08:00"}</small></>;
                    } else if (isLast) {
                      bg = "#fef9c3"; fg = "#854d0e";
                      label = <>↩ חזרה<br/><small>{b.return_time||"08:00"}</small></>;
                    } else {
                      bg = "#fee2e2"; fg = "#b91c1c";
                      label = b.customer_name?.split(" ")[0] ?? "תפוס";
                    }
                    return (
                      <td key={car.id}
                          title={`${b.customer_name} | ${b.start_date} ${b.pickup_time||""} – ${b.end_date} ${b.return_time||""}`}
                          style={{ ...gtd, textAlign:"center", background:bg, color:fg,
                                   lineHeight:1.3, cursor:"default" }}>
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
const cardStyle = { background:"#fff", borderRadius:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" };
const cardTitle = { margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" };


// ══════════════════════════════════════════════════════════════════════════════
