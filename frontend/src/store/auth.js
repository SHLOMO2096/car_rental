import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authAPI } from "../api/auth";
import { roleCan } from "../permissions";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user:  null,
      isAuthenticated: false,

      login: async (email, password) => {
        const data = await authAPI.login(email, password);
        localStorage.setItem("token", data.access_token);
        set({ token: data.access_token, user: data.user, isAuthenticated: true });
        return data.user;
      },

      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, user: null, isAuthenticated: false });
      },

      isAdmin: () => get().user?.role === "admin",
      can: (permission) => roleCan(get().user?.role, permission),
    }),
    { name: "auth-store", partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
