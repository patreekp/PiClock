import schedule from 'node-schedule';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb } from '../../db/database.js';
import { pickAlarmTrack } from '../audio/audioLibraryService.js';
import { broadcast } from '../../sse.js';

const activeJobs = new Map();
let currentAudioProc = null;
let currentAuxProc = null; // ffmpeg upstream quando si pipa in aplay (ogg/wav)
let audioLoopActive = false;
let currentTrackName = null;

// ── Eventi (broadcast via hub SSE condiviso) ──────────────────────────────────
function emitAlarmTriggered(alarm) {
  broadcast('alarm:triggered', alarm);
}

export function emitAlarmStopped() {
  broadcast('alarm:stopped', {});
}

export function emitAlarmSkipped(alarmId) {
  broadcast('alarm:skipped', { alarmId });
}

export function emitAlarmsChanged() {
  broadcast('alarms:changed', {});
}

export function getCurrentTrackName() {
  return currentTrackName;
}

// ── Volume ────────────────────────────────────────────────────────────────────
// Letto live dal DB ad ogni brano — un cambio di volume dallo slider si applica
// dal prossimo brano in coda, non su quello già in riproduzione.
function getVolumeConfig() {
  const row = getDb().prepare(`SELECT value FROM config WHERE key = 'volume'`).get();
  const v = parseInt(row?.value ?? '80', 10);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 80;
}

// mpg123: scale di default (unity gain) è 32768. Mappiamo 0-100% su 0-65536
// (0-200% di ampiezza) — a 80% (default app) risulta ~52428, vicino al
// vecchio valore hardcoded 55000, quindi il volume "di fabbrica" suona
// pressoché identico a prima.
function mpg123ScaleForVolume(volumePercent) {
  const clamped = Math.min(100, Math.max(0, volumePercent));
  return Math.max(1, Math.round((clamped / 100) * 65536));
}

// ffmpeg filtro volume: stessa scala 0-200% di ampiezza per coerenza con mpg123.
function ffmpegVolumeRatio(volumePercent) {
  const clamped = Math.min(100, Math.max(0, volumePercent));
  return ((clamped / 100) * 2).toFixed(2);
}

// ── Audio ─────────────────────────────────────────────────────────────────────
function getAudioFiles() {
  const row = getDb().prepare(`SELECT value FROM config WHERE key = 'alarmFolder'`).get();
  const folder = row?.value ?? '/media/alarms';

  console.log(`[Audio] Cartella configurata: "${folder}"`);

  if (!fs.existsSync(folder)) {
    console.error(`[Audio] ❌ Cartella non trovata: "${folder}"`);
    return null;
  }
  console.log(`[Audio] ✅ Cartella trovata`);

  let entries;
  try {
    entries = fs.readdirSync(folder);
  } catch (e) {
    console.error(`[Audio] ❌ Errore lettura cartella: ${e.message}`);
    return null;
  }

  const files = entries.filter(f =>
    ['.mp3', '.ogg', '.wav'].includes(path.extname(f).toLowerCase())
  );

  console.log(`[Audio] File audio supportati: ${files.length} su ${entries.length} totali`);

  if (files.length === 0) {
    console.error(`[Audio] ❌ Nessun file .mp3/.ogg/.wav trovato in "${folder}"`);
    return null;
  }

  return { folder, files };
}

function wireProcLogs(proc, player) {
  proc.stdout?.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log(`[Audio][${player}] ${line}`);
  });
  proc.stderr?.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log(`[Audio][${player}] stderr: ${line}`);
  });

  proc.on('spawn', () => {
    currentAudioProc = proc;
    console.log(`[Audio] ✅ Player avviato — PID: ${proc.pid} (${player})`);
  });

  proc.on('error', (e) => {
    console.error(`[Audio] ❌ Errore player "${player}": ${e.message}`);
    if (e.code === 'ENOENT') {
      const hint = player === 'mpg123' ? 'sudo apt install mpg123'
        : player === 'aplay' ? 'sudo apt install alsa-utils'
        : player === 'ffmpeg' ? 'sudo apt install ffmpeg'
        : '(player di sistema)';
      console.error(`[Audio] ❌ "${player}" non trovato. ${hint !== '(player di sistema)' ? `Installa con: ${hint}` : 'Controlla i player predefiniti di Windows.'}`);
    }
  });

  proc.on('exit', (code, signal) => {
    console.log(`[Audio] Player "${player}" (PID ${proc.pid}) terminato — code: ${code ?? '-'}, signal: ${signal ?? '-'}`);
    if (currentAudioProc === proc) currentAudioProc = null;
  });
}

function spawnAudioProcess(filePath, skipSeconds = 0, volume = 80) {
  const ext = path.extname(filePath).toLowerCase();
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    console.log(`[Audio] Piattaforma Windows — uso player di sistema (volume non applicabile, solo dev)`);
    const proc = spawn('cmd', ['/c', 'start', '', '/wait', filePath], { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
    wireProcLogs(proc, 'cmd');
    return proc;
  }

  if (ext === '.mp3') {
    const scale = mpg123ScaleForVolume(volume);
    const args = skipSeconds > 0
      ? ['--scale', String(scale), '--skip', String(Math.floor(skipSeconds)), filePath]
      : ['--scale', String(scale), filePath];
    console.log(`[Audio] Comando: mpg123 ${args.join(' ')}  (volume ${volume}% → scale ${scale})`);
    const proc = spawn('mpg123', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
    wireProcLogs(proc, 'mpg123');
    return proc;
  }

  // .ogg / .wav — mpg123 non li legge, aplay non ha volume nativo:
  // pipiamo ffmpeg (già dipendenza del progetto) con filtro volume verso aplay.
  const gain = ffmpegVolumeRatio(volume);
  const ffmpegArgs = ['-v', 'error', '-nostdin'];
  if (skipSeconds > 0) ffmpegArgs.push('-ss', String(Math.floor(skipSeconds)));
  ffmpegArgs.push('-i', filePath, '-af', `volume=${gain}`, '-f', 'wav', 'pipe:1');

  console.log(`[Audio] Comando: ffmpeg ${ffmpegArgs.join(' ')} | aplay -q -  (volume ${volume}% → gain x${gain})`);

  const ffmpegProc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  const aplayProc = spawn('aplay', ['-q', '-'], { stdio: ['pipe', 'pipe', 'pipe'], detached: false });

  ffmpegProc.stdout.pipe(aplayProc.stdin);
  ffmpegProc.stderr?.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log(`[Audio][ffmpeg] stderr: ${line}`);
  });
  ffmpegProc.on('error', (e) => console.error(`[Audio] ❌ Errore ffmpeg: ${e.message}`));
  ffmpegProc.on('exit', () => { if (currentAuxProc === ffmpegProc) currentAuxProc = null; });

  currentAuxProc = ffmpegProc;
  wireProcLogs(aplayProc, 'aplay');

  return aplayProc;
}

function pickRandomFileFallback(folder, files) {
  const chosen = files[Math.floor(Math.random() * files.length)];
  const filePath = path.join(folder, chosen);
  console.log(`[Audio] File random (fallback): "${chosen}"`);
  return { filePath, skipSeconds: 0 };
}

function startAudioLoop(alarm) {
  const result = getAudioFiles();
  if (!result) return;

  const { folder, files } = result;
  audioLoopActive = true;
  let firstPlay = true;

  async function playNext() {
    if (!audioLoopActive) {
      console.log(`[Audio] Loop interrotto, non riparte`);
      return;
    }

    let filePath, skipSeconds;

    if (firstPlay) {
      const track = pickAlarmTrack(folder);
      if (track) {
        filePath = track.filePath;
        skipSeconds = track.skipSeconds;
      } else {
        const picked = pickRandomFileFallback(folder, files);
        filePath = picked.filePath;
        skipSeconds = picked.skipSeconds;
      }
      firstPlay = false;
    } else {
      const picked = pickRandomFileFallback(folder, files);
      filePath = picked.filePath;
      skipSeconds = 0;
    }

    const fallbackName = path.basename(filePath, path.extname(filePath));
    let trackDisplay = fallbackName;
    try {
      const { parseFile } = await import('music-metadata');
      const meta = await parseFile(filePath);
      const title = meta.common.title?.trim();
      const artist = meta.common.artist?.trim();
      if (title && artist) trackDisplay = `${title} — ${artist}`;
      else if (title) trackDisplay = title;
      else if (artist) trackDisplay = `${fallbackName} — ${artist}`;
    } catch (_) {}
    currentTrackName = trackDisplay;
    if (alarm) emitAlarmTriggered({ ...alarm, trackName: currentTrackName });

    const volume = getVolumeConfig();
    const proc = spawnAudioProcess(filePath, skipSeconds, volume);

    proc.on('exit', (code, signal) => {
      if (signal) {
        console.log(`[Audio] Brano interrotto con signal "${signal}", loop fermato`);
        return;
      }
      if (audioLoopActive) {
        console.log(`[Audio] Brano terminato (code: ${code}), passo al prossimo...`);
        playNext();
      }
    });
  }

  playNext();
}

export function stopAlarmAudio() {
  console.log(`[Audio] Stop — loop: ${audioLoopActive}, proc PID: ${currentAudioProc?.pid ?? 'nessuno'}, aux PID: ${currentAuxProc?.pid ?? 'nessuno'}`);
  audioLoopActive = false;
  currentTrackName = null;

  if (currentAuxProc) {
    try { currentAuxProc.kill('SIGTERM'); } catch (e) { console.error(`[Audio] ❌ Errore kill aux: ${e.message}`); }
    currentAuxProc = null;
  }

  if (currentAudioProc) {
    try {
      currentAudioProc.kill('SIGTERM');
      console.log(`[Audio] ✅ SIGTERM → PID ${currentAudioProc.pid}`);
    } catch (e) {
      console.error(`[Audio] ❌ Errore kill: ${e.message}`);
    }
    currentAudioProc = null;
  } else {
    console.log(`[Audio] Nessun processo audio attivo`);
  }
}

// ── Scheduling ────────────────────────────────────────────────────────────────
function scheduleAlarm(alarm) {
  if (activeJobs.has(alarm.id)) {
    activeJobs.get(alarm.id).cancel();
    console.log(`[Scheduler] Job precedente per alarm ${alarm.id} cancellato`);
  }

  if (!alarm.enabled) {
    console.log(`[Scheduler] Alarm ${alarm.id} disabilitato, skip`);
    return;
  }

  const [hour, minute] = alarm.time.split(':').map(Number);

  let days = [];
  try { days = JSON.parse(alarm.days || '[]'); } catch (_) {}
  const dayExpr = days.length > 0 ? days.join(',') : '*';

  const job = schedule.scheduleJob(`${minute} ${hour} * * ${dayExpr}`, () => {
    console.log(`[Alarm] ⏰ Triggered: [${alarm.id}] "${alarm.label}" alle ${alarm.time}`);

    const row = getDb().prepare('SELECT skip_next FROM alarms WHERE id = ?').get(alarm.id);
    if (row?.skip_next) {
      getDb().prepare('UPDATE alarms SET skip_next = 0 WHERE id = ?').run(alarm.id);
      console.log(`[Alarm] ⏭ Alarm ${alarm.id} saltato (skip_next), reset flag`);
      emitAlarmSkipped(alarm.id);
      return;
    }

    startAudioLoop(alarm);
  });

  activeJobs.set(alarm.id, job);
  console.log(`[Scheduler] Alarm ${alarm.id} schedulato — ${alarm.time}, giorni: ${dayExpr}`);
}

export function snoozeAlarm(alarm) {
  stopAlarmAudio();

  const row = getDb().prepare(`SELECT value FROM config WHERE key = 'snoozeMinutes'`).get();
  const minutes = parseInt(row?.value ?? '1', 10);
  const snoozeAt = new Date(Date.now() + minutes * 60 * 1000);

  console.log(`[Snooze] Alarm ${alarm.id} snoozato di ${minutes} min → risuonerà alle ${snoozeAt.toLocaleTimeString()}`);

  const job = schedule.scheduleJob(snoozeAt, () => {
    console.log(`[Snooze] ⏰ Snooze triggered: [${alarm.id}] "${alarm.label}"`);
    startAudioLoop(alarm);
    activeJobs.delete(`snooze_${alarm.id}`);
  });

  activeJobs.set(`snooze_${alarm.id}`, job);
}

export function initAlarmScheduler() {
  const alarms = getDb().prepare('SELECT * FROM alarms').all();
  console.log(`[Scheduler] Inizializzazione — ${alarms.length} alarms trovati`);
  for (const alarm of alarms) scheduleAlarm(alarm);
  console.log(`[Scheduler] ✅ Pronto`);
}

export function rescheduleAlarm(alarm) {
  console.log(`[Scheduler] Reschedule alarm ${alarm.id}`);
  scheduleAlarm(alarm);
}

export function cancelAlarm(id) {
  if (activeJobs.has(id)) {
    activeJobs.get(id).cancel();
    activeJobs.delete(id);
    console.log(`[Scheduler] Alarm ${id} cancellato`);
  }
  const snoozeKey = `snooze_${id}`;
  if (activeJobs.has(snoozeKey)) {
    activeJobs.get(snoozeKey).cancel();
    activeJobs.delete(snoozeKey);
    console.log(`[Scheduler] Snooze job per alarm ${id} cancellato`);
  }
}