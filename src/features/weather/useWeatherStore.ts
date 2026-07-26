import { create } from 'zustand';
import { onSseEvent } from '../../lib/sseHub';

interface WeatherState {
  weather: any;
  loading: boolean;
  fetchWeather: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: () => void;
}

let connected = false;

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
    } catch (e) {
      console.error('Weather refresh failed', e);
      set({ loading: false });
    }
  },
  connect: () => {
    if (connected) return;
    connected = true;
    onSseEvent('weather:updated', (data) => set({ weather: data, loading: false }));
    onSseEvent('weather:error', () => set({ loading: false }));
  },
}));