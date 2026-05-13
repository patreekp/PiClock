import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../store/useAppStore';

const ClockPage = () => {
  const [now, setNow] = useState(new Date());
  const { config } = useAppStore();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormat = config.clock24h 
    ? (config.showSeconds ? 'HH:mm:ss' : 'HH:mm')
    : (config.showSeconds ? 'hh:mm:ss' : 'hh:mm');

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 select-none">
      <div className="text-[28vw] font-mono-clock leading-none tracking-tighter font-bold">
        {format(now, timeFormat)}
      </div>
      <div className="mt-4 text-2xl uppercase tracking-widest opacity-80">
        {format(now, "EEEE, d MMMM yyyy", { locale: it })}
      </div>
    </div>
  );
};

export default ClockPage;