import { Router } from 'express';
import { getDb } from '../../db/database.js';
import {
  rescheduleAlarm,
  cancelAlarm,
  addSseClient,
  stopAlarmAudio,
  emitAlarmStopped,
  emitAlarmsChanged,
  snoozeAlarm,
} from './alarmService.js';

export const alarmsRouter = Router();

// ── SSE endpoint ──────────────────────────────────────────────────────────────
alarmsRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

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
  try {
    const rows = getDb()
      .prepare('SELECT id, time, label, enabled, days, skip_next FROM alarms ORDER BY time ASC')
      .all();
    const alarms = rows.map(r => ({
      ...r,
      days: JSON.parse(r.days || '[]'),
      skip_next: r.skip_next === 1,
    }));
    res.json(alarms);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch alarms' }); }
});

alarmsRouter.post('/', (req, res) => {
  try {
    const { time, label = '', enabled = true, days = [] } = req.body;
    if (!time) return res.status(400).json({ error: 'time is required' });
    const daysJson = JSON.stringify(days);
    const result = getDb()
      .prepare('INSERT INTO alarms (time, label, enabled, days, skip_next) VALUES (?, ?, ?, ?, 0)')
      .run(time, label, enabled ? 1 : 0, daysJson);
    const alarm = { id: result.lastInsertRowid, time, label, enabled: enabled ? 1 : 0, days, skip_next: 0 };
    rescheduleAlarm({ ...alarm, days: daysJson });
    emitAlarmsChanged();
    res.status(201).json(alarm);
  } catch (e) { res.status(500).json({ error: 'Failed to create alarm' }); }
});

alarmsRouter.post('/:id/skip-next', (req, res) => {
  try {
    const id = Number(req.params.id);
    const alarm = getDb().prepare('SELECT skip_next FROM alarms WHERE id = ?').get(id);
    if (!alarm) return res.status(404).json({ error: 'Alarm not found' });
    const newVal = alarm.skip_next ? 0 : 1;
    getDb().prepare('UPDATE alarms SET skip_next = ? WHERE id = ?').run(newVal, id);
    emitAlarmsChanged();
    res.json({ skip_next: newVal === 1 });
  } catch (e) { res.status(500).json({ error: 'Failed to toggle skip_next' }); }
});

alarmsRouter.put('/:id', (req, res) => {
  try {
    const { time, label, enabled, days = [], skip_next = 0 } = req.body;
    const daysJson = JSON.stringify(days);
    getDb()
      .prepare('UPDATE alarms SET time = ?, label = ?, enabled = ?, days = ?, skip_next = ? WHERE id = ?')
      .run(time, label, enabled ? 1 : 0, daysJson, skip_next ? 1 : 0, req.params.id);
    const alarm = { id: Number(req.params.id), time, label, enabled: enabled ? 1 : 0, days, skip_next };
    rescheduleAlarm({ ...alarm, days: daysJson });
    emitAlarmsChanged();
    res.json(alarm);
  } catch (e) { res.status(500).json({ error: 'Failed to update alarm' }); }
});

alarmsRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    cancelAlarm(id);
    getDb().prepare('DELETE FROM alarms WHERE id = ?').run(id);
    emitAlarmsChanged();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete alarm' }); }
});