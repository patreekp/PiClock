import express from 'express';
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

const app = express();
const PORT = 3000;

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

// Scan automatico al boot se highlightMode !== 'off'
// Gira in background, non blocca il server
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
}, 3000); // 3s di delay per dare tempo al DB di stabilizzarsi


// uncomment after running npm run build
// after that you'll only need to launch npm run server: dash will be available at http://localhost:3000

/*
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));
*/

app.listen(PORT, () => console.log(`PiClock server running on http://localhost:${PORT}`));