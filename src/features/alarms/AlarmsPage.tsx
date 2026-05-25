import React, { useState, useEffect } from 'react';
import { useAlarmStore } from './useAlarmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Plus, Bell, Trash2, X, Check } from 'lucide-react';
import { ThemedSwitch, ThemedButton } from '@/components/ui-themed';

const AlarmsPage = () => {
  const { alarms, fetchAlarms, addAlarm, toggleAlarm, deleteAlarm } = useAlarmStore();
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [newTime, setNewTime] = useState('07:00');
  const [newLabel, setNewLabel] = useState('');
  useEffect(() => { fetchAlarms(); }, []);
  const handleAdd = () => { if (!newTime) return; addAlarm(newTime, newLabel); setIsAdding(false); setNewLabel(''); setNewTime('07:00'); };
  const handleCancel = () => { setIsAdding(false); setNewLabel(''); setNewTime('07:00'); };
  return (
    <div className="h-full flex flex-col select-none overflow-hidden">
      <div className="flex justify-between items-center px-8 pt-8 pb-6 flex-shrink-0">
        <h2 className="text-4xl font-bold uppercase tracking-tighter">{t('alarms.title')}</h2>
        {!isAdding && (
          <ThemedButton onClick={() => setIsAdding(true)} className="h-12 px-6 text-xs">
            <Plus size={18} /> {t('alarms.new')}
          </ThemedButton>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-8 space-y-6 min-h-0">
        {alarms.length === 0 && !isAdding && (
          <div className="h-full flex items-center justify-center opacity-20">
            <p className="text-2xl uppercase tracking-widest italic">{t('alarms.empty')}</p>
          </div>
        )}
        {alarms.map(alarm => (
          <div key={alarm.id} className="flex items-center justify-between border-b border-current/10 pb-6 group">
            <div className="flex-1">
              <div className="text-6xl font-mono-clock font-bold tracking-tighter">{alarm.time}</div>
              <div className="text-sm uppercase opacity-60 mt-2 tracking-widest font-medium">
                {alarm.label || t('alarms.defaultLabel')}
              </div>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={() => deleteAlarm(alarm.id)} className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity p-2">
                <Trash2 size={24} />
              </button>
              <div className="flex items-center gap-4">
                <Bell size={28} className={alarm.enabled ? 'opacity-100' : 'opacity-10'} />
                <ThemedSwitch checked={!!alarm.enabled} onCheckedChange={() => toggleAlarm(alarm)} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {isAdding && (
        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--color-fg)', backgroundColor: 'var(--color-bg)' }}>
          <div className="flex justify-between items-center px-8 pt-5 pb-3">
            <span className="text-xs uppercase font-bold tracking-widest opacity-60">{t('alarms.newAlarm')}</span>
            <button onClick={handleCancel} className="opacity-40 hover:opacity-100 transition-opacity p-1"><X size={20} /></button>
          </div>
          <div className="px-8 mb-3">
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
              className="font-mono-clock font-bold text-4xl h-16 bg-transparent px-4 tracking-tighter focus:outline-none w-full text-center"
              style={{ border: '2px solid var(--color-fg)' }} />
          </div>
          <div className="flex" style={{ borderTop: '1px solid var(--color-fg)' }}>
            <input type="text" placeholder={t('alarms.labelPlaceholder')} value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 h-16 bg-transparent px-6 text-lg placeholder:opacity-30 focus:outline-none"
              style={{ borderRight: '1px solid var(--color-fg)' }} />
            <button onClick={handleAdd}
              className="flex-shrink-0 h-16 px-8 flex items-center gap-3 hover:opacity-80 transition-opacity active:opacity-60 uppercase text-sm font-bold tracking-widest"
              style={{ backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' }}>
              <Check size={22} /> {t('alarms.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AlarmsPage;