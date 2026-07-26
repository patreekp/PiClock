import { Router } from 'express';
import { fetchWeather } from './weatherService.js';

export const weatherRouter = Router();

// Simple in-memory cache — avoids hammering Open-Meteo on every page swipe
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let sseClients = [];

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(payload));
}

// GET /api/weather
weatherRouter.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_TTL_MS) {
      return res.json(cache);
    }
    cache = await fetchWeather();
    cacheTime = now;
    res.json(cache);
  } catch (e) {
    console.error('GET /api/weather error:', e);
    // Return stale cache if available rather than an error
    if (cache) return res.json(cache);
    res.status(503).json({ error: 'Weather unavailable' });
  }
});

// POST /api/weather/refresh — forza una fetch fresca (bypassa la cache) e
// notifica tutti i client connessi (Pi + /remote) via SSE
weatherRouter.post('/refresh', async (req, res) => {
  try {
    cache = await fetchWeather();
    cacheTime = Date.now();
    broadcast('weather:updated', cache);
    res.json({ ok: true, weather: cache });
  } catch (e) {
    console.error('POST /api/weather/refresh error:', e);
    broadcast('weather:error', { message: e.message });
    res.status(503).json({ error: 'Weather refresh failed' });
  }
});

// GET /api/weather/events — SSE, stesso pattern di pomodoro/remote
weatherRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  res.on('close', () => clearInterval(heartbeat));

  sseClients.push(res);
  // stato immediato al nuovo client, se già disponibile in cache
  if (cache) res.write(`event: weather:updated\ndata: ${JSON.stringify(cache)}\n\n`);
  res.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});