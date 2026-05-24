import { Router } from 'express';
import { getDb } from '../../db/database.js';

export const clockRouter = Router();

// GET /api/clock — returns current server time in the configured timezone
clockRouter.get('/', (req, res) => {
  try {
    const row = getDb().prepare(`SELECT value FROM config WHERE key = 'timezone'`).get();
    const timezone = row?.value ?? 'Europe/Rome';
    res.json({
      iso: new Date().toISOString(),
      timezone,
    });
  } catch (e) {
    console.error('GET /api/clock error:', e);
    res.status(500).json({ error: 'Failed to get clock' });
  }
});
