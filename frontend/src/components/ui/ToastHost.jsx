import { useEffect } from "react";
import { useToastStore } from "../../store/toast";

const TYPE_STYLE = {
  success: { bg: "#ecfdf5", border: "#a7f3d0", color: "#047857", icon: "✅" },
  error: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", icon: "⛔" },
  warning: { bg: "#fff7ed", border: "#fdba74", color: "#c2410c", icon: "⚠️" },
  info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", icon: "ℹ️" },
};

function ToastItem({ item, onRemove }) {
  useEffect(() => {
    const id = window.setTimeout(() => onRemove(item.id), item.duration || 4000);
    return () => window.clearTimeout(id);
  }, [item.duration, item.id, onRemove]);

  const style = TYPE_STYLE[item.type] || TYPE_STYLE.info;

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.color,
      borderRadius: 10,
      padding: "10px 12px",
      boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
      minWidth: 280,
      maxWidth: 380,
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <div style={{ fontSize: 18, lineHeight: 1 }}>{style.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.title && <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{item.title}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.45 }}>{item.message}</div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        style={{
          background: "transparent",
          border: "none",
          color: style.color,
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="סגור הודעה"
      >
        ×
      </button>
    </div>
  );
}

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: "auto" }}>
          <ToastItem item={item} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}

