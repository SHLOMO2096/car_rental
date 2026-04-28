import api from "./client";

export const suggestionsAPI = {
  search: (data) => api.post("/suggestions/search", data).then((r) => r.data),
  apply: (data) => api.post("/suggestions/apply", data).then((r) => r.data),
};

