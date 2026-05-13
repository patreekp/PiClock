import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Cloud, Sun, CloudRain, Wind, Droplets } from 'lucide-react';

const WeatherPage = () => {
  const { config } = useAppStore();
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${config.lat}&longitude=${config.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
        );
        const data = await res.json();
        setWeather(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchWeather();
  }, [config.lat, config.lon]);

  if (!weather) return <div className="h-full flex items-center justify-center">Caricamento...</div>;

  return (
    <div className="h-full p-8 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold mb-1">Rimini</h2>
          <p className="text-xl opacity-70">Italia</p>
        </div>
        <div className="text-right">
          <div className="text-7xl font-bold">{Math.round(weather.current.temperature_2m)}°</div>
          <p className="text-lg opacity-70">Percepiti {Math.round(weather.current.apparent_temperature)}°</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-current py-6 my-6">
        <div className="flex flex-col items-center">
          <Droplets size={24} className="mb-2" />
          <span className="text-sm uppercase opacity-60">Umidità</span>
          <span className="text-xl font-bold">{weather.current.relative_humidity_2m}%</span>
        </div>
        <div className="flex flex-col items-center">
          <Wind size={24} className="mb-2" />
          <span className="text-sm uppercase opacity-60">Vento</span>
          <span className="text-xl font-bold">{weather.current.wind_speed_10m} km/h</span>
        </div>
        <div className="flex flex-col items-center">
          <Sun size={24} className="mb-2" />
          <span className="text-sm uppercase opacity-60">Max/Min</span>
          <span className="text-xl font-bold">{Math.round(weather.daily.temperature_2m_max[0])}° / {Math.round(weather.daily.temperature_2m_min[0])}°</span>
        </div>
      </div>

      <div className="flex justify-between">
        {weather.daily.time.slice(1, 6).map((date: string, i: number) => (
          <div key={date} className="flex flex-col items-center">
            <span className="text-xs uppercase opacity-60 mb-2">
              {new Date(date).toLocaleDateString('it-IT', { weekday: 'short' })}
            </span>
            <Cloud size={20} className="mb-2" />
            <span className="text-sm font-bold">{Math.round(weather.daily.temperature_2m_max[i+1])}°</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherPage;