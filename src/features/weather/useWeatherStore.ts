import { create } from 'zustand';

interface WeatherState {
  weather: any;
  loading: boolean;
  fetchWeather: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: () => void;
}

let sse: EventSource | null = null;

export const useWeatherStore = create<WeatherState>((set) => ({
  weather: null,
  loading: false,
  fetchWeather: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/weather');
      const data = await res.json();
      set({ weather: data, loading: false });
    } catch (e) {
      console.error('Weather fetch failed', e);
      set({ loading: false });
    }
  },
  refresh: async () => {
    set({ loading: true });
    try {
      await fetch('/api/weather/refresh', { method: 'POST' });
      // il nuovo dato arriva via SSE (weather:updated) a tutti i client,
      // incluso questo — niente bisogno di leggere la response qui
    } catch (e) {
      console.error('Weather refresh failed', e);
      set({ loading: false });
    }
  },
  connect: () => {
    if (sse) return; // singleton — una sola connessione per tutta l'app
    sse = new EventSource('/api/weather/events');
    sse.addEventListener('weather:updated', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      set({ weather: data, loading: false });
    });
    sse.addEventListener('weather:error', () => {
      set({ loading: false });
    });
    sse.onerror = () => { /* EventSource riprova la connessione da solo */ };
  },
}));