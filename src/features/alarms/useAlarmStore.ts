import { create } from 'zustand';

export interface Alarm {
  id: number;
  time: string;
  label: string;
  enabled: number;
  days: number[];
  skip_next: boolean;
}

interface AlarmState {
  alarms: Alarm[];
  fetchAlarms: () => Promise<void>;
  addAlarm: (time: string, label: string, days?: number[]) => Promise<void>;
  updateAlarm: (id: number, time: string, label: string, days?: number[], skipNext?: boolean) => Promise<void>;
  toggleAlarm: (alarm: Alarm) => Promise<void>;
  deleteAlarm: (id: number) => Promise<void>;
  toggleSkipNext: (alarm: Alarm) => Promise<void>;
  initSse: () => () => void;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],

  fetchAlarms: async () => {
    const res = await fetch('/api/alarms');
    const data = await res.json();
    set({ alarms: data });
  },

  addAlarm: async (time, label, days = []) => {
    const res = await fetch('/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, label, enabled: true, days }),
    });
    const newAlarm = await res.json();
    set({ alarms: [...get().alarms, newAlarm].sort((a, b) => a.time.localeCompare(b.time)) });
  },

  updateAlarm: async (id, time, label, days = [], skipNext = false) => {
    const existing = get().alarms.find(a => a.id === id);
    if (!existing) return;
    const updated: Alarm = { ...existing, time, label, days, skip_next: skipNext };
    await fetch(`/api/alarms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, skip_next: skipNext ? 1 : 0 }),
    });
    set({
      alarms: get().alarms
        .map(a => (a.id === id ? updated : a))
        .sort((a, b) => a.time.localeCompare(b.time)),
    });
  },

  toggleAlarm: async (alarm) => {
    const updated = { ...alarm, enabled: alarm.enabled ? 0 : 1 };
    await fetch(`/api/alarms/${alarm.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, skip_next: updated.skip_next ? 1 : 0 }),
    });
    set({ alarms: get().alarms.map(a => (a.id === alarm.id ? updated : a)) });
  },

  deleteAlarm: async (id) => {
    await fetch(`/api/alarms/${id}`, { method: 'DELETE' });
    set({ alarms: get().alarms.filter(a => a.id !== id) });
  },

  toggleSkipNext: async (alarm) => {
    const res = await fetch(`/api/alarms/${alarm.id}/skip-next`, { method: 'POST' });
    const data = await res.json();
    set({
      alarms: get().alarms.map(a =>
        a.id === alarm.id ? { ...a, skip_next: data.skip_next } : a
      ),
    });
  },

  initSse: () => {
    const es = new EventSource('/api/alarms/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'alarm:triggered' || msg.type === 'alarm:skipped' || msg.type === 'alarms:changed') {
          get().fetchAlarms();
        }
      } catch (_) {}
    };
    return () => es.close();
  },
}));