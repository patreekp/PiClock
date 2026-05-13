import Database from 'better-sqlite3';
import { join } from 'path';

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

export default db;
