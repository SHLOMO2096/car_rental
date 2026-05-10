import { useEffect, useMemo, useState } from "react";
import { payrollAPI } from "../api/payroll";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export default function Payroll() {
  const isMobile = useIsMobile(900);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(toISODate(startOfMonth(today)));
  const [dateTo, setDateTo] = useState(toISODate(endOfMonth(today)));

  const [users, setUsers] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);

  const usersById = useMemo(() => {
    const m = new Map();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  async function loadAll() {
    setLoading(true);
    try {
      const [u, rep] = await Promise.all([
        payrollAPI.listUsers(),
        payrollAPI.report({ date_from: dateFrom, date_to: dateTo }),
      ]);
      setUsers(u);
      setReport(rep);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת נתוני שכר");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshReport() {
    try {
      const rep = await payrollAPI.report({ date_from: dateFrom, date_to: dateTo });
      setReport(rep);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת דוח");
    }
  }

  async function saveRate(userId, hourlyRateValue) {
    const rate = hourlyRateValue === "" ? null : Number(hourlyRateValue);
    if (rate !== null && (Number.isNaN(rate) || rate < 0)) {
      toast.error("שכר שעתי לא תקין");
      return;
    }

    setSavingUserId(userId);
    try {
      const updated = await payrollAPI.updateHourlyRate(userId, rate);
      setUsers((prev) => prev.map((x) => (x.id === userId ? updated : x)));
      toast.success("עודכן שכר שעתי");
      await refreshReport();
    } catch (e) {
      toast.error(e?.detail || "לא הצלחנו לעדכן שכר שעתי");
    } finally {
      setSavingUserId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>טוען נתוני שכר...</div>;
  }

  const rows = report?.rows || [];

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 20 : 24 }}>ניהול שכר עובדים</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={s.label}>מ־</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={s.input} />
          <label style={s.label}>עד</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={s.input} />
          <button onClick={refreshReport} style={s.btnPrimary}>רענן דוח</button>
        </div>
      </div>

      <div style={{ ...s.kpiRow, flexDirection: isMobile ? "column" : "row" }}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>סה״כ שעות (משמרות סגורות בלבד)</div>
          <div style={s.kpiValue}>{(report?.total_hours || 0).toFixed(2)}</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>סה״כ לתשלום</div>
          <div style={s.kpiValue}>₪{Math.round(report?.total_pay || 0).toLocaleString()}</div>
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitle}>שכר שעתי לכל עובד</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {[
                  "שם", "אימייל", "פעיל", "שכר שעתי (₪)",
                ].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={s.td}><strong>{u.full_name}</strong></td>
                  <td style={s.td} dir="ltr">{u.email}</td>
                  <td style={s.td}>{u.is_active ? "כן" : "לא"}</td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={u.hourly_rate ?? ""}
                        disabled={savingUserId === u.id}
                        onBlur={(e) => saveRate(u.id, e.target.value)}
                        style={{ ...s.input, width: 140 }}
                      />
                      {savingUserId === u.id && <span style={{ color: "#64748b", fontSize: 12 }}>שומר...</span>}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                      נשמר ב־blur (יציאה מהשדה). אפשר להשאיר ריק כדי לא לחשב תשלום.
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitle}>דוח שכר לפי טווח</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {[
                  "עובד", "שכר שעתי", "כמות משמרות", "סה״כ שעות", "לתשלום",
                ].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...s.td, padding: 18, color: "#94a3b8", textAlign: "center" }}>
                    אין נתונים בטווח (או אין משמרות סגורות).
                  </td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={s.td}><strong>{r.full_name}</strong></td>
                  <td style={s.td}>₪{Number(r.hourly_rate || 0).toFixed(2)}</td>
                  <td style={s.td}>{r.shifts_count}</td>
                  <td style={s.td}>{Number(r.total_hours || 0).toFixed(2)}</td>
                  <td style={s.td}><strong>₪{Math.round(r.total_pay || 0).toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
          הערה: ימים/משמרות שלא הסתיימו (אין סיום משמרת) לא נכנסים לחישוב.
        </div>
      </div>

      {/* helpful debug */}
      {usersById.size === 0 && (
        <div style={{ color: "#94a3b8", fontSize: 12 }}>לא נטענו משתמשים.</div>
      )}
    </div>
  );
}

const s = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  label: { fontSize: 13, fontWeight: 700, color: "#475569" },
  input: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 },
  btnPrimary: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" },

  kpiRow: { display: "flex", gap: 10, marginBottom: 18 },
  kpiCard: { flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
  kpiLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 700 },
  kpiValue: { color: "#0f172a", fontSize: 22, fontWeight: 900, marginTop: 6 },

  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 18 },
  cardTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: "#0f172a" },

  tableWrap: { overflow: "auto", borderRadius: 10, border: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 12px", textAlign: "right", fontSize: 12, color: "#475569", fontWeight: 800, whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 13, color: "#0f172a", verticalAlign: "top" },
};

