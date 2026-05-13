import { defineEventHandler } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  return db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
});
