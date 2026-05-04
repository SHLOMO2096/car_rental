export default function UploadQueueFloatingPanel({ uploadQueue, onClear }) {
  if (!uploadQueue || uploadQueue.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 10000,
        background: "#1e293b",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 200,
        maxWidth: 300,
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          borderBottom: "1px solid #334155",
          paddingBottom: 6,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>📤 העלאת תמונות ({uploadQueue.filter((u) => u.status !== "done").length})</span>
        <button
          onClick={onClear}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
        >
          נקה הכל
        </button>
      </div>
      <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {uploadQueue.map((u) => (
          <div
            key={u.id}
            style={{ fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                marginRight: 8,
              }}
            >
              #{u.bookingId} - {u.fileName}
            </span>
            <span
              style={{
                color: u.status === "done" ? "#22c55e" : u.status === "error" ? "#ef4444" : "#3b82f6",
                fontWeight: 600,
              }}
            >
              {u.status === "compressing"
                ? "דוחס..."
                : u.status === "uploading"
                  ? "מעלה..."
                  : u.status === "done"
                    ? "✓ הושלם"
                    : "✘ שגיאה"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

