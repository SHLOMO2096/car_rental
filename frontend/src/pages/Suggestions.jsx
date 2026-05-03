import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRetryAfterSeconds, getUserFacingErrorMessage, normalizeApiError } from "../api/errors";
import { suggestionsAPI } from "../api/suggestions";
import { carsAPI } from "../api/cars";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";
import { Permissions } from "../permissions";
import { useIsMobile } from "../hooks/useIsMobile";

const EMPTY_FORM = {
  car_id: "",
  group: "",
  start_date: "",
  end_date: "",
};

const TYPE_LABEL = {
  A: "התאמה ישירה",
  B: "חלופה דומה",
  C: "שיבוץ מחדש",
};

export default function Suggestions() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("car");
  const [cars, setCars] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [searching, setSearching] = useState(false);
  const [applyingToken, setApplyingToken] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const canApplySuggestions = useAuthStore((s) => s.can(Permissions.SUGGESTIONS_APPLY));
  const isMobile = useIsMobile(640);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownSeconds(0);
      return undefined;
    }

    const tick = () => {
      const remain = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remain);
      if (remain <= 0) setCooldownUntil(null);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const isCoolingDown = cooldownSeconds > 0;

  function goToCreateBooking(carId) {
    navigate("/bookings", {
      state: {
        bookingPrefill: {
          car_id: carId ? String(carId) : "",
          start_date: form.start_date,
          end_date: form.end_date,
        },
      },
    });
  }

  const canSearch = useMemo(() => {
    const hasTarget = mode === "car" ? !!form.car_id : !!form.group.trim();
    return hasTarget && !!form.start_date && !!form.end_date;
  }, [form, mode]);

  async function ensureCarsLoaded() {
    if (cars.length > 0 || loadingCars) return;
    setLoadingCars(true);
    try {
      const data = await carsAPI.list({ active_only: true });
      setCars(data);
    } catch (e) {
      const msg = getUserFacingErrorMessage(e);
      setError(msg);
      toast.error(msg, { title: "טעינת רכבים" });
    } finally {
      setLoadingCars(false);
    }
  }

  async function onSearch(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setResults([]);

    if (isCoolingDown) {
      setError(`יש להמתין ${cooldownSeconds} שניות לפני ניסיון נוסף.`);
      return;
    }

    if (!canSearch) {
      setError("נא למלא יעד ותאריכים");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("תאריך סיום חייב להיות אחרי תאריך התחלה");
      return;
    }

    const payload = {
      start_date: form.start_date,
      end_date: form.end_date,
    };
    if (mode === "car") payload.car_id = Number(form.car_id);
    else payload.group = form.group.trim().toUpperCase();

    setSearching(true);
    try {
      const data = await suggestionsAPI.search(payload);
      setResults(data || []);
      if (!data?.length) {
        setError("לא נמצאו חלופות בטווח התאריכים שנבחר");
        toast.info("לא נמצאו חלופות בטווח התאריכים שנבחר");
      } else {
        toast.success(`נמצאו ${data.length} הצעות`);
      }
    } catch (err) {
      const retryAfter = getRetryAfterSeconds(err);
      if (retryAfter > 0) {
        setCooldownUntil(Date.now() + retryAfter * 1000);
      }
      const msg = getUserFacingErrorMessage(err);
      setError(msg);
      toast.error(msg, { title: "חיפוש חלופות" });
    } finally {
      setSearching(false);
    }
  }

  async function onApply(item, { continueToBooking = false } = {}) {
    if (!item?.apply_token) {
      setError("לא נמצא apply_token להצעה זו");
      return;
    }
    if (isCoolingDown) {
      setError(`יש להמתין ${cooldownSeconds} שניות לפני Apply נוסף.`);
      return;
    }

    const ok = window.confirm("להחיל את ההצעה? הפעולה תירשם במערכת.");
    if (!ok) return;

    setError("");
    setSuccess("");
    setApplyingToken(item.apply_token);
    try {
      const res = await suggestionsAPI.apply({
        apply_token: item.apply_token,
        operator_note: "Applied from suggestions screen",
      });
      const okMsg = res?.message || "השיבוץ הוחל בהצלחה";
      setSuccess(okMsg);
      toast.success(okMsg);
      // Remove applied item to avoid duplicate apply on stale token.
      setResults((prev) => prev.filter((x) => x.apply_token !== item.apply_token));
      if (continueToBooking && res?.freed_car_id) {
        navigate("/bookings", {
          state: {
            bookingPrefill: {
              car_id: String(res.freed_car_id),
              start_date: form.start_date,
              end_date: form.end_date,
            },
          },
        });
        return;
      }
    } catch (err) {
      const apiErr = normalizeApiError(err);
      const retryAfter = getRetryAfterSeconds(err);
      if (retryAfter > 0) {
        setCooldownUntil(Date.now() + retryAfter * 1000);
      }
      if (apiErr.status === 401) {
        const msg = "תוקף ההצעה פג או שהיא כבר לא תקפה. בצע חיפוש מחדש.";
        setError(msg);
        toast.error(msg, { title: "החלת הצעה" });
      } else {
        const msg = getUserFacingErrorMessage(err);
        setError(msg);
        toast.error(msg, { title: "החלת הצעה" });
      }
    } finally {
      setApplyingToken(null);
    }
  }

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 20 : 24 }}>הצעות חכמות</h1>
        <div style={s.subtitle}>חלופות חכמות ושיבוץ מחדש להזמנות</div>
      </div>

      {isCoolingDown && (
        <div style={s.cooldownBox}>
          ⏳ הגבלת קצב פעילה. אפשר לבצע ניסיון נוסף בעוד <strong>{cooldownSeconds}</strong> שניות.
        </div>
      )}

      <form onSubmit={onSearch} style={s.card}>
        <div style={s.row}>
          <label style={s.radioLabel}>
            <input
              type="radio"
              name="mode"
              checked={mode === "car"}
              onChange={() => setMode("car")}
              onFocus={ensureCarsLoaded}
            />
            לפי רכב ספציפי
          </label>
          <label style={s.radioLabel}>
            <input
              type="radio"
              name="mode"
              checked={mode === "group"}
              onChange={() => setMode("group")}
            />
            לפי קבוצת רכב
          </label>
        </div>

        <div style={s.grid}>
          {mode === "car" ? (
            <div>
              <label style={s.label}>רכב מבוקש *</label>
              <select
                value={form.car_id}
                onFocus={ensureCarsLoaded}
                onChange={(e) => setForm((f) => ({ ...f, car_id: e.target.value }))}
                style={s.input}
              >
                <option value="">-- בחר רכב --</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.plate})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={s.label}>קבוצת רכב *</label>
              <input
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                style={s.input}
                placeholder="למשל C"
                maxLength={2}
              />
            </div>
          )}

          <div>
            <label style={s.label}>מתאריך *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              style={s.input}
            />
          </div>

          <div>
            <label style={s.label}>עד תאריך *</label>
            <input
              type="date"
              value={form.end_date}
              min={form.start_date || undefined}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              style={s.input}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: isMobile ? "stretch" : "flex-end" }}>
          <button type="submit" disabled={!canSearch || searching || isCoolingDown} style={{ ...s.primaryBtn, width: isMobile ? "100%" : "auto" }}>
            {searching ? "מחפש..." : isCoolingDown ? `המתן ${cooldownSeconds}s` : "חפש חלופות"}
          </button>
        </div>
      </form>

      {error && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>{success}</div>}

      <div style={s.listWrap}>
        {results.map((item, idx) => {
          const canApply = canApplySuggestions && item.type === "C" && !!item.apply_token;
          const applyBusy = applyingToken === item.apply_token;
          return (
            <div key={`${item.type}-${item.car_id}-${idx}`} style={s.resultCard}>
              <div style={{ ...s.resultTop, flexWrap: "wrap" }}>
                <div style={s.typeBadge}>{TYPE_LABEL[item.type] || item.type}</div>
                <div style={s.score}>Score: {Math.round(item.score)}</div>
              </div>

              <div style={s.resultTitle}>{item.operator_summary}</div>
              <div style={s.resultSub}>{item.why}</div>

              <div style={s.metaRow}>
                <span>רכב מוצע: <strong>{item.car_name}</strong></span>
                {item.replacement_car_name && (
                  <span>רכב חלופי: <strong>{item.replacement_car_name}</strong></span>
                )}
                <span>Risk: <strong>{item.risk_level}</strong></span>
              </div>

              {item.type === "C" && (
                <div style={s.affectedBox}>
                  <div style={s.affectedTitle}>📋 פרטי ההזמנה הקיימת (שתועבר)</div>
                  <div style={s.affectedGrid}>
                    <div style={s.affectedRow}>
                      <span style={s.affectedLabel}>לקוח:</span>
                      <strong>{item.affected_customer_name || "—"}</strong>
                    </div>
                    {item.affected_customer_phone && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>טלפון:</span>
                        <strong>{item.affected_customer_phone}</strong>
                      </div>
                    )}
                    {item.affected_customer_email && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>אימייל:</span>
                        <strong>{item.affected_customer_email}</strong>
                      </div>
                    )}
                    {item.affected_customer_id_num && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>ת.ז.:</span>
                        <strong>{item.affected_customer_id_num}</strong>
                      </div>
                    )}
                    <div style={s.affectedRow}>
                      <span style={s.affectedLabel}>תאריכים:</span>
                      <strong>
                        {item.affected_booking_start} → {item.affected_booking_end || "—"}
                      </strong>
                    </div>
                    {(item.affected_booking_pickup_time || item.affected_booking_return_time) && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>שעות:</span>
                        <strong>
                          איסוף {item.affected_booking_pickup_time || "—"} / החזרה {item.affected_booking_return_time || "—"}
                        </strong>
                      </div>
                    )}
                    {item.affected_booking_total_price != null && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>מחיר כולל:</span>
                        <strong>₪{item.affected_booking_total_price.toLocaleString()}</strong>
                      </div>
                    )}
                    {item.affected_booking_notes && (
                      <div style={{ ...s.affectedRow, alignItems: "flex-start" }}>
                        <span style={s.affectedLabel}>הערות:</span>
                        <span style={{ color: "#334155" }}>{item.affected_booking_notes}</span>
                      </div>
                    )}
                  </div>

                  <div style={s.replacementTitle}>🔄 רכב חלופי ללקוח הקיים</div>
                  <div style={s.affectedGrid}>
                    <div style={s.affectedRow}>
                      <span style={s.affectedLabel}>רכב:</span>
                      <strong>
                        {item.replacement_car_name}
                        {item.replacement_car_make ? ` (${item.replacement_car_make})` : ""}
                        {item.replacement_car_group ? ` · קבוצה ${item.replacement_car_group}` : ""}
                      </strong>
                    </div>
                    {item.replacement_price_per_day != null && (
                      <div style={s.affectedRow}>
                        <span style={s.affectedLabel}>מחיר ליום:</span>
                        <strong>₪{item.replacement_price_per_day.toLocaleString()}</strong>
                        {item.replacement_price_delta != null && item.replacement_price_delta !== 0 && (
                          <span style={{
                            marginRight: 6,
                            color: item.replacement_price_delta > 0 ? "#b45309" : "#047857",
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            ({item.replacement_price_delta > 0 ? "+" : ""}₪{item.replacement_price_delta} ביחס לרכב המקורי)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canApply && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button disabled={applyBusy || isCoolingDown} onClick={() => onApply(item)} style={s.applyBtn}>
                    {applyBusy ? "מחיל..." : isCoolingDown ? `המתן ${cooldownSeconds}s` : "Apply Reassignment"}
                  </button>
                  <button
                    disabled={applyBusy || isCoolingDown}
                    onClick={() => onApply(item, { continueToBooking: true })}
                    style={s.secondaryBtn}
                  >
                    {applyBusy ? "מחיל..." : isCoolingDown ? `המתן ${cooldownSeconds}s` : "החל והמשך להזמנה"}
                  </button>
                </div>
              )}

              {(item.type === "A" || item.type === "B") && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => goToCreateBooking(item.car_id)} style={s.secondaryBtn}>
                    צור הזמנה עם רכב זה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  header: { marginBottom: 14 },
  h1: { margin: 0, fontSize: 24, fontWeight: 800 },
  subtitle: { color: "#64748b", marginTop: 6, fontSize: 13 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  row: { display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  label: { display: "block", fontSize: 12, color: "#475569", marginBottom: 5, fontWeight: 600 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  footer: { marginTop: 12, display: "flex", justifyContent: "flex-end" },
  primaryBtn: {
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  applyBtn: {
    background: "#065f46",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "7px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  listWrap: { marginTop: 16, display: "grid", gap: 10 },
  resultCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  resultTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  typeBadge: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  score: { color: "#475569", fontSize: 12, fontWeight: 700 },
  resultTitle: { marginTop: 8, fontWeight: 700, fontSize: 14, color: "#0f172a" },
  resultSub: { marginTop: 4, color: "#475569", fontSize: 13 },
  metaRow: { marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap", color: "#334155", fontSize: 12 },
  errorBox: {
    marginTop: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
  },
  successBox: {
    marginTop: 12,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
  },
  cooldownBox: {
    marginBottom: 12,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
  },
};

