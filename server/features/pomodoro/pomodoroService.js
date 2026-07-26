import { getDb } from '../../db/database.js';
import { broadcast } from '../../sse.js'; 

// ── Stato in memoria — non persistito: un pomodoro è effimero per natura ──────
let state = null;
let phaseTimeout = null;

function readDurations() {
  const rows = getDb()
    .prepare(`SELECT key, value FROM config WHERE key IN
      ('pomodoroFocusMin','pomodoroShortBreakMin','pomodoroLongBreakMin','pomodoroSessions')`)
    .all();
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    focus: parseInt(cfg.pomodoroFocusMin ?? '25', 10) * 60,
    shortBreak: parseInt(cfg.pomodoroShortBreakMin ?? '5', 10) * 60,
    longBreak: parseInt(cfg.pomodoroLongBreakMin ?? '15', 10) * 60,
    sessions: parseInt(cfg.pomodoroSessions ?? '4', 10),
  };
}

function durationFor(phase, d) { return d[phase]; }

function ensureInit() {
  if (state) return;
  const d = readDurations();
  state = { phase: 'focus', sessionIndex: 0, status: 'idle', secondsLeft: d.focus, endsAt: null };
}

function clearPhaseTimeout() {
  if (phaseTimeout) { clearTimeout(phaseTimeout); phaseTimeout = null; }
}

function schedulePhaseEnd() {
  clearPhaseTimeout();
  if (!state.endsAt) return;
  const ms = Math.max(0, state.endsAt - Date.now());
  phaseTimeout = setTimeout(handleNaturalCompletion, ms);
}

// Fase scaduta da sola — avanza e fa ripartire automaticamente la prossima
// (stesso comportamento dell'originale computeNextState(current, autoAdvance=true))
function handleNaturalCompletion() {
  const d = readDurations();
  if (state.phase === 'focus') {
    const nextIdx = state.sessionIndex + 1;
    if (nextIdx >= d.sessions) {
      state = { phase: 'focus', sessionIndex: 0, status: 'cycleComplete', secondsLeft: d.focus, endsAt: null };
    } else {
      const nextPhase = nextIdx === d.sessions - 1 ? 'longBreak' : 'shortBreak';
      state = { phase: nextPhase, sessionIndex: nextIdx, status: 'running', secondsLeft: null, endsAt: Date.now() + durationFor(nextPhase, d) * 1000 };
    }
  } else {
    state = { phase: 'focus', sessionIndex: state.sessionIndex, status: 'running', secondsLeft: null, endsAt: Date.now() + d.focus * 1000 };
  }
  broadcast('pomodoro:phase-complete', {});
  broadcast('pomodoro:state', getState());
  if (state.status === 'running') schedulePhaseEnd();
}

// ── Stato pubblico (calcola il countdown al volo se in running) ───────────────
export function getState() {
  ensureInit();
  if (state.status === 'running' && state.endsAt) {
    const secondsLeft = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
    return { ...state, secondsLeft };
  }
  return { ...state };
}

// ── Azioni ──────────────────────────────────────────────────────────────────
export function start() {
  ensureInit();
  const d = readDurations();
  if (state.status === 'cycleComplete') {
    state = { phase: 'focus', sessionIndex: 0, status: 'running', secondsLeft: null, endsAt: Date.now() + d.focus * 1000 };
  } else {
    const secs = state.secondsLeft ?? durationFor(state.phase, d);
    state = { ...state, status: 'running', secondsLeft: null, endsAt: Date.now() + secs * 1000 };
  }
  schedulePhaseEnd();
  broadcast('pomodoro:state', getState());
  broadcast('pomodoro:navigate', {}); // richiesto: salta alla pagina Pomodoro sul Pi
}

export function pause() {
  ensureInit();
  if (state.status !== 'running') return;
  const remaining = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
  clearPhaseTimeout();
  state = { ...state, status: 'paused', secondsLeft: remaining, endsAt: null };
  broadcast('pomodoro:state', getState());
}

export function reset() {
  ensureInit();
  clearPhaseTimeout();
  const d = readDurations();
  state = { phase: 'focus', sessionIndex: 0, status: 'idle', secondsLeft: d.focus, endsAt: null };
  broadcast('pomodoro:state', getState());
}

// "Next" manuale — non riparte in automatico (a differenza della fine naturale)
export function skip() {
  ensureInit();
  clearPhaseTimeout();
  const d = readDurations();
  if (state.phase === 'focus') {
    const nextIdx = state.sessionIndex + 1;
    if (nextIdx >= d.sessions) {
      state = { phase: 'focus', sessionIndex: 0, status: 'cycleComplete', secondsLeft: d.focus, endsAt: null };
    } else {
      const nextPhase = nextIdx === d.sessions - 1 ? 'longBreak' : 'shortBreak';
      state = { phase: nextPhase, sessionIndex: nextIdx, status: 'idle', secondsLeft: durationFor(nextPhase, d), endsAt: null };
    }
  } else {
    state = { phase: 'focus', sessionIndex: state.sessionIndex, status: 'idle', secondsLeft: d.focus, endsAt: null };
  }
  broadcast('pomodoro:state', getState());
}
