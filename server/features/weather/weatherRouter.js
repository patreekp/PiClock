import { Router } from 'express';
import { fetchWeather } from './weatherService.js';

export const weatherRouter = Router();

// Simple in-memory cache — avoids hammering Open-Meteo on every page swipe
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
