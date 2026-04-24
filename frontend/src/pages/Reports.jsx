import { useEffect, useState } from "react";
import { reportsAPI } from "../api/reports";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const MONTHS_HE = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
const PIE_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#f97316"];

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]     = useState(currentYear);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [topCars, setTopCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportsAPI.summary(),
      reportsAPI.monthly(year),
      reportsAPI.topCars(8),
    ]).then(([sum, mon, top]) => {
      setSummary(sum);
      // fill all 12 months (even empty ones)
      const filled = Array.from({ length: 12 }, (_, i) => {
        const found = mon.find(r => r.month === i + 1);
        return { name: MONTHS_HE[i], revenue: found?.revenue || 0, count: found?.count || 0 };
      });
      setMonthly(filled);
      setTopCars(top);
    }).finally(() => setLoading(false));
  }, [year]);

  const totalRevenue = monthly.reduce((a, m) => a + m.revenue, 0);
  const totalBookings = monthly.reduce((a, m) => a + m.count, 0);
  const avgPerBooking = totalBookings ? totalRevenue / totalBookings : 0;
  const bestMonth = monthly.reduce((a, b) => b.revenue > a.revenue ? b : a, { revenue: 0, name: "—" });

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>טוען דוחות...</div>;

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={s.h1}>דוחות וסטטיסטיקות</h1>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <label style={{ fontSize:13, fontWeight:600, color:"#475569" }}>שנה:</label>
          <select value={year} onChange={e => setYear(+e.target.value)} style={s.select}>
            {[currentYear-1, currentYear, currentYear+1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        {[
          { label:"סה״כ הכנסות בשנה", value:`₪${Math.round(totalRevenue).toLocaleString()}`, icon:"💰", color:"#1d4ed8" },
          { label:"סה״כ הזמנות בשנה", value:totalBookings,                                   icon:"📋", color:"#7c3aed" },
          { label:"ממוצע להזמנה",      value:`₪${Math.round(avgPerBooking).toLocaleString()}`, icon:"📊", color:"#0369a1" },
          { label:"חודש שיא",          value:bestMonth.name,                                   icon:"🏆", color:"#b45309" },
          { label:"סה״כ הזמנות מאז",   value:summary?.total ?? "—",                           icon:"📁", color:"#475569" },
          { label:"הזמנות פעילות כעת", value:summary?.active ?? "—",                          icon:"✅", color:"#15803d" },
        ].map(k => (
          <div key={k.label} style={s.kpiCard}>
            <div style={{ fontSize:28 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={s.chartsRow}>
        {/* Monthly Revenue Bar */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>הכנסות חודשיות {year}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} tickFormatter={v => `₪${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => [`₪${Math.round(v).toLocaleString()}`, "הכנסה"]} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]}
                   label={{ position:"top", fontSize:9, formatter:v=>v>0?`₪${Math.round(v/1000)}K`:"" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Bookings Line */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>מספר הזמנות לפי חודש {year}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
              <Tooltip formatter={v => [v, "הזמנות"]} />
              <Line type="monotone" dataKey="count" stroke="#7c3aed"
                    strokeWidth={2.5} dot={{ r:4 }} activeDot={{ r:6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={s.chartsRow}>
        {/* Top Cars Bar */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>רכבים מובילים — הכנסות</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topCars} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize:11 }}
                     tickFormatter={v => `₪${(v/1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:11 }} width={110} />
              <Tooltip formatter={v => [`₪${Math.round(v).toLocaleString()}`, "הכנסה"]} />
              <Bar dataKey="revenue" radius={[0,4,4,0]}>
                {topCars.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Cars Pie */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>חלוקת הזמנות לפי רכב</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={topCars} dataKey="bookings" nameKey="name"
                   cx="50%" cy="50%" outerRadius={95} label={({ name, percent }) =>
                     `${name} ${(percent*100).toFixed(0)}%`
                   } labelLine={false}>
                {topCars.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => [v, "הזמנות"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Cars Table */}
      <div style={s.tableCard}>
        <h3 style={s.chartTitle}>טבלת רכבים — ביצועים מלאים</h3>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              {["דירוג","שם רכב","מספר הזמנות","סה״כ הכנסות","ממוצע להזמנה"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topCars.map((c, i) => (
              <tr key={c.car_id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={s.td}>
                  <span style={{ ...s.rankBadge, background: i<3 ? ["#fef3c7","#f1f5f9","#fef3c7"][i]:"#f8fafc",
                    color: i<3 ? ["#b45309","#475569","#92400e"][i]:"#64748b" }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </span>
                </td>
                <td style={s.td}><strong>{c.name}</strong></td>
                <td style={s.td}>{c.bookings}</td>
                <td style={s.td}><strong style={{ color:"#1d4ed8" }}>₪{Math.round(c.revenue).toLocaleString()}</strong></td>
                <td style={s.td}>₪{c.bookings ? Math.round(c.revenue/c.bookings).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  header:    { display:"flex", justifyContent:"space-between", alignItems:"center",
               marginBottom:24, flexWrap:"wrap", gap:12 },
  h1:        { fontSize:24, fontWeight:800, margin:0 },
  select:    { padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0",
               fontSize:14, cursor:"pointer", background:"#fff" },
  kpiGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
               gap:14, marginBottom:24 },
  kpiCard:   { background:"#fff", borderRadius:12, padding:"16px 20px",
               display:"flex", gap:14, alignItems:"center",
               border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" },
  chartsRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 },
  chartCard: { background:"#fff", borderRadius:12, padding:20,
               border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" },
  chartTitle:{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" },
  tableCard: { background:"#fff", borderRadius:12, padding:20,
               border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", marginBottom:16 },
  th:        { padding:"10px 14px", fontSize:12, fontWeight:700, color:"#475569",
               textAlign:"right", borderBottom:"1px solid #e2e8f0" },
  td:        { padding:"12px 14px", fontSize:13 },
  rankBadge: { display:"inline-block", borderRadius:6, padding:"2px 8px",
               fontSize:12, fontWeight:700 },
};
