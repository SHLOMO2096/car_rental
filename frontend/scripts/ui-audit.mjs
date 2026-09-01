// ══════════════════════════════════════════════════════════════════════════════
// בדיקת עקרונות עיצוב — הופכת את האפיון למדיד במקום להצהרתי.
//
//   npm run audit:ui
//
// כל בדיקה מייצגת עיקרון שנקבע בביקורת העיצוב. הסקריפט לא נכשל על חוב
// קיים: הוא מדפיס מספרים כדי שאפשר יהיה לראות אם הם יורדים או עולים.
// דגל ‎--strict‎ מחזיר קוד יציאה 1 אם עיקרון שכבר נסגר נפרץ מחדש.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const STRICT = process.argv.includes("--strict");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|css)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({
  path: relative(SRC, p).replaceAll("\\", "/"),
  code: readFileSync(p, "utf8"),
}));

const js = files.filter((f) => /\.jsx?$/.test(f.path));
const isTokenFile = (p) => p.startsWith("styles/");

function count(list, re, skip = () => false) {
  let total = 0;
  const where = [];
  for (const f of list) {
    if (skip(f)) continue;
    const n = (f.code.match(re) || []).length;
    if (n) { total += n; where.push(`${f.path} (${n})`); }
  }
  return { total, where };
}

// ── העקרונות ─────────────────────────────────────────────────────────────────
const checks = [
  {
    name: "טבעת מיקוד לא מבוטלת",
    principle: 'אין outline:"none" מוטבע — הוא גובר על :focus-visible הגלובלי',
    ...count(js, /outline:\s*"?none"?/g),
    budget: 0,
  },
  {
    name: "אין חלונות דפדפן",
    principle: "confirm()/alert() נטיביים הוחלפו בקומפוננטת האישור",
    // ‎await confirm(...)‎ הוא ה-hook שלנו, לא של הדפדפן
    ...count(
      js,
      /(?<!await\s)(?<![.\w])(?:window\.)?(?:confirm|alert)\s*\(/g,
      (f) => f.path.includes("useConfirm")
    ),
    budget: 0,
  },
  {
    name: "תכונות ריווח לוגיות",
    principle: "marginInlineStart/End במקום Right/Left — נכון בשני הכיוונים",
    ...count(js, /\b(?:margin|padding)(?:Right|Left)\s*:/g),
    budget: 0,
  },
  {
    name: "אייקונים ולא אימוג׳י",
    principle: "אימוג׳י אינם יורשים צבע ומשתנים בין מערכות הפעלה",
    ...count(
      js.filter((f) => !f.path.includes("Customers")), // תבניות מייל ללקוח — תוכן, לא ממשק
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu
    ),
    budget: 3, // תווי ✓ בתאי הרשת, נקראים כטקסט
  },
  {
    name: "צבעים מהטוקנים",
    principle: "גוון קבוע בקוד רכיב עוקף את החוגות ב-tokens.css",
    ...count(js, /#[0-9a-fA-F]{6}\b/g),
    budget: null, // חוב מיגרציה ידוע — נמדד כדי שירד
  },
  {
    name: "גופן מהטוקנים",
    principle: "שם גופן קבוע בקוד רכיב שובר את החלפת הגופן בשורה אחת",
    ...count(js.filter((f) => !f.path.includes("dev/ThemeLab")), /fontFamily:\s*["'][^"']*(?:Segoe|Arial|Assistant|Frank)/g),
    budget: 0,
  },
];

// ── דוח ──────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n, " ");
console.log("\n  בדיקת עקרונות עיצוב — frontend/src\n");

let broken = 0;
for (const c of checks) {
  const budgeted = c.budget !== null;
  const ok = budgeted ? c.total <= c.budget : true;
  if (budgeted && !ok) broken++;

  const mark = !budgeted ? "·" : ok ? "✓" : "✗";
  const target = budgeted ? `יעד ${c.budget}` : "מדידה";
  console.log(`  ${mark} ${pad(c.name, 26)} ${pad(c.total, 6)} ${target}`);
  console.log(`    ${c.principle}`);
  if (!ok && c.where.length) {
    console.log(`    → ${c.where.slice(0, 4).join(", ")}${c.where.length > 4 ? " …" : ""}`);
  }
  console.log("");
}

// חוב המיגרציה: כמה מסכים עדיין לא משתמשים במחלקות הרכיבים
const screens = js.filter((f) => /^(pages|features)\//.test(f.path) && /\.jsx$/.test(f.path));
const migrated = screens.filter((f) => /className="[^"]*\b(btn|input|card|badge|alert)\b/.test(f.code));
console.log(`  · ${pad("מסכים שעברו למחלקות", 26)} ${migrated.length}/${screens.length}`);
console.log("    מסך שלא עבר עדיין חסר hover / focus / disabled\n");

if (STRICT && broken > 0) {
  console.error(`  ${broken} עקרונות שנסגרו נפרצו מחדש\n`);
  process.exit(1);
}
