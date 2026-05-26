import React, { useState, useEffect } from 'react';
import { useAlarmStore } from './useAlarmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Plus, Bell, Trash2 } from 'lucide-react';
import { ThemedSwitch, ThemedButton } from '@/components/ui-themed';
import CircularTimePicker from './CircularTimePicker';

type PanelMode = 'none' | 'add' | 'edit';

const AlarmsPage = () => {
  const { alarms, fetchAlarms, addAlarm, updateAlarm, toggleAlarm, deleteAlarm } =
    useAlarmStore();
  const { t } = useTranslation();

  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pickerTime, setPickerTime] = useState('07:00');
  const [pickerLabel, setPickerLabel] = useState('');

  useEffect(() => {
    fetchAlarms();
  }, []);

  // ── open panels ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setPickerTime('07:00');
    setPickerLabel('');
    setPanelMode('add');
  };

  const openEdit = (alarm: { id: number; time: string; label: string }) => {
    setEditingId(alarm.id);
    setPickerTime(alarm.time);
    setPickerLabel(alarm.label);
    setPanelMode('edit');
  };

  const closePanel = () => {
    setPanelMode('none');
    setEditingId(null);
  };

  // ── confirm handlers ──────────────────────────────────────────
  const handleConfirmAdd = (time: string) => {
    addAlarm(time, pickerLabel);
    closePanel();
  };

  const handleConfirmEdit = (time: string) => {
    if (editingId == null) return;
    updateAlarm(editingId, time, pickerLabel);
    closePanel();
  };

  const handleConfirm = panelMode === 'edit' ? handleConfirmEdit : handleConfirmAdd;

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

      {/* Alarm list */}
      <div className="flex-1 overflow-y-auto px-8 space-y-6 min-h-0">
        {alarms.length === 0 && !panelOpen && (
          <div className="h-full flex items-center justify-center opacity-20">
            <p className="text-2xl uppercase tracking-widest italic">{t('alarms.empty')}</p>
          </div>
        )}

        {alarms.map(alarm => {
          const isEditing = panelMode === 'edit' && editingId === alarm.id;
          return (
            <div
              key={alarm.id}
              className="flex items-center justify-between border-b border-current/10 pb-6 group"
              style={isEditing ? { opacity: 0.4 } : {}}
            >
              {/* Tappable time + label */}
              <button
                className="flex-1 text-left focus:outline-none"
                onClick={() => openEdit(alarm)}
              >
                <div className="text-6xl font-mono-clock font-bold tracking-tighter">
                  {alarm.time}
                </div>
                <div className="text-sm uppercase opacity-60 mt-2 tracking-widest font-medium">
                  {alarm.label || t('alarms.defaultLabel')}
                </div>
              </button>

              {/* Controls */}
              <div className="flex items-center gap-8">
                <button
                  onClick={() => deleteAlarm(alarm.id)}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity p-2"
                >
                  <Trash2 size={24} />
                </button>
                <div className="flex items-center gap-4">
                  <Bell size={28} className={alarm.enabled ? 'opacity-100' : 'opacity-10'} />
                  <ThemedSwitch
                    checked={!!alarm.enabled}
                    onCheckedChange={() => toggleAlarm(alarm)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom panel — add or edit */}
      {panelOpen && (
        <div
          className="flex-shrink-0 pb-4"
          style={{ borderTop: '1px solid var(--color-fg)', backgroundColor: 'var(--color-bg)' }}
        >
          {/* Panel title */}
          <div className="flex justify-between items-center px-8 pt-4 pb-2">
            <span className="text-xs uppercase font-bold tracking-widest opacity-60">
              {panelMode === 'edit' ? t('alarms.editAlarm') : t('alarms.newAlarm')}
            </span>
          </div>

          {/* Circular time picker */}
          <CircularTimePicker
            value={pickerTime}
            onChange={setPickerTime}
            onConfirm={handleConfirm}
            onCancel={closePanel}
            confirmLabel={t('alarms.save')}
            cancelLabel={t('alarms.cancel')}
          />

          {/* Label input */}
          <div className="px-8 pt-3">
            <input
              type="text"
              placeholder={t('alarms.labelPlaceholder')}
              value={pickerLabel}
              onChange={e => setPickerLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm(pickerTime)}
              className="w-full h-12 bg-transparent px-4 text-sm placeholder:opacity-30 focus:outline-none uppercase tracking-widest"
              style={{ border: '1px solid var(--color-fg)', opacity: 0.8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AlarmsPage;