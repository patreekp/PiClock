import fs from 'fs';
import path from 'path';

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'];

/**
 * Cammina ricorsivamente `rootAbsolutePath` e ritorna i path RELATIVI
 * (separatore '/') dei file audio trovati, a qualunque profondità.
 * Usato sia dallo scan highlights (audioLibraryService) sia dalla selezione
 * random per le sveglie (alarmService) — organizzare i file in sottocartelle
 * non deve renderli invisibili a nessuno dei due.
 */
export function walkAudioFiles(rootAbsolutePath) {
  const results = [];

  function walk(dirAbsolutePath, relativePrefix) {
    let entries;
    try { entries = fs.readdirSync(dirAbsolutePath, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const relative = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dirAbsolutePath, entry.name), relative);
      } else if (AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        results.push(relative);
      }
    }
  }

  walk(rootAbsolutePath, '');
  return results;
}
