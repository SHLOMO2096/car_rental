// ══════════════════════════════════════════════════════════════════════════════
// הצבעים עצמם חיים ב-styles/components.css ונגזרים מהטוקנים.
// ה-API נשאר זהה (color="green" | "blue" | ...) כדי לא לגעת באתרי הקריאה.
const VARIANT = {
  green: "badge--success",
  blue:  "badge--brand",
  red:   "badge--danger",
  amber: "badge--warning",
  gray:  "",
};

export default function Badge({ label, color = "gray" }) {
  const variant = VARIANT[color] ?? VARIANT.gray;
  return <span className={`badge ${variant}`.trim()}>{label}</span>;
}


// ══════════════════════════════════════════════════════════════════════════════
