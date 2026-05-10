import api from "./client";

export const payrollAPI = {
  listUsers: () => api.get("/payroll/users").then((r) => r.data),
  updateHourlyRate: (userId, hourly_rate) =>
    api.patch(`/payroll/users/${userId}/hourly-rate`, { hourly_rate }).then((r) => r.data),
  report: (params) => api.get("/payroll/report", { params }).then((r) => r.data),

  listShifts: (params) => api.get("/payroll/shifts", { params }).then((r) => r.data),
  updateShift: (shiftId, payload) => api.patch(`/payroll/shifts/${shiftId}`, payload).then((r) => r.data),
};

