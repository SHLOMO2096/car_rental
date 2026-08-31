import { useEffect } from "react";
import { useToastStore } from "../../store/toast";

// אייקוני קו במקום אימוג׳י — יורשים את צבע הטוסט במקום להישאר צבעוניים תמיד.
const ICON = {
  success: <path d="m4.5 12.5 5 5 10-10" />,
  error:   <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>,
  warning: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  info:    <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};

function ToastItem({ item, onRemove }) {
  useEffect(() => {
    const id = window.setTimeout(() => onRemove(item.id), item.duration || 4000);
    return () => window.clearTimeout(id);
  }, [item.duration, item.id, onRemove]);

  const type = ICON[item.type] ? item.type : "info";

  return (
    <div className={`toast toast--${type}`} role={type === "error" ? "alert" : "status"}>
      <svg className="toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        {ICON[type]}
      </svg>

      <div className="toast__body">
        {item.title && <div className="toast__title">{item.title}</div>}
        <div className="toast__text">{item.message}</div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="סגור הודעה"
        style={close}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  return (
    <div dir="rtl" className="toast-host" aria-live="polite">
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onRemove={remove} />
      ))}
    </div>
  );
}

const close = {
  display: "flex",
  alignItems: "center",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  padding: 2,
  marginTop: 1,
  opacity: .7,
  borderRadius: "var(--radius-sm)",
};
