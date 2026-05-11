import { useEffect, useMemo, useState } from "react";

import { attendanceAPI } from "../api/attendance";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAuthStore } from "../store/auth";
import { Permissions } from "../permissions";

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

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function toLocalDateTimeInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function hoursBetween(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return (b - a) / 3600000;
}

export default function Attendance() {
  const isMobile = useIsMobile(900);
  const can = useAuthStore((s) => s.can);
  const canViewAll = can(Permissions.ATTENDANCE_VIEW_ALL);
  const canManage = can(Permissions.ATTENDANCE_MANAGE);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState("");

  // manager/admin: reports + retro edits
  const today = useMemo(() => new Date(), []);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUserId, setAdminUserId] = useState("");
  const [adminDateTo, setAdminDateTo] = useState(toISODate(today));
  const [adminDateFrom, setAdminDateFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminShiftsLoading, setAdminShiftsLoading] = useState(false);
  const [adminShifts, setAdminShifts] = useState([]);
  const [shiftEdits, setShiftEdits] = useState({});
  const [savingShiftId, setSavingShiftId] = useState(null);

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

  useEffect(() => {
    if (!canViewAll) return;
    setAdminLoading(true);
    attendanceAPI
      .listUsers()
      .then((u) => {
        const arr = u || [];
        setAdminUsers(arr);
        if (!adminUserId && arr.length > 0) {
          setAdminUserId(String(arr[0].id));
        }
      })
      .catch((e) => toast.error(e?.detail || "שגיאה בטעינת עובדים"))
      .finally(() => setAdminLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAll]);

  async function loadAdminShifts() {
    if (!canViewAll) return;
    if (!adminUserId) {
      setAdminShifts([]);
      setShiftEdits({});
      return;
    }
    setAdminShiftsLoading(true);
    try {
      const data = await attendanceAPI.listShifts({
        date_from: adminDateFrom,
        date_to: adminDateTo,
        user_id: Number(adminUserId),
      });
      setAdminShifts(data || []);

      const initialEdits = {};
      for (const sh of data || []) {
        initialEdits[sh.id] = {
          start: toLocalDateTimeInputValue(sh.shift_start_at),
          end: toLocalDateTimeInputValue(sh.shift_end_at),
        };
      }
      setShiftEdits(initialEdits);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת דיווחי נוכחות");
    } finally {
      setAdminShiftsLoading(false);
    }
  }

  useEffect(() => {
    if (!canViewAll) return;
    if (!adminUserId) return;
    loadAdminShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUserId, canViewAll]);

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

      {canViewAll && (
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={s.cardTitle}>דיווחי עובדים (מנהל)</div>
            <button onClick={loadAdminShifts} disabled={adminShiftsLoading || savingShiftId} style={s.btnSecondary}>
              רענן דיווחים
            </button>
          </div>

          {adminLoading ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>טוען עובדים...</div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ minWidth: 220 }}>
                <label style={s.smallLabel}>עובד</label>
                <select value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} style={s.input}>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.smallLabel}>מ־</label>
                <input type="date" value={adminDateFrom} onChange={(e) => setAdminDateFrom(e.target.value)} style={s.input} />
              </div>
              <div>
                <label style={s.smallLabel}>עד</label>
                <input type="date" value={adminDateTo} onChange={(e) => setAdminDateTo(e.target.value)} style={s.input} />
              </div>
              <button onClick={loadAdminShifts} disabled={adminShiftsLoading || savingShiftId} style={s.btnPrimary}>
                הצג
              </button>
            </div>
          )}

          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
            כאן ניתן לראות דיווחי נוכחות של עובדים ולערוך זמנים רטרואקטיבית. כל שינוי נרשם בלוג הביקורת.
          </div>

          <div style={{ marginTop: 12 }}>
            {adminShiftsLoading ? (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>טוען משמרות...</div>
            ) : adminShifts.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>אין משמרות בטווח הנבחר.</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["תאריך", "התחלה", "סיום", "שעות", ""].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminShifts.map((sh) => {
                      const ed = shiftEdits[sh.id] || { start: "", end: "" };
                      const startIso = ed.start ? new Date(ed.start).toISOString() : null;
                      const endIso = ed.end ? new Date(ed.end).toISOString() : null;
                      const hrs = hoursBetween(startIso, endIso);
                      const canSave = canManage && !!ed.start && !!ed.end && hrs > 0;

                      return (
                        <tr key={sh.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                          <td style={s.td}>{sh.work_date}</td>
                          <td style={s.td}>
                            <input
                              type="datetime-local"
                              value={ed.start}
                              onChange={(e) => setShiftEdits((p) => ({ ...p, [sh.id]: { ...(p[sh.id] || {}), start: e.target.value } }))}
                              style={{ ...s.input, width: 200 }}
                              disabled={savingShiftId === sh.id || !canManage}
                            />
                          </td>
                          <td style={s.td}>
                            <input
                              type="datetime-local"
                              value={ed.end}
                              onChange={(e) => setShiftEdits((p) => ({ ...p, [sh.id]: { ...(p[sh.id] || {}), end: e.target.value } }))}
                              style={{ ...s.input, width: 200 }}
                              disabled={savingShiftId === sh.id || !canManage}
                            />
                          </td>
                          <td style={s.td}><strong>{hrs.toFixed(2)}</strong></td>
                          <td style={s.td}>
                            {canManage ? (
                              <button
                                disabled={!canSave || savingShiftId === sh.id}
                                style={{ ...s.btnSecondary, opacity: !canSave || savingShiftId === sh.id ? 0.6 : 1 }}
                                onClick={async () => {
                                  if (!canSave) return;
                                  setSavingShiftId(sh.id);
                                  try {
                                    await attendanceAPI.updateShift(sh.id, {
                                      shift_start_at: new Date(ed.start).toISOString(),
                                      shift_end_at: new Date(ed.end).toISOString(),
                                    });
                                    toast.success("עודכנו שעות משמרת");
                                    await loadAdminShifts();
                                  } catch (e) {
                                    toast.error(e?.detail || "לא הצלחנו לעדכן משמרת");
                                  } finally {
                                    setSavingShiftId(null);
                                  }
                                }}
                              >
                                שמור
                              </button>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>אין הרשאת עריכה</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
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

