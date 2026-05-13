import { create } from 'zustand';

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
  fetchConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<AppState['config']>) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
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
  
  fetchConfig: async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      set({ 
        config: {
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          clock24h: data.clock24h === 'true',
          showSeconds: data.showSeconds === 'true',
        },
        theme: data.theme as 'light' | 'dark' || 'light'
      });
    } catch (e) {
      console.error('Failed to fetch config', e);
    }
  },

  updateConfig: async (newConfig) => {
    const currentConfig = get().config;
    const updated = { ...currentConfig, ...newConfig };
    
    // Optimistic update
    set({ config: updated });

    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error('Failed to update config', e);
      // Rollback could be implemented here
    }
  },

  toggleTheme: async () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (e) {
      console.error('Failed to toggle theme', e);
    }
  }
}));
