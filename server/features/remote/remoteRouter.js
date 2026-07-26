import { Router } from 'express';
import { getState, navigate, isValidPage } from './remoteService.js';

export const remoteRouter = Router();

remoteRouter.get('/state', (req, res) => res.json(getState()));

remoteRouter.post('/navigate', (req, res) => {
  const { page } = req.body || {};
  if (!isValidPage(page)) {
    return res.status(400).json({ error: `invalid page: ${page}` });
  }
  navigate(page);
  res.json({ ok: true });
});