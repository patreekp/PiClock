// Hub SSE lato client — una sola EventSource per /api/events, condivisa da
// tutti gli store (pomodoro, weather, todos, remote). Evita di superare il
// limite di 6 connessioni HTTP/1.1 simultanee per origine che i browser
// impongono, causa del bug "la pagina resta in caricamento".
type Handler = (data: any) => void;

let source: EventSource | null = null;
const listeners = new Map<string, Set<Handler>>();

function ensureConnected() {
  if (source) return;
  source = new EventSource('/api/events');
  source.onerror = () => { /* EventSource riprova la connessione da solo */ };
}

export function onSseEvent(eventName: string, handler: Handler): () => void {
  ensureConnected();

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
    source!.addEventListener(eventName, (e) => {
      let data = {};
      try { data = JSON.parse((e as MessageEvent).data); } catch (_) {}
      listeners.get(eventName)!.forEach(fn => fn(data));
    });
  }

  listeners.get(eventName)!.add(handler);
  return () => { listeners.get(eventName)?.delete(handler); };
}