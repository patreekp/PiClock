import { Router } from 'express';
import { getState, start, pause, reset, skip, addSseClient } from './pomodoroService.js';

export const pomodoroRouter = Router();

pomodoroRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  addSseClient(res);
});

pomodoroRouter.get('/state', (req, res) => res.json(getState()));

pomodoroRouter.post('/start', (req, res) => { start(); res.json({ ok: true }); });
pomodoroRouter.post('/pause', (req, res) => { pause(); res.json({ ok: true }); });
pomodoroRouter.post('/reset', (req, res) => { reset(); res.json({ ok: true }); });
pomodoroRouter.post('/skip',  (req, res) => { skip();  res.json({ ok: true }); });