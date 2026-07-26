import { create } from 'zustand';
import { onSseEvent } from '../lib/sseHub';

type Phase = 'focus' | 'shortBreak' | 'longBreak';
type Status = 'idle' | 'running' | 'paused' | 'cycleComplete';

interface PomodoroStoreState {
  phase: Phase;
  sessionIndex: number;
  status: Status;
  secondsLeft: number;
  endsAt: number | null;
  navigateSignal: number;
  phaseCompleteSignal: number;
  connect: () => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
}

let connected = false;

export const usePomodoroStore = create<PomodoroStoreState>((set, get) => ({
  phase: 'focus', sessionIndex: 0, status: 'idle', secondsLeft: 25 * 60, endsAt: null,
  navigateSignal: 0, phaseCompleteSignal: 0,

  connect: () => {
    if (connected) return;
    connected = true;

    fetch('/api/pomodoro/state')
      .then(res => res.json())
      .then(data => set({ ...data }))
      .catch(e => console.error('Failed to fetch pomodoro state', e));

    onSseEvent('pomodoro:state', (data) => set({ ...data }));
    onSseEvent('pomodoro:phase-complete', () => {
      set(s => ({ phaseCompleteSignal: s.phaseCompleteSignal + 1 }));
    });
    onSseEvent('pomodoro:navigate', () => {
      set(s => ({ navigateSignal: s.navigateSignal + 1 }));
    });
  },

  start: async () => { await fetch('/api/pomodoro/start', { method: 'POST' }); },
  pause: async () => { await fetch('/api/pomodoro/pause', { method: 'POST' }); },
  reset: async () => { await fetch('/api/pomodoro/reset', { method: 'POST' }); },
  skip:  async () => { await fetch('/api/pomodoro/skip',  { method: 'POST' }); },
}));