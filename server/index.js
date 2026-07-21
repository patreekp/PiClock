import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { initDb } from './db/database.js';
import { clockRouter } from './features/clock/clockRouter.js';
import { weatherRouter } from './features/weather/weatherRouter.js';
import { todosRouter } from './features/todos/todoRouter.js';
import { alarmsRouter } from './features/alarms/alarmRouter.js';
import { configRouter } from './features/config/configRouter.js';
import { audioRouter } from './features/audio/audioRouter.js';
import { initAlarmScheduler } from './features/alarms/alarmService.js';
import { scanAudioLibrary } from './features/audio/audioLibraryService.js';
import { getDb } from './db/database.js';
import { systemRouter } from './features/system/systemRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 80;
const HOST = '0.0.0.0'; // ascolta su tutte le interfacce, non solo localhost

app.use(express.json());
app.use('/api/clock', clockRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/todos', todosRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/config', configRouter);
app.use('/api/audio', audioRouter);
app.use('/api/system', systemRouter);

initDb();
initAlarmScheduler();

setTimeout(() => {
  try {
    const row = getDb().prepare(`SELECT value FROM config WHERE key = 'highlightMode'`).get();
    const mode = row?.value ?? 'off';
    if (mode !== 'off') {
      console.log(`[Boot] highlightMode="${mode}" — avvio scan libreria (solo file nuovi)`);
      scanAudioLibrary({ onlyNew: true }).catch(e => {
        console.error('[Boot] Scan error:', e.message);
      });
    } else {
      console.log(`[Boot] highlightMode="off" — scan libreria disabilitato`);
    }
  } catch (e) {
    console.error('[Boot] Errore lettura config highlightMode:', e.message);
  }
}, 3000);

// --- Static frontend (build di produzione) ---
// Richiede `npm run build` eseguito in precedenza (genera /dist)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all per il routing client-side (SPA): qualsiasi richiesta
// non-API riceve index.html, lasciando fare a React il routing.
// NB: uso un middleware invece di una route "*" per evitare i problemi
// di path-to-regexp con Express 5.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`PiClock server running on http://${HOST}:${PORT}`);
});