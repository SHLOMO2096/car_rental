// ══════════════════════════════════════════════════════════════════════════════
export default function Confirm({
  open, message, messageList, onConfirm, onCancel,
  confirmLabel = "אישור", confirmColor = "#dc2626",
}) {
  if (!open) return null;
  const lines = String(message || "").split("\n").filter(Boolean);
  const hasList = Array.isArray(messageList) && messageList.length > 0;
  return (
    <div dir="rtl" style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100,
    }}>
      <div style={{
        background:"#fff", borderRadius:14, padding:28, maxWidth:380, width:"90%",
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)", textAlign:"center",
      }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
        <div style={{ marginBottom:24, textAlign:"right" }}>
          {lines.length <= 1 ? (
            <p style={{ fontSize:15, color:"#1e293b", margin:0, lineHeight:1.6 }}>{message}</p>
          ) : (
            <div style={{ display:"grid", gap:6 }}>
              {lines.map((line, idx) => (
                <p key={idx} style={{ fontSize:14, color:"#1e293b", margin:0, lineHeight:1.6 }}>{line}</p>
              ))}
            </div>
          )}
          {hasList && (
            <ul style={{ margin:"10px 0 0", paddingInlineStart:18, color:"#334155", fontSize:13, lineHeight:1.7 }}>
              {messageList.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          )}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} style={{
            background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0",
            borderRadius:8, padding:"9px 22px", fontWeight:600, cursor:"pointer",
          }}>ביטול</button>
          <button onClick={onConfirm} style={{
            background:confirmColor, color:"#fff", border:"none",
            borderRadius:8, padding:"9px 22px", fontWeight:700, cursor:"pointer",
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
