import { create } from 'zustand';

interface WeatherState {
  weather: any;
  loading: boolean;
  fetchWeather: () => Promise<void>;
}

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
  }
}));
