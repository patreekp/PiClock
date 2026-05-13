import { defineEventHandler, readBody } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  const updateStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  
  const transaction = db.transaction((configObj) => {
    for (const [key, value] of Object.entries(configObj)) {
      updateStmt.run(key, String(value));
    }
  });
  
  transaction(body);
  
  return { success: true };
});
