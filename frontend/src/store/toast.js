import { create } from "zustand";

let seq = 1;

export const useToastStore = create((set) => ({
  items: [],
  push: ({ type = "info", title = "", message, duration = 4000 }) => {
    const id = seq++;
    set((state) => ({
      items: [...state.items, { id, type, title, message, duration }],
    }));
    return id;
  },
  remove: (id) => set((state) => ({ items: state.items.filter((x) => x.id !== id) })),
  clear: () => set({ items: [] }),
}));

function pushToast(payload) {
  return useToastStore.getState().push(payload);
}

export const toast = {
  success: (message, options = {}) => pushToast({ type: "success", message, ...options }),
  error: (message, options = {}) => pushToast({ type: "error", message, ...options }),
  info: (message, options = {}) => pushToast({ type: "info", message, ...options }),
  warning: (message, options = {}) => pushToast({ type: "warning", message, ...options }),
};

