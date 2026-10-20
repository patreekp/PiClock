import { create } from 'zustand';
import { onSseEvent } from '../lib/sseHub';

export interface WifiNetwork {
  ssid: string;
  secured: boolean;
  signal: number;
  active?: boolean;
}

export interface WifiConnection {
  ssid: string;
  secured: boolean;
  signal: number;
  ip: string | null;
}

export interface WifiSavedNetwork {
  ssid: string;
  autoConnect: boolean;
}

export type WifiConnectError = 'wrongPassword' | 'timeout' | 'connectFailed';

interface WifiStoreState {
  supported: boolean;
  reason: string | null;
  enabled: boolean;
  connected: WifiConnection | null;
  networks: WifiNetwork[];
  scanning: boolean;
  scanError: string | null;
  saved: WifiSavedNetwork[];
  connectingSsid: string | null;

  connect: () => void;
  fetchStatus: () => Promise<void>;
  toggleEnabled: (enabled: boolean) => Promise<void>;
  scan: () => Promise<void>;
  connectToNetwork: (ssid: string, password?: string) => Promise<{ ok: boolean; error?: WifiConnectError }>;
  disconnect: () => Promise<void>;
  fetchSaved: () => Promise<void>;
  forget: (ssid: string) => Promise<void>;
}

let subscribed = false;

export const useWifiStore = create<WifiStoreState>((set, get) => ({
  supported: true, reason: null, enabled: false, connected: null,
  networks: [], scanning: false, scanError: null, saved: [], connectingSsid: null,

  connect: () => {
    if (subscribed) return;
    subscribed = true;

    get().fetchStatus();
    fetch('/api/wifi/networks').then(res => res.json())
      .then(data => set({ networks: data.networks ?? [], scanning: !!data.scanning, scanError: data.error ?? null }))
      .catch(e => console.error('Failed to fetch wifi networks', e));

    onSseEvent('wifi:status', (data) => set({
      supported: data.supported, reason: data.reason ?? null,
      enabled: data.enabled, connected: data.connected,
    }));
    onSseEvent('wifi:scan-start', () => set({ scanning: true, scanError: null }));
    onSseEvent('wifi:scan-result', (data) => set({ scanning: false, networks: data.networks ?? [] }));
    onSseEvent('wifi:scan-error', (data) => set({ scanning: false, scanError: data.message ?? 'scan failed' }));
    onSseEvent('wifi:saved-changed', () => get().fetchSaved());
  },

  fetchStatus: async () => {
    try {
      const res = await fetch('/api/wifi/status');
      const data = await res.json();
      set({ supported: data.supported, reason: data.reason ?? null, enabled: data.enabled, connected: data.connected });
    } catch (e) { console.error('Failed to fetch wifi status', e); }
  },

  toggleEnabled: async (enabled) => {
    set({ enabled });
    try { await fetch('/api/wifi/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }); }
    catch (e) { console.error('Failed to toggle wifi', e); }
  },

  scan: async () => {
    set({ scanning: true, scanError: null });
    try { await fetch('/api/wifi/scan', { method: 'POST' }); }
    catch (e) { set({ scanning: false, scanError: (e as Error).message }); }
  },

  connectToNetwork: async (ssid, password) => {
    set({ connectingSsid: ssid });
    try {
      const res = await fetch('/api/wifi/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password }),
      });
      const data = await res.json();
      if (data.ok) { set({ connected: data.connected, connectingSsid: null }); return { ok: true }; }
      set({ connectingSsid: null });
      return { ok: false, error: (data.error as WifiConnectError) ?? 'connectFailed' };
    } catch (e) {
      set({ connectingSsid: null });
      return { ok: false, error: 'connectFailed' };
    }
  },

  disconnect: async () => {
    try { await fetch('/api/wifi/disconnect', { method: 'POST' }); }
    catch (e) { console.error('Failed to disconnect wifi', e); }
  },

  fetchSaved: async () => {
    try {
      const res = await fetch('/api/wifi/saved');
      const data = await res.json();
      set({ saved: data });
    } catch (e) { console.error('Failed to fetch saved wifi networks', e); }
  },

  forget: async (ssid) => {
    try {
      await fetch(`/api/wifi/saved/${encodeURIComponent(ssid)}`, { method: 'DELETE' });
      await get().fetchSaved();
    } catch (e) { console.error('Failed to forget wifi network', e); }
  },
}));
