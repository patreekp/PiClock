import { execFile, execFileSync } from 'child_process';
import { broadcast } from '../../sse.js';

const EXEC_TIMEOUT_MS = 20000;

function run(args) {
  return new Promise((resolve, reject) => {
    execFile('nmcli', args, { timeout: EXEC_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; return reject(err); }
      resolve(stdout);
    });
  });
}

function hasNmcliSync() {
  try { execFileSync('nmcli', ['--version'], { timeout: 3000 }); return true; }
  catch { return false; }
}

// Spezza una riga terse di nmcli (`-g field1,field2,...`) nei suoi campi,
// rispettando l'escaping di nmcli: `\:` è un ':' letterale, `\\` è un '\' letterale.
function parseTerseLine(line) {
  const fields = [];
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) {
      current += line[i + 1];
      i++;
    } else if (c === ':') {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

function mapNmcliError(e) {
  const msg = (e.stderr || e.message || '').toLowerCase();
  if (msg.includes('secrets were required') || msg.includes('no secrets') || msg.includes('802-1x') || msg.includes('key-mgmt'))
    return 'wrongPassword';
  if (e.killed || msg.includes('timeout'))
    return 'timeout';
  return 'connectFailed';
}

// ── realImpl — Raspberry Pi / Linux con NetworkManager ─────────────────────────
function createRealImpl() {
  let cachedIface = null;
  let lastScan = { networks: [], scanning: false, error: null };

  async function getIface() {
    if (cachedIface) return cachedIface;
    const out = await run(['-g', 'DEVICE,TYPE', 'device', 'status']);
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [device, type] = parseTerseLine(line);
      if (type === 'wifi') { cachedIface = device; return device; }
    }
    throw new Error('No WiFi interface found');
  }

  async function getEnabled() {
    const out = await run(['radio', 'wifi']);
    return out.trim() === 'enabled';
  }

  async function getConnected(iface) {
    const out = await run(['-g', 'ACTIVE,SSID,SECURITY,SIGNAL', 'device', 'wifi', 'list', 'ifname', iface]);
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [active, ssid, security, signal] = parseTerseLine(line);
      if (active !== 'yes') continue;
      let ip = null;
      try {
        const ipOut = await run(['-g', 'IP4.ADDRESS', 'device', 'show', iface]);
        const ipLine = ipOut.split('\n').find(l => l.trim());
        if (ipLine) ip = ipLine.split('/')[0];
      } catch { /* niente IP (es. ancora in fase di associazione) */ }
      return {
        ssid,
        secured: !!security && security !== '--',
        signal: parseInt(signal, 10) || 0,
        ip,
      };
    }
    return null;
  }

  async function status() {
    const enabled = await getEnabled();
    let connected = null;
    let iface = null;
    if (enabled) {
      try { iface = await getIface(); connected = await getConnected(iface); }
      catch { /* nessuna interfaccia wifi trovata */ }
    }
    return { supported: true, enabled, connected, iface };
  }

  async function setEnabled(enabled) {
    await run(['radio', 'wifi', enabled ? 'on' : 'off']);
    broadcast('wifi:status', await status());
  }

  async function listSaved() {
    const out = await run(['-g', 'NAME,TYPE,AUTOCONNECT', 'connection', 'show']);
    const rows = [];
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [name, type, autoConnect] = parseTerseLine(line);
      if (type === '802-11-wireless' || type === 'wifi') {
        rows.push({ ssid: name, autoConnect: autoConnect === 'yes' });
      }
    }
    return rows;
  }

  function getScanState() {
    return lastScan;
  }

  async function scan() {
    lastScan = { ...lastScan, scanning: true, error: null };
    broadcast('wifi:scan-start', {});
    try {
      const iface = await getIface();
      const out = await run(['-g', 'SSID,SECURITY,SIGNAL,ACTIVE', 'device', 'wifi', 'list', '--rescan', 'yes', 'ifname', iface]);
      const bySsid = new Map();
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        const [ssid, security, signal, active] = parseTerseLine(line);
        if (!ssid) continue; // rete nascosta, nessun SSID broadcast
        const sig = parseInt(signal, 10) || 0;
        const existing = bySsid.get(ssid);
        if (!existing || sig > existing.signal) {
          bySsid.set(ssid, { ssid, secured: !!security && security !== '--', signal: sig, active: active === 'yes' });
        }
      }
      const networks = [...bySsid.values()].sort((a, b) => b.signal - a.signal);
      lastScan = { networks, scanning: false, error: null };
      broadcast('wifi:scan-result', { networks });
      return networks;
    } catch (e) {
      lastScan = { networks: lastScan.networks, scanning: false, error: e.message };
      broadcast('wifi:scan-error', { message: e.message });
      throw e;
    }
  }

  async function connect(ssid, password) {
    const iface = await getIface();
    const saved = await listSaved();
    const isSaved = saved.some(s => s.ssid === ssid);
    try {
      if (isSaved) {
        await run(['connection', 'up', ssid]);
      } else if (password) {
        await run(['device', 'wifi', 'connect', ssid, 'password', password, 'ifname', iface]);
      } else {
        await run(['device', 'wifi', 'connect', ssid, 'ifname', iface]);
      }
    } catch (e) {
      throw new Error(mapNmcliError(e));
    }
    const result = await status();
    broadcast('wifi:status', result);
    return result.connected;
  }

  async function disconnect() {
    const iface = await getIface();
    await run(['device', 'disconnect', iface]);
    broadcast('wifi:status', await status());
  }

  async function forget(ssid) {
    await run(['connection', 'delete', ssid]);
    broadcast('wifi:saved-changed', {});
  }

  async function setAutoReconnect(enabled) {
    const saved = await listSaved();
    await Promise.all(saved.map(s =>
      run(['connection', 'modify', s.ssid, 'connection.autoconnect', enabled ? 'yes' : 'no']).catch(() => {})
    ));
  }

  return { status, setEnabled, scan, getScanState, connect, disconnect, listSaved, forget, setAutoReconnect };
}

// ── unsupportedImpl — Linux senza nmcli (NetworkManager non installato/attivo) ──
function createUnsupportedImpl(reason) {
  const err = async () => { throw new Error(reason); };
  return {
    status: async () => ({ supported: false, reason, enabled: false, connected: null, iface: null }),
    setEnabled: err,
    scan: err,
    getScanState: () => ({ networks: [], scanning: false, error: reason }),
    connect: err,
    disconnect: err,
    listSaved: async () => [],
    forget: err,
    setAutoReconnect: err,
  };
}

// ── mockImpl — sviluppo su Windows/macOS, nessun nmcli disponibile ──────────────
function createMockImpl() {
  const MOCK_LATENCY_MS = 900;
  const PROTECTED_SSID = 'Office-5G';
  const PROTECTED_PASSWORD = 'piclock123';
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  let enabled = true;
  let connected = { ssid: 'HomeNet', secured: true, signal: 82, ip: '192.168.1.42' };
  const baseNetworks = [
    { ssid: 'HomeNet', secured: true, signal: 82 },
    { ssid: PROTECTED_SSID, secured: true, signal: 64 },
    { ssid: 'Biblioteca Pubblica', secured: false, signal: 40 },
    { ssid: 'Vicino_Fastidioso', secured: true, signal: 21 },
  ];
  let saved = [
    { ssid: 'HomeNet', autoConnect: true },
    { ssid: 'Vecchia-Rete-Ufficio', autoConnect: true },
  ];
  let lastScan = { networks: [], scanning: false, error: null };

  async function status() {
    return {
      supported: true,
      enabled,
      connected: enabled ? connected : null,
      iface: 'wlan0 (mock)',
    };
  }

  async function setEnabled(next) {
    enabled = next;
    if (!enabled) connected = null;
    broadcast('wifi:status', await status());
  }

  function getScanState() { return lastScan; }

  async function scan() {
    lastScan = { ...lastScan, scanning: true, error: null };
    broadcast('wifi:scan-start', {});
    await delay(MOCK_LATENCY_MS);
    const networks = baseNetworks.map(n => ({ ...n, active: connected?.ssid === n.ssid && enabled }));
    lastScan = { networks, scanning: false, error: null };
    broadcast('wifi:scan-result', { networks });
    return networks;
  }

  async function connect(ssid, password) {
    await delay(MOCK_LATENCY_MS);
    const net = baseNetworks.find(n => n.ssid === ssid);
    if (!net) throw new Error('connectFailed');
    if (net.secured && !saved.some(s => s.ssid === ssid)) {
      if (ssid === PROTECTED_SSID && password !== PROTECTED_PASSWORD) {
        throw new Error('wrongPassword');
      }
    }
    connected = { ssid: net.ssid, secured: net.secured, signal: net.signal, ip: '192.168.1.' + (40 + Math.floor(Math.random() * 50)) };
    if (!saved.some(s => s.ssid === ssid)) saved = [...saved, { ssid, autoConnect: true }];
    const result = await status();
    broadcast('wifi:status', result);
    return result.connected;
  }

  async function disconnect() {
    await delay(300);
    connected = null;
    broadcast('wifi:status', await status());
  }

  async function listSaved() { return saved; }

  async function forget(ssid) {
    saved = saved.filter(s => s.ssid !== ssid);
    if (connected?.ssid === ssid) connected = null;
    broadcast('wifi:saved-changed', {});
  }

  async function setAutoReconnect(nextEnabled) {
    saved = saved.map(s => ({ ...s, autoConnect: nextEnabled }));
  }

  return { status, setEnabled, scan, getScanState, connect, disconnect, listSaved, forget, setAutoReconnect };
}

const isLinux = process.platform === 'linux';
const nmcliAvailable = isLinux && hasNmcliSync();

export const wifiService = nmcliAvailable
  ? createRealImpl()
  : isLinux
    ? createUnsupportedImpl('nmcli non trovato — verifica che NetworkManager sia installato e avviato')
    : createMockImpl();

if (!nmcliAvailable) {
  console.log(isLinux
    ? '[WiFi] nmcli non disponibile — pannello WiFi in modalità "non supportato"'
    : '[WiFi] Piattaforma non-Linux — pannello WiFi in modalità mock per sviluppo');
}
