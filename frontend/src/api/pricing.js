import api from "./client";

export const pricingAPI = {
  // ── Seasons ───────────────────────────────────────────────────────────────
  listSeasons:   (params)   => api.get("/pricing/seasons", { params }).then(r => r.data),
  createSeason:  (data)     => api.post("/pricing/seasons", data).then(r => r.data),
  updateSeason:  (id, data) => api.put(`/pricing/seasons/${id}`, data).then(r => r.data),
  deleteSeason:  (id)       => api.delete(`/pricing/seasons/${id}`),

  // ── Price Rules ───────────────────────────────────────────────────────────
  listRules:  (params)   => api.get("/pricing/rules", { params }).then(r => r.data),
  createRule: (data)     => api.post("/pricing/rules", data).then(r => r.data),
  updateRule: (id, data) => api.put(`/pricing/rules/${id}`, data).then(r => r.data),
  deleteRule: (id)       => api.delete(`/pricing/rules/${id}`),

  // ── Season Rules (קישור עונה ↔ כלל מחיר) ─────────────────────────────────
  listSeasonRules:  (params)   => api.get("/pricing/season-rules", { params }).then(r => r.data),
  createSeasonRule: (data)     => api.post("/pricing/season-rules", data).then(r => r.data),
  updateSeasonRule: (id, data) => api.put(`/pricing/season-rules/${id}`, data).then(r => r.data),
  deleteSeasonRule: (id)       => api.delete(`/pricing/season-rules/${id}`),

  // ── Holidays ──────────────────────────────────────────────────────────────
  listHolidays:     (year)     => api.get("/pricing/holidays", { params: year ? { year } : {} }).then(r => r.data),
  createHoliday:    (data)     => api.post("/pricing/holidays", data).then(r => r.data),
  updateHoliday:    (id, data) => api.put(`/pricing/holidays/${id}`, data).then(r => r.data),
  deleteHoliday:    (id)       => api.delete(`/pricing/holidays/${id}`),
  generateHolidays: (year)     => api.post(`/pricing/holidays/generate/${year}`).then(r => r.data),

  // ── Calculation ───────────────────────────────────────────────────────────
  // body: { vehicle_id, rental_start, rental_end, pickup_time?, return_time? }
  calculate:     (data)            => api.post("/pricing/calculate", data).then(r => r.data),
  effectivePrice: (carId, params)  => api.get(`/pricing/effective/${carId}`, { params }).then(r => r.data),
};
