import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { ThemeMode, HighlightMode, Language, PomodoroStyle } from '../../store/useAppStore';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Moon, Sun, Clock, MapPin, Globe, Pencil, SunMoon, AlarmClock, Music, Loader2, RefreshCw, Languages, Timer } from 'lucide-react';
import { ThemedSwitch, ThemedToggleGroup, ThemedButton } from '@/components/ui-themed';
import type { ToggleOption } from '@/components/ui-themed';

interface LibraryStatus { total: number; scanned: number; pending: number; lastScan: string | null; scanInProgress: boolean; }

// ── Minimal number stepper ────────────────────────────────────────────────────
const Stepper = ({
  value, min, max, step = 1, onChange, suffix,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <button
      onClick={() => onChange(Math.max(min, value - step))}
      style={{
        width: '36px', height: '36px', border: '1px solid var(--color-fg)', borderColor: 'color-mix(in srgb, var(--color-fg) 20%, transparent)',
        background: 'transparent', color: 'var(--color-fg)', cursor: 'pointer', fontSize: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >−</button>
    <span style={{ minWidth: '48px', textAlign: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-fg)' }}>
      {value}{suffix ? <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '3px', fontWeight: 400 }}>{suffix}</span> : null}
    </span>
    <button
      onClick={() => onChange(Math.min(max, value + step))}
      style={{
        width: '36px', height: '36px', border: '1px solid var(--color-fg)', borderColor: 'color-mix(in srgb, var(--color-fg) 20%, transparent)',
        background: 'transparent', color: 'var(--color-fg)', cursor: 'pointer', fontSize: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >+</button>
  </div>
);

const SettingsPage = () => {
  const { theme, setTheme, config, updateConfig, setLanguage } = useAppStore();
  const { t, language } = useTranslation();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [draftPath, setDraftPath] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [scanning, setScanning] = useState(false);

  const THEME_OPTIONS: ToggleOption<ThemeMode>[] = [
    { value: 'light', label: t('settings.themeLight'), icon: <Sun size={18} /> },
    { value: 'dark',  label: t('settings.themeDark'),  icon: <Moon size={18} /> },
    { value: 'auto',  label: t('settings.themeAuto'),  icon: <SunMoon size={18} /> },
  ];
  const HIGHLIGHT_OPTIONS: ToggleOption<HighlightMode>[] = [
    { value: 'off',    label: t('settings.highlightsOff') },
    { value: 'local',  label: t('settings.highlightsLocal') },
    { value: 'audjust',label: t('settings.highlightsAudjust'), disabled: true },
  ];
  const SNOOZE_OPTIONS: ToggleOption<number>[] = [
    { value: 1,  label: t('settings.snooze1') },
    { value: 5,  label: t('settings.snooze5') },
    { value: 10, label: t('settings.snooze10') },
  ];
  const LANGUAGE_OPTIONS: ToggleOption<Language>[] = [
    { value: 'en', label: 'EN' },
    { value: 'it', label: 'IT' },
  ];
  const POMODORO_STYLE_OPTIONS: ToggleOption<PomodoroStyle>[] = [
    { value: 'hourglass', label: t('settings.pomodoroStyleHourglass') },
    { value: 'arc',       label: t('settings.pomodoroStyleArc') },
  ];

  const fetchLibraryStatus = async () => {
    try { const res = await fetch('/api/audio/status'); const data = await res.json(); setLibraryStatus(data); setScanning(data.scanInProgress); } catch (_) {}
  };

  useEffect(() => { fetchLibraryStatus(); const interval = setInterval(fetchLibraryStatus, 3000); return () => clearInterval(interval); }, []);

  useEffect(() => {
    const es = new EventSource('/api/audio/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'library:scan-start') setScanning(true);
        if (msg.type === 'library:scan-done' || msg.type === 'library:scan-error') { setScanning(false); fetchLibraryStatus(); }
      } catch (_) {}
    };
    return () => es.close();
  }, []);

  const handleScan = async (onlyNew: boolean) => {
    setScanning(true);
    try { await fetch('/api/audio/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onlyNew }) }); }
    catch (_) { setScanning(false); }
  };

  const openFolderDialog = () => { setDraftPath(config.alarmFolder); setFolderDialogOpen(true); };
  const handleFolderSave = () => { const trimmed = draftPath.trim(); if (trimmed) updateConfig({ alarmFolder: trimmed }); setFolderDialogOpen(false); };

  const locale = language === 'it' ? 'it-IT' : 'en-GB';
  const lastScanLabel = libraryStatus?.lastScan
    ? new Date(libraryStatus.lastScan + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : t('settings.libraryNever');

  const highlightDesc = config.highlightMode === 'off'
    ? t('settings.highlightsOffDesc')
    : config.highlightMode === 'local'
      ? t('settings.highlightsLocalDesc')
      : t('settings.highlightsAudjustDesc');

  const themeDesc = theme === 'auto'
    ? t('settings.themeDesc.auto')
    : theme === 'dark'
      ? t('settings.themeDesc.dark')
      : t('settings.themeDesc.light');

  const minSuffix = t('settings.pomodoroMinSuffix');

  return (
    <div className="h-full p-8 flex flex-col overflow-y-auto select-none custom-scrollbar">
      <h2 className="text-4xl font-bold mb-10 uppercase tracking-tighter">{t('settings.title')}</h2>
      <div className="space-y-10">

        {/* Theme */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
              {theme === 'dark' ? <Moon size={28} /> : theme === 'auto' ? <SunMoon size={28} /> : <Sun size={28} />}
            </div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.theme')}</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">{themeDesc}</p>
            </div>
          </div>
          <ThemedToggleGroup options={THEME_OPTIONS} value={theme} onChange={setTheme} />
        </div>

        {/* Language */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Languages size={28} /></div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.language')}</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">{t('settings.languageDesc')}</p>
            </div>
          </div>
          <ThemedToggleGroup options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
        </div>

        {/* 24h */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Clock size={28} /></div>
            <div><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.clock24h')}</Label><p className="text-sm opacity-50 uppercase tracking-widest mt-1">{t('settings.clock24hDesc')}</p></div>
          </div>
          <ThemedSwitch checked={config.clock24h} onCheckedChange={(val) => updateConfig({ clock24h: val })} />
        </div>

        {/* Seconds */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Clock size={28} className="opacity-40" /></div>
            <div><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.showSeconds')}</Label><p className="text-sm opacity-50 uppercase tracking-widest mt-1">{t('settings.showSecondsDesc')}</p></div>
          </div>
          <ThemedSwitch checked={config.showSeconds} onCheckedChange={(val) => updateConfig({ showSeconds: val })} />
        </div>

        {/* Location */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8"><MapPin size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.location')}</Label></div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3"><Label className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.lat')}</Label><Input value={config.lat} onChange={(e) => updateConfig({ lat: e.target.value })} className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" /></div>
            <div className="space-y-3"><Label className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.lon')}</Label><Input value={config.lon} onChange={(e) => updateConfig({ lon: e.target.value })} className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" /></div>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2"><Globe size={18} className="opacity-50" /><Label className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.timezone')}</Label></div>
            <Input value={config.timezone} onChange={(e) => updateConfig({ timezone: e.target.value })} className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" />
          </div>
        </div>

        {/* Audio */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8"><AlarmClock size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.audio')}</Label></div>
          <div className="flex items-center justify-between gap-6 mb-8">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-2">{t('settings.audioFolder')}</p>
              <p className="font-mono text-base truncate opacity-80">{config.alarmFolder}</p>
            </div>
            <ThemedButton onClick={openFolderDialog} className="h-12 px-5 text-xs flex-shrink-0"><Pencil size={15} /> {t('settings.audioFolderEdit')}</ThemedButton>
          </div>
          <div className="flex items-center justify-between mb-10">
            <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.snooze')}</p>
            <ThemedToggleGroup options={SNOOZE_OPTIONS} value={config.snoozeMinutes} onChange={(val) => updateConfig({ snoozeMinutes: val })} />
          </div>
        </div>

        {/* Song Highlights */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8"><Music size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.highlights')}</Label></div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">{t('settings.highlightsMode')}</p>
              <p className="text-xs opacity-50 uppercase tracking-widest mt-1">{highlightDesc}</p>
            </div>
            <ThemedToggleGroup options={HIGHLIGHT_OPTIONS} value={config.highlightMode} onChange={(val) => updateConfig({ highlightMode: val })} />
          </div>
          {config.highlightMode !== 'off' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 p-4 border border-current/10">
                <div className="space-y-1">
                  <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.libraryStatus')}</p>
                  {libraryStatus ? (
                    <>
                      <p className="text-sm font-bold">{libraryStatus.scanned} / {libraryStatus.total} {t('settings.libraryTracks')}</p>
                      {libraryStatus.pending > 0 && <p className="text-xs opacity-50 uppercase tracking-widest">{libraryStatus.pending} {t('settings.libraryPending')}</p>}
                      <p className="text-xs opacity-40 uppercase tracking-widest">{t('settings.libraryLastScan')}: {lastScanLabel}</p>
                    </>
                  ) : <p className="text-sm opacity-40">{t('settings.libraryLoading')}</p>}
                </div>
                {scanning && (
                  <div className="flex items-center gap-2 opacity-60 flex-shrink-0 pt-1">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs uppercase font-bold tracking-widest">{t('settings.scanInProgress')}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <ThemedButton disabled={scanning} onClick={() => handleScan(true)} className="flex-1 h-12 text-xs">
                  {scanning ? <><Loader2 size={15} className="animate-spin" /> {t('settings.scanning')}</> : <><RefreshCw size={15} /> {t('settings.scanNew')}</>}
                </ThemedButton>
                <ThemedButton disabled={scanning} onClick={() => handleScan(false)} className="flex-1 h-12 text-xs">
                  {t('settings.scanAll')}
                </ThemedButton>
              </div>
            </div>
          )}
        </div>

        {/* ── Pomodoro ── */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8">
            <Timer size={28} />
            <Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.pomodoro')}</Label>
          </div>

          {/* Style toggle */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">{t('settings.pomodoroStyle')}</p>
            </div>
            <ThemedToggleGroup
              options={POMODORO_STYLE_OPTIONS}
              value={config.pomodoroStyle}
              onChange={(val) => updateConfig({ pomodoroStyle: val })}
            />
          </div>

          {/* Sessions per cycle */}
          <div className="flex items-center justify-between mb-8">
            <p className="text-sm font-bold uppercase tracking-widest">{t('settings.pomodoroSessions')}</p>
            <Stepper
              value={config.pomodoroSessions}
              min={1} max={8}
              onChange={(v) => updateConfig({ pomodoroSessions: v })}
            />
          </div>

          {/* Durations grid */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.pomodoroFocusMin')}</p>
              <Stepper
                value={config.pomodoroFocusMin}
                min={1} max={60} step={5}
                onChange={(v) => updateConfig({ pomodoroFocusMin: v })}
                suffix={minSuffix}
              />
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.pomodoroShortBreakMin')}</p>
              <Stepper
                value={config.pomodoroShortBreakMin}
                min={1} max={30} step={1}
                onChange={(v) => updateConfig({ pomodoroShortBreakMin: v })}
                suffix={minSuffix}
              />
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.pomodoroLongBreakMin')}</p>
              <Stepper
                value={config.pomodoroLongBreakMin}
                min={1} max={60} step={5}
                onChange={(v) => updateConfig({ pomodoroLongBreakMin: v })}
                suffix={minSuffix}
              />
            </div>
          </div>
        </div>

      </div>
      <div className="mt-20 pb-8 text-center opacity-20 text-xs uppercase tracking-[0.3em] font-bold">{t('footer.credit')}</div>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="bg-[var(--color-bg)] text-[var(--color-fg)] border border-current rounded-none shadow-none max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-bold uppercase tracking-widest">{t('dialog.audioFolder')}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('dialog.path')}</Label>
            <Input value={draftPath} onChange={(e) => setDraftPath(e.target.value)} placeholder={t('dialog.pathPlaceholder')}
              className="bg-transparent border-current rounded-none h-14 font-mono text-lg placeholder:opacity-30 focus:ring-0"
              onKeyDown={(e) => e.key === 'Enter' && handleFolderSave()} autoFocus />
            <p className="text-xs opacity-40 uppercase tracking-widest pt-1">{t('dialog.pathHint')}</p>
          </div>
          <DialogFooter className="flex gap-3 sm:justify-start">
            <ThemedButton variant="solid" onClick={handleFolderSave} className="flex-1 h-12 text-sm">{t('dialog.save')}</ThemedButton>
            <ThemedButton onClick={() => setFolderDialogOpen(false)} className="flex-1 h-12 text-sm">{t('dialog.cancel')}</ThemedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default SettingsPage;