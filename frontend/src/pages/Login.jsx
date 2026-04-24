// ══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

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
      setError(typeof err === "string" ? err : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🚘</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: 24, color: "#1e293b" }}>השכרת רכבים</h1>
          <p style={{ color: "#64748b", margin: 0 }}>כניסה למערכת</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>אימייל</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={styles.input} placeholder="admin@rental.co.il" required />
          <label style={styles.label}>סיסמה</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={styles.input} required />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}
const styles = {
  page:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
           background:"#f1f5f9" },
  card:  { background:"#fff", borderRadius:16, padding:40, width:"100%", maxWidth:400,
           boxShadow:"0 4px 24px rgba(0,0,0,0.1)" },
  label: { display:"block", fontSize:13, fontWeight:600, color:"#475569", marginBottom:6, marginTop:16 },
  input: { width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0",
           fontSize:14, boxSizing:"border-box", outline:"none" },
  btn:   { width:"100%", marginTop:24, padding:"12px", background:"#1d4ed8", color:"#fff",
           border:"none", borderRadius:8, fontSize:16, fontWeight:700, cursor:"pointer" },
  error: { marginTop:12, padding:"10px 14px", background:"#fee2e2", color:"#dc2626",
           borderRadius:8, fontSize:13 },
};


// ══════════════════════════════════════════════════════════════════════════════
