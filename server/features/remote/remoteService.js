import { broadcast } from '../../sse.js';

// ── Stato in memoria — quale pagina è mostrata sul display del Pi ────────────
let currentPage = 'clock';

const VALID_PAGES = ['clock', 'weather', 'pomodoro', 'todos', 'alarms', 'settings'];

export function isValidPage(page) {
  return VALID_PAGES.includes(page);
}

export function getState() {
  return { page: currentPage };
}

export function navigate(page) {
  currentPage = page;
  broadcast('remote:navigate', getState());
}