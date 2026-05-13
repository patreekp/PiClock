import React, { useState, useEffect } from 'react';
import { useAlarmStore } from './useAlarmStore';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Bell, Trash2, X } from 'lucide-react';

const AlarmsPage = () => {
  const { alarms, fetchAlarms, addAlarm, toggleAlarm, deleteAlarm } = useAlarmStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTime, setNewTime] = useState('07:00');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    fetchAlarms();
  }, []);

  const handleAdd = () => {
    addAlarm(newTime, newLabel);
    setIsAdding(false);
    setNewLabel('');
  };

  return (
    <div className="h-full p-8 flex flex-col select-none">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold uppercase tracking-tighter">Sveglie</h2>
        {!isAdding && (
          <Button 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            className="border-current rounded-none h-12 px-6 hover:bg-current hover:text-background transition-colors uppercase tracking-widest text-xs font-bold"
          >
            <Plus size={18} className="mr-2" /> Nuova
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="mb-8 p-6 border border-current space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase font-bold tracking-widest">Nuova Sveglia</span>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="h-8 w-8">
              <X size={20} />
            </Button>
          </div>
          <div className="flex gap-4">
            <Input 
              type="time" 
              value={newTime} 
              onChange={(e) => setNewTime(e.target.value)}
              className="text-4xl font-mono-clock h-20 bg-transparent border-current rounded-none text-center"
            />
            <Input 
              placeholder="Etichetta (es. Lavoro)" 
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 h-20 bg-transparent border-current rounded-none text-xl placeholder:opacity-30"
            />
          </div>
          <Button onClick={handleAdd} className="w-full h-14 bg-current text-background rounded-none text-lg uppercase font-bold tracking-widest">
            Salva Sveglia
          </Button>
        </div>
      )}

      <div className="space-y-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {alarms.length === 0 && !isAdding && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 mt-[-40px]">
            <p className="text-2xl uppercase tracking-widest italic">Nessuna sveglia</p>
          </div>
        )}
        {alarms.map(alarm => (
          <div key={alarm.id} className="flex items-center justify-between border-b border-current/10 pb-6 group">
            <div className="flex-1">
              <div className="text-6xl font-mono-clock font-bold tracking-tighter">{alarm.time}</div>
              <div className="text-sm uppercase opacity-60 mt-2 tracking-widest font-medium">{alarm.label || 'Sveglia'}</div>
            </div>
            <div className="flex items-center gap-8">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => deleteAlarm(alarm.id)}
                className="opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
              >
                <Trash2 size={24} />
              </Button>
              <div className="flex items-center gap-4">
                <Bell size={28} className={alarm.enabled ? 'opacity-100' : 'opacity-10'} />
                <Switch 
                  checked={!!alarm.enabled} 
                  onCheckedChange={() => toggleAlarm(alarm)}
                  className="data-[state=checked]:bg-current data-[state=unchecked]:bg-current/10 h-8 w-14"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlarmsPage;
