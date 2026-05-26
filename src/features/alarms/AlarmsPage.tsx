import React, { useState, useEffect } from 'react';
import { useAlarmStore } from './useAlarmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Plus, Bell, Trash2 } from 'lucide-react';
import { ThemedSwitch, ThemedButton } from '@/components/ui-themed';
import CircularTimePicker from './CircularTimePicker';

type PanelMode = 'none' | 'add' | 'edit';

const AlarmsPage = () => {
  const { alarms, fetchAlarms, addAlarm, updateAlarm, toggleAlarm, deleteAlarm } = useAlarmStore();
  const { t } = useTranslation();

  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pickerTime, setPickerTime] = useState('07:00');

  useEffect(() => { fetchAlarms(); }, []);

  const openAdd = () => { setEditingId(null); setPickerTime('07:00'); setPanelMode('add'); };
  const openEdit = (alarm: { id: number; time: string; label: string }) => {
    setEditingId(alarm.id); setPickerTime(alarm.time); setPanelMode('edit');
  };
  const closePanel = () => { setPanelMode('none'); setEditingId(null); };

  const handleConfirm = (time: string) => {
    if (panelMode === 'edit' && editingId != null) {
      const alarm = alarms.find(a => a.id === editingId);
      updateAlarm(editingId, time, alarm?.label ?? '');
    } else {
      addAlarm(time, '');
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
        /* ── Panel: picker centrato, bottoni interni ── */
        <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
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
        /* ── Lista sveglie ── */
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 min-h-0">
          {alarms.length === 0 && (
            <div className="h-full flex items-center justify-center opacity-20">
              <p className="text-2xl uppercase tracking-widest italic">{t('alarms.empty')}</p>
            </div>
          )}
          {alarms.map(alarm => (
            <div key={alarm.id}
              className="flex items-center justify-between border-b border-current/10 pb-4">
              {/* Tappable time */}
              <button className="flex-1 text-left focus:outline-none" onClick={() => openEdit(alarm)}>
                <div className="text-5xl font-mono-clock font-bold tracking-tighter">{alarm.time}</div>
                <div className="text-xs uppercase opacity-50 mt-1 tracking-widest font-medium">
                  {alarm.label || t('alarms.defaultLabel')}
                </div>
              </button>
              {/* Controlli — sempre visibili su touch */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <button
                  onClick={() => deleteAlarm(alarm.id)}
                  className="p-2 opacity-30 hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={22} />
                </button>
                <Bell size={24} className={alarm.enabled ? 'opacity-100' : 'opacity-15'} />
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