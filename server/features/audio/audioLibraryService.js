import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDb } from '../../db/database.js';

// ── SSE clients (canale generico /api/events) ─────────────────────────────────
const sseClients = new Set();

export function addEventSseClient(res) {
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
}

function emit(type, payload = {}) {
  const data = JSON.stringify({ type, ...payload });
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

// ── Stato scan ────────────────────────────────────────────────────────────────
let scanInProgress = false;

export function getScanStatus() {
  const db = getDb();
  const total    = db.prepare(`SELECT COUNT(*) as n FROM audio_library`).get().n;
  const scanned  = db.prepare(`SELECT COUNT(*) as n FROM audio_library WHERE highlights_json IS NOT NULL`).get().n;
  const pending  = db.prepare(`SELECT COUNT(*) as n FROM audio_library WHERE highlights_json IS NULL`).get().n;
  const lastScan = db.prepare(`SELECT MAX(scanned_at) as t FROM audio_library`).get().t;
  return { total, scanned, pending, lastScan, scanInProgress };
}

// ── ffmpeg: estrai highlight (picco di loudness) ──────────────────────────────
// Restituisce una Promise con array di timestamp in ms.
// Strategia: divide il brano in segmenti da 30s e misura il loudness medio
// di ciascuno → il segmento con loudness massimo è il ritornello.
function analyzeWithFfmpeg(filePath) {
  return new Promise((resolve, reject) => {
    // astats con frame ogni 30s: usiamo silencedetect + volumedetect
    // Approccio semplice: ebur128 per loudness integrato a finestre di 3s
    const args = [
      '-i', filePath,
      '-af', 'ebur128=peak=true:framelog=quiet',
      '-f', 'null',
      '-'
    ];

    console.log(`[AudioLib] ffmpeg analisi: "${path.basename(filePath)}"`);

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', (e) => {
      if (e.code === 'ENOENT') {
        reject(new Error('ffmpeg non trovato. Installa con: sudo apt install ffmpeg'));
      } else {
        reject(new Error(`ffmpeg error: ${e.message}`));
      }
    });

    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        // ffmpeg esce con 0 anche su stderr — ignoriamo codici non-null diversi da 0
        // solo se non abbiamo output da parsare
        if (!stderr.includes('M/S')) {
          reject(new Error(`ffmpeg exited with code ${code}`));
          return;
        }
      }

      // Parsa le righe ebur128: "t:  1.234  M:  -23.1  S:  -22.4  I:  -21.0  LUFS  LRA:   3.2 LU"
      const highlights = parseEbur128Highlights(stderr);
      resolve(highlights);
    });
  });
}

function parseEbur128Highlights(stderr) {
  // Raccogli tutti i campioni (Short-term loudness ogni ~3s)
  const lines = stderr.split('\n');
  const samples = []; // { t: seconds, s: short-term loudness }

  for (const line of lines) {
    // Formato: [Parsed_ebur128_0 @ ...] t: 3.000 M: -12.3 S: -14.5 I: -18.2 LUFS LRA: 2.1 LU
    const tMatch = line.match(/t:\s+([\d.]+)/);
    const sMatch = line.match(/S:\s+([-\d.]+)/);
    if (tMatch && sMatch) {
      const t = parseFloat(tMatch[1]);
      const s = parseFloat(sMatch[1]);
      if (!isNaN(t) && !isNaN(s) && s > -70) { // ignora silenzio
        samples.push({ t, s });
      }
    }
  }

  if (samples.length === 0) {
    // Nessun dato → highlight al 30% della durata (euristica semplice)
    const durMatch = stderr.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);
    if (durMatch) {
      const totalSec = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
      return [Math.floor(totalSec * 0.3 * 1000)];
    }
    return [0];
  }

  // Trova i top-3 picchi di loudness (almeno 30s distanti tra loro)
  const sorted = [...samples].sort((a, b) => b.s - a.s);
  const peaks = [];

  for (const candidate of sorted) {
    const tooClose = peaks.some(p => Math.abs(p.t - candidate.t) < 30);
    if (!tooClose) {
      peaks.push(candidate);
      if (peaks.length >= 3) break;
    }
  }

  // Durata totale dal log ffmpeg
  const durMatch = stderr.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);
  const totalSec = durMatch
    ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])
    : null;

  return peaks.map(p => {
    // Torna indietro di 5s rispetto al picco (per non entrare a freddo nel ritornello)
    const offsetSec = Math.max(0, p.t - 5);
    // Non partire negli ultimi 30s del brano
    const safeSec = totalSec ? Math.min(offsetSec, totalSec - 30) : offsetSec;
    return Math.floor(Math.max(0, safeSec) * 1000);
  });
}

function getDurationMs(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.on('exit', () => {
      try {
        const json = JSON.parse(out);
        const dur = parseFloat(json.format?.duration ?? '0');
        resolve(Math.floor(dur * 1000));
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

// ── Scan principale ───────────────────────────────────────────────────────────
export async function scanAudioLibrary({ onlyNew = true } = {}) {
  if (scanInProgress) {
    console.log('[AudioLib] Scan già in corso, skip');
    return;
  }

  const db = getDb();
  const folderRow = db.prepare(`SELECT value FROM config WHERE key = 'alarmFolder'`).get();
  const folder = folderRow?.value ?? '/media/alarms';

  console.log(`[AudioLib] Scan cartella: "${folder}"`);

  if (!fs.existsSync(folder)) {
    const msg = `Cartella non trovata: "${folder}"`;
    console.error(`[AudioLib] ❌ ${msg}`);
    emit('library:scan-error', { message: msg });
    return;
  }

  const entries = fs.readdirSync(folder);
  const audioFiles = entries.filter(f =>
    ['.mp3', '.ogg', '.wav'].includes(path.extname(f).toLowerCase())
  );

  if (audioFiles.length === 0) {
    const msg = 'Nessun file audio trovato nella cartella';
    console.warn(`[AudioLib] ⚠️ ${msg}`);
    emit('library:scan-error', { message: msg });
    return;
  }

  // Registra tutti i file nel DB (senza highlights ancora)
  const upsertFile = db.prepare(`
    INSERT INTO audio_library (path, filename)
    VALUES (?, ?)
    ON CONFLICT(path) DO NOTHING
  `);
  for (const f of audioFiles) {
    upsertFile.run(path.join(folder, f), f);
  }

  // Decide quali file analizzare
  let toScan;
  if (onlyNew) {
    toScan = db.prepare(`
      SELECT * FROM audio_library
      WHERE highlights_json IS NULL
      AND path LIKE ?
    `).all(`${folder}%`);
  } else {
    toScan = db.prepare(`
      SELECT * FROM audio_library WHERE path LIKE ?
    `).all(`${folder}%`);
  }

  if (toScan.length === 0) {
    console.log('[AudioLib] Nessun file da analizzare (tutti già scansionati)');
    emit('library:scan-done', { total: audioFiles.length, failed: 0, skipped: audioFiles.length });
    return;
  }

  console.log(`[AudioLib] File da analizzare: ${toScan.length}`);
  scanInProgress = true;
  emit('library:scan-start', { total: toScan.length });

  const updateFile = db.prepare(`
    UPDATE audio_library
    SET highlights_json = ?, highlight_source = ?, duration_ms = ?, scanned_at = datetime('now')
    WHERE id = ?
  `);

  let done = 0;
  let failed = 0;

  for (const file of toScan) {
    if (!scanInProgress) {
      console.log('[AudioLib] Scan interrotto');
      break;
    }

    try {
      console.log(`[AudioLib] Analisi (${done + 1}/${toScan.length}): "${file.filename}"`);
      emit('library:scan-progress', { done, total: toScan.length, filename: file.filename });

      const [highlights, durationMs] = await Promise.all([
        analyzeWithFfmpeg(file.path),
        getDurationMs(file.path),
      ]);

      updateFile.run(
        JSON.stringify(highlights),
        'local',
        durationMs,
        file.id
      );

      console.log(`[AudioLib] ✅ "${file.filename}" — highlights: ${highlights.join(', ')} ms`);
      done++;
    } catch (e) {
      console.error(`[AudioLib] ❌ "${file.filename}": ${e.message}`);
      failed++;
      done++;

      // Se ffmpeg non è installato, interrompi subito tutto
      if (e.message.includes('ffmpeg non trovato')) {
        emit('library:scan-error', { message: e.message });
        scanInProgress = false;
        return;
      }
    }
  }

  scanInProgress = false;
  console.log(`[AudioLib] ✅ Scan completato — ${done - failed} ok, ${failed} falliti`);
  emit('library:scan-done', { total: toScan.length, failed });
}

export function stopScan() {
  if (scanInProgress) {
    scanInProgress = false;
    console.log('[AudioLib] Scan interrotto manualmente');
  }
}

// ── Selezione file per la sveglia ─────────────────────────────────────────────
// Restituisce { filePath, skipSeconds } — skipSeconds = 0 se highlights non disponibili
export function pickAlarmTrack(folder) {
  const db = getDb();
  const highlightModeRow = db.prepare(`SELECT value FROM config WHERE key = 'highlightMode'`).get();
  const highlightMode = highlightModeRow?.value ?? 'off';

  // Prova prima a prendere un file con highlights dalla cartella configurata
  if (highlightMode !== 'off') {
    const candidates = db.prepare(`
      SELECT * FROM audio_library
      WHERE path LIKE ? AND highlights_json IS NOT NULL
    `).all(`${folder}%`);

    if (candidates.length > 0) {
      const track = candidates[Math.floor(Math.random() * candidates.length)];
      const highlights = JSON.parse(track.highlights_json);
      const highlightMs = highlights[Math.floor(Math.random() * highlights.length)] ?? 0;
      console.log(`[AudioLib] Track con highlight: "${track.filename}" — skip ${highlightMs}ms`);
      return { filePath: track.path, skipSeconds: Math.floor(highlightMs / 1000) };
    }

    console.log('[AudioLib] Nessun track con highlights in DB, fallback a random');
  }

  // Fallback: file random dalla cartella (comportamento originale)
  return null;
}