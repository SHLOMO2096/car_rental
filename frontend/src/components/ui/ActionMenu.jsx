// ══════════════════════════════════════════════════════════════════════════════
// תפריט פעולות לשורת טבלה.
//
// מחליף את הדפוס של "כל הפעולות כגלולות צבעוניות בתא": פעולה ראשית אחת
// נשארת גלויה, השאר נכנסות לכאן. כך הצבע חוזר לשמש את הנתונים ולא את הכרום,
// והשורה מפסיקה להישבר לשלוש שורות.
//
//   <ActionMenu
//     label="פעולות ללקוח דוד לוי"
//     items={[
//       { label: "היסטוריה", Icon: History, onSelect: () => ... },
//       { label: "מחק", Icon: Trash2, onSelect: () => ..., danger: true },
//     ]}
//   />
import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ActionMenu({ label = "פעולות נוספות", items = [], align = "start" }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const usable = items.filter(Boolean);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();      // אל תסגור גם את המודאל שמסביב
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openWith(index) {
    setOpen(true);
    setActiveIndex(index);
  }

  function onTriggerKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openWith(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openWith(usable.length - 1);
    }
  }

  function onItemKeyDown(e, index) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((index + 1) % usable.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((index - 1 + usable.length) % usable.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(usable.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function choose(item) {
    setOpen(false);
    triggerRef.current?.focus();
    item.onSelect?.();
  }

  if (usable.length === 0) return null;

  return (
    <div className="action-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openWith(-1))}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreHorizontal size={17} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`action-menu__list action-menu__list--${align}`}
        >
          {usable.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => (itemRefs.current[i] = el)}
              type="button"
              role="menuitem"
              tabIndex={i === activeIndex ? 0 : -1}
              disabled={item.disabled}
              className={`action-menu__item${item.danger ? " action-menu__item--danger" : ""}`}
              onClick={() => choose(item)}
              onKeyDown={(e) => onItemKeyDown(e, i)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {item.Icon && <item.Icon size={15} strokeWidth={1.9} aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
