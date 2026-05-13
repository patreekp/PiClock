import { defineEventHandler, readBody } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const info = db.prepare('INSERT INTO alarms (time, label, enabled) VALUES (?, ?, ?)').run(body.time, body.label || '', body.enabled ? 1 : 0);
  
  if ((globalThis as any).reloadAlarms) {
    (globalThis as any).reloadAlarms();
  }
  
  return { id: info.lastInsertRowid, ...body };
});
