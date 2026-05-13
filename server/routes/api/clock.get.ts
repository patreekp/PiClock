import { defineEventHandler } from 'nitropack/runtime';
import { DateTime } from 'luxon';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const timezoneRow = db.prepare('SELECT value FROM config WHERE key = ?').get('timezone') as { value: string } | undefined;
  const timezone = timezoneRow?.value || 'Europe/Rome';
  
  const now = DateTime.now().setZone(timezone);
  
  return {
    time: now.toISO(),
    timezone: timezone,
    formatted: now.toFormat('HH:mm:ss'),
    date: now.toFormat('cccc, d MMMM yyyy')
  };
});
