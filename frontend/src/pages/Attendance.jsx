import { useEffect, useMemo, useState } from "react";

import { attendanceAPI } from "../api/attendance";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";

function getDeviceId() {
  return localStorage.getItem("device_id") || "";
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL");
  } catch {
    return String(iso);
  }
}

export default function Attendance() {
  const isMobile = useIsMobile(900);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState("");

  const deviceId = useMemo(() => getDeviceId(), []);

  const openShift = status?.open_shift || null;
  const openSessions = status?.open_device_sessions || [];
  const myOpenSession = openSessions.find((s) => s.device_id === deviceId) || null;

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await attendanceAPI.myStatus();
      setStatus(s);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת סטטוס נוכחות");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClockIn() {
    setBusy(true);
    try {
      await attendanceAPI.clockIn({ notes: notes || null });
      toast.success("נכנסת למשמרת");
      setNotes("");
      await loadStatus();
    } catch (e) {
      toast.error(e?.detail || "לא הצלחנו לבצע כניסה");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      await attendanceAPI.clockOut({ notes: notes || null });
      toast.success("יצאת מהמכשיר הזה");
      setNotes("");
      await loadStatus();
    } catch (e) {
      toast.error(e?.detail || "לא הצלחנו לבצע יציאה");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndShift() {
    setBusy(true);
    try {
      await attendanceAPI.endShift();
      toast.success("המשמרת הסתיימה");
      await loadStatus();
    } catch (e) {
      toast.error(e?.detail || "לא הצלחנו לסיים משמרת");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>טוען נוכחות...</div>;
  }

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 20 : 24 }}>נוכחות</h1>
        <button onClick={loadStatus} disabled={busy} style={s.btnSecondary}>רענן</button>
      </div>

      <div style={{ ...s.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <div style={s.card}>
          <div style={s.cardTitle}>סטטוס משמרת</div>
          <div style={s.row}><span style={s.label}>משמרת פעילה:</span><strong>{openShift ? "כן" : "לא"}</strong></div>
          <div style={s.row}><span style={s.label}>התחלה:</span><span>{fmtDateTime(openShift?.shift_start_at)}</span></div>
          <div style={s.row}><span style={s.label}>מכשירים פתוחים:</span><span>{openSessions.length}</span></div>
          <div style={s.row}><span style={s.label}>מכשיר זה מחובר:</span><strong>{myOpenSession ? "כן" : "לא"}</strong></div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>פעולות</div>

          <label style={s.smallLabel}>הערה (אופציונלי)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="למשל: הגעתי למשרד"
            style={s.input}
            disabled={busy}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button
              onClick={handleClockIn}
              disabled={busy || !!myOpenSession}
              style={{ ...s.btnPrimary, opacity: busy || myOpenSession ? 0.6 : 1 }}
            >
              כניסה (במכשיר זה)
            </button>

            <button
              onClick={handleClockOut}
              disabled={busy || !myOpenSession}
              style={{ ...s.btnWarn, opacity: busy || !myOpenSession ? 0.6 : 1 }}
            >
              יציאה (במכשיר זה)
            </button>

            <button
              onClick={handleEndShift}
              disabled={busy || !openShift}
              style={{ ...s.btnDanger, opacity: busy || !openShift ? 0.6 : 1 }}
              title="סוגר את כל המכשירים ומסיים את המשמרת"
            >
              סיים משמרת (סגור הכל)
            </button>
          </div>

          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
            הערה: אפשר להיות מחובר במקביל ממחשב ומטלפון. יציאה מהמכשיר הזה לא תסגור מכשירים אחרים.
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>מכשירים פתוחים במשמרת</div>
        {openSessions.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>אין מכשירים פתוחים.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["מכשיר", "נכנס ב", "מצב"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openSessions.map((sess) => (
                  <tr key={sess.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={s.td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong>{sess.device_id === deviceId ? "(זה המכשיר הזה)" : "מכשיר"}</strong>
                        <span style={{ color: "#94a3b8", fontSize: 11, direction: "ltr" }}>{sess.device_id}</span>
                      </div>
                    </td>
                    <td style={s.td}>{fmtDateTime(sess.clock_in_at)}</td>
                    <td style={s.td}><strong>פתוח</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10, flexWrap: "wrap" },
  h1: { fontSize: 24, fontWeight: 900, margin: 0 },

  grid: { display: "grid", gap: 12, marginBottom: 12 },

  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 10 },

  row: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px dashed #e2e8f0" },
  label: { color: "#64748b", fontWeight: 700 },

  smallLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13, boxSizing: "border-box" },

  btnPrimary: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  btnSecondary: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 12px", fontWeight: 800, cursor: "pointer" },
  btnWarn: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  btnDanger: { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },

  tableWrap: { overflow: "auto", borderRadius: 10, border: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 12px", textAlign: "right", fontSize: 12, color: "#475569", fontWeight: 900, whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 13, color: "#0f172a", verticalAlign: "top" },
};

