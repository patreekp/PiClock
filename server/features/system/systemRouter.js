import { Router } from 'express';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

export const systemRouter = Router();

/**
 * GET /api/system/info
 * Returns system metrics. Designed to be extended with more fields over time.
 * All values degrade gracefully: null = not available on this platform.
 */
systemRouter.get('/info', (req, res) => {
  const info = {
    cpuTemp: getCpuTemp(),
    // Future candidates:
    // uptime: getUptime(),
    // memUsed: getMemUsed(),
    // cpuLoad: getCpuLoad(),
  };
  res.json(info);
});

/** Reads CPU temperature from Linux thermal sysfs. Returns °C as a number, or null. */
function getCpuTemp() {
  try {
    const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
    const millideg = parseInt(raw, 10);
    if (isNaN(millideg)) return null;
    return Math.round(millideg / 100) / 10; // e.g. 54321 → 54.3
  } catch {
    // Windows dev machine or thermal_zone0 not present
    return null;
  }
}