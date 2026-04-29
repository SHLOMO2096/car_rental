import api from "./client";

export const carsAPI = {
  list:         (params)    => api.get("/cars/", { params }).then(r => r.data),
  get:          (id)        => api.get(`/cars/${id}`).then(r => r.data),
  create:       (data)      => api.post("/cars/", data).then(r => r.data),
  update:       (id, data)  => api.patch(`/cars/${id}`, data).then(r => r.data),
  delete:       (id)        => api.delete(`/cars/${id}`),
  availability: (id, s, e)  => api.get(`/cars/${id}/availability`, {
    params: { start: s, end: e }
  }).then(r => r.data),
};

