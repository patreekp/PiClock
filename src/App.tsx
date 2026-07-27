import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AlarmModal from "./features/alarms/AlarmModal";
import RemoteApp from "./features/remote/RemoteApp";
import { useAppStore } from "./store/useAppStore";

const queryClient = new QueryClient();

// Overlay di oscuramento software — solo per il display principale (Pi).
// /remote è un dispositivo secondario (telefono) e non deve essere dimmato
// dalla luminosità impostata per lo schermo del Pi.
const BrightnessOverlay = () => {
  const brightness = useAppStore((s) => s.config.brightness);
  const opacity = Math.max(0, (100 - brightness) / 100);
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#000',
        opacity,
        pointerEvents: 'none',
        zIndex: 40,
        transition: 'opacity 0.3s ease',
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