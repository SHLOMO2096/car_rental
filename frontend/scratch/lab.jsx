// מעבדת מובייל — מרנדרת את רכיבי המסך האמיתיים עם נתוני דמה בתוך מסגרת
// ברוחב טלפון, כדי שאפשר יהיה *לראות* ו*למדוד* את הפריסה במקום להסיק אותה
// מהקוד. לא נכנס ל-build: vite בונה רק את index.html.
import { createRoot } from "react-dom/client";
import "../src/styles/tokens.css";
import "../src/styles/presets.css";
import "../src/styles/base.css";
import "../src/styles/components.css";

import BookingsList from "../src/features/bookings/components/BookingsList";
import { BookingActionModal } from "../src/pages/Dashboard";
import { PhotoMenu } from "../src/components/photos/PhotoManagement";

const cars = {
  1: { id: 1, name: "Kia Picanto", plate: "12-345-67", make: "Kia" },
  2: { id: 2, name: "Toyota Corolla Hybrid", plate: "987-65-432", make: "Toyota" },
};

const bookings = [
  {
    id: 1041, car_id: 1, customer_id: 7, status: "active",
    customer_name: "אברהם רוזנברג", customer_phone: "052-1234567",
    customer_email: "avraham.rosenberg@example.co.il",
    start_date: "2026-09-01", end_date: "2026-09-04",
    pickup_time: "09:30", return_time: "17:00", total_price: 1240,
    email_sent: true, created_by_name: "שרה כהן", updated_by_name: "דוד לוי",
    created_at: "2026-08-28T09:12:00Z", updated_at: "2026-08-30T14:02:00Z",
  },
  {
    // הזמנה באיחור — מפעילה את שני כפתורי הפעולה המהירה בשורת התחתית
    id: 1042, car_id: 2, customer_id: 8, status: "active",
    customer_name: "מרים בן-דוד", customer_phone: "054-7654321",
    customer_email: "miriam@example.com",
    start_date: "2026-08-20", end_date: "2026-08-25",
    pickup_time: "08:00", return_time: "08:00", total_price: 3480,
    email_sent: false, created_by_name: "שרה כהן",
    created_at: "2026-08-19T07:40:00Z", updated_at: null,
  },
  {
    id: 1043, car_id: 1, customer_id: null, status: "completed",
    customer_name: "יוסי אברמוביץ׳", customer_phone: "050-1112233",
    start_date: "2026-07-10", end_date: "2026-07-12", total_price: 620,
    email_sent: false, created_by_name: "דוד לוי",
    created_at: "2026-07-09T11:00:00Z", updated_at: null,
  },
];

const noop = () => {};

function Bookings() {
  return (
    <BookingsList
      bookings={bookings}
      carsMap={cars}
      isMobile
      canDeleteBookings
      onOpenEdit={noop}
      onOpenCustomerFromBooking={noop}
      onRequestDelete={noop}
      onViewPhotos={noop}
      onUploadPhotos={noop}
      onContinuousCamera={noop}
      isBookingOverdue={(b) => b.id === 1042}
      onQuickComplete={noop}
      onQuickExtend={noop}
    />
  );
}

// רוחבי הטלפונים שבאמת בשימוש: iPhone SE / מכשירי אנדרואיד צרים,
// iPhone 12–15, ומכשירי Max.
// המודאל של הדשבורד מרונדר בתוך המסגרת ולא ב-fixed, כדי שהמדידה תהיה
// מול רוחב הטלפון. position:static נכפה דרך wrapper עם transform.
function ActionModalInFrame() {
  return (
    <div style={{ position: "relative", transform: "translate(0)", minHeight: 320 }}>
      <BookingActionModal
        booking={bookings[0]}
        carName="Toyota Corolla Hybrid"
        onEdit={noop}
        onDelete={noop}
        onCustomer={noop}
        onClose={noop}
        canReassign
        onReassign={noop}
        photoMenu={
          <PhotoMenu booking={bookings[0]} onView={noop} onUpload={noop} onContinuousCamera={noop} />
        }
      />
    </div>
  );
}

const WIDTHS = [360, 390, 430];

function Lab() {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: 16, background: "#dfe5e2" }}>
      {WIDTHS.map((w) => (
        <div key={w}>
          <div style={{ font: "600 12px monospace", marginBottom: 6, color: "#141816" }}>{w}px</div>
          <div
            data-frame={w}
            dir="rtl"
            style={{
              width: w,
              background: "#f7faf8",
              padding: "14px 10px",       // אותו ריפוד כמו ה-main באפליקציה
              outline: "2px solid #154038",
              overflow: "visible",         // כדי שגלישה תיראה ולא תיחתך
            }}
          >
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>הזמנות</h1>
            <Bookings />
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "22px 0 14px" }}>מודאל פעולות (דשבורד)</h1>
            <ActionModalInFrame />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("lab")).render(<Lab />);

// ── מד גלישה ────────────────────────────────────────────────────────────────
// צילום מסך מראה *ש*משהו גולש; זה מראה *מי*. כל אלמנט נמדד מול המסגרת
// שמכילה אותו, לא מול חלון הדפדפן — כך המדידה נכונה לכל רוחב בנפרד.
function describe(el) {
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(" ").filter(Boolean).join(".")
      : "";
  const txt = (el.textContent || "").trim().slice(0, 24);
  return el.tagName.toLowerCase() + cls + (txt ? ' "' + txt + '"' : "");
}

setTimeout(function () {
  const lines = [];
  document.querySelectorAll("[data-frame]").forEach(function (frame) {
    const fb = frame.getBoundingClientRect();
    const rows = [];
    frame.querySelectorAll("*").forEach(function (el) {
      const r = el.getBoundingClientRect();
      const spill = Math.round(Math.max(fb.left - r.left, r.right - fb.right));
      if (spill > 1) rows.push({ spill: spill, w: Math.round(r.width), el: describe(el) });
    });
    rows.sort(function (a, b) { return b.spill - a.spill; });
    lines.push("frame " + frame.dataset.frame + "px  spilling: " + rows.length);
    rows.slice(0, 6).forEach(function (r) {
      lines.push("   +" + String(r.spill).padStart(3) + "px w=" + String(r.w).padStart(4) + "  " + r.el);
    });
    lines.push("");
  });

  const box = document.createElement("pre");
  box.dir = "ltr";
  box.style.cssText =
    "margin:0;padding:10px;background:#111;color:#0f0;font:11px/1.4 monospace;white-space:pre-wrap";
  box.textContent = lines.join("\n");
  document.body.appendChild(box);
}, 800);
