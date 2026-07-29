import { Router } from 'express';
import { getDb } from '../../db/database.js';
import { broadcast } from '../../sse.js';

export const configRouter = Router();

// GET /api/config — returns all config as a flat key-value object
// Shape expected by useAppStore.fetchConfig():
// { lat, lon, timezone, clock24h, showSeconds, theme, alarmFolder }
configRouter.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT key, value FROM config').all();
    const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(config);
  } catch (e) {
    console.error('GET /api/config error:', e);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/config — accepts partial updates, e.g. { theme: 'dark' }
configRouter.put('/', (req, res) => {
  try {
    const updates = req.body;
    const upsert = getDb().prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    const updateMany = getDb().transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });

    updateMany(Object.entries(updates));

    // Propaga a tutti i client connessi (Pi + eventuali /remote aperti)
    // con i valori "come inviati" dal client (tipi JS originali, non stringificati),
    // così il consumer lato client non deve fare parsing.
    broadcast('config:changed', updates);

    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/config error:', e);
    res.status(500).json({ error: 'Failed to update config' });
  }
});