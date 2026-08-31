// ══════════════════════════════════════════════════════════════════════════════
// מעבדת נושא — כלי פיתוח בלבד (נטען רק כש-import.meta.env.DEV).
//
// משנה את החוגות של styles/tokens.css בזמן אמת על <html>, כדי לנסות
// צבע מותג, סולם אפור, זוג גופנים, גודל בסיס ורדיוס בלי לגעת בקוד.
// בסוף אפשר להעתיק את הערכים הסופיים ישירות לתוך tokens.css.
import { useEffect, useState } from "react";

const STORE_KEY = "theme-lab";

const BRANDS = [
  { id: "blue",     label: "כחול",   hex: "#1d4ed8" },
  { id: "indigo",   label: "אינדיגו", hex: "#4f46e5" },
  { id: "teal",     label: "טורקיז",  hex: "#0f766e" },
  { id: "emerald",  label: "ירוק",   hex: "#047857" },
  { id: "violet",   label: "סגול",   hex: "#6d28d9" },
  { id: "rose",     label: "ורוד",   hex: "#be123c" },
  { id: "amber",    label: "ענבר",   hex: "#b45309" },
  { id: "graphite", label: "גרפיט",  hex: "#334155" },
];

const NEUTRALS = [
  { id: "slate", label: "קריר" },
  { id: "zinc",  label: "נייטרלי" },
  { id: "stone", label: "חמים" },
];

// כל זוג: [גופן ממשק, גופן כותרות, מה לטעון מ-Google Fonts]
const FONTS = [
  { id: "assistant-frank", label: "Assistant + פרנק-רוהל",
    ui: '"Assistant", sans-serif', display: '"Frank Ruhl Libre", serif',
    load: "Assistant:wght@400;600;700;800&family=Frank+Ruhl+Libre:wght@700" },
  { id: "rubik", label: "Rubik",
    ui: '"Rubik", sans-serif', display: '"Rubik", sans-serif',
    load: "Rubik:wght@400;500;600;700;800" },
  { id: "heebo", label: "Heebo",
    ui: '"Heebo", sans-serif', display: '"Heebo", sans-serif',
    load: "Heebo:wght@400;500;700;800" },
  { id: "noto", label: "Noto Sans + Noto Serif",
    ui: '"Noto Sans Hebrew", sans-serif', display: '"Noto Serif Hebrew", serif',
    load: "Noto+Sans+Hebrew:wght@400;600;700&family=Noto+Serif+Hebrew:wght@700" },
  { id: "assistant-secular", label: "Assistant + Secular One",
    ui: '"Assistant", sans-serif', display: '"Secular One", sans-serif',
    load: "Assistant:wght@400;600;700;800&family=Secular+One" },
  { id: "system", label: "גופני מערכת (המצב הישן)",
    ui: '"Segoe UI", "Arial Hebrew", Arial, sans-serif',
    display: '"Segoe UI", "Arial Hebrew", Arial, sans-serif', load: null },
];

const DEFAULTS = { brand: "blue", neutral: "slate", font: "assistant-frank", text: 15, radius: 8 };

function loadFont(spec) {
  if (!spec) return;
  const id = `theme-lab-font-${spec.replace(/\W/g, "")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

export default function ThemeLab() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
    catch { return DEFAULTS; }
  });

  useEffect(() => {
    const root = document.documentElement;
    const font = FONTS.find(f => f.id === cfg.font) || FONTS[0];

    loadFont(font.load);
    root.setAttribute("data-brand", cfg.brand);
    root.setAttribute("data-neutral", cfg.neutral);
    root.style.setProperty("--font-ui", font.ui);
    root.style.setProperty("--font-display", font.display);
    root.style.setProperty("--text-base", `${cfg.text}px`);
    root.style.setProperty("--radius", `${cfg.radius}px`);

    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch { /* private mode */ }
  }, [cfg]);

  const set = patch => setCfg(c => ({ ...c, ...patch }));

  const font = FONTS.find(f => f.id === cfg.font) || FONTS[0];
  const brand = BRANDS.find(b => b.id === cfg.brand) || BRANDS[0];
  const snippet =
    `:root {\n` +
    `  --brand: ${brand.hex};\n` +
    `  --font-ui: ${font.ui};\n` +
    `  --font-display: ${font.display};\n` +
    `  --text-base: ${cfg.text}px;\n` +
    `  --radius: ${cfg.radius}px;\n` +
    `}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={fab} title="מעבדת נושא (פיתוח בלבד)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="19" cy="13" r="2.5" />
          <circle cx="6" cy="12" r="2.5" /><circle cx="10" cy="19" r="2.5" />
          <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-1.4-1-1.7-1-2.8 0-.8.7-1.2 1.5-1.2H17a5 5 0 0 0 5-5c0-4.9-4.5-9-10-9Z" />
        </svg>
      </button>
    );
  }

  return (
    <div dir="rtl" style={panel}>
      <div style={head}>
        <strong style={{ fontSize: "var(--text-base)" }}>מעבדת נושא</strong>
        <button type="button" className="btn btn--icon" onClick={() => setOpen(false)} aria-label="סגור">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={group}>
        <div style={legend}>צבע מותג</div>
        <div style={swatches}>
          {BRANDS.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => set({ brand: b.id })}
              title={b.label}
              aria-label={b.label}
              aria-pressed={cfg.brand === b.id}
              style={{
                ...swatch,
                background: b.hex,
                outline: cfg.brand === b.id ? "2px solid var(--c-ink)" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div style={group}>
        <div style={legend}>סולם אפור</div>
        <div style={row}>
          {NEUTRALS.map(n => (
            <button key={n.id} type="button" onClick={() => set({ neutral: n.id })}
                    className={`btn btn--sm ${cfg.neutral === n.id ? "btn--primary" : "btn--secondary"}`}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div style={group}>
        <div style={legend}>גופנים</div>
        <select className="input" value={cfg.font} onChange={e => set({ font: e.target.value })}>
          {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      <div style={group}>
        <div style={legend}>גודל בסיס · {cfg.text}px</div>
        <input type="range" min="13" max="17" step="0.5" style={{ width: "100%" }}
               value={cfg.text} onChange={e => set({ text: Number(e.target.value) })} />
      </div>

      <div style={group}>
        <div style={legend}>עיגול פינות · {cfg.radius}px</div>
        <input type="range" min="0" max="16" step="1" style={{ width: "100%" }}
               value={cfg.radius} onChange={e => set({ radius: Number(e.target.value) })} />
      </div>

      <div style={group}>
        <div style={legend}>להעתקה אל styles/tokens.css</div>
        <pre style={code}>{snippet}</pre>
      </div>

      <button type="button" className="btn btn--secondary btn--block btn--sm"
              onClick={() => setCfg(DEFAULTS)}>
        איפוס לברירת המחדל
      </button>
    </div>
  );
}

const fab = {
  position: "fixed",
  insetBlockEnd: "var(--space-5)",
  insetInlineStart: "var(--space-5)",
  zIndex: "var(--z-drawer)",
  width: 42,
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--c-line)",
  background: "var(--c-surface)",
  color: "var(--c-text-2)",
  boxShadow: "var(--shadow-lg)",
  cursor: "pointer",
};

const panel = {
  position: "fixed",
  insetBlockEnd: "var(--space-5)",
  insetInlineStart: "var(--space-5)",
  zIndex: "var(--z-drawer)",
  width: 280,
  maxHeight: "82vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
  padding: "var(--space-5)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--c-line)",
  background: "var(--c-surface)",
  boxShadow: "var(--shadow-lg)",
};

const head = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const group = { display: "flex", flexDirection: "column", gap: "var(--space-3)" };
const legend = { fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--c-text-2)" };
const row = { display: "flex", gap: "var(--space-2)" };
const swatches = { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "var(--space-2)" };
const swatch = {
  width: "100%",
  aspectRatio: "1",
  border: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  padding: 0,
};
const code = {
  margin: 0,
  padding: "var(--space-3)",
  borderRadius: "var(--radius-sm)",
  background: "var(--c-ground-2)",
  color: "var(--c-text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  lineHeight: 1.6,
  direction: "ltr",
  textAlign: "left",
  overflowX: "auto",
  whiteSpace: "pre",
};


// ══════════════════════════════════════════════════════════════════════════════
