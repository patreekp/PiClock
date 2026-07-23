import { create } from 'zustand';

type Phase = 'focus' | 'shortBreak' | 'longBreak';
type Status = 'idle' | 'running' | 'paused' | 'cycleComplete';

interface PomodoroStoreState {
  phase: Phase;
  sessionIndex: number;
  status: Status;
  secondsLeft: number;
  endsAt: number | null;
  navigateSignal: number;      // incrementato ad ogni richiesta di navigazione remota
  phaseCompleteSignal: number; // incrementato ad ogni fine-fase naturale (per il bell)
  connect: () => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
}

let sse: EventSource | null = null;

export const usePomodoroStore = create<PomodoroStoreState>((set, get) => ({
  phase: 'focus', sessionIndex: 0, status: 'idle', secondsLeft: 25 * 60, endsAt: null,
  navigateSignal: 0, phaseCompleteSignal: 0,

  connect: () => {
    if (sse) return; // singleton — una sola connessione per tutta l'app
    sse = new EventSource('/api/pomodoro/events');

    sse.addEventListener('pomodoro:state', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      set({ ...data });
    });
    sse.addEventListener('pomodoro:phase-complete', () => {
      set(s => ({ phaseCompleteSignal: s.phaseCompleteSignal + 1 }));
    });
    sse.addEventListener('pomodoro:navigate', () => {
      set(s => ({ navigateSignal: s.navigateSignal + 1 }));
    });
    sse.onerror = () => { /* EventSource riprova la connessione da solo */ };
  },

  start: async () => { await fetch('/api/pomodoro/start', { method: 'POST' }); },
  pause: async () => { await fetch('/api/pomodoro/pause', { method: 'POST' }); },
  reset: async () => { await fetch('/api/pomodoro/reset', { method: 'POST' }); },
  skip:  async () => { await fetch('/api/pomodoro/skip',  { method: 'POST' }); },
}));