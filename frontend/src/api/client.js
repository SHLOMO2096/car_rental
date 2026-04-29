// ══════════════════════════════════════════════════════════════════════════════
import axios from "axios";

const api = axios.create({
  // Keep API URL relative by default so HTTPS pages never call HTTP endpoints.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// הוספת JWT לכל בקשה אוטומטית
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// טיפול ב-401 — logout אוטומטי
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status || 0;
    const rawDetail = err.response?.data?.detail;
    // Pydantic v2 returns detail as an array of validation-error objects — flatten to string
    let detail;
    if (typeof rawDetail === "string") {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      detail = rawDetail.map(e => e.msg || e.message || JSON.stringify(e)).join("; ");
    } else if (rawDetail && typeof rawDetail === "object") {
      detail = rawDetail.msg || rawDetail.message || "שגיאת אימות";
    } else {
      detail = "שגיאה בשרת";
    }
    const headers = err.response?.headers || {};

    // Logout only for expired/invalid AUTH JWT, not for suggestion apply-token failures.
    if (status === 401 && detail === "אסימון לא תקין או פג תוקף") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject({
      status,
      detail,
      headers,
      raw: err,
    });
  }
);

export default api;

// ══════════════════════════════════════════════════════════════════════════════
