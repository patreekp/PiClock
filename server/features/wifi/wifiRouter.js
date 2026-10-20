import { Router } from 'express';
import { wifiService } from './wifiService.js';
import { getDb } from '../../db/database.js';
import { broadcast } from '../../sse.js';

export const wifiRouter = Router();

wifiRouter.get('/status', async (req, res) => {
  try { res.json(await wifiService.status()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

wifiRouter.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body ?? {};
    await wifiService.setEnabled(!!enabled);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ritorna l'ultimo risultato di scan in cache, senza avviarne uno nuovo —
// la UI lo usa per popolare la lista immediatamente all'apertura del tab.
wifiRouter.get('/networks', (req, res) => {
  res.json(wifiService.getScanState());
});

wifiRouter.post('/scan', async (req, res) => {
  res.json({ ok: true });
  try { await wifiService.scan(); }
  catch (e) { /* già notificato via broadcast wifi:scan-error dal service */ }
});

wifiRouter.post('/connect', async (req, res) => {
  const { ssid, password } = req.body ?? {};
  if (!ssid) return res.status(400).json({ error: 'ssid is required' });
  try {
    const connected = await wifiService.connect(ssid, password);
    res.json({ ok: true, connected });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

wifiRouter.post('/disconnect', async (req, res) => {
  try { await wifiService.disconnect(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

wifiRouter.get('/saved', async (req, res) => {
  try { res.json(await wifiService.listSaved()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

wifiRouter.delete('/saved/:ssid', async (req, res) => {
  try { await wifiService.forget(req.params.ssid); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

wifiRouter.post('/autoreconnect', async (req, res) => {
  try {
    const { enabled } = req.body ?? {};
    await wifiService.setAutoReconnect(!!enabled);

    getDb().prepare(
      `INSERT INTO config (key, value) VALUES ('wifiAutoReconnect', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(String(!!enabled));
    broadcast('config:changed', { wifiAutoReconnect: !!enabled });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
