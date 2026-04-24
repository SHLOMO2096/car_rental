// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useMemo } from "react";
import { bookingsAPI } from "../api/bookings";
import { carsAPI } from "../api/cars";

const TYPE_COLORS = {
  sedan:"#3b82f6", crossover:"#8b5cf6", suv:"#10b981", hatchback:"#f59e0b",
  mini:"#ec4899", hybrid:"#06b6d4", electric:"#22c55e", luxury:"#ef4444", van:"#f97316",
};

export function CalendarPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState([]);
  const [cars, setCars]         = useState({});

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 1) % 7; // RTL: Sunday=0

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
  const DAYS_HE   = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  return (
    <div dir="rtl">
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>לוח זמינות רכבים</h1>
        <div style={{ flex:1 }} />
        <button onClick={prevMonth} style={navBtn}>→</button>
        <span style={{ fontWeight:700, fontSize:16, minWidth:140, textAlign:"center" }}>
          {MONTHS_HE[month]} {year}
        </span>
        <button onClick={nextMonth} style={navBtn}>←</button>
      </div>

      {/* Days header */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {DAYS_HE.map(d => (
          <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700,
               color:"#64748b", padding:"8px 0" }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`e${i}`} style={emptyCell} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const bList = dayBookings[day] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div key={day} style={{
              ...dayCell,
              border: isToday ? "2px solid #3b82f6" : "1px solid #e2e8f0",
              background: isToday ? "#eff6ff" : "#fff",
            }}>
              <div style={{ fontSize:12, fontWeight:700, color: isToday ? "#3b82f6" : "#334155",
                   marginBottom:4 }}>{day}</div>
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

      {/* Legend */}
      <div style={{ marginTop:20, display:"flex", gap:12, flexWrap:"wrap" }}>
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
const emptyCell = { minHeight:90, background:"#fafafa", borderRadius:6, border:"1px solid #f1f5f9" };
