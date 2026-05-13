import { defineEventHandler } from 'nitropack/runtime';
import fetch from 'node-fetch';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const configRows = db.prepare('SELECT key, value FROM config WHERE key IN (?, ?, ?)').all('lat', 'lon', 'timezone') as { key: string, value: string }[];
  const config: Record<string, string> = {};
  configRows.forEach(row => config[row.key] = row.value);
  
  const lat = config.lat || '44.0594';
  const lon = config.lon || '12.5683';
  const timezone = config.timezone || 'Europe/Rome';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(timezone)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API error');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Weather fetch error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch weather data',
    });
  }
});
