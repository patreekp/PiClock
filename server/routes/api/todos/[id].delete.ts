import { defineEventHandler, getRouterParam } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return { success: true };
});
