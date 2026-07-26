import { Router } from 'express';
import { getState, navigate, isValidPage, addSseClient } from './remoteService.js';

export const remoteRouter = Router();

remoteRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  addSseClient(res);
});

remoteRouter.get('/state', (req, res) => res.json(getState()));

remoteRouter.post('/navigate', (req, res) => {
  const { page } = req.body || {};
  if (!isValidPage(page)) {
    return res.status(400).json({ error: `invalid page: ${page}` });
  }
  navigate(page);
  res.json({ ok: true });
})