import { STATUS_OPTIONS } from "../constants";
import { s } from "../styles";

export default function BookingsHeader({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onOpenCreate,
  isMobile,
}) {
  return (
    <div style={s.header}>
      <h1 style={s.h1}>ניהול הזמנות</h1>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
        <input
          placeholder="🔍 לקוח, טלפון, רכב..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ ...s.searchInput, minWidth: isMobile ? "100%" : 220 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          style={{ ...s.select, width: isMobile ? "100%" : "auto" }}
        >
          <option value="all">כל הסטטוסים</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button onClick={onOpenCreate} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>
          + הזמנה חדשה
        </button>
      </div>
    </div>
  );
}

