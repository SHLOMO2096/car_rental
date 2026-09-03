import api from "./client";

const URL = "/car-blocks";

export const carBlocksAPI = {
  // start/end הם חובה — הרשימה תמיד מוגבלת לחלון תאריכים, כמו הגריד עצמו
  list:   (start, end, carId) =>
    api.get(`${URL}/`, { params: { start, end, ...(carId ? { car_id: carId } : {}) } }).then((r) => r.data),
  create: (data)       => api.post(`${URL}/`, data).then((r) => r.data),
  update: (id, data)   => api.patch(`${URL}/${id}`, data).then((r) => r.data),
  cancel: (id)         => api.delete(`${URL}/${id}`),
};

export const BLOCK_REASONS = [
  { id: "garage",   label: "מוסך / טיפול", short: "מוסך" },
  { id: "accident", label: "תאונה",        short: "תאונה" },
  { id: "other",    label: "אחר",          short: "מושבת" },
];

export const BLOCK_REASON_LABEL = Object.fromEntries(BLOCK_REASONS.map((r) => [r.id, r.label]));
// תווית קצרה לתא בגריד — עמודת רכב היא ~70px, והתווית המלאה נחתכת שם.
export const BLOCK_REASON_SHORT = Object.fromEntries(BLOCK_REASONS.map((r) => [r.id, r.short]));
