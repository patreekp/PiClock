import { defineEventHandler, getRouterParam } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  db.prepare('DELETE FROM alarms WHERE id = ?').run(id);
  
  if ((globalThis as any).reloadAlarms) {
    (globalThis as any).reloadAlarms();
  }
  
  return { success: true };
});
