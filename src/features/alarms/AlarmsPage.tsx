import React, { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Bell } from 'lucide-react';

const AlarmsPage = () => {
  const [alarms, setAlarms] = useState([
    { id: 1, time: '07:30', label: 'Sveglia', enabled: true },
    { id: 2, time: '08:15', label: 'Lavoro', enabled: false },
  ]);

  return (
    <div className="h-full p-8 flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold uppercase tracking-tighter">Sveglie</h2>
        <Button variant="outline" className="border-current rounded-none">
          <Plus size={20} className="mr-2" /> Nuova
        </Button>
      </div>

      <div className="space-y-6">
        {alarms.map(alarm => (
          <div key={alarm.id} className="flex items-center justify-between border-b border-current pb-6">
            <div>
              <div className="text-5xl font-mono-clock font-bold">{alarm.time}</div>
              <div className="text-sm uppercase opacity-60 mt-1">{alarm.label}</div>
            </div>
            <div className="flex items-center gap-4">
              <Bell size={24} className={alarm.enabled ? 'opacity-100' : 'opacity-20'} />
              <Switch 
                checked={alarm.enabled} 
                onCheckedChange={() => {
                  setAlarms(alarms.map(a => a.id === alarm.id ? { ...a, enabled: !a.enabled } : a));
                }}
                className="data-[state=checked]:bg-current"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlarmsPage;