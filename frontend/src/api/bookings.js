import api from "./client";

export const bookingsAPI = {
  list:     (params)    => api.get("/bookings/", { params }).then(r => r.data),
  calendar: (start, end)=> api.get("/bookings/calendar", { params: { start, end } }).then(r => r.data),
  get:      (id)        => api.get(`/bookings/${id}`).then(r => r.data),
  create:   (data)      => api.post("/bookings/", data).then(r => r.data),
  update:   (id, data)  => api.patch(`/bookings/${id}`, data).then(r => r.data),
  delete:   (id)        => api.delete(`/bookings/${id}`),
};

