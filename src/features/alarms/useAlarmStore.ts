import { create } from 'zustand';

interface Alarm {
  id: number;
  time: string;
  label: string;
  enabled: number;
}

interface AlarmState {
  alarms: Alarm[];
  fetchAlarms: () => Promise<void>;
  addAlarm: (time: string, label: string) => Promise<void>;
  toggleAlarm: (alarm: Alarm) => Promise<void>;
  deleteAlarm: (id: number) => Promise<void>;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],
  fetchAlarms: async () => {
    const res = await fetch('/api/alarms');
    const data = await res.json();
    set({ alarms: data });
  },
  addAlarm: async (time, label) => {
    const res = await fetch('/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, label, enabled: true }),
    });
    const newAlarm = await res.json();
    set({ alarms: [...get().alarms, newAlarm].sort((a, b) => a.time.localeCompare(b.time)) });
  },
  toggleAlarm: async (alarm) => {
    const updated = { ...alarm, enabled: alarm.enabled ? 0 : 1 };
    await fetch(`/api/alarms/${alarm.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    set({
      alarms: get().alarms.map(a => a.id === alarm.id ? updated : a)
    });
  },
  deleteAlarm: async (id) => {
    await fetch(`/api/alarms/${id}`, { method: 'DELETE' });
    set({ alarms: get().alarms.filter(a => a.id !== id) });
  }
}));
