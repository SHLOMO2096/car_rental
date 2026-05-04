import { s } from "../styles";
import { formatDateTime } from "../utils/dates";

/** פס audit קטן – "נוצר ע"י שם · תאריך" */
export default function BookingAuditMeta({ b, style = {} }) {
  const parts = [];
  if (b?.created_by_name) parts.push(`נוצר ע"י ${b.created_by_name}`);
  const dt = formatDateTime(b?.created_at);
  if (dt) parts.push(dt);
  if (!parts.length) return null;

  return (
    <div style={{ ...s.auditMeta, ...style }}>
      🕐 {parts.join(" · ")}
    </div>
  );
}

