import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { join } from 'path';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Initialize database
const dbPath = join(process.cwd(), 'raspi-clock.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    label TEXT,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default config if empty
const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get() as { count: number };
if (configCount.count === 0) {
  const insertConfig = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
  insertConfig.run('lat', '44.0594');
  insertConfig.run('lon', '12.5683');
  insertConfig.run('timezone', 'Europe/Rome');
  insertConfig.run('clock24h', 'true');
  insertConfig.run('showSeconds', 'false');
  insertConfig.run('theme', 'light');
}

// API Routes
app.get('/api/clock', (req, res) => {
  const { DateTime } = require('luxon');
  const timezoneRow = db.prepare('SELECT value FROM config WHERE key = ?').get('timezone') as { value: string } | undefined;
  const timezone = timezoneRow?.value || 'Europe/Rome';
  
  const now = DateTime.now().setZone(timezone);
  
  res.json({
    time: now.toISO(),
    timezone: timezone,
    formatted: now.toFormat('HH:mm:ss'),
    date: now.toFormat('cccc, d MMMM yyyy')
  });
});

app.get('/api/config', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string, value: string }[];
  const config: Record<string, string> = {};
  rows.forEach(row => {
    config[row.key] = row.value;
  });
  res.json(config);
});

app.put('/api/config', (req, res) => {
  const body = req.body;
  
  const updateStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  
  const transaction = db.transaction((configObj) => {
    for (const [key, value] of Object.entries(configObj)) {
      updateStmt.run(key, String(value));
    }
  });
  
  transaction(body);
  
  res.json({ success: true });
});

app.get('/api/weather', async (req, res) => {
  const configRows = db.prepare('SELECT key, value FROM config WHERE key IN (?, ?, ?)').all('lat', 'lon', 'timezone') as { key: string, value: string }[];
  const config: Record<string, string> = {};
  configRows.forEach(row => config[row.key] = row.value);
  
  const lat = config.lat || '44.0594';
  const lon = config.lon || '12.5683';
  const timezone = config.timezone || 'Europe/Rome';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(timezone)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API error');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

app.get('/api/todos', (req, res) => {
  res.json(db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all());
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  const info = db.prepare('INSERT INTO todos (text) VALUES (?)').run(text);
  res.json({ id: info.lastInsertRowid, text, done: 0 });
});

app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { text, done } = req.body;
  
  db.prepare('UPDATE todos SET text = ?, done = ? WHERE id = ?').run(text, done ? 1 : 0, id);
  res.json({ success: true });
});

app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get('/api/alarms', (req, res) => {
  res.json(db.prepare('SELECT * FROM alarms ORDER BY time ASC').all());
});

app.post('/api/alarms', (req, res) => {
  const { time, label, enabled } = req.body;
  const info = db.prepare('INSERT INTO alarms (time, label, enabled) VALUES (?, ?, ?)').run(time, label || '', enabled ? 1 : 0);
  res.json({ id: info.lastInsertRowid, time, label, enabled });
});

app.put('/api/alarms/:id', (req, res) => {
  const { id } = req.params;
  const { time, label, enabled } = req.body;
  
  db.prepare('UPDATE alarms SET time = ?, label = ?, enabled = ? WHERE id = ?').run(
    time, 
    label, 
    enabled ? 1 : 0, 
    id
  );
  
  res.json({ success: true });
});

app.delete('/api/alarms/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM alarms WHERE id = ?').run(id);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});