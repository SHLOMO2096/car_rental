// ══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  green: { bg:"#f0fdf4", border:"#bbf7d0", text:"#15803d" },
  blue:  { bg:"#eff6ff", border:"#bfdbfe", text:"#1d4ed8" },
  gray:  { bg:"#f8fafc", border:"#e2e8f0", text:"#475569" },
  red:   { bg:"#fef2f2", border:"#fecaca", text:"#dc2626" },
  amber: { bg:"#fffbeb", border:"#fde68a", text:"#b45309" },
};

export default function Badge({ label, color = "gray" }) {
  const c = COLORS[color] || COLORS.gray;
  return (
    <span style={{
      background: c.bg, border:`1px solid ${c.border}`, color: c.text,
      borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600,
      whiteSpace:"nowrap", display:"inline-block",
    }}>{label}</span>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
