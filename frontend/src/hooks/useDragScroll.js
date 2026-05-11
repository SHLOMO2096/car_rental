import { useCallback, useMemo, useRef } from "react";

let cachedRtlScrollType = null;

function detectRtlScrollType() {
  // In JSDOM (tests) there is no layout, but we still want deterministic behavior.
  if (typeof document === "undefined") return "default";
  if (cachedRtlScrollType) return cachedRtlScrollType;

  const outer = document.createElement("div");
  outer.dir = "rtl";
  outer.style.width = "1px";
  outer.style.height = "1px";
  outer.style.overflow = "scroll";
  outer.style.visibility = "hidden";

  const inner = document.createElement("div");
  inner.style.width = "2px";
  inner.style.height = "1px";
  outer.appendChild(inner);

  document.body.appendChild(outer);

  // If scrollLeft starts as a positive number, the browser uses the "default" model.
  if (outer.scrollLeft > 0) {
    cachedRtlScrollType = "default";
  } else {
    outer.scrollLeft = 1;
    // If setting to 1 doesn't move it, the browser uses negative scrollLeft.
    cachedRtlScrollType = outer.scrollLeft === 0 ? "negative" : "reverse";
  }

  document.body.removeChild(outer);
  return cachedRtlScrollType;
}

function getNormalizedScrollLeft(el) {
  const dir = (typeof window !== "undefined" && window.getComputedStyle)
    ? window.getComputedStyle(el).direction
    : "ltr";
  if (dir !== "rtl") return el.scrollLeft;

  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const type = detectRtlScrollType();
  if (type === "negative") return max + el.scrollLeft; // scrollLeft in [-max..0]
  if (type === "reverse") return max - el.scrollLeft; // scrollLeft in [0..max] but reversed
  return el.scrollLeft; // "default" uses [0..max]
}

function setNormalizedScrollLeft(el, value) {
  const dir = (typeof window !== "undefined" && window.getComputedStyle)
    ? window.getComputedStyle(el).direction
    : "ltr";
  if (dir !== "rtl") {
    el.scrollLeft = value;
    return;
  }

  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const type = detectRtlScrollType();

  if (type === "negative") {
    el.scrollLeft = value - max;
    return;
  }
  if (type === "reverse") {
    el.scrollLeft = max - value;
    return;
  }
  el.scrollLeft = value;
}

function isInteractiveTarget(target, ignoreSelector) {
  if (!target || typeof target.closest !== "function") return false;
  return !!target.closest(ignoreSelector);
}

/**
 * Enables “grab & drag” scrolling (mouse + touch) for scrollable containers.
 *
 * Usage:
 *   const drag = useDragScroll();
 *   <div {...drag.bind} style={{ ...drag.style, overflowX: 'auto' }}>...</div>
 */
export function useDragScroll(options = {}) {
  const {
    axis = "x",
    enabled = true,
    dragThreshold = 6,
    // Inputs/selects shouldn't start drag-scroll.
    // Buttons/links are allowed: click is suppressed only if an actual drag happened.
    ignoreSelector =
      // NOTE: In dense tables (Bookings/Customers) users often click action buttons.
      // Starting drag-scroll on buttons can cause clicks to be suppressed due to tiny hand jitter.
      // So we ignore common interactive controls by default.
      'input, textarea, select, option, button, a, [role="button"], [contenteditable="true"], [data-drag-scroll-ignore], [draggable="true"]',
    cursor = true,
  } = options;

  const stateRef = useRef({
    pointerId: null,
    isPointerDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    originalUserSelect: "",
    originalCursor: "",
    suppressClick: false,
  });

  const baseStyle = useMemo(() => {
    if (!enabled) return {};
    const style = {
      touchAction: axis === "x" ? "pan-y" : "pan-x",
    };
    if (cursor) style.cursor = "grab";
    return style;
  }, [axis, cursor, enabled]);

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isInteractiveTarget(e.target, ignoreSelector)) return;

      const el = e.currentTarget;
      const st = stateRef.current;

      st.pointerId = e.pointerId;
      st.isPointerDown = true;
      st.isDragging = false;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.startScrollX = getNormalizedScrollLeft(el);
      st.startScrollY = el.scrollTop;
      st.suppressClick = false;

      // Cursor / user-select tweaks (do not rely on re-render).
      st.originalUserSelect = el.style.userSelect;
      el.style.userSelect = "none";
      if (cursor) {
        st.originalCursor = el.style.cursor;
        el.style.cursor = "grabbing";
      }

      // Capture so dragging keeps working even if pointer leaves element.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    },
    [axis, cursor, enabled, ignoreSelector, dragThreshold]
  );

  const onPointerMove = useCallback(
    (e) => {
      const st = stateRef.current;
      if (!enabled) return;
      if (!st.isPointerDown) return;
      if (st.pointerId !== e.pointerId) return;

      const el = e.currentTarget;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;

      if (!st.isDragging) {
        const primaryDelta = axis === "x" ? dx : dy;
        const crossDelta = axis === "x" ? dy : dx;

        // If the gesture is mostly in the other direction, let the browser handle it.
        if (Math.abs(crossDelta) > Math.abs(primaryDelta) && Math.abs(crossDelta) > dragThreshold) {
          return;
        }

        if (Math.abs(primaryDelta) < dragThreshold) return;
        st.isDragging = true;
        st.suppressClick = true;
      }

      // Once dragging - prevent accidental selections and default drag behaviors.
      e.preventDefault();

      if (axis === "x") {
        setNormalizedScrollLeft(el, st.startScrollX - dx);
      } else {
        el.scrollTop = st.startScrollY - dy;
      }
    },
    [axis, dragThreshold, enabled]
  );

  const endPointer = useCallback(
    (e) => {
      const st = stateRef.current;
      if (!enabled) return;
      if (!st.isPointerDown) return;
      if (st.pointerId !== e.pointerId) return;

      const el = e.currentTarget;
      st.isPointerDown = false;
      st.pointerId = null;

      el.style.userSelect = st.originalUserSelect;
      if (cursor) el.style.cursor = st.originalCursor || "grab";

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    },
    [cursor, enabled]
  );

  const onClickCapture = useCallback(
    (e) => {
      const st = stateRef.current;
      if (!enabled) return;
      if (!st.suppressClick) return;
      st.suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    [enabled]
  );

  const bind = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
    }),
    [endPointer, onClickCapture, onPointerDown, onPointerMove]
  );

  return { bind, style: baseStyle };
}

