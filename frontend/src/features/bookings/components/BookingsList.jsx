import Badge from "../../../components/ui/Badge";
import { PhotoMenu } from "../../../components/photos/PhotoManagement";

import { statusMap } from "../constants";
import { s } from "../styles";
import { formatDate } from "../utils/dates";
import BookingAuditMeta from "./BookingAuditMeta";
import { useDragScroll } from "../../../hooks/useDragScroll";
import { User, AlertTriangle, Mail, CircleCheck, CalendarPlus, Pencil, Trash2 } from "lucide-react";
import ActionMenu from "../../../components/ui/ActionMenu";

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
  // היה כאן סרגל מעוגל עם רקע ומסגרת שהכיל צ'יפים מעוגלים — גלולה בתוך
  // גלולה. עכשיו זו פריסה בלבד, והרכיבים עצמם נושאים את הסגנון.
  const actionsToolbar = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
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
                      {/* פעולות מהירות מופיעות רק כשהן רלוונטיות — הזמנה
                          שחלף מועדה. השאר יושבות בתפריט. */}
                      {overdue && (
                        <>
                          <button
                            onClick={() => onQuickComplete(b)}
                            className="btn btn--secondary btn--sm"
                            title="סמן כהושלמה"
                          >
                            <CircleCheck size={14} strokeWidth={1.9} aria-hidden="true" /> סיום
                          </button>
                          <button
                            onClick={() => onQuickExtend(b)}
                            className="btn btn--secondary btn--sm"
                            title="הארך ביום אחד"
                          >
                            <CalendarPlus size={14} strokeWidth={1.9} aria-hidden="true" /> +יום
                          </button>
                        </>
                      )}

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

                      <ActionMenu
                        align="end"
                        label={`פעולות להזמנה ${b.id}`}
                        items={[
                          { label: "עריכת הזמנה", Icon: Pencil, onSelect: () => onOpenEdit(b) },
                          canDeleteBookings && {
                            label: "מחיקת הזמנה", Icon: Trash2, danger: true,
                            onSelect: () => onRequestDelete(b),
                          },
                        ]}
                      />
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
                    <button onClick={() => onQuickComplete(b)} className="btn btn--secondary btn--sm" title="סמן כהושלמה">
                      <CircleCheck size={14} strokeWidth={1.9} aria-hidden="true" /> סיום
                    </button>
                    <button onClick={() => onQuickExtend(b)} className="btn btn--secondary btn--sm" title="הארך ביום אחד">
                      <CalendarPlus size={14} strokeWidth={1.9} aria-hidden="true" /> +יום
                    </button>
                  </>
                )}

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

                <ActionMenu
                  align="end"
                  label={`פעולות להזמנה ${b.id}`}
                  items={[
                    { label: "עריכת הזמנה", Icon: Pencil, onSelect: () => onOpenEdit(b) },
                    canDeleteBookings && {
                      label: "מחיקת הזמנה", Icon: Trash2, danger: true,
                      onSelect: () => onRequestDelete(b),
                    },
                  ]}
                />
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

