import { Router } from 'express';
import { getState, start, pause, reset, skip } from './pomodoroService.js';

export const pomodoroRouter = Router();

pomodoroRouter.get('/state', (req, res) => res.json(getState()));

pomodoroRouter.post('/start', (req, res) => { start(); res.json({ ok: true }); });
pomodoroRouter.post('/pause', (req, res) => { pause(); res.json({ ok: true }); });
pomodoroRouter.post('/reset', (req, res) => { reset(); res.json({ ok: true }); });
pomodoroRouter.post('/skip',  (req, res) => { skip();  res.json({ ok: true }); });