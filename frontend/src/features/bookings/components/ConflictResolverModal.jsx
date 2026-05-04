import Modal from "../../../components/ui/Modal";

import { s } from "../styles";
import { addDays, diffDays, formatDate, formatDayWithWeekday } from "../utils/dates";
import { overlaps } from "../utils/bookingMath";

export default function ConflictResolverModal({
  open,
  conflictModal,
  categories,
  cars,
  form,
  isMobile,
  resolvingConflict,
  dragItem,
  dragOverCarId,
  setDragOverCarId,
  onClose,
  onUpdateFilters,
  onCardDragStart,
  onCardDragEnd,
  onDropToCar,
}) {
  const conflictModelOptions = conflictModal
    ? [...new Set(cars.filter((c) => c.is_active).map((c) => c.name))].sort((a, b) => a.localeCompare(b, "he"))
    : [];

  const conflictVisibleCars = conflictModal
    ? cars.filter(
      (c) =>
        c.is_active &&
        (!conflictModal.modelFilter || conflictModal.modelFilter.length === 0 || conflictModal.modelFilter.includes(c.name)) &&
        (!conflictModal.categoryFilter ||
          conflictModal.categoryFilter.length === 0 ||
          conflictModal.categoryFilter.includes(c.category || "")),
    )
    : [];

  const conflictDates = conflictModal
    ? Array.from({ length: Math.max(diffDays(conflictModal.viewStart, conflictModal.viewEnd) + 1, 1) }, (_, i) =>
      addDays(conflictModal.viewStart, i),
    )
    : [];

  const conflictOcc = {};
  if (conflictModal) {
    conflictModal.bookings.forEach((b) => {
      conflictDates.forEach((ds) => {
        if (ds >= b.start_date && ds <= b.end_date) conflictOcc[`${ds}:${b.car_id}`] = b;
      });
    });
  }

  const draggingRange = dragItem
    ? dragItem.type === "existing"
      ? { start: dragItem.booking.start_date, end: dragItem.booking.end_date }
      : { start: form.start_date, end: form.end_date }
    : null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (resolvingConflict) return;
        onClose();
      }}
      title="הרכב תפוס - פתרון בגרירה"
      wide
      maxWidth={960}
    >
      {conflictModal && (
        <div>
          <div style={s.conflictIntro}>
            <strong>
              ⚠️ הרכב {conflictModal.requestedCarName} תפוס בין {formatDate(conflictModal.requestedStart)} ל-
              {formatDate(conflictModal.requestedEnd)}.
            </strong>
            <div style={{ marginTop: 6 }}>
              גרור כרטיסים בין רכבים כדי לפנות מקום: 1) אפשר לגרור כל הזמנה קיימת בלוח. 2) אפשר גם לגרור את
              ההזמנה החדשה לרכב חלופי.
            </div>
          </div>

          <div style={s.conflictFilters}>
            <label style={s.conflictFilterField}>
              <span style={s.conflictFilterLabel}>
                קטגוריה
                {conflictModal.categoryFilter.length > 0 && (
                  <button
                    onClick={() => onUpdateFilters({ categoryFilter: [] })}
                    disabled={resolvingConflict}
                    style={s.conflictClearBtn}
                  >
                    נקה
                  </button>
                )}
              </span>
              <div style={s.conflictFilterScroll}>
                {categories.map((cat) => {
                  const checked = conflictModal.categoryFilter.includes(cat.name);
                  return (
                    <label
                      key={cat.name}
                      style={{ ...s.conflictFilterItem, background: checked ? "#eff6ff" : "transparent" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? conflictModal.categoryFilter.filter((c) => c !== cat.name)
                            : [...conflictModal.categoryFilter, cat.name];
                          onUpdateFilters({ categoryFilter: next });
                        }}
                      />
                      {cat.name}
                    </label>
                  );
                })}
              </div>
            </label>

            <label style={s.conflictFilterField}>
              <span style={s.conflictFilterLabel}>
                דגם
                {conflictModal.modelFilter.length > 0 && (
                  <button
                    onClick={() => onUpdateFilters({ modelFilter: [] })}
                    disabled={resolvingConflict}
                    style={{
                      marginRight: 6,
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#f1f5f9",
                      cursor: "pointer",
                      color: "#64748b",
                    }}
                  >
                    נקה
                  </button>
                )}
              </span>
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#fff",
                  maxHeight: 130,
                  overflowY: "auto",
                  padding: "4px 0",
                  opacity: resolvingConflict ? 0.5 : 1,
                  pointerEvents: resolvingConflict ? "none" : "auto",
                }}
              >
                {conflictModelOptions.map((model) => {
                  const checked = conflictModal.modelFilter.includes(model);
                  return (
                    <label
                      key={model}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#374151",
                        background: checked ? "#eff6ff" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = conflictModal.modelFilter;
                          const next = checked ? current.filter((m) => m !== model) : [...current, model];
                          onUpdateFilters({ modelFilter: next });
                        }}
                      />
                      {model}
                    </label>
                  );
                })}
                {conflictModelOptions.length === 0 && (
                  <div style={{ padding: "4px 10px", fontSize: 12, color: "#94a3b8" }}>אין דגמים</div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {conflictModal.modelFilter.length === 0 ? "מוצגים כל הדגמים" : `${conflictModal.modelFilter.length} דגמים נבחרו`}
              </div>
            </label>

            <label style={s.conflictFilterField}>
              <span style={s.conflictFilterLabel}>מתאריך</span>
              <input
                type="date"
                value={conflictModal.viewStart}
                onChange={(e) => onUpdateFilters({ viewStart: e.target.value })}
                style={s.conflictFilterInput}
                disabled={resolvingConflict}
              />
            </label>

            <label style={s.conflictFilterField}>
              <span style={s.conflictFilterLabel}>עד תאריך (מינימום שבוע)</span>
              <input
                type="date"
                value={conflictModal.viewEnd}
                min={addDays(conflictModal.viewStart, 6)}
                onChange={(e) => onUpdateFilters({ viewEnd: e.target.value })}
                style={s.conflictFilterInput}
                disabled={resolvingConflict}
              />
            </label>
          </div>

          <div style={s.newBookingCardWrap}>
            <div
              draggable={!resolvingConflict}
              onDragStart={(e) => onCardDragStart(e, { type: "new" })}
              onDragEnd={onCardDragEnd}
              style={{ ...s.conflictCard, ...s.newBookingCard }}
            >
              <div style={s.newBookingBadge}>חדש · מוכן לגרירה</div>
              <div style={s.newBookingTitle}>✨ גרור אותי ללוח כדי לבחור רכב חלופי</div>
              <div style={s.newBookingMeta}>
                {form.customer_name || "לקוח חדש"} · {formatDate(form.start_date)} עד {formatDate(form.end_date)}
              </div>
            </div>
            <div style={s.conflictLegend}>
              <span>
                <b style={{ color: "#0f172a" }}>אפור:</b> הזמנה קיימת (ניתן לגרירה מהתאריך הראשון שלה)
              </span>
              <span>
                <b style={{ color: "#991b1b" }}>אדום:</b> הזמנה שחוסמת כרגע את הרכב המבוקש
              </span>
              <span>
                <b style={{ color: "#166534" }}>ירוק:</b> תא פנוי לשחרור
              </span>
              <span>
                <b style={{ color: "#1d4ed8" }}>כחול:</b> טווח יעד פעיל לגרירה
              </span>
            </div>
          </div>

          <div style={s.conflictTableWrap}>
            <table style={{ ...s.conflictTable, minWidth: isMobile ? 620 : 780 }}>
              <thead>
                <tr>
                  <th style={{ ...s.conflictTh, ...s.conflictStickyCorner }}>תאריך</th>
                  {conflictVisibleCars.map((car) => (
                    <th key={car.id} style={s.conflictTh}>
                      <div>
                        {car.name} {car.id === conflictModal.requestedCarId ? "(מבוקש)" : ""}
                      </div>
                      <div style={s.conflictCarMeta}>#{car.id}{car.plate ? ` · ${car.plate}` : ""}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conflictDates.map((ds) => (
                  <tr key={ds}>
                    <td style={{ ...s.conflictTd, ...s.conflictStickyDate }}>{formatDayWithWeekday(ds)}</td>
                    {conflictVisibleCars.map((car) => {
                      const b = conflictOcc[`${ds}:${car.id}`];
                      const canDrop =
                        dragItem &&
                        ((dragItem.type === "new" && car.id !== conflictModal.requestedCarId) ||
                          (dragItem.type === "existing" && car.id !== dragItem.booking.car_id));
                      const isHoveredTarget = !!draggingRange && dragOverCarId === car.id;
                      const inPreviewRange = !!draggingRange && ds >= draggingRange.start && ds <= draggingRange.end;
                      const isRangePreviewCell = isHoveredTarget && inPreviewRange;
                      if (!b) {
                        return (
                          <td
                            key={car.id}
                            onDragOver={(e) => {
                              if (canDrop) {
                                e.preventDefault();
                                if (dragOverCarId !== car.id) setDragOverCarId(car.id);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverCarId === car.id) setDragOverCarId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              onDropToCar(car.id);
                            }}
                            style={{
                              ...s.conflictTd,
                              background: isRangePreviewCell ? "#bfdbfe" : canDrop ? "#dbeafe" : "#dcfce7",
                              color: canDrop ? "#1d4ed8" : "#166534",
                              cursor: canDrop ? "copy" : "default",
                              outline: isRangePreviewCell ? "1px dashed #2563eb" : "none",
                              outlineOffset: "-1px",
                            }}
                          >
                            {canDrop ? "שחרר כאן" : "פנוי"}
                          </td>
                        );
                      }

                      const isBlocker =
                        b.car_id === conflictModal.requestedCarId &&
                        overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd);
                      const dragAnchorDay = b.start_date > conflictModal.viewStart ? b.start_date : conflictModal.viewStart;
                      const isDragHandleCell = ds === dragAnchorDay;
                      const isExistingDragged = dragItem?.type === "existing" && dragItem.booking.id === b.id;
                      const oneDayBooking = b.start_date === b.end_date;
                      const pickup = b.pickup_time || "08:00";
                      const ret = b.return_time || "08:00";

                      return (
                        <td
                          key={car.id}
                          onDragOver={(e) => {
                            if (canDrop) {
                              e.preventDefault();
                              if (dragOverCarId !== car.id) setDragOverCarId(car.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverCarId === car.id) setDragOverCarId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            onDropToCar(car.id);
                          }}
                          style={{
                            ...s.conflictTd,
                            background: isRangePreviewCell
                              ? "#bfdbfe"
                              : isBlocker
                                ? "#fee2e2"
                                : isExistingDragged
                                  ? "#dbeafe"
                                  : "#f8fafc",
                            color: isBlocker ? "#991b1b" : "#334155",
                            padding: 4,
                            outline: isRangePreviewCell ? "1px dashed #2563eb" : "none",
                            outlineOffset: "-1px",
                          }}
                        >
                          <div
                            draggable={isDragHandleCell && !resolvingConflict}
                            onDragStart={(e) => isDragHandleCell && onCardDragStart(e, { type: "existing", booking: b })}
                            onDragEnd={onCardDragEnd}
                            style={{
                              ...s.conflictCellCard,
                              opacity: isExistingDragged ? 0.62 : 1,
                              cursor: isDragHandleCell ? "grab" : "default",
                              borderColor: isBlocker ? "#fca5a5" : isExistingDragged ? "#93c5fd" : "#cbd5e1",
                              background: isBlocker ? "#fff1f2" : "#ffffff",
                            }}
                            title={isDragHandleCell ? "גרור להעברה לרכב אחר (הזמנה מלאה)" : "תפוס"}
                          >
                            #{b.id} {b.customer_name}
                            {isDragHandleCell && <div style={s.fullDragHint}>גרירה מלאה של ההזמנה</div>}
                            {isBlocker && <div style={s.blockerHint}>חוסם כרגע את הרכב המבוקש</div>}
                            {oneDayBooking ? (
                              <div style={s.conflictMetaText}>יציאה היום {pickup} · חזרה מחר {ret}</div>
                            ) : (
                              <div style={s.conflictMetaText}>
                                מ-{formatDate(b.start_date)} {pickup} עד {formatDate(b.end_date)} {ret}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...s.conflictFooter, flexDirection: isMobile ? "column-reverse" : "row", alignItems: isMobile ? "stretch" : "center" }}>
            <button
              onClick={onClose}
              disabled={resolvingConflict}
              style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}
            >
              סגור
            </button>
            {resolvingConflict && <span style={s.conflictWorking}>מבצע עדכון...</span>}
          </div>
        </div>
      )}
    </Modal>
  );
}

