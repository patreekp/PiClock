// Hub SSE centralizzato — un solo stream /api/events multiplexato per tutta
// l'app, invece di una EventSource separata per feature (pomodoro, weather,
// todos, remote...). Necessario perché i browser limitano a 6 le connessioni
// HTTP/1.1 simultanee per origine: con troppe SSE permanenti aperte in una
// scheda, altre richieste (incluso il caricamento di un'altra pagina sulla
// stessa origine) restavano bloccate in coda a tempo indeterminato.
let clients = [];

export function addSseClient(res) {
  clients.push(res);
  res.on('close', () => { clients = clients.filter(c => c !== res); });
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

export function sseHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  addSseClient(res);
}