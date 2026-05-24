import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ThemeMode, HighlightMode } from '../../store/useAppStore';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Moon, Sun, Clock, MapPin, Globe, Pencil, SunMoon, AlarmClock, Music, Loader2, RefreshCw } from 'lucide-react';
import { ThemedSwitch, ThemedToggleGroup, ThemedButton } from '@/components/ui-themed';
import type { ToggleOption } from '@/components/ui-themed';

const THEME_OPTIONS: ToggleOption<ThemeMode>[] = [
  { value: 'light', label: 'Chiaro', icon: <Sun size={18} /> },
  { value: 'dark',  label: 'Scuro',  icon: <Moon size={18} /> },
  { value: 'auto',  label: 'Auto',   icon: <SunMoon size={18} /> },
];

const HIGHLIGHT_OPTIONS: ToggleOption<HighlightMode>[] = [
  { value: 'off',     label: 'Off' },
  { value: 'local',   label: 'Locale' },
  { value: 'audjust', label: 'Audjust', disabled: true },
];

const SNOOZE_OPTIONS: ToggleOption<number>[] = [
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 10, label: '10 min' },
];

interface LibraryStatus {
  total: number;
  scanned: number;
  pending: number;
  lastScan: string | null;
  scanInProgress: boolean;
}

const SettingsPage = () => {
  const { theme, setTheme, config, updateConfig } = useAppStore();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [draftPath, setDraftPath] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [scanning, setScanning] = useState(false);

  const fetchLibraryStatus = async () => {
    try {
      const res = await fetch('/api/audio/status');
      const data = await res.json();
      setLibraryStatus(data);
      setScanning(data.scanInProgress);
    } catch (_) {}
  };

  useEffect(() => {
    fetchLibraryStatus();
    const interval = setInterval(fetchLibraryStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/audio/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'library:scan-start') setScanning(true);
        if (msg.type === 'library:scan-done' || msg.type === 'library:scan-error') {
          setScanning(false);
          fetchLibraryStatus();
        }
      } catch (_) {}
    };
    return () => es.close();
  }, []);

  const handleScan = async (onlyNew: boolean) => {
    setScanning(true);
    try {
      await fetch('/api/audio/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyNew }),
      });
    } catch (_) { setScanning(false); }
  };

  const openFolderDialog = () => { setDraftPath(config.alarmFolder); setFolderDialogOpen(true); };
  const handleFolderSave = () => {
    const trimmed = draftPath.trim();
    if (trimmed) updateConfig({ alarmFolder: trimmed });
    setFolderDialogOpen(false);
  };

  const lastScanLabel = libraryStatus?.lastScan
    ? new Date(libraryStatus.lastScan + 'Z').toLocaleDateString('it-IT', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : 'Mai';

  return (
    <div className="h-full p-8 flex flex-col overflow-y-auto select-none custom-scrollbar">
      <h2 className="text-4xl font-bold mb-10 uppercase tracking-tighter">Impostazioni</h2>
      <div className="space-y-10">

        {/* Tema */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
              {theme === 'dark' ? <Moon size={28} /> : theme === 'auto' ? <SunMoon size={28} /> : <Sun size={28} />}
            </div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Tema</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">
                {theme === 'auto' ? 'Segue alba e tramonto' : theme === 'dark' ? 'Modalità notte attiva' : 'Modalità giorno attiva'}
              </p>
            </div>
          </div>
          <ThemedToggleGroup options={THEME_OPTIONS} value={theme} onChange={setTheme} />
        </div>

        {/* Formato 24h */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Clock size={28} /></div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Formato 24h</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">Usa il formato militare</p>
            </div>
          </div>
          <ThemedSwitch checked={config.clock24h} onCheckedChange={(val) => updateConfig({ clock24h: val })} />
        </div>

        {/* Mostra Secondi */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors"><Clock size={28} className="opacity-40" /></div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Mostra Secondi</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">Aggiornamento ogni secondo</p>
            </div>
          </div>
          <ThemedSwitch checked={config.showSeconds} onCheckedChange={(val) => updateConfig({ showSeconds: val })} />
        </div>

        {/* Posizione & Meteo */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8">
            <MapPin size={28} />
            <Label className="text-2xl font-bold uppercase tracking-tight">Posizione & Meteo</Label>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Latitudine</Label>
              <Input value={config.lat} onChange={(e) => updateConfig({ lat: e.target.value })}
                className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" />
            </div>
            <div className="space-y-3">
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Longitudine</Label>
              <Input value={config.lon} onChange={(e) => updateConfig({ lon: e.target.value })}
                className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" />
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={18} className="opacity-50" />
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Fuso Orario</Label>
            </div>
            <Input value={config.timezone} onChange={(e) => updateConfig({ timezone: e.target.value })}
              className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors" />
          </div>
        </div>

        {/* Audio & Sveglie */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8">
            <AlarmClock size={28} />
            <Label className="text-2xl font-bold uppercase tracking-tight">Audio & Sveglie</Label>
          </div>

          {/* Cartella audio */}
          <div className="flex items-center justify-between gap-6 mb-8">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-2">Cartella Audio</p>
              <p className="font-mono text-base truncate opacity-80">{config.alarmFolder}</p>
            </div>
            <ThemedButton onClick={openFolderDialog} className="h-12 px-5 text-xs flex-shrink-0">
              <Pencil size={15} /> Modifica
            </ThemedButton>
          </div>

          {/* Durata snooze */}
          <div className="mb-10">
            <p className="text-xs uppercase opacity-50 font-bold tracking-widest mb-4">Durata Snooze</p>
            <ThemedToggleGroup
              options={SNOOZE_OPTIONS}
              value={config.snoozeMinutes}
              onChange={(val) => updateConfig({ snoozeMinutes: val })}
            />
          </div>
        </div>

        {/* Song Highlights */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8">
            <Music size={28} />
            <Label className="text-2xl font-bold uppercase tracking-tight">Song Highlights</Label>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">Modalità</p>
              <p className="text-xs opacity-50 uppercase tracking-widest mt-1">
                {config.highlightMode === 'off'
                  ? 'Riproduzione dall\'inizio'
                  : config.highlightMode === 'local'
                  ? 'Analisi locale con ffmpeg'
                  : 'Analisi cloud con Audjust'}
              </p>
            </div>
            <ThemedToggleGroup
              options={HIGHLIGHT_OPTIONS}
              value={config.highlightMode}
              onChange={(val) => updateConfig({ highlightMode: val })}
            />
          </div>

          {config.highlightMode !== 'off' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 p-4 border border-current/10">
                <div className="space-y-1">
                  <p className="text-xs uppercase opacity-50 font-bold tracking-widest">Stato Libreria</p>
                  {libraryStatus ? (
                    <>
                      <p className="text-sm font-bold">
                        {libraryStatus.scanned} / {libraryStatus.total} brani analizzati
                      </p>
                      {libraryStatus.pending > 0 && (
                        <p className="text-xs opacity-50 uppercase tracking-widest">
                          {libraryStatus.pending} in attesa
                        </p>
                      )}
                      <p className="text-xs opacity-40 uppercase tracking-widest">
                        Ultima scansione: {lastScanLabel}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm opacity-40">Caricamento...</p>
                  )}
                </div>
                {scanning && (
                  <div className="flex items-center gap-2 opacity-60 flex-shrink-0 pt-1">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs uppercase font-bold tracking-widest">In corso</span>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <ThemedButton
                  disabled={scanning}
                  onClick={() => handleScan(true)}
                  className="flex-1 h-12 text-xs"
                >
                  {scanning
                    ? <><Loader2 size={15} className="animate-spin" /> Analisi in corso...</>
                    : <><RefreshCw size={15} /> Scansiona nuovi</>}
                </ThemedButton>
                <ThemedButton
                  disabled={scanning}
                  onClick={() => handleScan(false)}
                  className="flex-1 h-12 text-xs"
                >
                  Riscansiona tutto
                </ThemedButton>
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="mt-20 pb-8 text-center opacity-20 text-xs uppercase tracking-[0.3em] font-bold">
        PiClock — Progettato per Raspberry Pi
      </div>

      {/* Dialog cartella audio */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="bg-[var(--color-bg)] text-[var(--color-fg)] border border-current rounded-none shadow-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-widest">Cartella Audio</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Percorso</Label>
            <Input value={draftPath} onChange={(e) => setDraftPath(e.target.value)}
              placeholder="/media/alarms"
              className="bg-transparent border-current rounded-none h-14 font-mono text-lg placeholder:opacity-30 focus:ring-0"
              onKeyDown={(e) => e.key === 'Enter' && handleFolderSave()} autoFocus />
            <p className="text-xs opacity-40 uppercase tracking-widest pt-1">File supportati: .mp3 .ogg .wav</p>
          </div>
          <DialogFooter className="flex gap-3 sm:justify-start">
            <ThemedButton variant="solid" onClick={handleFolderSave} className="flex-1 h-12 text-sm">
              Salva
            </ThemedButton>
            <ThemedButton onClick={() => setFolderDialogOpen(false)} className="flex-1 h-12 text-sm">
              Annulla
            </ThemedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;