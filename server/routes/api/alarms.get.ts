import { defineEventHandler } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  return db.prepare('SELECT * FROM alarms ORDER BY time ASC').all();
});
