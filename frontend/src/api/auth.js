import api from "./client";

export const authAPI = {
  login:       (email, password) => {
    const form = new URLSearchParams({ username: email, password });
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(r => r.data);
  },
  me:          ()        => api.get("/auth/me").then(r => r.data),
  listUsers:   ()        => api.get("/auth/users").then(r => r.data),
  createUser:  (data)    => api.post("/auth/users", data).then(r => r.data),
  updateUser:  (id, data)=> api.patch(`/auth/users/${id}`, data).then(r => r.data),
};

// ══════════════════════════════════════════════════════════════════════════════
