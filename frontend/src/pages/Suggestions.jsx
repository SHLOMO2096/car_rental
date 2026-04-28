import { useMemo, useState } from "react";
import { suggestionsAPI } from "../api/suggestions";
import { carsAPI } from "../api/cars";

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("car");
  const [cars, setCars] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [searching, setSearching] = useState(false);
  const [applyingToken, setApplyingToken] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setError(typeof e === "string" ? e : "שגיאה בטעינת רכבים");
    } finally {
      setLoadingCars(false);
    }
  }

  function normalizeError(e) {
    if (typeof e === "string") return e;
    if (e?.detail) return e.detail;
    return "אירעה שגיאה, נסה שוב";
  }

  async function onSearch(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setResults([]);

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
      if (!data?.length) setError("לא נמצאו חלופות בטווח התאריכים שנבחר");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSearching(false);
    }
  }

  async function onApply(item) {
    if (!item?.apply_token) {
      setError("לא נמצא apply_token להצעה זו");
      return;
    }

    const ok = window.confirm("להחיל את ההצעה? הפעולה נרשמת ב-audit ונשלחת התראה.");
    if (!ok) return;

    setError("");
    setSuccess("");
    setApplyingToken(item.apply_token);
    try {
      const res = await suggestionsAPI.apply({
        apply_token: item.apply_token,
        operator_note: "Applied from suggestions screen",
      });
      setSuccess(res?.message || "השיבוץ הוחל בהצלחה");
      // Remove applied item to avoid duplicate apply on stale token.
      setResults((prev) => prev.filter((x) => x.apply_token !== item.apply_token));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setApplyingToken(null);
    }
  }

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={s.h1}>Smart Suggestions</h1>
        <div style={s.subtitle}>חלופות חכמות ושיבוץ מחדש להזמנות</div>
      </div>

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

        <div style={s.footer}>
          <button type="submit" disabled={!canSearch || searching} style={s.primaryBtn}>
            {searching ? "מחפש..." : "חפש חלופות"}
          </button>
        </div>
      </form>

      {error && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>{success}</div>}

      <div style={s.listWrap}>
        {results.map((item, idx) => {
          const canApply = item.type === "C" && !!item.apply_token;
          const applyBusy = applyingToken === item.apply_token;
          return (
            <div key={`${item.type}-${item.car_id}-${idx}`} style={s.resultCard}>
              <div style={s.resultTop}>
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

              {canApply && (
                <div style={{ marginTop: 10 }}>
                  <button disabled={applyBusy} onClick={() => onApply(item)} style={s.applyBtn}>
                    {applyBusy ? "מחיל..." : "Apply Reassignment"}
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
};

