import fs from 'fs';
import path from 'path';
import { getDb } from '../../db/database.js';

function getRootFolder() {
  const row = getDb().prepare(`SELECT value FROM config WHERE key = 'alarmFolder'`).get();
  return path.resolve(row?.value ?? '/media/alarms');
}

// Risolve `relativePath` dentro la cartella configurata e verifica che il
// risultato non ne esca (niente path traversal) — l'app non ha autenticazione
// ed è raggiungibile da chiunque in LAN, quindi questo controllo è l'unica
// barriera contro l'accesso a file arbitrari del filesystem.
function resolveSafePath(relativePath) {
  const root = getRootFolder();
  const resolved = path.normalize(path.join(root, relativePath || '.'));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

function toRelative(absolutePath) {
  return path.relative(getRootFolder(), absolutePath).split(path.sep).join('/');
}

function assertValidName(name) {
  if (!name || typeof name !== 'string' || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error('Invalid name');
  }
}

export function listDir(relativePath) {
  const root = getRootFolder();
  const dir = resolveSafePath(relativePath);
  const dirents = fs.readdirSync(dir, { withFileTypes: true });

  const entries = dirents.map((d) => {
    const abs = path.join(dir, d.name);
    const stat = fs.statSync(abs);
    return {
      name: d.name,
      type: d.isDirectory() ? 'dir' : 'file',
      size: d.isDirectory() ? null : stat.size,
      mtimeMs: stat.mtimeMs,
    };
  }).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { path: toRelative(dir), entries };
}

export function createFolder(relativePath, name) {
  assertValidName(name);
  const parent = resolveSafePath(relativePath);
  const target = path.join(parent, name);
  fs.mkdirSync(target, { recursive: false });
}

function syncLibraryOnDelete(db, absolutePath, isDir) {
  if (isDir) {
    db.prepare(`DELETE FROM audio_library WHERE path = ? OR path LIKE ?`).run(absolutePath, `${absolutePath}${path.sep}%`);
  } else {
    db.prepare(`DELETE FROM audio_library WHERE path = ?`).run(absolutePath);
  }
}

function syncLibraryOnMove(db, oldAbsolutePath, newAbsolutePath, isDir) {
  if (isDir) {
    const rows = db.prepare(`SELECT id, path FROM audio_library WHERE path = ? OR path LIKE ?`)
      .all(oldAbsolutePath, `${oldAbsolutePath}${path.sep}%`);
    const update = db.prepare(`UPDATE audio_library SET path = ? WHERE id = ?`);
    for (const row of rows) {
      update.run(newAbsolutePath + row.path.slice(oldAbsolutePath.length), row.id);
    }
  } else {
    db.prepare(`UPDATE audio_library SET path = ? WHERE path = ?`).run(newAbsolutePath, oldAbsolutePath);
  }
}

export function moveEntries(relativePaths, destRelativePath) {
  const dest = resolveSafePath(destRelativePath);
  const db = getDb();
  const moved = [];
  const errors = [];

  for (const relativePath of relativePaths) {
    try {
      const src = resolveSafePath(relativePath);
      const name = path.basename(src);
      const target = path.join(dest, name);
      if (fs.existsSync(target)) throw new Error('A file with this name already exists in the destination');

      const isDir = fs.statSync(src).isDirectory();
      fs.renameSync(src, target);
      syncLibraryOnMove(db, src, target, isDir);
      moved.push(relativePath);
    } catch (e) {
      errors.push({ path: relativePath, message: e.message });
    }
  }

  return { moved, errors };
}

export function deleteEntries(relativePaths) {
  const db = getDb();
  const deleted = [];
  const errors = [];

  for (const relativePath of relativePaths) {
    try {
      const abs = resolveSafePath(relativePath);
      const isDir = fs.statSync(abs).isDirectory();
      fs.rmSync(abs, { recursive: true });
      syncLibraryOnDelete(db, abs, isDir);
      deleted.push(relativePath);
    } catch (e) {
      errors.push({ path: relativePath, message: e.message });
    }
  }

  return { deleted, errors };
}

export { getRootFolder, resolveSafePath, assertValidName };
