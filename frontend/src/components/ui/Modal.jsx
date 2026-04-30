// ══════════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";

export default function Modal({ open, onClose, title, children, wide = false, maxWidth = null }) {
  const isMobile = useIsMobile(640);
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div dir="rtl" onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000, padding:isMobile ? 8 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:isMobile ? 12 : 16, padding:isMobile ? 16 : 28,
        width:"100%", maxWidth: isMobile ? "100%" : (maxWidth || (wide ? 640 : 480)),
        maxHeight:isMobile ? "95vh" : "90vh", overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1e293b" }}>{title}</h2>
          <button onClick={onClose} style={{
            background:"none", border:"none", cursor:"pointer",
            fontSize:20, color:"#94a3b8", lineHeight:1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
