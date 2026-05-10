// ══════════════════════════════════════════════════════════════════════════════
import axios from "axios";

function getOrCreateDeviceId() {
  const KEY = "device_id";
  let id = localStorage.getItem(KEY);
  if (id) return id;

  // Prefer cryptographically strong UUIDs when available.
  const uuid = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID()
    : `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(KEY, uuid);
  return uuid;
}

function getDeviceLabel() {
  try {
    const ua = navigator.userAgent || "";
    // Keep it short to avoid bloating headers.
    return ua.slice(0, 120);
  } catch {
    return null;
  }
}

const api = axios.create({
  // Keep API URL relative by default so HTTPS pages never call HTTP endpoints.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// הוספת JWT לכל בקשה אוטומטית
api.interceptors.request.use((config) => {
  // Let the browser set multipart boundary automatically for file uploads.
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Attendance (and other future modules) may rely on per-device identity.
  // Safe to send on all requests.
  config.headers["X-Device-Id"] = getOrCreateDeviceId();
  const label = getDeviceLabel();
  if (label) config.headers["X-Device-Label"] = label;
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

    const requestUrl = String(err.config?.url || "");

    // Force logout on unauthorized API access (except login itself).
    if (status === 401 && !requestUrl.includes("/auth/login")) {
      localStorage.removeItem("token");
      window.dispatchEvent(new CustomEvent("auth:expired"));
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
