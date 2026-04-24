import api from "./client";

export const reportsAPI = {
  summary: ()           => api.get("/reports/summary").then(r => r.data),
  monthly: (year)       => api.get("/reports/monthly", { params: { year } }).then(r => r.data),
  topCars: (limit = 5)  => api.get("/reports/top-cars", { params: { limit } }).then(r => r.data),
};
