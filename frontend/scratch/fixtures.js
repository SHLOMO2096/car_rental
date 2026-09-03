// נתוני דמה למעבדת המובייל. כל מפתח הוא URL כפי שהדפים קוראים לו;
// ה-adapter ב-lab.jsx בוחר לפי התאמת prefix, כך שגם נתיבים עם מזהה נתפסים.
const HEB_NAMES = [
  "אברהם רוזנברג", "מרים בן-דוד", "יוסי אברמוביץ׳", "שרה כהן-לוי",
  "דוד מזרחי", "רבקה אשכנזי", "משה פרידמן", "אסתר גולדשטיין",
];

export const cars = [
  { id: 1, name: "Kia Picanto", make: "Kia", model: "Picanto", type: "mini", group: "A", year: 2023, plate: "12-345-67", category: "מיני", color: "לבן", price_per_day: 180, is_active: true, is_hybrid: false, test_date: "2026-11-04" },
  { id: 2, name: "Toyota Corolla Hybrid", make: "Toyota", model: "Corolla", type: "hybrid", group: "C", year: 2024, plate: "987-65-432", category: "משפחתי", color: "כסף מטאלי", price_per_day: 320, is_active: true, is_hybrid: true, test_date: "2027-02-18" },
  { id: 3, name: "Hyundai Tucson", make: "Hyundai", model: "Tucson", type: "suv", group: "E", year: 2022, plate: "555-11-222", category: "פנאי-שטח", color: "אפור", price_per_day: 410, is_active: false, is_hybrid: false, test_date: "2026-09-30" },
];

export const customers = HEB_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  normalized_name: name,
  phone: `05${i}-${1000000 + i * 11111}`.slice(0, 11),
  email: i % 3 === 0 ? null : `customer${i + 1}@example.co.il`,
  id_number: `0${20000000 + i * 137}`,
  address: i % 2 ? "רחוב הרצל 14, תל אביב-יפו" : null,
  created_at: "2026-05-02T08:00:00Z",
}));

export const bookings = [
  {
    id: 1041, car_id: 1, customer_id: 7, status: "active",
    customer_name: "אברהם רוזנברג", customer_phone: "052-1234567",
    customer_email: "avraham.rosenberg@example.co.il", customer_id_num: "023456789",
    start_date: "2026-09-01", end_date: "2026-09-04",
    pickup_time: "09:30", return_time: "17:00", total_price: 1240,
    billable_days: 3, actual_days: 3, price_type_used: "day",
    email_sent: true, created_by_name: "שרה כהן", updated_by_name: "דוד לוי",
    created_at: "2026-08-28T09:12:00Z", updated_at: "2026-08-30T14:02:00Z",
    notes: "הלקוח ביקש כיסא תינוק וגגון. יש לוודא זמינות לפני המסירה.",
  },
  {
    id: 1042, car_id: 2, customer_id: 8, status: "active",
    customer_name: "מרים בן-דוד", customer_phone: "054-7654321",
    customer_email: "miriam@example.com", customer_id_num: "031122334",
    start_date: "2026-08-20", end_date: "2026-08-25",
    pickup_time: "08:00", return_time: "08:00", total_price: 3480,
    billable_days: 5, actual_days: 5, price_type_used: "week",
    email_sent: false, created_by_name: "שרה כהן",
    created_at: "2026-08-19T07:40:00Z", updated_at: null, notes: null,
  },
  {
    id: 1043, car_id: 1, customer_id: null, status: "completed",
    customer_name: "יוסי אברמוביץ׳", customer_phone: "050-1112233",
    start_date: "2026-07-10", end_date: "2026-07-12", total_price: 620,
    billable_days: 2, actual_days: 2, price_type_used: "day",
    email_sent: false, created_by_name: "דוד לוי",
    created_at: "2026-07-09T11:00:00Z", updated_at: null, notes: null,
  },
];

export const users = [
  { id: 1, email: "admin@rental.co.il", full_name: "שרה כהן", role: "admin", is_active: true, hourly_rate: 68 },
  { id: 2, email: "agent@rental.co.il", full_name: "דוד לוי", role: "agent", is_active: true, hourly_rate: 52 },
  { id: 3, email: "noa@rental.co.il", full_name: "נועה בן-שמעון", role: "agent", is_active: false, hourly_rate: null },
];

export const priceRules = [
  { id: 1, name: "תעריף בסיס גלובלי", entity_type: "global", entity_value: null, price_half_day: 120, price_day: 200, price_week: 1150, price_month: 3900, price_hour: 45, exclude_sabbath_holidays: true, priority: 0, is_active: true, season_id: null },
  { id: 2, name: "קבוצה C", entity_type: "category", entity_value: "משפחתי", price_half_day: null, price_day: 320, price_week: 1850, price_month: null, price_hour: null, exclude_sabbath_holidays: true, priority: 5, is_active: true, season_id: null },
  { id: 3, name: "Kia Picanto — רכב ספציפי", entity_type: "car", entity_value: "1", price_half_day: 100, price_day: 180, price_week: null, price_month: null, price_hour: 38, exclude_sabbath_holidays: false, priority: 10, is_active: true, season_id: 1 },
];

export const seasons = [
  { id: 1, name: "עונת הקיץ ופגרת בין הזמנים", season_type: "peak", valid_from: "2026-07-01", valid_until: "2026-09-05", is_recurring: true, adjustment_type: "percent", adjustment_direction: "add", adjustment_value: 18, is_active: true },
  { id: 2, name: "חורף — ביקוש נמוך", season_type: "low", valid_from: "2026-12-01", valid_until: "2027-02-28", is_recurring: false, adjustment_type: "percent", adjustment_direction: "subtract", adjustment_value: 12, is_active: true },
];

export const holidays = [
  { id: 1, name: "ראש השנה", date: "2026-09-12", hebrew_year: 5787, is_auto_generated: true },
  { id: 2, name: "יום כיפור", date: "2026-09-21", hebrew_year: 5787, is_auto_generated: true },
  { id: 3, name: "סוכות", date: "2026-09-26", hebrew_year: 5787, is_auto_generated: true },
];

export const shifts = [
  { id: 11, user_id: 2, user_name: "דוד לוי", shift_start_at: "2026-09-01T05:02:00Z", shift_end_at: "2026-09-01T14:31:00Z", work_date: "2026-09-01", total_hours: 9.48, device_sessions: [] },
  { id: 12, user_id: 1, user_name: "שרה כהן", shift_start_at: "2026-09-02T06:00:00Z", shift_end_at: null, work_date: "2026-09-02", total_hours: null, device_sessions: [] },
];

export const payrollReport = {
  period: { from: "2026-08-01", to: "2026-08-31" },
  rows: users.map((u, i) => ({
    user_id: u.id, full_name: u.full_name, hourly_rate: u.hourly_rate,
    total_hours: [172.5, 148.25, 0][i], total_pay: [11730, 7709, 0][i], shifts_count: [21, 19, 0][i],
  })),
  totals: { total_hours: 320.75, total_pay: 19439 },
};

export const kpi = {
  total: 128, active: 14, fleet_size: 32, busy_today: 18,
  free_today: 14, returns_today: 5, overdue: 2, utilization: 56.3,
};

export const summary = { total_bookings: 128, active_bookings: 14, total_revenue: 284500, avg_booking_value: 2223 };

export const monthly = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1, revenue: [12000, 15400, 18900, 22300, 26800, 31200, 38900, 41200, 33100, 24800, 19400, 16300][i],
  bookings: [8, 10, 12, 14, 17, 20, 25, 27, 21, 16, 12, 10][i],
}));

export const topCars = cars.map((c, i) => ({
  car_id: c.id, name: c.name, plate: c.plate,
  bookings: [42, 38, 21][i], revenue: [52400, 61200, 28900][i],
}));

// ההגדרות נשמרות כ-key/value, וכל מפתח מחזיר צורה אחרת.
export const settingsByKey = {
  category_hierarchy: {
    key: "category_hierarchy",
    value: [
      { name: "מיני", groups: ["A", "B"] },
      { name: "משפחתי", groups: ["C", "D"] },
      { name: "פנאי-שטח", groups: ["E", "G"] },
    ],
  },
  general_settings: { key: "general_settings", value: { default_pickup_time: "08:00", default_return_time: "08:00", currency: "₪" } },
};

export const settingsBlob = {
  business_name: "וויקאר השכרת רכב",
  contact_phone: "03-5551234",
  contact_email: "info@waycar.co.il",
  address: "דרך מנחם בגין 132, תל אביב-יפו",
  manager_emails: "manager@waycar.co.il, owner@waycar.co.il",
};

export const attendanceStatus = {
  open_shift: { id: 12, shift_start_at: "2026-09-02T06:00:00Z", work_date: "2026-09-02" },
  open_device_sessions: [{ id: 44, device_id: "abc", device_label: "iPhone", clock_in_at: "2026-09-02T06:00:00Z" }],
};

export const customerHistory = {
  customer: customers[0],
  summary: { total_bookings: 9, active_bookings: 1, total_revenue: 18400, last_booking_date: "2026-09-01" },
  bookings: bookings,
};

// השבתות זמניות — אחת פעילה על ה-Picanto בטווח שהגריד מציג כברירת מחדל.
const _today = new Date();
const _iso = (off) => new Date(_today.getFullYear(), _today.getMonth(), _today.getDate() + off)
  .toISOString().slice(0, 10);

export const carBlocks = [
  { id: 1, car_id: 1, start_date: _iso(1), end_date: _iso(3), reason: "garage",
    note: "טיפול 60,000 ק״מ + בלמים", created_by_name: "שרה כהן",
    car_name: "Kia Picanto", car_plate: "12-345-67" },
  { id: 2, car_id: 2, start_date: _iso(6), end_date: _iso(6), reason: "accident",
    note: "המתנה לשמאי", created_by_name: "דוד לוי",
    car_name: "Toyota Corolla Hybrid", car_plate: "987-65-432" },
];
