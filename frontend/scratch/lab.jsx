// ── מעבדת מובייל ────────────────────────────────────────────────────────────
// מרנדרת את *דפי האפליקציה האמיתיים* מול API מדומה, בתוך מסגרות ברוחב טלפון,
// ומדפיסה מי חורג מהמסגרת. קיימת כי הבנייה, הטסטים ו-audit:ui מודדים מבנה
// ולא פריסה: כפתור יכול לשבת 32px מחוץ למודאל וכל השערים יישארו ירוקים.
//
//   npx vite --port 5201
//   /lab.html?screen=cars          מסך בודד
//   /lab.html?screen=cars&w=390    רוחב יחיד
//
// לא נכנס ל-build: vite בונה רק את index.html.
import { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import "../src/styles/tokens.css";
import "../src/styles/presets.css";
import "../src/styles/base.css";
import "../src/styles/components.css";

import api from "../src/api/client";
import { useAuthStore } from "../src/store/auth";
import * as fx from "./fixtures";

// ── לכידת קונסולה ───────────────────────────────────────────────────────────
// בלי זה שגיאת רינדור נראית פשוט כאזור ריק בצילום, בלי שום רמז למה.
const LOG = [];
for (const level of ["warn", "error"]) {
  const orig = console[level].bind(console);
  console[level] = (...a) => {
    LOG.push(level + ": " + a.map((x) => (x && x.stack) || String(x)).join(" ").slice(0, 300));
    orig(...a);
  };
}
window.addEventListener("error", (e) => LOG.push("uncaught: " + (e.message || "")));
window.addEventListener("unhandledrejection", (e) => LOG.push("rejection: " + String(e.reason).slice(0, 300)));

// ── API מדומה ───────────────────────────────────────────────────────────────
// עוקף את שכבת הרשת ב-adapter של axios, כך שהיירטים (JWT, נרמול שגיאות)
// ממשיכים לרוץ בדיוק כמו באפליקציה.
const ROUTES = [
  [/^\/bookings\/kpi/,            () => fx.kpi],
  [/^\/bookings\/calendar/,       () => fx.bookings],
  [/^\/bookings\/\d+\/audit/,     () => []],
  [/^\/bookings/,                 () => fx.bookings],
  [/^\/cars\/\d+\/availability/,  () => ({ available: true, conflicts: [] })],
  [/^\/cars/,                     () => fx.cars],
  [/^\/customers\/\d+\/history/,  () => fx.customerHistory],
  [/^\/customers\/search/,        () => fx.customers],
  [/^\/customers/,                () => fx.customers],
  [/^\/auth\/users/,              () => fx.users],
  [/^\/auth\/me/,                 () => fx.users[0]],
  [/^\/pricing\/rules/,           () => fx.priceRules],
  [/^\/pricing\/seasons/,         () => fx.seasons],
  [/^\/pricing\/season-rules/,    () => []],
  [/^\/pricing\/holidays/,        () => fx.holidays],
  [/^\/pricing\/effective/,       () => ({ price_day: 320, price_week: 1850, source: "category" })],
  [/^\/pricing\/calculate/,       () => ({ total: 1240, billable_days: 3, price_type_used: "day", breakdown: [] })],
  [/^\/attendance\/me\/status/,   () => fx.attendanceStatus],
  [/^\/attendance\/shifts/,       () => fx.shifts],
  [/^\/attendance\/users/,        () => fx.users],
  [/^\/payroll\/report/,          () => fx.payrollReport],
  [/^\/payroll\/users/,           () => fx.users],
  [/^\/payroll\/shifts/,          () => fx.shifts],
  [/^\/reports\/summary/,         () => fx.summary],
  [/^\/reports\/monthly/,         () => fx.monthly],
  [/^\/reports\/top-cars/,        () => fx.topCars],
  [/^\/settings\/(.+)/,           (m) => fx.settingsByKey[m[1]] || { key: m[1], value: fx.settingsBlob }],
  [/^\/settings/,                 () => fx.settingsBlob],
  [/^\/car-blocks/,               () => fx.carBlocks],
  [/^\/suggestions/,              () => []],
];

api.defaults.adapter = async (config) => {
  const url = (config.url || "").replace(/^\/api/, "");
  let data = [];
  let hit = null;
  for (const [re, make] of ROUTES) {
    const m = url.match(re);
    if (m) { hit = true; data = make(m); break; }
  }
  if (!hit) console.warn("[lab] no fixture for", url, "→ []");
  return { data, status: 200, statusText: "OK", headers: {}, config };
};

useAuthStore.setState({ token: "lab-token", user: fx.users[0], isAuthenticated: true });

// ── המסכים ──────────────────────────────────────────────────────────────────
const SCREENS = {
  cars:       { label: "רכבים",        load: () => import("../src/pages/Cars") },
  customers:  { label: "לקוחות",       load: () => import("../src/pages/Customers") },
  bookings:   { label: "הזמנות",       load: () => import("../src/pages/Bookings") },
  dashboard:  { label: "לוח בקרה",     load: () => import("../src/pages/Dashboard").then((m) => ({ default: m.Dashboard })) },
  calendar:   { label: "לוח שנה",      load: () => import("../src/pages/CalendarPage").then((m) => ({ default: m.CalendarPage })) },
  attendance: { label: "נוכחות",       load: () => import("../src/pages/Attendance") },
  payroll:    { label: "שכר עובדים",   load: () => import("../src/pages/Payroll") },
  pricing:    { label: "מחירים",       load: () => import("../src/pages/Pricing") },
  reports:    { label: "סטטיסטיקות",   load: () => import("../src/pages/Reports") },
  users:      { label: "משתמשים",      load: () => import("../src/pages/Users") },
  settings:   { label: "הגדרות",       load: () => import("../src/pages/Settings") },
  login:      { label: "כניסה",        load: () => import("../src/pages/Login") },
};

const params = new URLSearchParams(location.search);
const screenKey = params.get("screen") || "cars";
const Screen = lazy(SCREENS[screenKey].load);

// מסגרת אחת שממלאת את ה-viewport. הרוחב נקבע מבחוץ באמולציית מכשיר
// (Emulation.setDeviceMetricsOverride), ולא במסגרת בתוך הדף — אחרת
// window.innerWidth נשאר רוחב החלון והדפים מרנדרים את ענף הדסקטופ.
function Lab() {
  return (
    <div
      data-frame={window.innerWidth}
      dir="rtl"
      style={{ background: "#f7faf8", padding: "14px 10px", minHeight: "100vh" }}
    >
      <Suspense fallback={<div>טוען…</div>}>
        <MemoryRouter>
          <Screen />
        </MemoryRouter>
      </Suspense>
    </div>
  );
}

createRoot(document.getElementById("lab")).render(<Lab />);
document.title = "Lab · " + SCREENS[screenKey].label;

// ── מד גלישה ────────────────────────────────────────────────────────────────
// כל אלמנט נמדד מול המסגרת שמכילה אותו, לא מול חלון הדפדפן.
function describe(el) {
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(" ").filter(Boolean).join(".")
      : "";
  const txt = (el.textContent || "").trim().slice(0, 30);
  return el.tagName.toLowerCase() + cls + (txt ? ' "' + txt + '"' : "");
}

function clippedByAncestor(el, frame) {
  for (let p = el.parentElement; p && p !== frame; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX;
    if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
  }
  return false;
}

function report() {
  const lines = ["screen: " + screenKey + "  viewport: " + window.innerWidth + "px"];
  document.querySelectorAll("[data-frame]").forEach(function (frame) {
    const fb = frame.getBoundingClientRect();
    const rows = [];
    frame.querySelectorAll("*").forEach(function (el) {
      const r = el.getBoundingClientRect();
      // אלמנטים נסתרים או באפס רוחב אינם גלישה אמיתית
      if (r.width < 2 || r.height < 2) return;
      // ואם אב כלשהו גולל או חותך אופקית — האלמנט מוכל, גם אם ה-rect
      // שלו חורג. בלי הבדיקה הזאת כל טבלה בתוך overflow:auto נספרת
      // כשבורה, וזה שלח אותי לתקן מסכים תקינים.
      if (clippedByAncestor(el, frame)) return;
      const spill = Math.round(Math.max(fb.left - r.left, r.right - fb.right));
      if (spill > 1) rows.push({ spill, w: Math.round(r.width), el: describe(el) });
    });
    rows.sort((a, b) => b.spill - a.spill);
    lines.push("frame " + frame.dataset.frame + "px  spilling: " + rows.length);
    rows.slice(0, 8).forEach((r) =>
      lines.push("   +" + String(r.spill).padStart(3) + "px w=" + String(r.w).padStart(4) + "  " + r.el)
    );
    lines.push("");
  });

  if (LOG.length) {
    lines.push("console (" + LOG.length + "):");
    [...new Set(LOG)].slice(0, 12).forEach((l) => lines.push("   " + l));
  }

  const box = document.createElement("pre");
  box.dir = "ltr";
  box.style.cssText =
    "margin:0;padding:10px;background:#111;color:#0f0;font:11px/1.4 monospace;white-space:pre-wrap";
  box.textContent = lines.join("\n");
  document.body.appendChild(box);
}

// ── בדיקה עצמית ─────────────────────────────────────────────────────────────
// ?selftest=1 מזריק אלמנט רחב מדי. אם הדוח לא מסמן אותו — המודד שבור,
// ו"אפס גלישות" בכל המסכים לא אומר כלום. זה קרה כאן פעמיים.
if (params.get("selftest")) {
  setTimeout(() => {
    const bad = document.createElement("div");
    bad.textContent = "SELFTEST-OVERFLOW";
    bad.style.cssText = "width:900px;height:20px;background:#f00";
    document.querySelector("[data-frame]").appendChild(bad);
  }, 1000);
}

// ?click=<טקסט> לוחץ על כפתור לפי הטקסט שלו, ו-?open=menu פותח אחריו את
// תפריט הפעולות הראשון — כדי לצלם מצבים שדורשים אינטראקציה.
const clickText = params.get("click");
if (clickText) {
  setTimeout(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes(clickText));
    btn?.click();
  }, 800);
}

if (params.get("open") === "menu") {
  setTimeout(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="menu"], .action-menu button')][0];
    t?.click();
  }, 1400);
}

setTimeout(report, 2400);
