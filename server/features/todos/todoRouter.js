import { Router } from 'express';
import { getDb } from '../../db/database.js';

export const todosRouter = Router();

// ── SSE ─────────────────────────────────────────────────────────────────────
let sseClients = [];

function broadcastTodosChanged() {
  const payload = `event: todos:changed\ndata: {}\n\n`;
  sseClients.forEach(res => res.write(payload));
}

todosRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  sseClients.push(res);
  res.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

// GET /api/todos — newest first
todosRouter.get('/', (req, res) => {
  try {
    const todos = getDb()
      .prepare('SELECT id, text, done FROM todos ORDER BY created_at DESC')
      .all();
    res.json(todos);
  } catch (e) {
    console.error('GET /api/todos error:', e);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// POST /api/todos — { text }
todosRouter.post('/', (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const result = getDb()
      .prepare('INSERT INTO todos (text, done) VALUES (?, 0)')
      .run(text.trim());

    broadcastTodosChanged();
    res.status(201).json({ id: result.lastInsertRowid, text: text.trim(), done: 0 });
  } catch (e) {
    console.error('POST /api/todos error:', e);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// PUT /api/todos/:id — { text, done }
todosRouter.put('/:id', (req, res) => {
  try {
    const { text, done } = req.body;
    const { id } = req.params;
    getDb()
      .prepare('UPDATE todos SET text = ?, done = ? WHERE id = ?')
      .run(text, done ? 1 : 0, id);
    broadcastTodosChanged();
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/todos error:', e);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id
todosRouter.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
    broadcastTodosChanged();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/todos error:', e);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});