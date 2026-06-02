import { create } from 'zustand';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface UIState {
  toast: Toast | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),
}));
