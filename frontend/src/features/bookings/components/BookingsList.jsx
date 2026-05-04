import Badge from "../../../components/ui/Badge";
import { PhotoMenu } from "../../../components/photos/PhotoManagement";

import { statusMap } from "../constants";
import { s } from "../styles";
import { formatDate } from "../utils/dates";
import BookingAuditMeta from "./BookingAuditMeta";

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
  if (!isMobile) {
    return (
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
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
                        👤 {b.customer_name}
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
                      <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 4 }}>⚠️ חלף זמן החזרה</div>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 700, color: "#1d4ed8" }}>
                      {b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <Badge label={st.label} color={st.color} />
                    {b.email_sent && (
                      <span title="אימייל נשלח" style={{ marginRight: 4 }}>
                        📧
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {overdue && (
                        <>
                          <button
                            onClick={() => onQuickComplete(b)}
                            style={{
                              ...s.btnIcon,
                              color: "#166534",
                              background: "#dcfce7",
                              fontSize: 12,
                              padding: "2px 6px",
                              fontWeight: "bold",
                            }}
                            title="סמן כהושלמה"
                          >
                            ✅ סיום
                          </button>
                          <button
                            onClick={() => onQuickExtend(b)}
                            style={{
                              ...s.btnIcon,
                              color: "#1d4ed8",
                              background: "#dbeafe",
                              fontSize: 12,
                              padding: "2px 6px",
                              fontWeight: "bold",
                            }}
                            title="הארך ביום אחד"
                          >
                            📅 +יום
                          </button>
                        </>
                      )}
                      <button onClick={() => onOpenEdit(b)} style={s.btnIcon} title="ערוך">
                        ✏️
                      </button>
                      {b.status === "active" && (
                        <PhotoMenu
                          booking={b}
                          onView={() => onViewPhotos(b)}
                          onUpload={(files) => onUploadPhotos(b.id, files)}
                          onContinuousCamera={() => onContinuousCamera(b.id)}
                          isOpen={activePhotoMenu === b.id}
                          onToggle={() => onTogglePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                        />
                      )}
                      {canDeleteBookings && (
                        <button onClick={() => onRequestDelete(b)} style={s.btnIcon} title="מחק">
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
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
                👤 {b.customer_name}
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
                  <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 2 }}>⚠️ חלף זמן החזרה</div>
                )}
              </div>
            </div>

            <div style={s.mobileFooter}>
              <span style={{ fontWeight: 700, color: "#1d4ed8" }}>{b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {overdue && (
                  <>
                    <button
                      onClick={() => onQuickComplete(b)}
                      style={{
                        ...s.btnIcon,
                        color: "#166534",
                        background: "#dcfce7",
                        fontSize: 12,
                        padding: "2px 6px",
                        fontWeight: "bold",
                      }}
                      title="סמן כהושלמה"
                    >
                      ✅ סיום
                    </button>
                    <button
                      onClick={() => onQuickExtend(b)}
                      style={{
                        ...s.btnIcon,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        fontSize: 12,
                        padding: "2px 6px",
                        fontWeight: "bold",
                      }}
                      title="הארך ביום אחד"
                    >
                      📅 +יום
                    </button>
                  </>
                )}

                <button onClick={() => onOpenEdit(b)} style={s.btnIcon} title="ערוך">
                  ✏️
                </button>

                {b.status === "active" && (
                  <PhotoMenu
                    booking={b}
                    onView={() => onViewPhotos(b)}
                    onUpload={(files) => onUploadPhotos(b.id, files)}
                    onContinuousCamera={() => onContinuousCamera(b.id)}
                    isOpen={activePhotoMenu === b.id}
                    onToggle={() => onTogglePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                  />
                )}

                {canDeleteBookings && (
                  <button onClick={() => onRequestDelete(b)} style={s.btnIcon} title="מחק">
                    🗑️
                  </button>
                )}
              </div>
            </div>
            <BookingAuditMeta b={b} style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9" }} />
          </div>
        );
      })}
      {bookings.length === 0 && <div style={s.mobileEmpty}>לא נמצאו הזמנות</div>}
    </div>
  );
}

