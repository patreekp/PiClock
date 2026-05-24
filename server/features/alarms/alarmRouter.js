import { Router } from 'express';
import { getDb } from '../../db/database.js';
import {
  rescheduleAlarm,
  cancelAlarm,
  addSseClient,
  stopAlarmAudio,
  emitAlarmStopped,
  snoozeAlarm,
} from './alarmService.js';

export const alarmsRouter = Router();

// ── SSE endpoint ──────────────────────────────────────────────────────────────
alarmsRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  addSseClient(res);
});

// ── Stop active alarm ─────────────────────────────────────────────────────────
alarmsRouter.post('/:id/stop', (req, res) => {
  try {
    stopAlarmAudio();
    emitAlarmStopped();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to stop alarm' });
  }
});

// ── Snooze active alarm ───────────────────────────────────────────────────────
alarmsRouter.post('/:id/snooze', (req, res) => {
  try {
    const alarm = getDb().prepare('SELECT * FROM alarms WHERE id = ?').get(req.params.id);
    if (!alarm) return res.status(404).json({ error: 'Alarm not found' });
    snoozeAlarm(alarm);
    emitAlarmStopped(); // close the modal on the frontend
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to snooze alarm' });
  }
});

// ── CRUD ──────────────────────────────────────────────────────────────────────
alarmsRouter.get('/', (req, res) => {
  try { res.json(getDb().prepare('SELECT id, time, label, enabled FROM alarms ORDER BY time ASC').all()); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch alarms' }); }
});

alarmsRouter.post('/', (req, res) => {
  try {
    const { time, label = '', enabled = true } = req.body;
    if (!time) return res.status(400).json({ error: 'time is required' });
    const result = getDb().prepare('INSERT INTO alarms (time, label, enabled) VALUES (?, ?, ?)').run(time, label, enabled ? 1 : 0);
    const alarm = { id: result.lastInsertRowid, time, label, enabled: enabled ? 1 : 0 };
    rescheduleAlarm(alarm);
    res.status(201).json(alarm);
  } catch (e) { res.status(500).json({ error: 'Failed to create alarm' }); }
});

alarmsRouter.put('/:id', (req, res) => {
  try {
    const { time, label, enabled } = req.body;
    getDb().prepare('UPDATE alarms SET time = ?, label = ?, enabled = ? WHERE id = ?').run(time, label, enabled ? 1 : 0, req.params.id);
    const alarm = { id: Number(req.params.id), time, label, enabled: enabled ? 1 : 0 };
    rescheduleAlarm(alarm);
    res.json(alarm);
  } catch (e) { res.status(500).json({ error: 'Failed to update alarm' }); }
});

alarmsRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    cancelAlarm(id);
    getDb().prepare('DELETE FROM alarms WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete alarm' }); }
});