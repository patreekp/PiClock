import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n/useTranslation';
import { onSseEvent } from '../../lib/sseHub';
import type { ThemeMode, HighlightMode, Language, PomodoroStyle, BrightnessMode } from '../../store/useAppStore';
import { useWifiStore, type WifiNetwork, type WifiConnectError } from '../../store/useWifiStore';
import { VirtualKeyboard } from '../wifi/VirtualKeyboard';
import { AudioLibraryManager } from '../audio/AudioLibraryManager';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Moon, Sun, Clock, MapPin, Globe, Pencil, SunMoon, AlarmClock, Music,
  Loader2, RefreshCw, Languages, Timer, Volume2, Cpu,
  Wifi, WifiOff, Lock, Eye, EyeOff, Folder,
} from 'lucide-react';
import { ThemedSwitch, ThemedToggleGroup, ThemedButton, ThemedSlider } from '@/components/ui-themed';
import type { ToggleOption } from '@/components/ui-themed';

interface LibraryStatus { total: number; scanned: number; pending: number; lastScan: string | null; scanInProgress: boolean; }

type SettingsTab = 'appearance' | 'audio' | 'weather' | 'pomodoro' | 'network' | 'system';

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
  const { theme, setTheme, config, updateConfig, updateConfigLocal, setLanguage, setNotification } = useAppStore();
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [draftPath, setDraftPath] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [scanning, setScanning] = useState(false);

  const wifi = useWifiStore();
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [wifiPendingSsid, setWifiPendingSsid] = useState<string | null>(null);
  const [wifiPasswordDraft, setWifiPasswordDraft] = useState('');
  const [wifiShowPassword, setWifiShowPassword] = useState(false);
  const [wifiConnectError, setWifiConnectError] = useState<WifiConnectError | null>(null);

  useEffect(() => { wifi.connect(); wifi.fetchSaved(); }, []);
  useEffect(() => {
    if (activeTab === 'network' && wifi.supported && wifi.enabled && wifi.networks.length === 0 && !wifi.scanning) {
      wifi.scan();
    }
  }, [activeTab, wifi.supported, wifi.enabled]);

  const wifiKnownSsids = new Set(wifi.saved.map(s => s.ssid));
  const wifiSavedNotInRange = wifi.saved.filter(s => !wifi.networks.some(n => n.ssid === s.ssid));

  const handleWifiNetworkClick = async (net: WifiNetwork) => {
    if (net.active || wifi.connectingSsid) return;
    if (net.secured && !wifiKnownSsids.has(net.ssid)) {
      setWifiPendingSsid(net.ssid);
      setWifiPasswordDraft('');
      setWifiShowPassword(false);
      setWifiConnectError(null);
      setWifiDialogOpen(true);
      return;
    }
    const result = await wifi.connectToNetwork(net.ssid);
    if (result.ok) wifi.fetchSaved();
    else setNotification(t(`wifi.error.${result.error}`), 5000);
  };

  const handleWifiDialogSubmit = async () => {
    if (!wifiPendingSsid) return;
    const result = await wifi.connectToNetwork(wifiPendingSsid, wifiPasswordDraft);
    if (result.ok) { setWifiDialogOpen(false); wifi.fetchSaved(); }
    else setWifiConnectError(result.error ?? 'connectFailed');
  };

  const handleAutoReconnect = async (enabled: boolean) => {
    updateConfigLocal({ wifiAutoReconnect: enabled });
    try {
      await fetch('/api/wifi/autoreconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
      });
    } catch (e) { console.error('Failed to set wifi autoreconnect', e); }
  };


  const TAB_OPTIONS: ToggleOption<SettingsTab>[] = [
    { value: 'appearance', label: t('settings.tab.appearance'), icon: <SunMoon size={16} /> },
    { value: 'audio',      label: t('settings.tab.audio'),      icon: <Music size={16} /> },
    { value: 'weather',    label: t('settings.tab.weather'),    icon: <MapPin size={16} /> },
    { value: 'pomodoro',   label: t('settings.pomodoro'),       icon: <Timer size={16} /> },
    { value: 'network',    label: t('settings.tab.network'),    icon: <Wifi size={16} /> },
    { value: 'system',     label: t('settings.tab.system'),     icon: <Cpu size={16} /> },
  ];

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
  
  const BRIGHTNESS_MODE_OPTIONS: ToggleOption<BrightnessMode>[] = [
    { value: 'manual', label: t('settings.brightnessModeManual') },
    { value: 'auto',   label: t('settings.brightnessModeAuto') },
  ];

  const fetchLibraryStatus = async () => {
    try { const res = await fetch('/api/audio/status'); const data = await res.json(); setLibraryStatus(data); setScanning(data.scanInProgress); } catch (_) {}
  };

  useEffect(() => { fetchLibraryStatus(); const interval = setInterval(fetchLibraryStatus, 3000); return () => clearInterval(interval); }, []);

  // Hub SSE consolidato — niente più EventSource dedicati per feature.
  useEffect(() => {
    const offStart = onSseEvent('library:scan-start', () => setScanning(true));
    const offDone = onSseEvent('library:scan-done', () => { setScanning(false); fetchLibraryStatus(); });
    const offError = onSseEvent('library:scan-error', () => { setScanning(false); fetchLibraryStatus(); });
    return () => { offStart(); offDone(); offError(); };
  }, []);

  const [cpuTemp, setCpuTemp] = useState<number | null>(null);

  useEffect(() => {
    const fetchTemp = async () => {
      try {
        const res = await fetch('/api/system/info');
        const data = await res.json();
        setCpuTemp(data.cpuTemp);
      } catch (_) {}
    };
    fetchTemp();
    const interval = setInterval(fetchTemp, 5000);
    return () => clearInterval(interval);
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
      <div className="flex items-start justify-between mb-8">
        <h2 className="text-4xl font-bold uppercase tracking-tighter">{t('settings.title')}</h2>
        {cpuTemp !== null && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: '2px', opacity: 0.55,
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-fg)' }}>
              CPU
            </span>
            <span style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1, color: 'var(--color-fg)', fontVariantNumeric: 'tabular-nums' }}>
              {cpuTemp.toFixed(1)}°
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
<ThemedToggleGroup options={TAB_OPTIONS} value={activeTab} onChange={(val) => setActiveTab(val)} className="mb-10" />
      <div className="space-y-10">

        {/* ── Aspetto ── */}
        {activeTab === 'appearance' && (
          <>
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

            {/* Brightness */}
            <div className="group">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-5">
                  <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Sun size={28} className="opacity-40" /></div>
                  <div>
                    <Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.brightness')}</Label>
                    <p className="text-sm opacity-50 uppercase tracking-widest mt-1">
                      {config.brightnessMode === 'auto' ? t('settings.brightnessAutoDesc') : t('settings.brightnessDesc')}
                    </p>
                  </div>
                </div>
                <ThemedToggleGroup
                  options={BRIGHTNESS_MODE_OPTIONS}
                  value={config.brightnessMode}
                  onChange={(val) => updateConfig({ brightnessMode: val })}
                />
              </div>

              {config.brightnessMode === 'manual' ? (
                <div className="flex items-center gap-3 pl-16">
                  <ThemedSlider
                    showSteppers
                    value={config.brightness} min={20} max={100}
                    onChange={(v) => updateConfigLocal({ brightness: v })}
                    onChangeEnd={(v) => updateConfig({ brightness: v })}
                  />
                  <span className="text-sm font-mono w-12 text-right opacity-70 flex-shrink-0">{config.brightness}%</span>
                </div>
              ) : (
                <div className="pl-16 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase opacity-50 font-bold tracking-widest w-14 flex-shrink-0">{t('settings.brightnessDay')}</span>
                    <ThemedSlider
                      showSteppers
                      value={config.brightness} min={20} max={100}
                      onChange={(v) => updateConfigLocal({ brightness: v })}
                      onChangeEnd={(v) => updateConfig({ brightness: v })}
                    />
                    <span className="text-sm font-mono w-12 text-right opacity-70 flex-shrink-0">{config.brightness}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase opacity-50 font-bold tracking-widest w-14 flex-shrink-0">{t('settings.brightnessNight')}</span>
                    <ThemedSlider
                      showSteppers
                      value={config.brightnessNight} min={10} max={100}
                      onChange={(v) => updateConfigLocal({ brightnessNight: v })}
                      onChangeEnd={(v) => updateConfig({ brightnessNight: v })}
                    />
                    <span className="text-sm font-mono w-12 text-right opacity-70 flex-shrink-0">{config.brightnessNight}%</span>
                  </div>
                </div>
              )}
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
          </>
        )}

        {/* ── Audio ── */}
        {activeTab === 'audio' && (
          <>
            <div>
              <div className="flex items-center gap-4 mb-8"><AlarmClock size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.audio')}</Label></div>

              {/* Volume */}
              <div className="flex items-center gap-3 w-64">
                  <Volume2 size={18} className="opacity-40 flex-shrink-0" />
                  <ThemedSlider
                    showSteppers
                    value={config.volume} min={0} max={100}
                    onChange={(v) => updateConfigLocal({ volume: v })}
                    onChangeEnd={(v) => updateConfig({ volume: v })}
                  />
                  <span className="text-sm font-mono w-12 text-right opacity-70 flex-shrink-0">{config.volume}%</span>
                </div>
                
              <div className="flex items-center justify-between gap-6 mb-8">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-2">{t('settings.audioFolder')}</p>
                  <p className="font-mono text-base truncate opacity-80">{config.alarmFolder}</p>
                </div>
                <ThemedButton onClick={openFolderDialog} className="h-12 px-5 text-xs flex-shrink-0"><Pencil size={15} /> {t('settings.audioFolderEdit')}</ThemedButton>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('settings.snooze')}</p>
                <ThemedToggleGroup options={SNOOZE_OPTIONS} value={config.snoozeMinutes} onChange={(val) => updateConfig({ snoozeMinutes: val })} />
              </div>
            </div>

            {/* Song Highlights */}
            <div className="pt-10 border-t border-current/10">
              <div className="flex items-center gap-4 mb-8"><Music size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.highlights')}</Label></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest">{t('settings.highlightsMode')}</p>
                  <p className="text-xs opacity-50 uppercase tracking-widest mt-1">{highlightDesc}</p>
                </div>
                <ThemedToggleGroup options={HIGHLIGHT_OPTIONS} value={config.highlightMode} onChange={(val) => updateConfig({ highlightMode: val })} />
              </div>
            </div>
          </>
        )}

        {/* ── Meteo & Posizione ── */}
        {activeTab === 'weather' && (
          <div>
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
        )}

        {/* ── Pomodoro ── */}
        {activeTab === 'pomodoro' && (
          <div>
            <div className="flex items-center gap-4 mb-8">
              <Timer size={28} />
              <Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.pomodoro')}</Label>
            </div>

            <div className="flex items-center justify-between mb-8">
              <p className="text-sm font-bold uppercase tracking-widest">{t('settings.pomodoroStyle')}</p>
              <ThemedToggleGroup
                options={POMODORO_STYLE_OPTIONS}
                value={config.pomodoroStyle}
                onChange={(val) => updateConfig({ pomodoroStyle: val })}
              />
            </div>

            <div className="flex items-center justify-between mb-8">
              <p className="text-sm font-bold uppercase tracking-widest">{t('settings.pomodoroSessions')}</p>
              <Stepper
                value={config.pomodoroSessions}
                min={1} max={8}
                onChange={(v) => updateConfig({ pomodoroSessions: v })}
              />
            </div>

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
        )}

        {/* ── Rete ── */}
        {activeTab === 'network' && (
          <div>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-5">
                <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
                  {wifi.enabled ? <Wifi size={28} /> : <WifiOff size={28} className="opacity-40" />}
                </div>
                <div>
                  <Label className="text-2xl font-bold uppercase tracking-tight">{t('wifi.title')}</Label>
                  <p className="text-sm opacity-50 uppercase tracking-widest mt-1">
                    {!wifi.supported ? t('wifi.unsupported') : wifi.enabled ? t('wifi.enabledDesc') : t('wifi.disabledDesc')}
                  </p>
                </div>
              </div>
              {wifi.supported && <ThemedSwitch checked={wifi.enabled} onCheckedChange={wifi.toggleEnabled} />}
            </div>

            {!wifi.supported && wifi.reason && (
              <p className="text-xs opacity-40 uppercase tracking-widest mt-3 pl-16">{wifi.reason}</p>
            )}

            {wifi.supported && wifi.enabled && (
              <div className="mt-10 space-y-10">
                {wifi.connected && (
                  <div className="flex items-center justify-between gap-4 p-4 border border-current/10">
                    <div>
                      <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-1">{t('wifi.connectedTo')}</p>
                      <p className="text-lg font-bold">{wifi.connected.ssid}</p>
                      {wifi.connected.ip && <p className="text-xs opacity-40 font-mono mt-1">{wifi.connected.ip}</p>}
                    </div>
                    <ThemedButton onClick={wifi.disconnect} className="h-11 px-5 text-xs flex-shrink-0">{t('wifi.disconnect')}</ThemedButton>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-widest">{t('wifi.autoReconnect')}</p>
                    <p className="text-xs opacity-50 uppercase tracking-widest mt-1">{t('wifi.autoReconnectDesc')}</p>
                  </div>
                  <ThemedSwitch checked={config.wifiAutoReconnect} onCheckedChange={handleAutoReconnect} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('wifi.available')}</p>
                    <ThemedButton disabled={wifi.scanning} onClick={wifi.scan} className="h-10 px-4 text-xs">
                      {wifi.scanning ? <><Loader2 size={14} className="animate-spin" /> {t('wifi.scanning')}</> : <><RefreshCw size={14} /> {t('wifi.scan')}</>}
                    </ThemedButton>
                  </div>
                  <div className="space-y-2">
                    {wifi.networks.length === 0 && !wifi.scanning && (
                      <p className="text-sm opacity-40 uppercase tracking-widest">{t('wifi.noNetworks')}</p>
                    )}
                    {wifi.networks.map((net) => (
                      <button
                        key={net.ssid}
                        onClick={() => handleWifiNetworkClick(net)}
                        disabled={!!wifi.connectingSsid}
                        className="w-full flex items-center justify-between gap-4 p-3 border border-current/10 hover:border-current transition-colors text-left disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {net.secured && <Lock size={14} className="opacity-50 flex-shrink-0" />}
                          <span className="font-bold truncate">{net.ssid}</span>
                          {net.active && <span className="text-[10px] uppercase opacity-50 tracking-widest flex-shrink-0">{t('wifi.connectedTo')}</span>}
                        </div>
                        <div className="flex items-center gap-2 opacity-50 flex-shrink-0">
                          {wifi.connectingSsid === net.ssid ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs font-mono">{net.signal}%</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {wifiSavedNotInRange.length > 0 && (
                  <div>
                    <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-4">{t('wifi.saved')}</p>
                    <div className="space-y-2">
                      {wifiSavedNotInRange.map((s) => (
                        <div key={s.ssid} className="flex items-center justify-between gap-4 p-3 border border-current/10">
                          <span className="font-bold truncate">{s.ssid}</span>
                          <ThemedButton onClick={() => wifi.forget(s.ssid)} className="h-9 px-4 text-xs flex-shrink-0">{t('wifi.forget')}</ThemedButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Sistema ── */}
        {activeTab === 'system' && (
          <div>
            <div className="flex items-center gap-4 mb-8"><Cpu size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('settings.library')}</Label></div>

            {config.highlightMode === 'off' ? (
              <p className="text-sm opacity-50 uppercase tracking-widest">{t('settings.libraryDisabledHint')}</p>
            ) : (
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

            <div className="mt-10 pt-10 border-t border-current/10">
              <div className="flex items-center gap-4 mb-8"><Folder size={28} /><Label className="text-2xl font-bold uppercase tracking-tight">{t('library.title')}</Label></div>
              <AudioLibraryManager />
            </div>
          </div>
        )}

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

      {/* WiFi Password Dialog */}
      <Dialog open={wifiDialogOpen} onOpenChange={(open) => { setWifiDialogOpen(open); if (!open) setWifiPendingSsid(null); }}>
        <DialogContent className="bg-[var(--color-bg)] text-[var(--color-fg)] border border-current rounded-none shadow-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-widest truncate">{wifiPendingSsid}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">{t('wifi.enterPassword')}</Label>
            <div className="relative">
              <Input
                value={wifiPasswordDraft}
                readOnly
                type={wifiShowPassword ? 'text' : 'password'}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                placeholder={t('wifi.password')}
                className="bg-transparent border-current rounded-none h-14 font-mono text-lg placeholder:opacity-30 focus-visible:ring-0 pr-12"
              />
              <button
                type="button"
                onClick={() => setWifiShowPassword(!wifiShowPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="toggle password visibility"
              >
                {wifiShowPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {wifiConnectError && (
              <p className="text-xs uppercase tracking-widest" style={{ color: '#c0392b' }}>{t(`wifi.error.${wifiConnectError}`)}</p>
            )}
            <VirtualKeyboard value={wifiPasswordDraft} onChange={setWifiPasswordDraft} onSubmit={handleWifiDialogSubmit} />
          </div>
          <DialogFooter className="flex gap-3 sm:justify-start">
            <ThemedButton
              variant="solid"
              disabled={!!wifi.connectingSsid}
              onClick={handleWifiDialogSubmit}
              className="flex-1 h-12 text-sm"
            >
              {wifi.connectingSsid ? <><Loader2 size={15} className="animate-spin" /> {t('wifi.connecting')}</> : t('wifi.connect')}
            </ThemedButton>
            <ThemedButton onClick={() => setWifiDialogOpen(false)} className="flex-1 h-12 text-sm">{t('dialog.cancel')}</ThemedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default SettingsPage;