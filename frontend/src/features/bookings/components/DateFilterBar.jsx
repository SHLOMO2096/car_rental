import { s } from "../styles";

export default function DateFilterBar({
  dateFilter,
  onDateFilterChange,
  customDate,
  onCustomDateChange,
  activeDateStr,
  isMobile,
}) {
  return (
    <div style={{ ...s.dateFilterBar, overflowX: isMobile ? "auto" : "visible", flexWrap: isMobile ? "nowrap" : "wrap" }}>
      {[
        { key: "all", label: "כל התאריכים" },
        { key: "today", label: "היום" },
        { key: "tomorrow", label: "מחר" },
        { key: "custom", label: "תאריך ספציפי 📅" },
      ].map((opt) => (
        <button
          key={opt.key}
          onClick={() => onDateFilterChange(opt.key)}
          style={dateFilter === opt.key ? s.dateFilterBtnActive : s.dateFilterBtn}
        >
          {opt.label}
        </button>
      ))}

      {dateFilter === "custom" && (
        <input type="date" value={customDate} onChange={(e) => onCustomDateChange(e.target.value)} style={s.datePickerInline} />
      )}

      {activeDateStr && dateFilter !== "all" && (
        <span style={s.dateFilterHint}>📋 מציג הזמנות פעילות ב-{new Date(activeDateStr).toLocaleDateString("he-IL")}</span>
      )}
    </div>
  );
}

