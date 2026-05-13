import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  currentPage: number;
  theme: 'light' | 'dark';
  config: {
    lat: string;
    lon: string;
    timezone: string;
    clock24h: boolean;
    showSeconds: boolean;
  };
  setPage: (page: number) => void;
  toggleTheme: () => void;
  updateConfig: (newConfig: Partial<AppState['config']>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 0,
      theme: 'light',
      config: {
        lat: '44.0594',
        lon: '12.5683',
        timezone: 'Europe/Rome',
        clock24h: true,
        showSeconds: false,
      },
      setPage: (page) => set({ currentPage: page }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      updateConfig: (newConfig) => set((state) => ({ config: { ...state.config, ...newConfig } })),
    }),
    { name: 'raspi-clock-storage' }
  )
);