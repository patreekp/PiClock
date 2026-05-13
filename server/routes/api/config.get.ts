import { defineEventHandler, readBody } from 'nitropack/runtime';
import db from '../../utils/db';

export default defineEventHandler(async (event) => {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string, value: string }[];
  const config: Record<string, string> = {};
  rows.forEach(row => {
    config[row.key] = row.value;
  });
  return config;
});
