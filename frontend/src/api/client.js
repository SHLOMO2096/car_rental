// ══════════════════════════════════════════════════════════════════════════════
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
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
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err.response?.data?.detail || "שגיאה בשרת");
  }
);

export default api;

// ══════════════════════════════════════════════════════════════════════════════
