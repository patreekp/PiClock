import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAlarmStore } from '../alarms/useAlarmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Bell } from 'lucide-react';

const ClockPage = () => {
  const [now, setNow] = useState(new Date());
  const { config, notification, setNotification } = useAppStore();
  const { alarms, fetchAlarms } = useAlarmStore();
  const { t, language } = useTranslation();

  useEffect(() => {
    fetchAlarms();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/audio/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'library:scan-start')
          setNotification(t('notify.scanStart', { total: msg.total }));
        else if (msg.type === 'library:scan-progress')
          setNotification(t('notify.scanProgress', { done: msg.done, total: msg.total, filename: msg.filename }));
        else if (msg.type === 'library:scan-done')
          setNotification(t('notify.scanDone', { count: msg.total - (msg.failed ?? 0) }), 5000);
        else if (msg.type === 'library:scan-error')
          setNotification(t('notify.scanError', { message: msg.message }), 8000);
      } catch (_) {}
    };
    return () => es.close();
  }, [language]);

  const upcomingAlarm = alarms.filter(a => !!a.enabled).find(a => {
    const [h, m] = a.time.split(':').map(Number);
    const alarmDate = new Date(now);
    alarmDate.setHours(h, m, 0, 0);
    if (alarmDate < now) alarmDate.setDate(alarmDate.getDate() + 1);
    const diff = (alarmDate.getTime() - now.getTime()) / (1000 * 60);
    return diff > 0 && diff <= 60;
  });
  const nextAlarmSkipped = upcomingAlarm?.skip_next ?? false;
  const nextAlarm = upcomingAlarm ?? null;

  const tz = config.timezone || 'Europe/Rome';
  const locale = language === 'it' ? 'it-IT' : 'en-GB';
  const timeParts = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined,
    hour12: !config.clock24h, timeZone: tz,
  }).formatToParts(now);
  const get = (type: string) => timeParts.find(p => p.type === type)?.value ?? '';
  const hours = get('hour'); const minutes = get('minute');
  const seconds = config.showSeconds ? get('second') : null;
  const ampm = !config.clock24h ? get('dayPeriod') : null;
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
  }).format(now);
  const clockSize = config.showSeconds ? 'text-[17vw]' : 'text-[28vw]';
  const footerLabel = notification || t('clock.appLabel');
  const isNotifying = !!notification;

  return (
    <div className="h-full flex flex-col justify-center p-6 pt-8 select-none overflow-hidden">
      <div className="flex items-start gap-0">
        <div className={`font-mono-clock font-bold tabular-nums leading-[0.9] tracking-tighter ${clockSize} transition-all duration-300`}>
          {hours}:{minutes}{seconds ? `:${seconds}` : ''}
        </div>
        {ampm && <div className="font-mono-clock font-bold leading-[0.9] tracking-tighter text-[8vw] ml-4 mt-1 opacity-80">{ampm.toUpperCase()}</div>}
      </div>
      <div className="mt-6 text-xl uppercase tracking-[0.2em] opacity-60 font-medium capitalize">{formattedDate}</div>
      {nextAlarm && (
         <div
            className="mt-10 flex items-center gap-3 px-6 py-3 border border-current w-fit"
            style={{ opacity: nextAlarmSkipped ? 0.4 : 1 }}
          >
            <Bell size={20} className={nextAlarmSkipped ? 'opacity-40' : 'animate-pulse'} />
            <span className="text-sm uppercase font-bold tracking-widest">
              {nextAlarmSkipped
                ? t('clock.alarmSkipped', { time: nextAlarm.time })
                : `${t('clock.alarmIn')} ${nextAlarm.time}`}
            </span>
          </div>
        )}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-opacity duration-500 ${isNotifying ? 'opacity-80' : 'opacity-20'}`}>
          <div className={`h-1 w-1 bg-current rounded-full ${isNotifying ? 'animate-pulse' : ''}`} />
          <span className="max-w-[70vw] truncate">{footerLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default ClockPage;