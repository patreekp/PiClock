import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAppStore } from '../../store/useAppStore';
import { useAlarmStore } from '../alarms/useAlarmStore';
import { Bell } from 'lucide-react';

const ClockPage = () => {
  const [now, setNow] = useState(new Date());
  const { config } = useAppStore();
  const { alarms, fetchAlarms } = useAlarmStore();

  useEffect(() => {
    fetchAlarms();
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if any alarm is active within the next hour
  const nextAlarm = alarms
    .filter(a => !!a.enabled)
    .find(a => {
      const [h, m] = a.time.split(':').map(Number);
      const alarmDate = new Date(now);
      alarmDate.setHours(h, m, 0, 0);
      if (alarmDate < now) alarmDate.setDate(alarmDate.getDate() + 1);
      const diff = (alarmDate.getTime() - now.getTime()) / (1000 * 60);
      return diff > 0 && diff <= 60;
    });

  // Format time based on config
  const formattedTime = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined,
    hour12: !config.clock24h,
    timeZone: config.timezone || 'Europe/Rome'
  }).format(now);

  const formattedDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: config.timezone || 'Europe/Rome'
  }).format(now);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 select-none">
      <div className="text-[32vw] font-mono-clock leading-none tracking-tighter font-bold tabular-nums">
        {formattedTime}
      </div>
      <div className="mt-8 text-2xl uppercase tracking-[0.2em] opacity-60 font-medium">
        {formattedDate}
      </div>
      
      {nextAlarm && (
        <div className="mt-12 flex items-center gap-3 px-6 py-3 border border-current animate-pulse">
          <Bell size={20} />
          <span className="text-sm uppercase font-bold tracking-widest">Sveglia alle {nextAlarm.time}</span>
        </div>
      )}
      
      <div className="absolute bottom-12 opacity-20">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
          <div className="h-1 w-1 bg-current rounded-full" />
          RaspiClock Active
        </div>
      </div>
    </div>
  );
};

export default ClockPage;
