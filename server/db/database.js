import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../piclockdb.sqlite');

let db;
export function getDb() { return db; }

export function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS alarms (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS audio_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      duration_ms INTEGER,
      highlights_json TEXT,
      highlight_source TEXT,
      scanned_at TEXT
    );
  `);

// Migration: aggiunge colonne giorni e skip_next se non esistono
try { db.exec(`ALTER TABLE alarms ADD COLUMN days TEXT NOT NULL DEFAULT '[]'`); } catch (_) {}
try { db.exec(`ALTER TABLE alarms ADD COLUMN skip_next INTEGER NOT NULL DEFAULT 0`); } catch (_) {}

  const insert = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
  for (const [key, value] of Object.entries({
    lat: '44.0594', lon: '12.5683', timezone: 'Europe/Rome',
    clock24h: 'true', showSeconds: 'false', theme: 'light',
    alarmFolder: '/media/alarms', snoozeMinutes: '1',
    highlightMode: 'off', audjustApiKey: '',
    language: 'en',
    // Pomodoro
    pomodoroStyle: 'hourglass',   // 'hourglass' | 'arc'
    pomodoroFocusMin: '25',
    pomodoroShortBreakMin: '5',
    pomodoroLongBreakMin: '15',
    pomodoroSessions: '4',
  })) insert.run(key, value);
  console.log('Database initialized at', DB_PATH);
}