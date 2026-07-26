// ── Stato in memoria — quale pagina è mostrata sul display del Pi ────────────
// Non persistito: al riavvio del server si riparte da 'clock', comportamento
// coerente con l'avvio normale dell'app (PageCarousel parte sempre da index 0).
let currentPage = 'clock';
let sseClients = [];

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

// ── SSE ─────────────────────────────────────────────────────────────────────
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(payload));
}

export function addSseClient(res) {
  sseClients.push(res);
  // stato immediato al nuovo client (Pi o telefono che apre /remote)
  res.write(`event: remote:navigate\ndata: ${JSON.stringify(getState())}\n\n`);
  res.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
}