import { create } from 'zustand';
import { onSseEvent } from '../lib/sseHub';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type HighlightMode = 'off' | 'local' | 'audjust';
export type Language = 'en' | 'it';
export type PomodoroStyle = 'hourglass' | 'arc';
export type BrightnessMode = 'manual' | 'auto';
export type PageSlug = 'clock' | 'weather' | 'pomodoro' | 'todos' | 'alarms' | 'settings';

interface AppState {
  currentPage: PageSlug;
  theme: ThemeMode;
  language: Language;
  notification: string;
  config: {
    lat: string; lon: string; timezone: string;
    clock24h: boolean; showSeconds: boolean;
    alarmFolder: string; snoozeMinutes: number;
    highlightMode: HighlightMode;
    volume: number;
    brightness: number;
    brightnessMode: BrightnessMode;
    brightnessNight: number;
    // Pomodoro
    pomodoroStyle: PomodoroStyle;
    pomodoroFocusMin: number;
    pomodoroShortBreakMin: number;
    pomodoroLongBreakMin: number;
    pomodoroSessions: number;
  };
  setPage: (page: PageSlug) => void;
  connectRemote: () => void;
  setNotification: (msg: string, autoClearMs?: number) => void;
  fetchConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<AppState['config']>) => Promise<void>;
  updateConfigLocal: (newConfig: Partial<AppState['config']>) => void;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

let remoteConnected = false;

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'clock', theme: 'light', language: 'en', notification: '',
  config: {
    lat: '44.0594', lon: '12.5683', timezone: 'Europe/Rome',
    clock24h: true, showSeconds: false,
    alarmFolder: '/media/alarms', snoozeMinutes: 1,
    highlightMode: 'off',
    volume: 80,
    brightness: 100,
    brightnessMode: 'manual',
    brightnessNight: 30,
    pomodoroStyle: 'hourglass',
    pomodoroFocusMin: 25,
    pomodoroShortBreakMin: 5,
    pomodoroLongBreakMin: 15,
    pomodoroSessions: 4,
  },
  setPage: (page) => {
    set({ currentPage: page });
    fetch('/api/remote/navigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    }).catch(e => console.error('Failed to notify remote navigate', e));
  },
  connectRemote: () => {
    if (remoteConnected) return;
    remoteConnected = true;

    fetch('/api/remote/state')
      .then(res => res.json())
      .then(data => { if (data.page) set({ currentPage: data.page }); })
      .catch(e => console.error('Failed to fetch remote state', e));

    onSseEvent('remote:navigate', (data) => {
      if (data.page) set({ currentPage: data.page });
    });
  },
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
          volume: parseInt(data.volume ?? '80', 10),
          brightness: parseInt(data.brightness ?? '100', 10),
          brightnessMode: (data.brightnessMode as BrightnessMode) ?? 'manual',
          brightnessNight: parseInt(data.brightnessNight ?? '30', 10),
          pomodoroStyle: (data.pomodoroStyle as PomodoroStyle) ?? 'hourglass',
          pomodoroFocusMin: parseInt(data.pomodoroFocusMin ?? '25', 10),
          pomodoroShortBreakMin: parseInt(data.pomodoroShortBreakMin ?? '5', 10),
          pomodoroLongBreakMin: parseInt(data.pomodoroLongBreakMin ?? '15', 10),
          pomodoroSessions: parseInt(data.pomodoroSessions ?? '4', 10),
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
  updateConfigLocal: (newConfig) => {
    set(state => ({ config: { ...state.config, ...newConfig } }));
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