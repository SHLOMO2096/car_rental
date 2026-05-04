export function toLocalISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toLocalISODate(new Date());
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalISODate(d);
}

export function addDays(baseIso, days) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

export function diffDays(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  return Math.round(ms / 86400000);
}

export function ensureMinWeek(startIso, endIso) {
  if (!startIso || !endIso) return { startIso, endIso };
  const minEnd = addDays(startIso, 6);
  return { startIso, endIso: endIso < minEnd ? minEnd : endIso };
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

export function formatDateTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayWithWeekday(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
}

