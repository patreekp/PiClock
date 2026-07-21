import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, AlarmClock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ActiveAlarm {
  id: number;
  time: string;
  label: string;
  trackName?: string;
}

// WeatherPage è la pagina index 1 nel carousel (Clock=0, Weather=1, ...)
// Adatta il numero se nel tuo carousel l'ordine è diverso
const CLOCK_PAGE_INDEX = 0; 
const WEATHER_PAGE_INDEX = 1;

const AlarmModal = () => {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const { config, setPage } = useAppStore();
  const snoozeMinutes = config.snoozeMinutes;

  useEffect(() => {
    const es = new EventSource('/api/alarms/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'alarm:triggered') setActiveAlarm(msg.alarm);
        else if (msg.type === 'alarm:stopped') setActiveAlarm(null);
      } catch (_) {}
    };
    return () => es.close();
  }, []);

  const handleStop = async () => {
    if (!activeAlarm) return;
    try { await fetch(`/api/alarms/${activeAlarm.id}/stop`, { method: 'POST' }); } catch (_) {}
    setActiveAlarm(null);
    
    // Cambia alla pagina del meteo immediatamente
    setPage(WEATHER_PAGE_INDEX);

    // Dopo un minuto, cambia alla pagina dell'ora
    setTimeout(() => {
      setPage(CLOCK_PAGE_INDEX); // Supponiamo che CLOCK_PAGE_INDEX sia l'indice della pagina dell'ora
    }, 60000); // 60000 millisecondi = 1 minuto
  };

  const handleSnooze = async () => {
    if (!activeAlarm) return;
    try { await fetch(`/api/alarms/${activeAlarm.id}/snooze`, { method: 'POST' }); } catch (_) {}
    setActiveAlarm(null);
  };

  if (!activeAlarm) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
          <div className="absolute inset-0 rounded-full border border-current opacity-10 animate-ping" />
          <div className="absolute inset-3 rounded-full border border-current opacity-15 animate-ping [animation-delay:0.4s]" />
          <Bell size={40} className="relative animate-bounce" />
        </div>
        <div className="font-mono-clock font-bold leading-none tracking-tighter tabular-nums text-[18vw]">
          {activeAlarm.time}
        </div>
        <div className="text-sm uppercase tracking-[0.3em] opacity-50 font-bold">
          {activeAlarm.label || 'Sveglia'}
        </div>
        {/* Nome brano */}
        {activeAlarm.trackName && (
          <div
            className="text-xs tracking-widest"
            style={{ opacity: 0.35, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}
          >
            ♪ {activeAlarm.trackName}
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex-shrink-0 flex" style={{ borderTop: '1px solid var(--color-fg)' }}>
        {/* Snooze */}
        <button
          onClick={handleSnooze}
          className="flex-1 flex flex-col items-center justify-center gap-2 py-8 hover:opacity-70 transition-opacity active:opacity-50"
          style={{ borderRight: '1px solid var(--color-fg)' }}
        >
          <AlarmClock size={32} />
          <span className="text-sm uppercase font-bold tracking-widest">Snooze</span>
          <span className="text-xs opacity-50 uppercase tracking-widest">+{snoozeMinutes} min</span>
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          className="flex-1 flex flex-col items-center justify-center gap-2 py-8 hover:opacity-90 transition-opacity active:opacity-75"
          style={{ backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' }}
        >
          <X size={32} />
          <span className="text-sm uppercase font-bold tracking-widest">Stop</span>
        </button>
      </div>
    </div>
  );
};

export default AlarmModal;