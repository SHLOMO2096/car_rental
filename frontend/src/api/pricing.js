import api from "./client";

export const pricingAPI = {
  // ── Seasons ──────────────────────────────────────────────────────────────
  listSeasons:    (params)   => api.get("/pricing/seasons", { params }).then(r => r.data),
  createSeason:   (data)     => api.post("/pricing/seasons", data).then(r => r.data),
  updateSeason:   (id, data) => api.patch(`/pricing/seasons/${id}`, data).then(r => r.data),
  deleteSeason:   (id)       => api.delete(`/pricing/seasons/${id}`),

  // ── Price Rules ───────────────────────────────────────────────────────────
  listRules:   (params)   => api.get("/pricing/rules", { params }).then(r => r.data),
  getMatrix:   ()         => api.get("/pricing/rules/matrix").then(r => r.data),
  createRule:  (data)     => api.post("/pricing/rules", data).then(r => r.data),
  updateRule:  (id, data) => api.patch(`/pricing/rules/${id}`, data).then(r => r.data),
  deleteRule:  (id)       => api.delete(`/pricing/rules/${id}`),

  // ── Holidays ──────────────────────────────────────────────────────────────
  listHolidays:   (year)     => api.get("/pricing/holidays", { params: year ? { year } : {} }).then(r => r.data),
  createHoliday:  (data)     => api.post("/pricing/holidays", data).then(r => r.data),
  updateHoliday:  (id, data) => api.patch(`/pricing/holidays/${id}`, data).then(r => r.data),
  deleteHoliday:  (id)       => api.delete(`/pricing/holidays/${id}`),
  generateHolidays: (year)   => api.post(`/pricing/holidays/generate/${year}`).then(r => r.data),

  // ── Calculation ───────────────────────────────────────────────────────────
  calculate:      (data)     => api.post("/pricing/calculate", data).then(r => r.data),
  effectivePrice: (carId, params) => api.get(`/pricing/effective/${carId}`, { params }).then(r => r.data),
};

