import { defineEventHandler, readBody, getRouterParam } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);
  
  db.prepare('UPDATE alarms SET time = ?, label = ?, enabled = ? WHERE id = ?').run(
    body.time, 
    body.label, 
    body.enabled ? 1 : 0, 
    id
  );
  
  if ((globalThis as any).reloadAlarms) {
    (globalThis as any).reloadAlarms();
  }
  
  return { success: true };
});
