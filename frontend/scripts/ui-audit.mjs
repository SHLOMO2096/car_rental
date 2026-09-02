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
    name: "שכבות מהטוקנים",
    // באג אמיתי: הרקע שמאחורי מגירת המובייל נכתב zIndex:999 מוטבע, מול
    // ‎--z-drawer:900‎ של המגירה. הרקע כיסה את המגירה, כל הקשה על קישור
    // ניווט פגעה בו במקום בקישור, וניווט במובייל היה בלתי אפשרי לחלוטין.
    principle: "מספר z-index מוטבע לא רואה את סולם השכבות ויכול לבלוע לחיצות",
    ...count(js, /zIndex:\s*\d/g),
    budget: null, // חוב ידוע — נמדד כדי שירד
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

// ── הפניות סגנון יתומות ──────────────────────────────────────────────────────
// style={s.foo} שמצביע למפתח שנמחק הופך ל-undefined, ו-React מתעלם ממנו
// בשקט: הבנייה עוברת, הטסטים עוברים, והעיצוב נעלם. קרה בפועל במיגרציה
// של מסך ההזמנות, ולכן זו בדיקה קבועה ולא הערה.

// שמות שמגיעים מ-useAuthStore(s => s.x) ולא מאובייקט סגנונות
const NOT_A_STYLE = /^(can|user|token|isAuthenticated|items|remove|login|logout|isAdmin|initializeAuth)$/;

const declaredIn = (code) =>
  new Set([...code.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]));
const usedIn = (code) =>
  new Set([...code.matchAll(/(?<![\w$])s\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]));

// הסימן החד-משמעי לשימוש בסגנון הוא הופעה בתוך style= — או style={s.x}
// או פריסה בתוך אובייקט סגנון. בכל שאר המקומות s הוא פרמטר של map/selector.
const usedAsStyle = (code) => {
  const names = new Set();
  for (const m of code.matchAll(/style=\{\{?\s*(?:\.\.\.)?s\.([a-zA-Z][a-zA-Z0-9]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\.\.\.s\.([a-zA-Z][a-zA-Z0-9]*)/g)) names.add(m[1]);
  return names;
};

const orphans = [];
for (const f of js.filter((x) => x.path.endsWith(".jsx"))) {
  const used = usedAsStyle(f.code);
  if (used.size === 0) continue;

  const declared = new Set(declaredIn(f.code));
  for (const mod of js.filter((m) => m.path.endsWith("styles.js"))) {
    const modDir = mod.path.slice(0, mod.path.lastIndexOf("/") + 1);
    if (f.path.startsWith(modDir)) for (const n of declaredIn(mod.code)) declared.add(n);
  }

  for (const name of used) if (!declared.has(name)) orphans.push(`${f.path}: s.${name}`);
}

checks.push({
  name: "אין הפניות סגנון יתומות",
  principle: "style={s.x} למפתח שנמחק מתאפס בשקט — הבנייה עוברת והעיצוב נעלם",
  total: orphans.length,
  where: [...new Set(orphans)],
  budget: 0,
});

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
