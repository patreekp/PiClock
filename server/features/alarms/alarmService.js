import schedule from 'node-schedule';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb } from '../../db/database.js';
import { pickAlarmTrack } from '../audio/audioLibraryService.js';

const activeJobs = new Map();
const sseClients = new Set();
let currentAudioProc = null;
let audioLoopActive = false;
let currentTrackName = null;

// ── SSE client registry ───────────────────────────────────────────────────────
export function addSseClient(res) {
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
}

function emitAlarmTriggered(alarm) {
  const data = JSON.stringify({ type: 'alarm:triggered', alarm });
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

export function emitAlarmStopped() {
  const data = JSON.stringify({ type: 'alarm:stopped' });
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

export function emitAlarmSkipped(alarmId) {
  const data = JSON.stringify({ type: 'alarm:skipped', alarmId });
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

export function emitAlarmsChanged() {
  const data = JSON.stringify({ type: 'alarms:changed' });
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

export function getCurrentTrackName() {
  return currentTrackName;
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

function buildPlayerCommand(filePath, skipSeconds = 0) {
  const ext = path.extname(filePath).toLowerCase();
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    console.log(`[Audio] Piattaforma Windows — uso player di sistema`);
    return { player: 'cmd', args: ['/c', 'start', '', '/wait', filePath] };
  }

  if (ext === '.mp3') {
    const args = skipSeconds > 0
      ? ['--scale', '55000', '--skip', String(Math.floor(skipSeconds)), filePath]
      : ['--scale', '55000', filePath];
    return { player: 'mpg123', args };
  }

  return { player: 'aplay', args: [filePath] };
}

function spawnAudioProcess(filePath, skipSeconds = 0) {
  const { player, args } = buildPlayerCommand(filePath, skipSeconds);
  console.log(`[Audio] Comando: ${player} ${args.join(' ')}`);

  const proc = spawn(player, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  let started = false;

  proc.stdout?.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log(`[Audio][${player}] ${line}`);
  });
  proc.stderr?.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log(`[Audio][${player}] stderr: ${line}`);
  });

  proc.on('spawn', () => {
    started = true;
    currentAudioProc = proc;
    console.log(`[Audio] ✅ Player avviato — PID: ${proc.pid}`);
  });

  proc.on('error', (e) => {
    console.error(`[Audio] ❌ Errore player "${player}": ${e.message}`);
    if (e.code === 'ENOENT') {
      const hint = player === 'mpg123' ? 'sudo apt install mpg123'
        : player === 'aplay' ? 'sudo apt install alsa-utils'
        : '(player di sistema)';
      console.error(`[Audio] ❌ "${player}" non trovato. ${hint !== '(player di sistema)' ? `Installa con: ${hint}` : 'Controlla i player predefiniti di Windows.'}`);
    }
    if (!started) currentAudioProc = null;
  });

  proc.on('exit', (code, signal) => {
    if (started) {
      console.log(`[Audio] Player "${player}" (PID ${proc.pid}) terminato — code: ${code ?? '-'}, signal: ${signal ?? '-'}`);
    }
    if (currentAudioProc === proc) currentAudioProc = null;
  });

  return proc;
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

    const proc = spawnAudioProcess(filePath, skipSeconds);

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
  console.log(`[Audio] Stop — loop: ${audioLoopActive}, proc PID: ${currentAudioProc?.pid ?? 'nessuno'}`);
  audioLoopActive = false;
  currentTrackName = null;

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

  // days: array JS di interi 0-6 (0=Dom). Vuoto = ogni giorno.
  let days = [];
  try { days = JSON.parse(alarm.days || '[]'); } catch (_) {}
  const dayExpr = days.length > 0 ? days.join(',') : '*';

  const job = schedule.scheduleJob(`${minute} ${hour} * * ${dayExpr}`, () => {
    console.log(`[Alarm] ⏰ Triggered: [${alarm.id}] "${alarm.label}" alle ${alarm.time}`);

    // Controlla skip_next — rilegge dal DB per avere il valore aggiornato
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