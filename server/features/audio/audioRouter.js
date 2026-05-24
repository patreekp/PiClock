import { Router } from 'express';
import { scanAudioLibrary, getScanStatus, stopScan, addEventSseClient } from './audioLibraryService.js';

export const audioRouter = Router();

// SSE — canale generico eventi (library:*, future notifiche)
audioRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  addEventSseClient(res);
});

// Stato corrente della libreria
audioRouter.get('/status', (req, res) => {
  try {
    res.json(getScanStatus());
  } catch (e) {
    res.status(500).json({ error: 'Failed to get audio library status' });
  }
});

// Avvia scansione — onlyNew=true di default, onlyNew=false per riscansione completa
audioRouter.post('/scan', async (req, res) => {
  const { onlyNew = true } = req.body ?? {};
  // Risponde subito — la scan gira in background
  res.json({ ok: true, message: 'Scan avviato' });
  // Fire & forget
  scanAudioLibrary({ onlyNew }).catch(e => {
    console.error('[AudioRouter] Scan error:', e.message);
  });
});

// Interrompi scan in corso
audioRouter.post('/scan/stop', (req, res) => {
  stopScan();
  res.json({ ok: true });
});