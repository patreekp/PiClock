import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AlarmModal from "./features/alarms/AlarmModal";
import RemoteApp from "./features/remote/RemoteApp";
import { useAppStore } from "./store/useAppStore";

const queryClient = new QueryClient();

// Schedule fisso (non ancora configurabile) — notte 23:30 → 05:00.
const NIGHT_START_MIN = 23 * 60 + 30;
const NIGHT_END_MIN = 5 * 60;

function computeEffectiveBrightness(mode: 'manual' | 'auto', day: number, night: number): number {
  if (mode !== 'auto') return day;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isNight = minutes >= NIGHT_START_MIN || minutes < NIGHT_END_MIN;
  return isNight ? night : day;
}

// Overlay di oscuramento software — solo per il display principale (Pi).
// /remote è un dispositivo secondario (telefono) e non va dimmato insieme al Pi.
const BrightnessOverlay = () => {
  const brightnessMode = useAppStore((s) => s.config.brightnessMode);
  const brightnessDay = useAppStore((s) => s.config.brightness);
  const brightnessNight = useAppStore((s) => s.config.brightnessNight);
  const [effective, setEffective] = useState(brightnessDay);

  useEffect(() => {
    const update = () => setEffective(computeEffectiveBrightness(brightnessMode, brightnessDay, brightnessNight));
    update();
    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, [brightnessMode, brightnessDay, brightnessNight]);

  const opacity = Math.max(0, (100 - effective) / 100);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#000',
        opacity,
        pointerEvents: 'none',
        zIndex: 40,
        transition: 'opacity 0.6s ease',
      }}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<><Index /><BrightnessOverlay /></>} />
          <Route path="/remote" element={<RemoteApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      {/* Global alarm overlay — listens to SSE, renders above everything (anche sopra BrightnessOverlay) */}
      <AlarmModal />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;