// ══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, wide = false, maxWidth = null }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useId();

  // onClose מגיע לרוב כפונקציית חץ אנונימית, כלומר זהות חדשה בכל רינדור.
  // מחזיקים אותו ב-ref כדי שהאפקטים למטה לא ייתלו בו — כשהם כן נתלו,
  // כל הקשה במקלדת הריצה מחדש את מיקוד-הפתיחה והמיקוד קפץ מהשדה.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const close = useCallback(() => onCloseRef.current?.(), []);

  // מיקוד פתיחה והחזרתו בסגירה — תלוי אך ורק ב-open.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    if (first) first.focus();
    else panel?.focus();
    return () => restoreRef.current?.focus?.();
  }, [open]);

  // מלכודת מיקוד ו-Escape — גם הוא תלוי רק ב-open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div dir="rtl" className="modal-overlay" onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal${wide ? " modal--wide" : ""}`}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button type="button" className="btn btn--icon" onClick={close} aria-label="סגור">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
