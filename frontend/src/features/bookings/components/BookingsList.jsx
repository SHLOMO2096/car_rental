import Badge from "../../../components/ui/Badge";
import { PhotoMenu } from "../../../components/photos/PhotoManagement";

import { statusMap } from "../constants";
import { s } from "../styles";
import { formatDate } from "../utils/dates";
import BookingAuditMeta from "./BookingAuditMeta";
import { useDragScroll } from "../../../hooks/useDragScroll";
import { User, AlertTriangle, Mail, CircleCheck, CalendarPlus, Pencil, Trash2 } from "lucide-react";

export default function BookingsList({
  bookings,
  carsMap,
  isMobile,
  canDeleteBookings,
  activePhotoMenu,
  onTogglePhotoMenu,
  onOpenEdit,
  onOpenCustomerFromBooking,
  onRequestDelete,
  onViewPhotos,
  onUploadPhotos,
  onContinuousCamera,
  isBookingOverdue,
  onQuickComplete,
  onQuickExtend,
}) {
  const dragScroll = useDragScroll({ enabled: !isMobile });
  const actionsToolbar = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "4px 6px",
    borderRadius: 999,
    border: "1px solid #e3e7e5",
    background: "#f7faf8",
  };

  const actionChip = (variant) => {
    const base = {
      border: "1px solid",
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: 800,
      cursor: "pointer",
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "#fff",
      whiteSpace: "nowrap",
    };
    if (variant === "success") return { ...base, color: "#166534", background: "#dcfce7", borderColor: "#bbf7d0" };
    if (variant === "info") return { ...base, color: "#154038", background: "#d7e8e1", borderColor: "#b9d4cb" };
    return { ...base, color: "#59605d", background: "#fff", borderColor: "#e3e7e5" };
  };

  if (!isMobile) {
    return (
      <div {...dragScroll.bind} style={{ ...s.tableWrap, ...dragScroll.style }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: "#f7faf8" }}>
              {["#", "לקוח", "רכב", "מתאריך", "עד תאריך", "סכום", "סטטוס", "פעולות"].map((h) => (
                <th key={h} style={s.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const car = carsMap[b.car_id];
              const st = statusMap[b.status] || statusMap.cancelled;
              const overdue = isBookingOverdue(b);
              return (
                <tr key={b.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={s.idBadge}>#{b.id}</span>
                  </td>
                  <td style={s.td}>
                    {b.status === "active" && b.customer_id ? (
                      <button
                        type="button"
                        onClick={() => onOpenCustomerFromBooking(b)}
                        style={s.customerLinkBtn}
                        title="פתח כרטיס לקוח"
                        aria-label={`פתח כרטיס לקוח: ${b.customer_name}`}
                      >
                        <User size={13} strokeWidth={1.9} aria-hidden="true" /> {b.customer_name}
                      </button>
                    ) : (
                      <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                    )}
                    {b.customer_phone && <div style={s.sub}>{b.customer_phone}</div>}
                    {b.customer_email && <div style={s.sub}>{b.customer_email}</div>}
                    <BookingAuditMeta b={b} />
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>{car?.name || "—"}</div>
                    {car && <div style={s.sub}>{car.plate}</div>}
                  </td>
                  <td style={s.td}>
                    <div>{formatDate(b.start_date)}</div>
                    {b.status === "active" && <div style={s.sub}>איסוף: {b.pickup_time || "08:00"}</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? "bold" : "normal" }}>
                      {formatDate(b.end_date)}
                    </div>
                    {b.status === "active" && (
                      <div style={{ ...s.sub, color: overdue ? "#ef4444" : s.sub.color }}>החזרה: {b.return_time || "08:00"}</div>
                    )}
                    {overdue && (
                      <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 4 }}><AlertTriangle size={11} strokeWidth={1.9} aria-hidden="true" /> חלף זמן החזרה</div>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 700, color: "#154038" }}>
                      {b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <Badge label={st.label} color={st.color} />
                    {b.email_sent && (
                      <span title="אימייל נשלח" style={{ marginInlineStart: 4 }}>
                        <Mail size={15} strokeWidth={1.9} aria-hidden="true" />
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    <div style={actionsToolbar}>
                      {overdue && (
                        <>
                          <button
                            onClick={() => onQuickComplete(b)}
                            style={actionChip("success")}
                            title="סמן כהושלמה"
                          >
                            <CircleCheck size={14} strokeWidth={1.9} aria-hidden="true" /> סיום
                          </button>
                          <button
                            onClick={() => onQuickExtend(b)}
                            style={actionChip("info")}
                            title="הארך ביום אחד"
                          >
                            <CalendarPlus size={14} strokeWidth={1.9} aria-hidden="true" /> +יום
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onOpenEdit(b)}
                        style={{
                          ...s.btnIcon,
                          width: 34,
                          height: 34,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fff",
                          border: "1px solid #e3e7e5",
                          borderRadius: 14,
                        }}
                        title="ערוך"
                        aria-label={`ערוך הזמנה #${b.id}`}
                      >
                        <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                      {b.status === "active" && (
                        <PhotoMenu
                          booking={b}
                          onView={() => onViewPhotos(b)}
                          onUpload={(files) => onUploadPhotos(b.id, files)}
                          onContinuousCamera={() => onContinuousCamera(b.id)}
                          isOpen={activePhotoMenu === b.id}
                          onToggle={() => onTogglePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                          variant="compact"
                        />
                      )}
                      {canDeleteBookings && (
                        <button
                          onClick={() => onRequestDelete(b)}
                          style={{
                            ...s.btnIcon,
                            width: 34,
                            height: 34,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#fff",
                            border: "1px solid #fecaca",
                            borderRadius: 14,
                            color: "#dc2626",
                          }}
                          title="מחק"
                          aria-label={`מחק הזמנה #${b.id}`}
                        >
                          <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#8e9592" }}>
                  לא נמצאו הזמנות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Mobile cards
  return (
    <div style={s.mobileCardsWrap}>
      {bookings.map((b) => {
        const car = carsMap[b.car_id];
        const st = statusMap[b.status] || statusMap.cancelled;
        const overdue = isBookingOverdue(b);

        return (
          <div key={b.id} style={s.mobileCard}>
            <div style={s.mobileCardHead}>
              <span style={s.idBadge}>#{b.id}</span>
              <Badge label={st.label} color={st.color} />
            </div>

            {b.status === "active" && b.customer_id ? (
              <button
                type="button"
                onClick={() => onOpenCustomerFromBooking(b)}
                style={s.mobileCustomerLinkBtn}
                title="פתח כרטיס לקוח"
                aria-label={`פתח כרטיס לקוח: ${b.customer_name}`}
              >
                <User size={13} strokeWidth={1.9} aria-hidden="true" /> {b.customer_name}
              </button>
            ) : (
              <div style={s.mobileTitle}>{b.customer_name}</div>
            )}

            <div style={s.sub}>
              {car?.name || "—"}
              {car?.plate ? ` · ${car.plate}` : ""}
            </div>

            <div style={s.mobileDates}>
              <div>
                <b>מתאריך:</b> {formatDate(b.start_date)}
                {b.status === "active" && <div style={s.sub}>איסוף: {b.pickup_time || "08:00"}</div>}
              </div>
              <div>
                <b style={{ color: overdue ? "#dc2626" : "inherit" }}>עד תאריך:</b>{" "}
                <span style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? "bold" : "normal" }}>
                  {formatDate(b.end_date)}
                </span>
                {b.status === "active" && (
                  <div style={{ ...s.sub, color: overdue ? "#ef4444" : s.sub.color }}>החזרה: {b.return_time || "08:00"}</div>
                )}
                {overdue && (
                  <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 2 }}><AlertTriangle size={11} strokeWidth={1.9} aria-hidden="true" /> חלף זמן החזרה</div>
                )}
              </div>
            </div>

            <div style={s.mobileFooter}>
              <span style={{ fontWeight: 700, color: "#154038" }}>{b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}</span>
              <div style={actionsToolbar}>
                {overdue && (
                  <>
                    <button
                      onClick={() => onQuickComplete(b)}
                      style={actionChip("success")}
                      title="סמן כהושלמה"
                    >
                      <CircleCheck size={14} strokeWidth={1.9} aria-hidden="true" /> סיום
                    </button>
                    <button
                      onClick={() => onQuickExtend(b)}
                      style={actionChip("info")}
                      title="הארך ביום אחד"
                    >
                      <CalendarPlus size={14} strokeWidth={1.9} aria-hidden="true" /> +יום
                    </button>
                  </>
                )}

                <button
                  onClick={() => onOpenEdit(b)}
                  style={{
                    ...s.btnIcon,
                    width: 34,
                    height: 34,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                    border: "1px solid #e3e7e5",
                    borderRadius: 14,
                  }}
                  title="ערוך"
                  aria-label={`ערוך הזמנה #${b.id}`}
                >
                  <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
                </button>

                {b.status === "active" && (
                  <PhotoMenu
                    booking={b}
                    onView={() => onViewPhotos(b)}
                    onUpload={(files) => onUploadPhotos(b.id, files)}
                    onContinuousCamera={() => onContinuousCamera(b.id)}
                    isOpen={activePhotoMenu === b.id}
                    onToggle={() => onTogglePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                    variant="compact"
                  />
                )}

                {canDeleteBookings && (
                  <button
                    onClick={() => onRequestDelete(b)}
                    style={{
                      ...s.btnIcon,
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#fff",
                      border: "1px solid #fecaca",
                      borderRadius: 14,
                      color: "#dc2626",
                    }}
                    title="מחק"
                    aria-label={`מחק הזמנה #${b.id}`}
                  >
                    <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <BookingAuditMeta b={b} style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #eff3f1" }} />
          </div>
        );
      })}
      {bookings.length === 0 && <div style={s.mobileEmpty}>לא נמצאו הזמנות</div>}
    </div>
  );
}

