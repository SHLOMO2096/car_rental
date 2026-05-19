export default function BookingDeleteModal({
  booking,
  loading,
  onConfirm,
  onCancel,
  operatorNote,
  onOperatorNoteChange,
  requiresOperatorNote,
}) {
  if (!booking) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}
    >
      <div
        dir="rtl"
        style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#991b1b" }}>מחיקת הזמנה</h3>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}><strong>לקוח:</strong> {booking.customer_name}</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}><strong>תאריכים:</strong> {booking.start_date} - {booking.end_date}</div>
        <div style={{ fontSize: 12, color: "#991b1b", background: "#fef2f2", borderRadius: 10, padding: "10px 12px", margin: "14px 0 18px" }}>
          המחיקה מבוצעת כפעולת soft delete ומתועדת ב-audit log.
        </div>
        {requiresOperatorNote && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
              נדרשת הערת מפעיל למחיקת הזמנה שנוצרה ע"י סוכן אחר
            </div>
            <textarea
              value={operatorNote}
              onChange={(e) => onOperatorNoteChange?.(e.target.value)}
              rows={3}
              placeholder="מה הסיבה למחיקה? מי אישר?"
              style={{ width: "100%", borderRadius: 8, border: "1px solid #f59e0b", padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#374151", cursor: "pointer" }}>
            ביטול
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || (requiresOperatorNote && !operatorNote.trim())}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              background: loading || (requiresOperatorNote && !operatorNote.trim()) ? "#fca5a5" : "#dc2626",
              color: "#fff",
              fontWeight: 700,
              cursor: loading || (requiresOperatorNote && !operatorNote.trim()) ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "מוחק..." : "🗑 מחק הזמנה"}
          </button>
        </div>
      </div>
    </div>
  );
}

