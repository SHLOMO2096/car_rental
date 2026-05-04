export const STATUS_OPTIONS = [
  { value: "active", label: "פעיל", color: "green" },
  { value: "completed", label: "הושלם", color: "blue" },
  { value: "cancelled", label: "בוטל", color: "gray" },
];

export const statusMap = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

