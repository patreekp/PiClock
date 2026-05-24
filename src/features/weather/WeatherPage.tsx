import React, { useEffect } from 'react';
import { useWeatherStore } from './useWeatherStore';
import { Wind, Droplets, ArrowDown, ArrowUp } from 'lucide-react';

const WeatherPage = () => {
  const { weather, loading, fetchWeather } = useWeatherStore();

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !weather) return (
    <div className="h-full flex items-center justify-center uppercase tracking-widest opacity-40" style={{ fontSize: '2.5vw' }}>
      Caricamento...
    </div>
  );
  if (!weather || !weather.current) return (
    <div className="h-full flex items-center justify-center uppercase tracking-widest opacity-40" style={{ fontSize: '2.5vw' }}>
      Meteo non disponibile
    </div>
  );

  const { current, forecast } = weather;

  return (
    <div className="h-full flex flex-col select-none overflow-hidden" style={{ padding: '2vh 3vw' }}>

      {/* ── Current weather — flex-1 so it takes exactly half the space ── */}
      <div className="flex items-stretch justify-between" style={{ flex: '1 1 0', minHeight: 0 }}>

        {/* Left: location + stats + condition */}
        <div className="flex flex-col justify-between py-[1vh]">
          <div>
            <h2 className="font-bold uppercase tracking-tighter leading-none" style={{ fontSize: '4.5vw' }}>Rimini</h2>
            <p className="uppercase tracking-[0.2em] opacity-50" style={{ fontSize: '1.3vw', marginTop: '0.4vh' }}>Italia</p>
          </div>

          <div className="flex gap-[2vw]" style={{ marginTop: '1vh' }}>
            <div className="flex items-center gap-[0.5vw]">
              <Droplets style={{ width: '1.8vw', height: '1.8vw' }} className="opacity-50" />
              <span className="font-bold" style={{ fontSize: '1.8vw' }}>{current.humidity}%</span>
              <span className="opacity-50 uppercase tracking-widest" style={{ fontSize: '1.1vw' }}>umid.</span>
            </div>
            <div className="flex items-center gap-[0.5vw]">
              <Wind style={{ width: '1.8vw', height: '1.8vw' }} className="opacity-50" />
              <span className="font-bold" style={{ fontSize: '1.8vw' }}>{current.windSpeed}</span>
              <span className="opacity-50 uppercase tracking-widest" style={{ fontSize: '1.1vw' }}>km/h</span>
            </div>
          </div>

          <p className="uppercase tracking-widest opacity-60 font-medium" style={{ fontSize: '1.8vw', marginTop: '0.5vh' }}>
            {current.condition}
          </p>
        </div>

        {/* Right: big temp + symbol + feels like */}
        <div className="flex flex-col items-end justify-between py-[1vh]">
          <div className="flex items-start" style={{ gap: '1vw' }}>
            <span className="font-mono-clock font-bold leading-none tracking-tighter" style={{ fontSize: '13vw' }}>
              {current.temp}°
            </span>
            <span style={{ fontSize: '6vw', lineHeight: 1, marginTop: '0.5vw' }}>{current.symbol}</span>
          </div>
          <p className="opacity-50 uppercase tracking-widest" style={{ fontSize: '1.3vw' }}>
            Percepiti {current.feelsLike}°
          </p>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: '1px solid rgba(128,128,128,0.2)', margin: '0' }} />

      {/* ── 5-day forecast — flex-1 fills remaining space ── */}
      <div className="flex items-stretch" style={{ flex: '1 1 0', minHeight: 0, gap: '1vw', paddingTop: '2vh', paddingBottom: '1vh' }}>
        {(forecast ?? []).map((day: { date: string; symbol: string; max: number; min: number }) => (
          <div
            key={day.date}
            className="flex flex-col items-center justify-between border border-current/10 hover:border-current/30 transition-colors"
            style={{ flex: 1, padding: '1.2vh 0.5vw' }}
          >
            <span className="uppercase font-bold opacity-50 tracking-widest" style={{ fontSize: '1.3vw' }}>
              {new Date(day.date).toLocaleDateString('it-IT', { weekday: 'short' })}
            </span>
            <span style={{ fontSize: '5vw', lineHeight: 1 }}>{day.symbol}</span>
            <div>
              <div className="flex items-center justify-center gap-[0.3vw]">
                <ArrowUp style={{ width: '1.1vw', height: '1.1vw' }} className="opacity-40" />
                <span className="font-bold" style={{ fontSize: '2vw' }}>{day.max}°</span>
              </div>
              <div className="flex items-center justify-center gap-[0.3vw]">
                <ArrowDown style={{ width: '1.1vw', height: '1.1vw' }} className="opacity-30" />
                <span className="opacity-50" style={{ fontSize: '1.7vw' }}>{day.min}°</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default WeatherPage;