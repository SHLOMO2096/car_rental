import api from "./client";

const API_URL = "/settings";

export const settingsAPI = {
  get: async (key) => {
    const res = await api.get(`${API_URL}/${key}`);
    return res.data;
  },
  update: async (key, value) => {
    const res = await api.put(`${API_URL}/${key}`, { value });
    return res.data;
  },
};
