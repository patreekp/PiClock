import { defineEventHandler, readBody } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body.text) {
    throw createError({ statusCode: 400, statusMessage: 'Text is required' });
  }
  
  const info = db.prepare('INSERT INTO todos (text) VALUES (?)').run(body.text);
  return { id: info.lastInsertRowid, text: body.text, done: 0 };
});
