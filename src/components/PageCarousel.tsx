import React, { useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useAppStore } from '../store/useAppStore';
import ClockPage from '../features/clock/ClockPage';
import WeatherPage from '../features/weather/WeatherPage';
import PomodoroPage from '../features/pomodoro/PomodoroPage';
import TodosPage from '../features/todos/TodosPage';
import AlarmsPage from '../features/alarms/AlarmsPage';
import SettingsPage from '../features/settings/SettingsPage';

const PAGES = [
  { label: 'Clock',    Component: ClockPage },
  { label: 'Weather',  Component: WeatherPage },
  { label: 'Pomodoro', Component: PomodoroPage },
  { label: 'Todos',    Component: TodosPage },
  { label: 'Alarms',   Component: AlarmsPage },
  { label: 'Settings', Component: SettingsPage },
];

// ── Sunrise/sunset formula (NOAA simplified) ─────────────────────────────────
function getSunTimes(lat: number, lon: number): { sunrise: Date; sunset: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);

  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (now.getHours() - 12) / 24);

  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.04089 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const zenith = toRad(90.833);
  const latRad = toRad(lat);
  const cosHa =
    (Math.cos(zenith) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  const haDeg = toDeg(Math.acos(Math.max(-1, Math.min(1, cosHa))));

  const sunriseUTC = 720 - 4 * (lon + haDeg) - eqtime;
  const sunsetUTC  = 720 - 4 * (lon - haDeg) - eqtime;

  const toLocalDate = (utcMinutes: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setTime(d.getTime() + utcMinutes * 60000);
    return d;
  };

  return { sunrise: toLocalDate(sunriseUTC), sunset: toLocalDate(sunsetUTC) };
}

function isDaytime(lat: number, lon: number): boolean {
  const now = new Date();
  const { sunrise, sunset } = getSunTimes(lat, lon);
  return now >= sunrise && now < sunset;
}
// ─────────────────────────────────────────────────────────────────────────────

const PageCarousel = () => {
  const { currentPage, setPage, theme, fetchConfig, config } = useAppStore();

  const handlers = useSwipeable({
    onSwipedLeft:  () => setPage(Math.min(currentPage + 1, PAGES.length - 1)),
    onSwipedRight: () => setPage(Math.max(currentPage - 1, 0)),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  useEffect(() => { fetchConfig(); }, []);

  const applyTheme = useCallback(() => {
    if (theme === 'auto') {
      const lat = parseFloat(config.lat) || 44.0594;
      const lon = parseFloat(config.lon) || 12.5683;
      const dark = !isDaytime(lat, lon);
      document.documentElement.classList.toggle('dark', dark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, config.lat, config.lon]);

  useEffect(() => { applyTheme(); }, [applyTheme]);

  useEffect(() => {
    if (theme !== 'auto') return;
    const interval = setInterval(applyTheme, 60 * 1000);
    return () => clearInterval(interval);
  }, [theme, applyTheme]);

  return (
    <div {...handlers} className="h-screen w-screen overflow-hidden relative touch-none">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentPage * 100}%)` }}
      >
        {PAGES.map(({ label, Component }) => (
          <div key={label} className="w-screen h-full flex-shrink-0">
            <Component />
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 pointer-events-none">
        {PAGES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-opacity duration-500 ${
              i === currentPage ? 'bg-current opacity-100' : 'bg-current opacity-20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default PageCarousel;