import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type HighlightMode = 'off' | 'local' | 'audjust';
export type Language = 'en' | 'it';

interface AppState {
  currentPage: number;
  theme: ThemeMode;
  language: Language;
  notification: string;
  config: {
    lat: string; lon: string; timezone: string;
    clock24h: boolean; showSeconds: boolean;
    alarmFolder: string; snoozeMinutes: number;
    highlightMode: HighlightMode;
  };
  setPage: (page: number) => void;
  setNotification: (msg: string, autoClearMs?: number) => void;
  fetchConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<AppState['config']>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 0, theme: 'light', language: 'en', notification: '',
  config: { lat: '44.0594', lon: '12.5683', timezone: 'Europe/Rome', clock24h: true, showSeconds: false, alarmFolder: '/media/alarms', snoozeMinutes: 1, highlightMode: 'off' },
  setPage: (page) => set({ currentPage: page }),
  setNotification: (msg, autoClearMs) => {
    set({ notification: msg });
    if (autoClearMs) setTimeout(() => { if (get().notification === msg) set({ notification: '' }); }, autoClearMs);
  },
  fetchConfig: async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      set({
        config: {
          lat: data.lat, lon: data.lon, timezone: data.timezone,
          clock24h: data.clock24h === 'true', showSeconds: data.showSeconds === 'true',
          alarmFolder: data.alarmFolder ?? '/media/alarms',
          snoozeMinutes: parseInt(data.snoozeMinutes ?? '1', 10),
          highlightMode: (data.highlightMode as HighlightMode) ?? 'off',
        },
        theme: (data.theme as ThemeMode) || 'light',
        language: (data.language as Language) || 'en',
      });
    } catch (e) { console.error('Failed to fetch config', e); }
  },
  updateConfig: async (newConfig) => {
    const updated = { ...get().config, ...newConfig };
    set({ config: updated });
    try { await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfig) }); }
    catch (e) { console.error('Failed to update config', e); }
  },
  setTheme: async (theme) => {
    set({ theme });
    try { await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) }); }
    catch (e) { console.error('Failed to set theme', e); }
  },
  setLanguage: async (language) => {
    set({ language });
    try { await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) }); }
    catch (e) { console.error('Failed to set language', e); }
  },
}));