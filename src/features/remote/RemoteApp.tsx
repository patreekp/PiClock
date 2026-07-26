import { useEffect } from 'react';
import { useAppStore, PageSlug } from '../../store/useAppStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ThemedButton } from '../../components/ui-themed';
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

const RemoteApp = () => {
  const { t } = useTranslation();

  const currentPage = useAppStore(s => s.currentPage);
  const setPage = useAppStore(s => s.setPage);
  const connectRemote = useAppStore(s => s.connectRemote);

  const pomodoroStatus = usePomodoroStore(s => s.status);
  const pomodoroPhase = usePomodoroStore(s => s.phase);
  const connectPomodoro = usePomodoroStore(s => s.connect);
  const startPomodoro = usePomodoroStore(s => s.start);
  const pausePomodoro = usePomodoroStore(s => s.pause);
  const resetPomodoro = usePomodoroStore(s => s.reset);
  const skipPomodoro = usePomodoroStore(s => s.skip);

  useEffect(() => { connectRemote(); }, [connectRemote]);
  useEffect(() => { connectPomodoro(); }, [connectPomodoro]);

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
      <div className="flex-1">
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
                <ThemedButton
                  variant="solid"
                  onClick={() => pausePomodoro()}
                  className="py-4 rounded-lg"
                >
                  {t('remote.pomodoro.pause')}
                </ThemedButton>
              ) : (
                <ThemedButton
                  variant="solid"
                  onClick={() => startPomodoro()}
                  className="py-4 rounded-lg"
                >
                  {t('remote.pomodoro.start')}
                </ThemedButton>
              )}
              <ThemedButton
                variant="outline"
                onClick={() => skipPomodoro()}
                className="py-4 rounded-lg"
              >
                {t('remote.pomodoro.skip')}
              </ThemedButton>
              <ThemedButton
                variant="outline"
                onClick={() => resetPomodoro()}
                className="py-4 rounded-lg col-span-2"
              >
                {t('remote.pomodoro.reset')}
              </ThemedButton>
            </div>
          </div>
        )}

        {currentPage !== 'pomodoro' && (
          <p className="text-center text-sm opacity-50 mt-8">
            {t('remote.noControls')}
          </p>
        )}
      </div>
    </div>
  );
};

export default RemoteApp;