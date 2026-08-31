import { useEffect, useState } from "react";
import { authAPI } from "../api/auth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useDragScroll } from "../hooks/useDragScroll";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Pencil } from "lucide-react";

const EMPTY_FORM = { email:"", full_name:"", password:"", role:"agent" };

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [modal, setModal]       = useState(false);
  const [editUser, setEdit]     = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");
  const isMobile = useIsMobile(900);
  const dragScroll = useDragScroll({ enabled: !isMobile });

  const load = () => authAPI.listUsers().then(setUsers);
  useEffect(() => { load(); }, []);

  function openCreate() { setForm(EMPTY_FORM); setEdit(null); setFormError(""); setModal(true); }
  function openEdit(u) {
    setForm({
      email: u.email,
      full_name: u.full_name,
      password: "",
      role: u.role,
    });
    setEdit(u); setFormError(""); setModal(true);
  }

  async function handleSave() {
    if (!form.email.trim())     return setFormError("יש להזין אימייל");
    if (!form.full_name.trim()) return setFormError("יש להזין שם מלא");
    if (!editUser && !form.password) return setFormError("יש להזין סיסמה");
    setSaving(true); setFormError("");
    try {
      if (editUser) {
        const data = {
          full_name: form.full_name,
          role: form.role,
        };
        await authAPI.updateUser(editUser.id, data);
      } else {
        await authAPI.createUser({
          ...form,
        });
      }
      await load(); setModal(false);
    } catch (e) {
      setFormError(typeof e === "string" ? e : "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  async function toggleActive(u) {
    await authAPI.updateUser(u.id, { is_active: !u.is_active });
    await load();
  }

  return (
    <div dir="rtl">
      <div style={s.header}>
        <h1 style={s.h1}>ניהול משתמשים</h1>
        <button onClick={openCreate} style={s.btnPrimary}>+ משתמש חדש</button>
      </div>

      {!isMobile ? (
        <div {...dragScroll.bind} style={{ ...s.tableWrap, ...dragScroll.style }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f7faf8" }}>
                {["#","שם מלא","אימייל","תפקיד","סטטוס","נוצר","פעולות"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom:"1px solid #eff3f1", opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={s.td}><span style={s.idBadge}>#{u.id}</span></td>
                  <td style={s.td}><strong>{u.full_name}</strong></td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}><Badge label={u.role === "admin" ? "מנהל" : "סוכן"} color={u.role === "admin" ? "blue" : "gray"} /></td>
                  <td style={s.td}><Badge label={u.is_active ? "פעיל" : "מושבת"} color={u.is_active ? "green" : "gray"} /></td>
                  <td style={s.td}>{new Date(u.created_at).toLocaleDateString("he-IL")}</td>
                  <td style={s.td}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => openEdit(u)} style={s.btnEdit}><Pencil size={14} strokeWidth={1.9} aria-hidden="true" /> ערוך</button>
                      <button onClick={() => toggleActive(u)} style={u.is_active ? s.btnWarn : s.btnSuccess}>
                        {u.is_active ? "השבת" : "הפעל"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {users.map(u => (
            <div key={u.id} style={{ background:"#fff", border:"1px solid #e3e7e5", borderRadius:16, padding:14, opacity: u.is_active ? 1 : 0.55 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={s.idBadge}>#{u.id}</span>
                <Badge label={u.is_active ? "פעיל" : "מושבת"} color={u.is_active ? "green" : "gray"} />
              </div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>{u.full_name}</div>
              <div style={{ fontSize:12, color:"#707774", marginBottom:6 }}>{u.email}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:8 }}>
                <Badge label={u.role === "admin" ? "מנהל" : "סוכן"} color={u.role === "admin" ? "blue" : "gray"} />
                <span style={{ fontSize:11, color:"#8e9592" }}>נוצר: {new Date(u.created_at).toLocaleDateString("he-IL")}</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => openEdit(u)} style={s.btnEdit}><Pencil size={14} strokeWidth={1.9} aria-hidden="true" /> ערוך</button>
                <button onClick={() => toggleActive(u)} style={u.is_active ? s.btnWarn : s.btnSuccess}>
                  {u.is_active ? "השבת" : "הפעל"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={editUser ? "עריכת משתמש" : "משתמש חדש"}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={s.label}>שם מלא *</label>
            <input value={form.full_name}
              onChange={e => setForm(f=>({...f,full_name:e.target.value}))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>אימייל *</label>
            <input type="email" value={form.email} disabled={!!editUser}
              onChange={e => setForm(f=>({...f,email:e.target.value}))} style={s.input} />
          </div>
          {!editUser && (
            <div>
              <label style={s.label}>סיסמה *</label>
              <input type="password" value={form.password}
                onChange={e => setForm(f=>({...f,password:e.target.value}))} style={s.input} />
            </div>
          )}
          <div>
            <label style={s.label}>תפקיד</label>
            <select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}
              style={s.input}>
              <option value="agent">סוכן</option>
              <option value="admin">מנהל</option>
            </select>
          </div>

          {formError && <div style={s.errorBox}>{formError}</div>}
          <div style={s.modalFooter}>
            <button onClick={() => setModal(false)} style={s.btnSecondary}>ביטול</button>
            <button onClick={handleSave} disabled={saving} style={s.btnPrimary}>
              {saving ? "שומר..." : editUser ? "שמור" : "צור משתמש"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const s = {
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 },
  h1:         { fontSize:24, fontWeight:800, margin:0 },
  tableWrap:  { background:"#fff", borderRadius:16, overflow:"auto",
                border:"1px solid #e3e7e5", boxShadow:"0 1px 2px rgba(20,24,22,0.04), 0 2px 8px rgba(20,24,22,0.04)" },
  th:         { padding:"12px 14px", fontSize:12, fontWeight:700, color:"#59605d",
                textAlign:"right", borderBottom:"1px solid #e3e7e5" },
  td:         { padding:"12px 14px", fontSize:13 },
  idBadge:    { background:"#eff3f1", color:"#59605d", borderRadius:10,
                padding:"2px 7px", fontSize:12, fontWeight:700 },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#59605d", marginBottom:5 },
  input:      { width:"100%", padding:"9px 12px", borderRadius:12, border:"1px solid #e3e7e5",
                fontSize:14, outline:"none", boxSizing:"border-box" },
  btnPrimary: { background:"#154038", color:"#fff", border:"none", borderRadius:12,
                padding:"8px 18px", fontWeight:700, cursor:"pointer" },
  btnSecondary:{ background:"#eff3f1", color:"#59605d", border:"1px solid #e3e7e5",
                 borderRadius:12, padding:"8px 18px", fontWeight:600, cursor:"pointer" },
  btnEdit:    { background:"#eef5f2", color:"#2c6b5e", border:"1px solid #b9d4cb",
                borderRadius:10, padding:"5px 10px", cursor:"pointer", fontSize:12 },
  btnWarn:    { background:"#fff7ed", color:"#c2410c", border:"1px solid #fed7aa",
                borderRadius:10, padding:"5px 10px", cursor:"pointer", fontSize:12 },
  btnSuccess: { background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0",
                borderRadius:10, padding:"5px 10px", cursor:"pointer", fontSize:12 },
  errorBox:   { background:"#fef2f2", color:"#dc2626", borderRadius:12,
                padding:"10px 14px", fontSize:13 },
  modalFooter:{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 },
};
