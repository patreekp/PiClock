import React, { useEffect } from 'react';
import { useWeatherStore } from './useWeatherStore';
import { Cloud, Sun, CloudRain, Wind, Droplets } from 'lucide-react';

const WeatherPage = () => {
  const { weather, loading, fetchWeather } = useWeatherStore();

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !weather) return <div className="h-full flex items-center justify-center text-2xl uppercase tracking-widest opacity-40">Caricamento...</div>;
  if (!weather) return <div className="h-full flex items-center justify-center text-2xl uppercase tracking-widest opacity-40">Meteo non disponibile</div>;

  return (
    <div className="h-full p-8 flex flex-col justify-between select-none">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold mb-1 uppercase tracking-tighter">Rimini</h2>
          <p className="text-xl opacity-70 uppercase tracking-widest">Italia</p>
        </div>
        <div className="text-right">
          <div className="text-8xl font-mono-clock font-bold leading-none">{Math.round(weather.current.temperature_2m)}°</div>
          <p className="text-lg opacity-70 uppercase mt-2">Percepiti {Math.round(weather.current.apparent_temperature)}°</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-current py-8 my-6">
        <div className="flex flex-col items-center">
          <Droplets size={28} className="mb-3" />
          <span className="text-xs uppercase opacity-60 tracking-widest mb-1">Umidità</span>
          <span className="text-2xl font-bold">{weather.current.relative_humidity_2m}%</span>
        </div>
        <div className="flex flex-col items-center">
          <Wind size={28} className="mb-3" />
          <span className="text-xs uppercase opacity-60 tracking-widest mb-1">Vento</span>
          <span className="text-2xl font-bold">{Math.round(weather.current.wind_speed_10m)} <span className="text-sm">km/h</span></span>
        </div>
        <div className="flex flex-col items-center">
          <Sun size={28} className="mb-3" />
          <span className="text-xs uppercase opacity-60 tracking-widest mb-1">Max/Min</span>
          <span className="text-2xl font-bold">{Math.round(weather.daily.temperature_2m_max[0])}° / {Math.round(weather.daily.temperature_2m_min[0])}°</span>
        </div>
      </div>

      <div className="flex justify-between px-2">
        {weather.daily.time.slice(1, 6).map((date: string, i: number) => (
          <div key={date} className="flex flex-col items-center">
            <span className="text-xs uppercase opacity-60 mb-3 tracking-tighter">
              {new Date(date).toLocaleDateString('it-IT', { weekday: 'short' })}
            </span>
            <Cloud size={24} className="mb-3" />
            <span className="text-lg font-bold">{Math.round(weather.daily.temperature_2m_max[i+1])}°</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherPage;
