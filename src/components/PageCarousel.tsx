import React, { useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useAppStore } from '../store/useAppStore';
import ClockPage from '../features/clock/ClockPage';
import WeatherPage from '../features/weather/WeatherPage';
import TodosPage from '../features/todos/TodosPage';
import AlarmsPage from '../features/alarms/AlarmsPage';
import SettingsPage from '../features/settings/SettingsPage';

const PAGES = [
  <ClockPage />,
  <WeatherPage />,
  <TodosPage />,
  <AlarmsPage />,
  <SettingsPage />
];

const PageCarousel = () => {
  const { currentPage, setPage, theme, fetchConfig } = useAppStore();

  const handlers = useSwipeable({
    onSwipedLeft: () => setPage(Math.min(currentPage + 1, PAGES.length - 1)),
    onSwipedRight: () => setPage(Math.max(currentPage - 0, 0)),
    trackMouse: true
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div {...handlers} className="h-screen w-screen overflow-hidden relative touch-none">
      <div 
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentPage * 100}%)` }}
      >
        {PAGES.map((page, i) => (
          <div key={i} className="w-screen h-full flex-shrink-0">
            {page}
          </div>
        ))}
      </div>

      {/* Dot Indicator */}
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