import { useEffect, useState } from 'react';
import { useAppStore, PageSlug } from '../../store/useAppStore';
import type { ThemeMode, HighlightMode, Language, PomodoroStyle, BrightnessMode } from '../../store/useAppStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useWeatherStore } from '../weather/useWeatherStore';
import { useAlarmStore, Alarm } from '../alarms/useAlarmStore';
import { useTodoStore } from '../todos/useTodoStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ThemedButton, ThemedSwitch, ThemedToggleGroup, ThemedSlider } from '../../components/ui-themed';
import type { ToggleOption } from '../../components/ui-themed';
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

// ── Settings — mini stepper compatto per telefono ────────────────────────────
const MiniStepper = ({
  value, min, max, step = 1, onChange, suffix,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onChange(Math.max(min, value - step))}
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
      style={{ border: '1px solid', borderColor: 'color-mix(in srgb, var(--color-fg) 25%, transparent)', color: 'var(--color-fg)' }}
    >−</button>
    <span className="min-w-[42px] text-center text-sm font-bold font-mono">
      {value}{suffix ? <span className="text-[10px] opacity-50 ml-0.5">{suffix}</span> : null}
    </span>
    <button
      onClick={() => onChange(Math.min(max, value + step))}
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
      style={{ border: '1px solid', borderColor: 'color-mix(in srgb, var(--color-fg) 25%, transparent)', color: 'var(--color-fg)' }}
    >+</button>
  </div>
);

const SettingsDivider = () => (
  <div className="border-t opacity-10" style={{ borderColor: 'var(--color-fg)' }} />
);

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

  // ── Settings ──────────────────────────────────────────────────────────────
  const config = useAppStore(s => s.config);
  const theme = useAppStore(s => s.theme);
  const language = useAppStore(s => s.language);
  const fetchConfig = useAppStore(s => s.fetchConfig);
  const updateConfig = useAppStore(s => s.updateConfig);
  const updateConfigLocal = useAppStore(s => s.updateConfigLocal);
  const setTheme = useAppStore(s => s.setTheme);
  const setLanguage = useAppStore(s => s.setLanguage);
  const [folderDraft, setFolderDraft] = useState(config.alarmFolder);

  const THEME_OPTIONS: ToggleOption<ThemeMode>[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark',  label: t('settings.themeDark') },
    { value: 'auto',  label: t('settings.themeAuto') },
  ];
  const LANGUAGE_OPTIONS: ToggleOption<Language>[] = [
    { value: 'en', label: 'EN' },
    { value: 'it', label: 'IT' },
  ];
  const HIGHLIGHT_OPTIONS: ToggleOption<HighlightMode>[] = [
    { value: 'off',     label: t('settings.highlightsOff') },
    { value: 'local',   label: t('settings.highlightsLocal') },
    { value: 'audjust', label: t('settings.highlightsAudjust'), disabled: true },
  ];
  const SNOOZE_OPTIONS: ToggleOption<number>[] = [
    { value: 1,  label: t('settings.snooze1') },
    { value: 5,  label: t('settings.snooze5') },
    { value: 10, label: t('settings.snooze10') },
  ];
  const BRIGHTNESS_MODE_OPTIONS: ToggleOption<BrightnessMode>[] = [
    { value: 'manual', label: t('settings.brightnessModeManual') },
    { value: 'auto',   label: t('settings.brightnessModeAuto') },
  ];
  const POMODORO_STYLE_OPTIONS: ToggleOption<PomodoroStyle>[] = [
    { value: 'hourglass', label: t('settings.pomodoroStyleHourglass') },
    { value: 'arc',       label: t('settings.pomodoroStyleArc') },
  ];

  const minSuffix = t('settings.pomodoroMinSuffix');

  useEffect(() => { connectRemote(); }, [connectRemote]);
  useEffect(() => { connectPomodoro(); }, [connectPomodoro]);
  useEffect(() => { connectWeather(); }, [connectWeather]);
  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { setFolderDraft(config.alarmFolder); }, [config.alarmFolder]);
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

  const saveFolder = () => {
    const trimmed = folderDraft.trim();
    if (trimmed) updateConfig({ alarmFolder: trimmed });
  };

  return (
    // fixed + overflow-y-auto crea un contesto di scroll INDIPENDENTE dal
    // <body>, che ha overflow:hidden globale (necessario per il display
    // fisso del Pi, ma incompatibile con /remote che deve poter scrollare).
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      {/* Header sticky: titolo + nav restano visibili durante lo scroll */}
      <div
        className="sticky top-0 z-10 flex flex-col gap-4 p-4 pb-4"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <h1 className="text-xl font-bold uppercase tracking-widest text-center">
          {t('remote.title')}
        </h1>

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
      </div>

      {/* Contenuto scrollabile */}
      <div className="px-4 pb-8">

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

        {/* ── Settings ── */}
        {currentPage === 'settings' && (
          <div className="flex flex-col gap-6">

            {/* Aspetto */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t('settings.tab.appearance')}</p>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.theme')}</span>
                <ThemedToggleGroup options={THEME_OPTIONS} value={theme} onChange={setTheme} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.language')}</span>
                <ThemedToggleGroup options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">{t('settings.clock24h')}</span>
                <ThemedSwitch checked={config.clock24h} onCheckedChange={(val) => updateConfig({ clock24h: val })} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">{t('settings.showSeconds')}</span>
                <ThemedSwitch checked={config.showSeconds} onCheckedChange={(val) => updateConfig({ showSeconds: val })} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.brightness')}</span>
                <ThemedToggleGroup
                  options={BRIGHTNESS_MODE_OPTIONS}
                  value={config.brightnessMode}
                  onChange={(val) => updateConfig({ brightnessMode: val })}
                />
              </div>
              <div className="flex items-center gap-3">
                {config.brightnessMode === 'auto' && (
                  <span className="text-xs opacity-50 w-10 flex-shrink-0">{t('settings.brightnessDay')}</span>
                )}
                <ThemedSlider
                  showSteppers
                  value={config.brightness} min={20} max={100}
                  onChange={(v) => updateConfigLocal({ brightness: v })}
                  onChangeEnd={(v) => updateConfig({ brightness: v })}
                />
                <span className="text-xs font-mono w-10 text-right opacity-70">{config.brightness}%</span>
              </div>
              {config.brightnessMode === 'auto' && (
                <div className="flex items-center gap-3">
                  <span className="text-xs opacity-50 w-10 flex-shrink-0">{t('settings.brightnessNight')}</span>
                  <ThemedSlider
                    showSteppers
                    value={config.brightnessNight} min={10} max={100}
                    onChange={(v) => updateConfigLocal({ brightnessNight: v })}
                    onChangeEnd={(v) => updateConfig({ brightnessNight: v })}
                  />
                  <span className="text-xs font-mono w-10 text-right opacity-70">{config.brightnessNight}%</span>
                </div>
              )}
            </div>

            <SettingsDivider />

            {/* Audio & Sveglie */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t('settings.tab.audio')}</p>

              <div className="flex items-center gap-3">
                <ThemedSlider
                  showSteppers
                  value={config.volume} min={0} max={100}
                  onChange={(v) => updateConfigLocal({ volume: v })}
                  onChangeEnd={(v) => updateConfig({ volume: v })}
                />
                <span className="text-xs font-mono w-10 text-right opacity-70">{config.volume}%</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.snooze')}</span>
                <ThemedToggleGroup options={SNOOZE_OPTIONS} value={config.snoozeMinutes} onChange={(val) => updateConfig({ snoozeMinutes: val })} />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs opacity-50">{t('settings.audioFolder')}</span>
                <div className="flex gap-2">
                  <input
                    value={folderDraft}
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveFolder()}
                    className="flex-1 bg-transparent border rounded-lg px-3 h-10 text-xs font-mono"
                    style={{ borderColor: 'var(--color-fg)' }}
                  />
                  <ThemedButton variant="outline" onClick={saveFolder} className="h-10 px-3 text-xs">
                    {t('dialog.save')}
                  </ThemedButton>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.highlightsMode')}</span>
                <ThemedToggleGroup options={HIGHLIGHT_OPTIONS} value={config.highlightMode} onChange={(val) => updateConfig({ highlightMode: val })} />
              </div>
            </div>

            <SettingsDivider />

            {/* Meteo */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t('settings.tab.weather')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs opacity-50">{t('settings.lat')}</span>
                  <input
                    value={config.lat}
                    onChange={(e) => updateConfigLocal({ lat: e.target.value })}
                    onBlur={(e) => updateConfig({ lat: e.target.value })}
                    className="w-full bg-transparent border rounded-lg px-3 h-10 text-xs font-mono"
                    style={{ borderColor: 'var(--color-fg)' }}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs opacity-50">{t('settings.lon')}</span>
                  <input
                    value={config.lon}
                    onChange={(e) => updateConfigLocal({ lon: e.target.value })}
                    onBlur={(e) => updateConfig({ lon: e.target.value })}
                    className="w-full bg-transparent border rounded-lg px-3 h-10 text-xs font-mono"
                    style={{ borderColor: 'var(--color-fg)' }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs opacity-50">{t('settings.timezone')}</span>
                <input
                  value={config.timezone}
                  onChange={(e) => updateConfigLocal({ timezone: e.target.value })}
                  onBlur={(e) => updateConfig({ timezone: e.target.value })}
                  className="w-full bg-transparent border rounded-lg px-3 h-10 text-xs font-mono"
                  style={{ borderColor: 'var(--color-fg)' }}
                />
              </div>
            </div>

            <SettingsDivider />

            {/* Pomodoro */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t('settings.pomodoro')}</p>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t('settings.pomodoroStyle')}</span>
                <ThemedToggleGroup options={POMODORO_STYLE_OPTIONS} value={config.pomodoroStyle} onChange={(val) => updateConfig({ pomodoroStyle: val })} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">{t('settings.pomodoroSessions')}</span>
                <MiniStepper value={config.pomodoroSessions} min={1} max={8} onChange={(v) => updateConfig({ pomodoroSessions: v })} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs opacity-50">{t('settings.pomodoroFocusMin')}</span>
                <MiniStepper value={config.pomodoroFocusMin} min={1} max={60} step={5} onChange={(v) => updateConfig({ pomodoroFocusMin: v })} suffix={minSuffix} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs opacity-50">{t('settings.pomodoroShortBreakMin')}</span>
                <MiniStepper value={config.pomodoroShortBreakMin} min={1} max={30} onChange={(v) => updateConfig({ pomodoroShortBreakMin: v })} suffix={minSuffix} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs opacity-50">{t('settings.pomodoroLongBreakMin')}</span>
                <MiniStepper value={config.pomodoroLongBreakMin} min={1} max={60} step={5} onChange={(v) => updateConfig({ pomodoroLongBreakMin: v })} suffix={minSuffix} />
              </div>
            </div>
          </div>
        )}

        {currentPage !== 'pomodoro' && currentPage !== 'weather' && currentPage !== 'alarms' && currentPage !== 'todos' && currentPage !== 'settings' && (
          <p className="text-center text-sm opacity-50 mt-8">
            {t('remote.noControls')}
          </p>
        )}
      </div>
    </div>
  );
};

export default RemoteApp;