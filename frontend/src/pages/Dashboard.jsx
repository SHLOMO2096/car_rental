// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { reportsAPI } from "../api/reports";
import { carsAPI } from "../api/cars";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const MONTH_NAMES = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];

export function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [topCars, setTopCars]   = useState([]);
  const [cars, setCars]         = useState([]);
  const year = new Date().getFullYear();

  useEffect(() => {
    reportsAPI.summary().then(setSummary);
    reportsAPI.monthly(year).then(rows =>
      setMonthly(rows.map(r => ({ ...r, name: MONTH_NAMES[r.month - 1] })))
    );
    reportsAPI.topCars(5).then(setTopCars);
    carsAPI.list().then(setCars);
  }, []);

  const free   = cars.filter(c => c.is_active).length;  // simplified
  const rented = summary ? summary.active : 0;

  return (
    <div dir="rtl">
      <h1 style={{ fontSize:24, fontWeight:800, marginBottom:24 }}>לוח בקרה</h1>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:16, marginBottom:32 }}>
        {[
          { label:"סה״כ הזמנות",  value: summary?.total   ?? "—", color:"#3b82f6", icon:"📋" },
          { label:"הזמנות פעילות",value: summary?.active  ?? "—", color:"#22c55e", icon:"✅" },
          { label:"הכנסות השנה",  value: summary ? `₪${Math.round(summary.revenue).toLocaleString()}` : "—", color:"#f59e0b", icon:"💰" },
          { label:"רכבים במערכת",  value: cars.length,              color:"#8b5cf6", icon:"🚗" },
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

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>
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
const cardStyle = { background:"#fff", borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" };
const cardTitle = { margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" };


// ══════════════════════════════════════════════════════════════════════════════
