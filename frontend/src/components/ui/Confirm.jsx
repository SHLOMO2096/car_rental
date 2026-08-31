// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

export default function Confirm({
  open, message, messageList, onConfirm, onCancel,
  confirmLabel = "אישור", confirmColor = null,
}) {
  const cancelRef = useRef(null);

  // ברירת המחדל היא הכפתור הבטוח: Enter לא מוחק בטעות.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = e => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const lines = String(message || "").split("\n").filter(Boolean);
  const hasList = Array.isArray(messageList) && messageList.length > 0;

  return (
    <div dir="rtl" className="modal-overlay">
      <div role="alertdialog" aria-modal="true" aria-label={lines[0] || "אישור פעולה"}
           className="modal modal--narrow">
        <div style={warn} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>

        <div style={body}>
          {lines.length <= 1 ? (
            <p>{message}</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {lines.map((line, idx) => <p key={idx}>{line}</p>)}
            </div>
          )}
          {hasList && (
            <ul style={list}>
              {messageList.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "center", marginTop: "var(--space-6)" }}>
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel}>
            ביטול
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onConfirm}
            style={confirmColor ? { background: confirmColor } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const warn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  margin: "0 auto var(--space-5)",
  borderRadius: "var(--radius-pill)",
  background: "var(--c-warning-bg)",
  color: "var(--c-warning)",
};

const body = {
  color: "var(--c-ink-2)",
  fontSize: "var(--text-base)",
  lineHeight: "var(--leading-body)",
  textAlign: "start",
};

const list = {
  margin: "var(--space-4) 0 0",
  paddingInlineStart: "var(--space-6)",
  color: "var(--c-text)",
  fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-loose)",
};


// ══════════════════════════════════════════════════════════════════════════════
