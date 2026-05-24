import React, { useEffect, useState } from 'react';
import { Bell, X, AlarmClock } from 'lucide-react';

interface ActiveAlarm {
  id: number;
  time: string;
  label: string;
}

const AlarmModal = () => {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState(1);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => setSnoozeMinutes(parseInt(d.snoozeMinutes ?? '1', 10)))
      .catch(() => {});
  }, []);

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

        {/* Stop — inverted colors with inline style to avoid Tailwind class issues */}
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