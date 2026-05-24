import { getDb } from '../../db/database.js';

// WMO Weather interpretation codes → human readable + SVG symbol key
const WMO_CODES = {
  0: { label: 'Sereno', symbol: '☀️' },
  1: { label: 'Prevalentemente sereno', symbol: '🌤️' },
  2: { label: 'Parzialmente nuvoloso', symbol: '⛅' },
  3: { label: 'Coperto', symbol: '☁️' },
  45: { label: 'Nebbia', symbol: '🌫️' },
  48: { label: 'Nebbia ghiacciata', symbol: '🌫️' },
  51: { label: 'Pioggerella leggera', symbol: '🌦️' },
  53: { label: 'Pioggerella moderata', symbol: '🌦️' },
  55: { label: 'Pioggerella intensa', symbol: '🌧️' },
  61: { label: 'Pioggia leggera', symbol: '🌧️' },
  63: { label: 'Pioggia moderata', symbol: '🌧️' },
  65: { label: 'Pioggia intensa', symbol: '🌧️' },
  71: { label: 'Neve leggera', symbol: '🌨️' },
  73: { label: 'Neve moderata', symbol: '❄️' },
  75: { label: 'Neve intensa', symbol: '❄️' },
  80: { label: 'Rovesci leggeri', symbol: '🌦️' },
  81: { label: 'Rovesci moderati', symbol: '🌧️' },
  82: { label: 'Rovesci violenti', symbol: '⛈️' },
  95: { label: 'Temporale', symbol: '⛈️' },
  96: { label: 'Temporale con grandine', symbol: '⛈️' },
  99: { label: 'Temporale con grandine intensa', symbol: '⛈️' },
};

/**
 * Fetches current weather + 5-day forecast from Open-Meteo.
 * @returns {Promise<Object>} weather data shaped for the frontend
 */
export async function fetchWeather() {
  const db = getDb();
  const rows = db.prepare(`SELECT key, value FROM config WHERE key IN ('lat','lon','timezone')`).all();
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const lat = cfg.lat ?? '44.0594';
  const lon = cfg.lon ?? '12.5683';
  const tz = cfg.timezone ?? 'Europe/Rome';

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('timezone', tz);
  url.searchParams.set('current', [
    'temperature_2m',
    'apparent_temperature',
    'weather_code',
    'relative_humidity_2m',
    'wind_speed_10m',
  ].join(','));
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
  ].join(','));
  url.searchParams.set('forecast_days', '6');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

  const raw = await response.json();
  const c = raw.current;
  const d = raw.daily;

  const wmo = (code) => WMO_CODES[code] ?? { label: 'Sconosciuto', symbol: '?' };

  return {
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      condition: wmo(c.weather_code).label,
      symbol: wmo(c.weather_code).symbol,
    },
    // Skip index 0 (today) — start from tomorrow for the forecast strip
    forecast: d.time.slice(1, 6).map((date, i) => ({
      date,
      max: Math.round(d.temperature_2m_max[i + 1]),
      min: Math.round(d.temperature_2m_min[i + 1]),
      symbol: wmo(d.weather_code[i + 1]).symbol,
      condition: wmo(d.weather_code[i + 1]).label,
    })),
  };
}
