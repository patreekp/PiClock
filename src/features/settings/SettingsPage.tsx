import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Clock, MapPin } from 'lucide-react';

const SettingsPage = () => {
  const { theme, toggleTheme, config, updateConfig } = useAppStore();

  return (
    <div className="h-full p-8 flex flex-col overflow-y-auto">
      <h2 className="text-4xl font-bold mb-8 uppercase tracking-tighter">Impostazioni</h2>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'light' ? <Sun size={24} /> : <Moon size={24} />}
            <div>
              <Label className="text-xl">Tema Scuro</Label>
              <p className="text-sm opacity-60">Inverti i colori per la notte</p>
            </div>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={24} />
            <div>
              <Label className="text-xl">Formato 24h</Label>
              <p className="text-sm opacity-60">Usa il formato militare</p>
            </div>
          </div>
          <Switch 
            checked={config.clock24h} 
            onCheckedChange={(val) => updateConfig({ clock24h: val })} 
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={24} className="opacity-40" />
            <div>
              <Label className="text-xl">Mostra Secondi</Label>
              <p className="text-sm opacity-60">Aggiornamento ogni secondo</p>
            </div>
          </div>
          <Switch 
            checked={config.showSeconds} 
            onCheckedChange={(val) => updateConfig({ showSeconds: val })} 
          />
        </div>

        <div className="pt-4 border-t border-current/20">
          <div className="flex items-center gap-3 mb-4">
            <MapPin size={24} />
            <Label className="text-xl">Posizione</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase opacity-60">Latitudine</span>
              <div className="text-lg font-mono">{config.lat}</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase opacity-60">Longitudine</span>
              <div className="text-lg font-mono">{config.lon}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8 text-center opacity-20 text-xs uppercase tracking-widest">
        RaspiClock v1.0.0
      </div>
    </div>
  );
};

export default SettingsPage;