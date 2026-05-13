import { defineEventHandler, readBody, getRouterParam } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);
  
  db.prepare('UPDATE todos SET text = ?, done = ? WHERE id = ?').run(body.text, body.done ? 1 : 0, id);
  return { success: true };
});
