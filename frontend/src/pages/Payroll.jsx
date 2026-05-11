import { useEffect, useMemo, useState } from "react";
import { payrollAPI } from "../api/payroll";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAuthStore } from "../store/auth";
import { Permissions } from "../permissions";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
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

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Payroll() {
  const isMobile = useIsMobile(900);
  const can = useAuthStore((s) => s.can);
  const canManage = can(Permissions.PAYROLL_MANAGE);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(toISODate(startOfMonth(today)));
  const [dateTo, setDateTo] = useState(toISODate(endOfMonth(today)));

  const [users, setUsers] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState("all");

  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftEdits, setShiftEdits] = useState({});
  const [savingShiftId, setSavingShiftId] = useState(null);

  const usersById = useMemo(() => {
    const m = new Map();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const selectedUser = useMemo(() => {
    if (selectedUserId === "all") return null;
    return usersById.get(Number(selectedUserId)) || null;
  }, [selectedUserId, usersById]);

  function reportParams() {
    const params = { date_from: dateFrom, date_to: dateTo };
    if (selectedUserId !== "all") params.user_id = Number(selectedUserId);
    return params;
  }

  async function loadShifts() {
    if (!canManage) return;
    if (selectedUserId === "all") {
      setShifts([]);
      setShiftEdits({});
      return;
    }
    setShiftsLoading(true);
    try {
      const data = await payrollAPI.listShifts({
        date_from: dateFrom,
        date_to: dateTo,
        user_id: Number(selectedUserId),
      });
      setShifts(data);

      const initialEdits = {};
      for (const s of data) {
        initialEdits[s.id] = {
          start: toLocalDateTimeInputValue(s.shift_start_at),
          end: toLocalDateTimeInputValue(s.shift_end_at),
        };
      }
      setShiftEdits(initialEdits);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת משמרות");
    } finally {
      setShiftsLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [u, rep] = await Promise.all([
        payrollAPI.listUsers(),
        payrollAPI.report(reportParams()),
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
      const rep = await payrollAPI.report(reportParams());
      setReport(rep);
    } catch (e) {
      toast.error(e?.detail || "שגיאה בטעינת דוח");
    }
  }

  async function refreshAll() {
    await refreshReport();
    await loadShifts();
  }

  function exportCsv() {
    const rows = report?.rows || [];
    if (rows.length === 0) {
      toast.info("אין נתונים לייצוא בטווח הנבחר");
      return;
    }

    const esc = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };

    const header = ["עובד", "שכר שעתי", "כמות משמרות", "סה\"כ שעות", "לתשלום"].map(esc).join(",");
    const lines = [header];
    for (const r of rows) {
      lines.push([
        r.full_name,
        Number(r.hourly_rate || 0).toFixed(2),
        r.shifts_count,
        Number(r.total_hours || 0).toFixed(2),
        Math.round(r.total_pay || 0),
      ].map(esc).join(","));
    }
    lines.push(["סה\"כ", "", "", Number(report?.total_hours || 0).toFixed(2), Math.round(report?.total_pay || 0)].map(esc).join(","));

    const titleLine = `טווח,${esc(dateFrom)},${esc(dateTo)}`;
    const filterLine = selectedUser ? `עובד,${esc(selectedUser.full_name)}` : "עובד,כל העובדים";

    // BOM for Excel + Hebrew
    const csv = "\ufeff" + [titleLine, filterLine, "", ...lines].join("\r\n");
    const filename = `payroll_${dateFrom}_to_${dateTo}${selectedUser ? `_user_${selectedUser.id}` : ""}.csv`;
    downloadCsv(filename, csv);
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
          <label style={s.label}>עובד</label>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={s.input}>
            <option value="all">כל העובדים</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>{u.full_name}</option>
            ))}
          </select>

          <label style={s.label}>מ־</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={s.input} />
          <label style={s.label}>עד</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={s.input} />
          <button onClick={refreshAll} style={s.btnPrimary}>רענן</button>
          <button onClick={exportCsv} style={s.btnSecondary}>ייצוא CSV</button>
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

      {canManage && selectedUserId !== "all" && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>תיקון שעות נוכחות (למנהל בלבד) — {selectedUser?.full_name}</h3>
          {shiftsLoading ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>טוען משמרות...</div>
          ) : shifts.length === 0 ? (
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
                  {shifts.map((sh) => {
                    const ed = shiftEdits[sh.id] || { start: "", end: "" };
                    const startMs = ed.start ? new Date(ed.start).getTime() : NaN;
                    const endMs = ed.end ? new Date(ed.end).getTime() : NaN;
                    const hrs = (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs)
                      ? (endMs - startMs) / 3600000
                      : 0;
                    const canSave = !!ed.start && !!ed.end && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs;

                    return (
                      <tr key={sh.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={s.td}>{sh.work_date}</td>
                        <td style={s.td}>
                          <input
                            type="datetime-local"
                            value={ed.start}
                            onChange={(e) => setShiftEdits((p) => ({ ...p, [sh.id]: { ...(p[sh.id] || {}), start: e.target.value } }))}
                            style={{ ...s.input, width: 200 }}
                            disabled={savingShiftId === sh.id}
                          />
                        </td>
                        <td style={s.td}>
                          <input
                            type="datetime-local"
                            value={ed.end}
                            onChange={(e) => setShiftEdits((p) => ({ ...p, [sh.id]: { ...(p[sh.id] || {}), end: e.target.value } }))}
                            style={{ ...s.input, width: 200 }}
                            disabled={savingShiftId === sh.id}
                          />
                        </td>
                        <td style={s.td}><strong>{hrs.toFixed(2)}</strong></td>
                        <td style={s.td}>
                          <button
                            disabled={!canSave || savingShiftId === sh.id}
                            style={{
                              ...s.btnPrimary,
                              padding: "7px 12px",
                              opacity: (!canSave || savingShiftId === sh.id) ? 0.6 : 1,
                            }}
                            onClick={async () => {
                              try {
                                setSavingShiftId(sh.id);
                                await payrollAPI.updateShift(sh.id, {
                                  shift_start_at: new Date(ed.start).toISOString(),
                                  shift_end_at: new Date(ed.end).toISOString(),
                                });
                                toast.success("עודכן זמן משמרת");
                                await refreshAll();
                              } catch (e) {
                                toast.error(e?.detail || "לא הצלחנו לעדכן משמרת");
                              } finally {
                                setSavingShiftId(null);
                              }
                            }}
                          >
                            שמור
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
            לאחר שמירה אנחנו מרעננים את הדוח כדי שהשכר יתעדכן לפי השעות החדשות.
          </div>
        </div>
      )}

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
  btnSecondary: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" },

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

