import api from "./client";

export const attendanceAPI = {
  myStatus: () => api.get("/attendance/me/status").then((r) => r.data),
  clockIn:  (data = {}) => api.post("/attendance/clock-in", data).then((r) => r.data),
  clockOut: (data = {}) => api.post("/attendance/clock-out", data).then((r) => r.data),
  endShift: () => api.post("/attendance/end-shift").then((r) => r.data),
};

