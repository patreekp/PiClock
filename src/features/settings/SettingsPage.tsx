import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Moon, Sun, Clock, MapPin, Globe } from 'lucide-react';

const SettingsPage = () => {
  const { theme, toggleTheme, config, updateConfig } = useAppStore();

  return (
    <div className="h-full p-8 flex flex-col overflow-y-auto select-none custom-scrollbar">
      <h2 className="text-4xl font-bold mb-10 uppercase tracking-tighter">Impostazioni</h2>

      <div className="space-y-10">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
              {theme === 'light' ? <Sun size={28} /> : <Moon size={28} />}
            </div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Tema Scuro</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">Inverti i colori per la notte</p>
            </div>
          </div>
          <Switch 
            checked={theme === 'dark'} 
            onCheckedChange={toggleTheme} 
            className="h-8 w-14 data-[state=checked]:bg-current"
          />
        </div>

        {/* 24h Format */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
              <Clock size={28} />
            </div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Formato 24h</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">Usa il formato militare</p>
            </div>
          </div>
          <Switch 
            checked={config.clock24h} 
            onCheckedChange={(val) => updateConfig({ clock24h: val })} 
            className="h-8 w-14 data-[state=checked]:bg-current"
          />
        </div>

        {/* Show Seconds */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-5">
            <div className="p-3 border border-current/10 group-hover:border-current transition-colors">
              <Clock size={28} className="opacity-40" />
            </div>
            <div>
              <Label className="text-2xl font-bold uppercase tracking-tight">Mostra Secondi</Label>
              <p className="text-sm opacity-50 uppercase tracking-widest mt-1">Aggiornamento ogni secondo</p>
            </div>
          </div>
          <Switch 
            checked={config.showSeconds} 
            onCheckedChange={(val) => updateConfig({ showSeconds: val })} 
            className="h-8 w-14 data-[state=checked]:bg-current"
          />
        </div>

        {/* Location Settings */}
        <div className="pt-10 border-t border-current/10">
          <div className="flex items-center gap-4 mb-8">
            <MapPin size={28} />
            <Label className="text-2xl font-bold uppercase tracking-tight">Posizione & Meteo</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Latitudine</Label>
              <Input 
                value={config.lat} 
                onChange={(e) => updateConfig({ lat: e.target.value })}
                className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Longitudine</Label>
              <Input 
                value={config.lon} 
                onChange={(e) => updateConfig({ lon: e.target.value })}
                className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={18} className="opacity-50" />
              <Label className="text-xs uppercase opacity-50 font-bold tracking-widest">Fuso Orario</Label>
            </div>
            <Input 
              value={config.timezone} 
              onChange={(e) => updateConfig({ timezone: e.target.value })}
              className="bg-transparent border-current/20 rounded-none h-12 font-mono text-lg focus:border-current transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="mt-20 pb-8 text-center opacity-20 text-xs uppercase tracking-[0.3em] font-bold">
        RaspiClock — Progettato per Raspberry Pi
      </div>
    </div>
  );
};

export default SettingsPage;
