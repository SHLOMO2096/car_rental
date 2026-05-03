import axios from "axios";

const API_URL = "/api/settings";

export const settingsAPI = {
  get: async (key) => {
    const res = await axios.get(`${API_URL}/${key}`);
    return res.data;
  },
  update: async (key, value) => {
    const res = await axios.put(`${API_URL}/${key}`, { value });
    return res.data;
  },
};
