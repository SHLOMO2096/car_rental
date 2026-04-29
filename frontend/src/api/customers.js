import api from "./client";

export const customersAPI = {
  list: (params) => api.get("/customers/", { params }).then((r) => r.data),
  search: (q, limit = 8) => api.get("/customers/search", { params: { q, limit } }).then((r) => r.data),
  history: (id, limit = 20) => api.get(`/customers/${id}/history`, { params: { limit } }).then((r) => r.data),
  importFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/customers/import", formData).then((r) => r.data);
  },
  create: (data) => api.post("/customers/", data).then((r) => r.data),
  update: (id, data) => api.patch(`/customers/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/customers/${id}`),
  sendEmail: (id, data) => api.post(`/customers/${id}/send-email`, data).then((r) => r.data),
  sendBulkEmail: (data) => api.post("/customers/send-bulk-email", data).then((r) => r.data),
};

