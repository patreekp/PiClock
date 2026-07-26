import { useEffect, useState } from 'react';
import { useAppStore, PageSlug } from '../../store/useAppStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useWeatherStore } from '../weather/useWeatherStore';
import { useAlarmStore, Alarm } from '../alarms/useAlarmStore';
import { useTodoStore } from '../todos/useTodoStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ThemedButton, ThemedSwitch } from '../../components/ui-themed';
import CircularTimePicker from '../alarms/CircularTimePicker';
import { Plus, Trash2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n/translations';

const NAV_PAGES: { slug: PageSlug; labelKey: TranslationKey }[] = [
  { slug: 'clock',    labelKey: 'remote.nav.clock' },
  { slug: 'weather',  labelKey: 'remote.nav.weather' },
  { slug: 'pomodoro', labelKey: 'remote.nav.pomodoro' },
  { slug: 'todos',    labelKey: 'remote.nav.todos' },
  { slug: 'alarms',   labelKey: 'remote.nav.alarms' },
  { slug: 'settings', labelKey: 'remote.nav.settings' },
];

const PHASE_LABEL_KEY: Record<string, TranslationKey> = {
  focus: 'pomodoro.focus',
  shortBreak: 'pomodoro.shortBreak',
  longBreak: 'pomodoro.longBreak',
};

// ── Alarms — day selector (stesso schema di AlarmsPage) ─────────────────────
type AlarmPanelMode = 'none' | 'add' | 'edit';
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS_3: TranslationKey[] = [
  'alarms.days.mon3','alarms.days.tue3','alarms.days.wed3',
  'alarms.days.thu3','alarms.days.fri3','alarms.days.sat3','alarms.days.sun3',
];

const RemoteApp = () => {
  const { t } = useTranslation();

  const currentPage = useAppStore(s => s.currentPage);
  const setPage = useAppStore(s => s.setPage);
  const connectRemote = useAppStore(s => s.connectRemote);

  // ── Pomodoro ──────────────────────────────────────────────────────────────
  const pomodoroStatus = usePomodoroStore(s => s.status);
  const pomodoroPhase = usePomodoroStore(s => s.phase);
  const connectPomodoro = usePomodoroStore(s => s.connect);
  const startPomodoro = usePomodoroStore(s => s.start);
  const pausePomodoro = usePomodoroStore(s => s.pause);
  const resetPomodoro = usePomodoroStore(s => s.reset);
  const skipPomodoro = usePomodoroStore(s => s.skip);

  // ── Weather ───────────────────────────────────────────────────────────────
  const weatherLoading = useWeatherStore(s => s.loading);
  const connectWeather = useWeatherStore(s => s.connect);
  const refreshWeather = useWeatherStore(s => s.refresh);

  // ── Alarms ────────────────────────────────────────────────────────────────
  const { alarms, fetchAlarms, addAlarm, updateAlarm, toggleAlarm, initSse: initAlarmSse } = useAlarmStore();
  const [alarmPanelMode, setAlarmPanelMode] = useState<AlarmPanelMode>('none');
  const [editingAlarmId, setEditingAlarmId] = useState<number | null>(null);
  const [pickerTime, setPickerTime] = useState('07:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // ── Todos ─────────────────────────────────────────────────────────────────
const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo, initSse: initTodoSse } = useTodoStore();
const [newTodo, setNewTodo] = useState('');

  useEffect(() => { connectRemote(); }, [connectRemote]);
  useEffect(() => { connectPomodoro(); }, [connectPomodoro]);
  useEffect(() => { connectWeather(); }, [connectWeather]);
  useEffect(() => {
    fetchAlarms();
    const cleanup = initAlarmSse();
    return cleanup;
  }, []);
  useEffect(() => {
    fetchTodos();
    const cleanup = initTodoSse();
    return cleanup;
  }, []);

  const openAddAlarm = () => {
    setEditingAlarmId(null);
    setPickerTime('07:00');
    setSelectedDays([]);
    setAlarmPanelMode('add');
  };

  const openEditAlarm = (alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setPickerTime(alarm.time);
    setSelectedDays(alarm.days ?? []);
    setAlarmPanelMode('edit');
  };

  const closeAlarmPanel = () => { setAlarmPanelMode('none'); setEditingAlarmId(null); };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleAlarmConfirm = (time: string) => {
    if (alarmPanelMode === 'edit' && editingAlarmId != null) {
      const alarm = alarms.find(a => a.id === editingAlarmId);
      updateAlarm(editingAlarmId, time, alarm?.label ?? '', selectedDays, alarm?.skip_next ?? false);
    } else {
      addAlarm(time, '', selectedDays);
    }
    closeAlarmPanel();
  };

  const handleAddTodo = () => {
    if (!newTodo.trim()) return;
    addTodo(newTodo);
    setNewTodo('');
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col p-4 gap-6"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      <h1 className="text-xl font-bold uppercase tracking-widest text-center">
        {t('remote.title')}
      </h1>

      {/* Navigazione principale — sempre visibile */}
      <div className="grid grid-cols-3 gap-2">
        {NAV_PAGES.map(({ slug, labelKey }) => (
          <ThemedButton
            key={slug}
            variant={currentPage === slug ? 'solid' : 'outline'}
            onClick={() => setPage(slug)}
            className="py-3 rounded-lg text-xs"
          >
            {t(labelKey)}
          </ThemedButton>
        ))}
      </div>

      <div className="border-t opacity-20" style={{ borderColor: 'var(--color-fg)' }} />

      {/* Pannello contestuale */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Pomodoro ── */}
        {currentPage === 'pomodoro' && (
          <div className="flex flex-col gap-4">
            {pomodoroStatus === 'cycleComplete' ? (
              <p className="text-center text-sm opacity-70">{t('pomodoro.done')}</p>
            ) : (
              <p className="text-center text-sm opacity-70">
                {t(PHASE_LABEL_KEY[pomodoroPhase] ?? 'pomodoro.focus')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {pomodoroStatus === 'running' ? (
                <ThemedButton variant="solid" onClick={() => pausePomodoro()} className="py-4 rounded-lg">
                  {t('remote.pomodoro.pause')}
                </ThemedButton>
              ) : (
                <ThemedButton variant="solid" onClick={() => startPomodoro()} className="py-4 rounded-lg">
                  {t('remote.pomodoro.start')}
                </ThemedButton>
              )}
              <ThemedButton variant="outline" onClick={() => skipPomodoro()} className="py-4 rounded-lg">
                {t('remote.pomodoro.skip')}
              </ThemedButton>
              <ThemedButton variant="outline" onClick={() => resetPomodoro()} className="py-4 rounded-lg col-span-2">
                {t('remote.pomodoro.reset')}
              </ThemedButton>
            </div>
          </div>
        )}

        {/* ── Weather ── */}
        {currentPage === 'weather' && (
          <div className="flex flex-col gap-4">
            <ThemedButton
              variant="solid"
              onClick={() => refreshWeather()}
              disabled={weatherLoading}
              className="py-4 rounded-lg w-full"
            >
              {weatherLoading ? t('remote.weather.refreshing') : t('remote.weather.refresh')}
            </ThemedButton>
          </div>
        )}

        {/* ── Alarms ── */}
        {currentPage === 'alarms' && (
          <div className="flex flex-col gap-4">
            {alarmPanelMode === 'none' ? (
              <>
                <ThemedButton variant="solid" onClick={openAddAlarm} className="py-3 rounded-lg w-full">
                  <Plus size={16} /> {t('alarms.new')}
                </ThemedButton>
                <div className="flex flex-col gap-2">
                  {alarms.length === 0 && (
                    <p className="text-center text-sm opacity-40 mt-4">{t('alarms.empty')}</p>
                  )}
                  {alarms.map(alarm => (
                    <div
                      key={alarm.id}
                      className="flex items-center justify-between border-b pb-2"
                      style={{ borderColor: 'color-mix(in srgb, var(--color-fg) 12%, transparent)' }}
                    >
                      <button className="text-left flex-1" onClick={() => openEditAlarm(alarm)}>
                        <div className="text-2xl font-mono-clock font-bold tracking-tighter">{alarm.time}</div>
                      </button>
                      <ThemedSwitch checked={!!alarm.enabled} onCheckedChange={() => toggleAlarm(alarm)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-1 flex-wrap justify-center">
                  {DAY_ORDER.map((day) => {
                    const keyIdx = day === 0 ? 6 : day - 1;
                    const active = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className="w-8 h-8 rounded-full text-xs font-bold uppercase transition-all"
                        style={{
                          background: active ? 'var(--color-fg)' : 'transparent',
                          color: active ? 'var(--color-bg)' : 'var(--color-fg)',
                          border: '1px solid',
                          borderColor: active ? 'var(--color-fg)' : 'color-mix(in srgb, var(--color-fg) 30%, transparent)',
                        }}
                      >
                        {t(DAY_KEYS_3[keyIdx])}
                      </button>
                    );
                  })}
                </div>
                <CircularTimePicker
                  value={pickerTime}
                  onChange={setPickerTime}
                  onConfirm={handleAlarmConfirm}
                  onCancel={closeAlarmPanel}
                  confirmLabel={t('alarms.save')}
                  cancelLabel={t('alarms.cancel')}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Todos ── */}
        {currentPage === 'todos' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder={t('todos.placeholder')}
                className="flex-1 bg-transparent border rounded-lg px-3 h-11 text-sm"
                style={{ borderColor: 'var(--color-fg)' }}
              />
              <ThemedButton variant="solid" onClick={handleAddTodo} className="h-11 w-11 p-0 rounded-lg">
                <Plus size={18} />
              </ThemedButton>
            </div>
            <div className="flex flex-col gap-2">
              {todos.length === 0 && (
                <p className="text-center text-sm opacity-40 mt-4">{t('todos.empty')}</p>
              )}
              {todos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'color-mix(in srgb, var(--color-fg) 12%, transparent)' }}>
                  <span
                    onClick={() => toggleTodo(todo.id, todo.text, !!todo.done)}
                    className={`flex-1 text-sm cursor-pointer ${todo.done ? 'line-through opacity-40' : ''}`}
                  >
                    {todo.text}
                  </span>
                  <button onClick={() => deleteTodo(todo.id)} className="opacity-40 hover:opacity-100 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage !== 'pomodoro' && currentPage !== 'weather' && currentPage !== 'alarms' && currentPage !== 'todos' && (
          <p className="text-center text-sm opacity-50 mt-8">
            {t('remote.noControls')}
          </p>
        )}
      </div>
    </div>
  );
};

export default RemoteApp;