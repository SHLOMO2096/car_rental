// ══════════════════════════════════════════════════════════════════════════════
// מסך פיילוט לשכבת העיצוב (styles/tokens.css + base.css + components.css).
// אין כאן אובייקט styles מקומי: כל ערך מגיע מטוקן או ממחלקת רכיב.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFacingErrorMessage } from "../api/errors";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      const msg = getUserFacingErrorMessage(err);
      setError(msg);
      toast.error(msg, { title: "התחברות נכשלה" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" style={page}>
      <div className="card card--raised" style={card}>
        <div style={header}>
          <div style={mark} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17h14M6 17v2M18 17v2M4 13l1.5-5A2 2 0 0 1 7.4 6.5h9.2A2 2 0 0 1 18.5 8L20 13v4H4z" />
              <circle cx="7.5" cy="14.5" r="1" />
              <circle cx="16.5" cy="14.5" r="1" />
            </svg>
          </div>
          <h1 style={title}>השכרת רכבים</h1>
          <p style={subtitle}>כניסה למערכת</p>
        </div>

        <form onSubmit={handleSubmit} style={form}>
          <div className="field">
            <label className="label" htmlFor="login-email">אימייל</label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@rental.co.il"
              autoComplete="username"
              aria-invalid={error ? "true" : undefined}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="login-password">סיסמה</label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={error ? "true" : undefined}
              required
            />
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}

          <button type="submit" className="btn btn--primary btn--block" disabled={loading} style={submit}>
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}

// פריסה בלבד — ערכים מהטוקנים, אפס צבעים או גדלים קשיחים.
const page = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--c-ground-2)",
  padding: "var(--space-5)",
};

const card = {
  width: "100%",
  maxWidth: 400,
  padding: "var(--space-9) var(--space-8)",
};

const header = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-1)",
  marginBottom: "var(--space-8)",
};

const mark = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 52,
  height: 52,
  marginBottom: "var(--space-4)",
  borderRadius: "var(--radius-lg)",
  background: "var(--c-brand-soft)",
  color: "var(--c-brand)",
};

const title = { fontSize: "var(--text-xl)" };

const subtitle = { color: "var(--c-muted)", fontSize: "var(--text-base)" };

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
};

const submit = { marginTop: "var(--space-2)", fontSize: "var(--text-md)" };


// ══════════════════════════════════════════════════════════════════════════════
