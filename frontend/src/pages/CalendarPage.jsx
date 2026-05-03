// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useMemo } from "react";
import { bookingsAPI } from "../api/bookings";
import { carsAPI } from "../api/cars";
import { getJewishDayMeta } from "../utils/jewishCalendar";
import { useIsMobile } from "../hooks/useIsMobile";

const TYPE_COLORS = {
  sedan:"#3b82f6", crossover:"#8b5cf6", suv:"#10b981", hatchback:"#f59e0b",
  mini:"#ec4899", hybrid:"#06b6d4", electric:"#22c55e", luxury:"#ef4444", van:"#f97316",
};

// ── Hebrew calendar helpers (Intl) ──────────────────────────────────────────
function toHebrewDay(year, month, day) {
  try {
    return new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric" })
      .format(new Date(year, month, day));
  } catch { return ""; }
}

function hebrewMonthsInGregorianMonth(year, month) {
  /** Return all unique Hebrew month names that appear in the Gregorian month */
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const fmt = new Intl.DateTimeFormat("he-u-ca-hebrew", { month: "long" });
  const seen = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const name = fmt.format(new Date(year, month, d));
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

function hebrewYearsInGregorianMonth(year, month) {
  const fmt = new Intl.DateTimeFormat("he-u-ca-hebrew", { year: "numeric" });
  const first = fmt.format(new Date(year, month, 1));
  const last  = fmt.format(new Date(year, month + 1, 0));
  return first === last ? first : `${first} / ${last}`;
}

function getCalendarDayStyle(meta, isToday) {
  if (isToday) {
    return { background: "#eff6ff", border: "2px solid #3b82f6" };
  }
  if (meta.isHoliday) {
    return { background: "#fee2e2", border: "1px solid #fecaca" };
  }
  if (meta.isShabbat) {
    return { background: "#ede9fe", border: "1px solid #ddd6fe" };
  }
  if (meta.isErevChag) {
    return { background: "#fef3c7", border: "1px solid #fde68a" };
  }
  return { background: "#fff", border: "1px solid #e2e8f0" };
}

// ── Component ────────────────────────────────────────────────────────────────
export function CalendarPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState([]);
  const [cars, setCars]         = useState({});
  const [showHebrew, setShowHebrew] = useState(true);
  const isMobile = useIsMobile(640);

  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // RTL grid: column order is א(Sun)=col1 ... ש(Sat)=col7 (leftmost in RTL)
  // JS getDay(): Sun=0, Mon=1, ..., Sat=6
  // We want: Sun→0 offset, Mon→1, ..., Sat→6
  const startOffset = firstDay.getDay(); // Sun=0..Sat=6

  const monthStr = String(month + 1).padStart(2, "0");
  const start = `${year}-${monthStr}-01`;
  const end   = `${year}-${monthStr}-${String(daysInMonth).padStart(2,"0")}`;

  useEffect(() => {
    bookingsAPI.calendar(start, end).then(setBookings);
    carsAPI.list().then(list =>
      setCars(Object.fromEntries(list.map(c => [c.id, c])))
    );
  }, [year, month]);

  const dayBookings = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const s = new Date(b.start_date), e = new Date(b.end_date);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() !== month) continue;
        const key = d.getDate();
        if (!map[key]) map[key] = [];
        map[key].push(b);
      }
    });
    return map;
  }, [bookings, month]);

   const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                       "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
   // RTL column order: right→left = א(Sun), ב(Mon), ג(Tue), ד(Wed), ה(Thu), ו(Fri), ש(Sat=left)
   const DAYS_HE   = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  // Hebrew header data
  const hebrewMonths = hebrewMonthsInGregorianMonth(year, month);
  const hebrewYear   = hebrewYearsInGregorianMonth(year, month);

  return (
    <div dir="rtl">
      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <h1 style={{ fontSize: isMobile ? 18 : 24, fontWeight:800, margin:0, flex: isMobile ? "1 1 100%" : "0 0 auto" }}>לוח זמינות רכבים</h1>
        {!isMobile && <div style={{ flex:1 }} />}
        <button
          onClick={() => setShowHebrew(v => !v)}
          style={{
            ...navBtn,
            background: showHebrew ? "#1d4ed8" : "#f1f5f9",
            color: showHebrew ? "#fff" : "#334155",
            fontSize: isMobile ? 11 : 13, fontWeight:700,
          }}
        >
          {showHebrew ? "✦ עברי" : "✦ הצג עברי"}
        </button>
        <button onClick={prevMonth} style={navBtn}>→</button>
        <span style={{ fontWeight:700, fontSize: isMobile ? 13 : 16, minWidth: isMobile ? 100 : 140, textAlign:"center" }}>
          {MONTHS_HE[month]} {year}
        </span>
        <button onClick={nextMonth} style={navBtn}>←</button>
      </div>

      {/* ── Hebrew month subtitle ── */}
      {showHebrew && (
        <div style={{
          textAlign:"center", marginBottom:16,
          fontSize:15, fontWeight:700, color:"#1d4ed8",
          letterSpacing:0.5,
        }}>
          {hebrewMonths.join(" – ")} {hebrewYear}
        </div>
      )}

      {/* Scroll wrapper for mobile */}
      <div style={{ overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: isMobile ? 420 : undefined }}>

      {/* Days header */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {DAYS_HE.map((d, i) => (
          <div key={d} style={{
            textAlign:"center", fontSize: isMobile ? 11 : 12, fontWeight:700,
            color: i === 6 ? "#7c3aed" : "#64748b",
            padding: isMobile ? "6px 0" : "8px 0",
            background: i === 6 ? "#f5f3ff" : "transparent",
            borderRadius: i === 6 ? "6px 6px 0 0" : 0,
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`e${i}`} style={emptyCell} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day   = i + 1;
          const dayDate = new Date(year, month, day);
          const bList = dayBookings[day] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hebDay  = showHebrew ? toHebrewDay(year, month, day) : null;
          const dayMeta = getJewishDayMeta(dayDate);
          const dayStyle = getCalendarDayStyle(dayMeta, isToday);

          const isHebrewFirst = showHebrew && hebDay === "א׳";

          return (
            <div key={day} style={{
              ...dayCell,
              ...(isMobile ? mobileDayCell : {}),
              ...dayStyle,
            }}>
              {/* Day number row */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                <span style={{
                  fontSize:13, fontWeight:800,
                  color: isToday ? "#3b82f6" : "#334155",
                  lineHeight:1,
                }}>
                  {day}
                </span>
                {showHebrew && hebDay && (
                  <span style={{
                    fontSize:11, fontWeight:700,
                    color: isHebrewFirst ? "#7c3aed" : "#64748b",
                    lineHeight:1,
                    background: isHebrewFirst ? "#ede9fe" : "transparent",
                    borderRadius: isHebrewFirst ? 4 : 0,
                    padding: isHebrewFirst ? "1px 4px" : 0,
                  }}>
                    {hebDay}
                  </span>
                )}
              </div>
              {(dayMeta.isShabbat || dayMeta.isHoliday || dayMeta.isErevChag) && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                  {dayMeta.isShabbat && <span style={{ ...tagBase, background:"#7c3aed" }}>שבת</span>}
                  {dayMeta.isHoliday && <span style={{ ...tagBase, background:"#dc2626" }}>{dayMeta.holidayNames[0] || "חג"}</span>}
                  {dayMeta.isErevChag && <span style={{ ...tagBase, background:"#d97706" }}>{dayMeta.erevNames[0] || "ערב חג"}</span>}
                </div>
              )}
              {dayMeta.closureAtNoon && (
                <div style={{ fontSize:10, fontWeight:700, color:"#92400e", marginBottom:4 }}>
                  🕛 סגירה ב-12:00
                </div>
              )}
              {bList.slice(0,3).map(b => {
                const car = cars[b.car_id];
                return (
                  <div key={b.id} title={`${b.customer_name} — ${car?.name}`}
                    style={{
                      background: car ? `${TYPE_COLORS[car.type]}20` : "#f1f5f9",
                      borderRight: `3px solid ${car ? TYPE_COLORS[car.type] : "#94a3b8"}`,
                      borderRadius:3, padding:"1px 4px", fontSize:10, marginBottom:1,
                      overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
                      color:"#334155",
                    }}
                  >{car?.name || "רכב"}</div>
                );
              })}
              {bList.length > 3 && (
                <div style={{ fontSize:10, color:"#94a3b8" }}>+{bList.length - 3} עוד</div>
              )}
            </div>
          );
        })}
      </div>

        </div>{/* end minWidth div */}
      </div>{/* end scroll wrapper */}

      {/* Hebrew month legend */}
      {showHebrew && (
        <div style={{
          marginTop:12, padding:"8px 14px",
          background:"#ede9fe", borderRadius:8,
          fontSize:12, color:"#5b21b6", fontWeight:600,
          display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
        }}>
          <span>✡ חודש עברי:</span>
          {hebrewMonths.map(m => <span key={m} style={{ background:"#7c3aed", color:"#fff", borderRadius:6, padding:"2px 8px" }}>{m}</span>)}
          <span style={{ color:"#7c3aed" }}>· שנה: {hebrewYear}</span>
          <span style={{ marginRight:"auto", fontWeight:400, color:"#6d28d9" }}>
            תאריך בצד ימין של כל תא = יום עברי ·
            <b> א׳ </b> = ראש חודש (מסומן בסגול)
          </span>
        </div>
      )}

      {/* Car type legend */}
      <div style={{ marginTop:12, display:"flex", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
          <div style={{ width:12, height:12, background:"#ede9fe", borderRadius:3 }} />
          <span style={{ color:"#475569" }}>שבת</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
          <div style={{ width:12, height:12, background:"#fee2e2", borderRadius:3 }} />
          <span style={{ color:"#475569" }}>חג</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
          <div style={{ width:12, height:12, background:"#fef3c7", borderRadius:3 }} />
          <span style={{ color:"#475569" }}>ערב חג (סגירה 12:00)</span>
        </div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
            <div style={{ width:12, height:12, background:color, borderRadius:3 }} />
            <span style={{ color:"#475569" }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
const navBtn  = { background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:8,
                  padding:"6px 14px", cursor:"pointer", fontSize:16 };
const dayCell = { minHeight:90, padding:6, borderRadius:6, verticalAlign:"top" };
const mobileDayCell = { minHeight:60, padding:"3px 2px", fontSize:10 };
const emptyCell = { minHeight:90, background:"#fafafa", borderRadius:6, border:"1px solid #f1f5f9" };
const tagBase = {
  fontSize: 9,
  fontWeight: 700,
  color: "#fff",
  borderRadius: 999,
  padding: "1px 6px",
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
