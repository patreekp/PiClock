import React, { useState, useEffect } from 'react';
import { useAlarmStore } from './useAlarmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Plus, Bell, SkipForward } from 'lucide-react';
import { ThemedSwitch, ThemedButton } from '@/components/ui-themed';
import CircularTimePicker from './CircularTimePicker';

type PanelMode = 'none' | 'add' | 'edit';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = ['alarms.days.mon','alarms.days.tue','alarms.days.wed',
                  'alarms.days.thu','alarms.days.fri','alarms.days.sat','alarms.days.sun'] as const;

const DAY_KEYS_3 = ['alarms.days.mon3','alarms.days.tue3','alarms.days.wed3',
                    'alarms.days.thu3','alarms.days.fri3','alarms.days.sat3','alarms.days.sun3'] as const;

function formatDaysLabel(days: number[], t: (k: string) => string): string {
  if (days.length === 0) return t('alarms.days.daily');
  if (days.length === 5 && [1,2,3,4,5].every(d => days.includes(d))) return t('alarms.days.weekdays');
  if (days.length === 2 && days.includes(6) && days.includes(0)) return t('alarms.days.weekend');
  return DAY_ORDER
    .filter(d => days.includes(d))
    .map(d => t(DAY_KEYS_3[d === 0 ? 6 : d - 1]))
    .join(' · ');
}

const AlarmsPage = () => {
  const { alarms, fetchAlarms, addAlarm, updateAlarm, toggleAlarm, deleteAlarm, toggleSkipNext, initSse } = useAlarmStore();
  const { t } = useTranslation();

  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pickerTime, setPickerTime] = useState('07:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    fetchAlarms();
    const cleanup = initSse();
    return cleanup;
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setPickerTime('07:00');
    setSelectedDays([]);
    setPanelMode('add');
  };

  const openEdit = (alarm: { id: number; time: string; label: string; days: number[]; skip_next: boolean }) => {
    setEditingId(alarm.id);
    setPickerTime(alarm.time);
    setSelectedDays(alarm.days ?? []);
    setPanelMode('edit');
  };

  const closePanel = () => { setPanelMode('none'); setEditingId(null); };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleConfirm = (time: string) => {
    if (panelMode === 'edit' && editingId != null) {
      const alarm = alarms.find(a => a.id === editingId);
      updateAlarm(editingId, time, alarm?.label ?? '', selectedDays, alarm?.skip_next ?? false);
    } else {
      addAlarm(time, '', selectedDays);
    }
    closePanel();
  };

  const handleDelete = () => {
    if (editingId != null) deleteAlarm(editingId);
    closePanel();
  };

  const panelOpen = panelMode !== 'none';

  return (
    <div className="h-full flex flex-col select-none overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-8 pb-6 flex-shrink-0">
        <h2 className="text-4xl font-bold uppercase tracking-tighter">{t('alarms.title')}</h2>
        {!panelOpen && (
          <ThemedButton onClick={openAdd} className="h-12 px-6 text-xs">
            <Plus size={18} /> {t('alarms.new')}
          </ThemedButton>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'color-mix(in srgb, var(--color-fg) 12%, transparent)', flexShrink: 0 }} />

      {panelOpen ? (
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden py-2 gap-4">

          {/* Day selector */}
          <div className="flex gap-2">
            {DAY_ORDER.map((day) => {
              const keyIdx = day === 0 ? 6 : day - 1;
              const label = t(DAY_KEYS[keyIdx]);
              const active = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className="w-9 h-9 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                  style={{
                    background: active ? 'var(--color-fg)' : 'transparent',
                    color: active ? 'var(--color-bg)' : 'var(--color-fg)',
                    border: '1px solid',
                    borderColor: active
                      ? 'var(--color-fg)'
                      : 'color-mix(in srgb, var(--color-fg) 30%, transparent)',
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Picker */}
          <CircularTimePicker
            value={pickerTime}
            onChange={setPickerTime}
            onConfirm={handleConfirm}
            onCancel={closePanel}
            confirmLabel={t('alarms.save')}
            cancelLabel={t('alarms.cancel')}
            onDelete={panelMode === 'edit' ? handleDelete : undefined}
            deleteLabel={t('alarms.delete')}
          />
        </div>
      ) : (
        /* Lista sveglie */
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 min-h-0">
          {alarms.length === 0 && (
            <div className="h-full flex items-center justify-center opacity-20">
              <p className="text-2xl uppercase tracking-widest italic">{t('alarms.empty')}</p>
            </div>
          )}
          {alarms.map(alarm => (
            <div
              key={alarm.id}
              className="flex items-center justify-between border-b border-current/10 pb-4"
              style={{ opacity: editingId === alarm.id ? 0.4 : 1 }}
            >
              {/* Orario + label giorni */}
              <button className="flex-1 text-left focus:outline-none" onClick={() => openEdit(alarm)}>
                <div className="text-5xl font-mono-clock font-bold tracking-tighter">{alarm.time}</div>
                <div className="text-xs uppercase opacity-50 mt-1 tracking-widest font-medium">
                  {formatDaysLabel(alarm.days ?? [], t)}
                </div>
              </button>

              {/* Controlli */}
              <div className="flex items-center gap-5 flex-shrink-0">

                {/* Skip next — visibile solo se sveglia abilitata */}
                {!!alarm.enabled && (
                  <button
                    onClick={() => toggleSkipNext(alarm)}
                    className="flex flex-col items-center gap-0.5 transition-opacity"
                    style={{ opacity: alarm.skip_next ? 1 : 0.25 }}
                    title={t('alarms.skipNext')}
                  >
                    <SkipForward
                      size={20}
                      style={{ color: alarm.skip_next ? 'var(--color-fg)' : undefined }}
                    />
                    {alarm.skip_next && (
                      <span
                        className="text-[9px] uppercase tracking-widest font-bold leading-none"
                        style={{ color: 'var(--color-fg)' }}
                      >
                        {t('alarms.skipNext')}
                      </span>
                    )}
                  </button>
                )}

                <Bell size={22} className={alarm.enabled ? 'opacity-100' : 'opacity-15'} />
                <ThemedSwitch
                  checked={!!alarm.enabled}
                  onCheckedChange={() => toggleAlarm(alarm)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlarmsPage;