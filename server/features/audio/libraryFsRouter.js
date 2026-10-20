import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { listDir, createFolder, moveEntries, deleteEntries, resolveSafePath } from './libraryFsService.js';

export const libraryFsRouter = Router();

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // per file — nessuna auth nell'app, limite di sicurezza contro riempimento disco

// busboy/multer sanitizzano `file.originalname` al solo basename (niente '/'),
// quindi il sottopercorso di un file caricato da una cartella droppata non può
// viaggiare dentro il nome file stesso — il client lo manda a parte, nel campo
// di testo `relativePaths` (JSON array, un elemento per file, nello STESSO
// ordine in cui i file vengono appesi alla FormData). Deve precedere i campi
// `files` nella FormData: multer popola `req.body` in ordine di arrivo, quindi
// il valore è già disponibile quando scatta la callback `destination` del
// primo file. L'indice avanza una volta per file (un solo contatore, usato
// solo qui — `filename` non ne ha bisogno, il basename è già sicuro).
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const destPath = req.body.destPath || '';
      let relativePaths = [];
      try { relativePaths = JSON.parse(req.body.relativePaths || '[]'); } catch { /* campo assente */ }

      const idx = req._uploadIdx ?? 0;
      req._uploadIdx = idx + 1;
      const relDir = path.dirname(relativePaths[idx] || '');

      const targetDir = resolveSafePath(relDir === '.' || relDir === '' ? destPath : path.posix.join(destPath, relDir));
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    cb(null, path.basename(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } });

libraryFsRouter.get('/list', (req, res) => {
  try { res.json(listDir(req.query.path ?? '')); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

libraryFsRouter.post('/mkdir', (req, res) => {
  try {
    const { path: relativePath, name } = req.body ?? {};
    createFolder(relativePath ?? '', name);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

libraryFsRouter.post('/move', (req, res) => {
  try {
    const { items, destPath } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items is required' });
    res.json(moveEntries(items, destPath ?? ''));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

libraryFsRouter.post('/delete', (req, res) => {
  try {
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items is required' });
    res.json(deleteEntries(items));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

libraryFsRouter.post('/upload', upload.array('files'), (req, res) => {
  res.json({ ok: true, uploaded: (req.files ?? []).length });
});

// Multer segnala errori (es. file troppo grande, destinazione invalida) tramite `next(err)`
// invece che lanciare — serve un error handler dedicato su questo router.
libraryFsRouter.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});
