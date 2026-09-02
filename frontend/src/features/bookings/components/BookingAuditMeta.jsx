import { s } from "../styles";
import { formatDateTime } from "../utils/dates";
import { Clock } from "lucide-react";

/** פס audit קטן – "נוצר ע"י שם · תאריך" */
export default function BookingAuditMeta({ b, style = {} }) {
  const parts = [];
  if (b?.created_by_name) parts.push(`נוצר ע"י ${b.created_by_name}`);
  if (b?.updated_by_name) parts.push(`עודכן ע"י ${b.updated_by_name}`);
  const dt = formatDateTime(b?.created_at);
  if (dt) parts.push(dt);
  const updatedDt = formatDateTime(b?.updated_at);
  if (updatedDt) parts.push(`עדכון ${updatedDt}`);
  if (!parts.length) return null;

  return (
    <div style={{ ...s.auditMeta, ...style }}>
      <Clock size={11} strokeWidth={1.9} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={s.auditMetaText}>{parts.join(" · ")}</span>
    </div>
  );
}

