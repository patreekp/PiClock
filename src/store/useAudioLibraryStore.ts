import { create } from 'zustand';

export interface LibraryEntry {
  name: string;
  type: 'dir' | 'file';
  size: number | null;
  mtimeMs: number;
}

export interface UploadItem {
  file: File;
  relativePath: string; // es. "Sottocartella/traccia.mp3", oppure solo "traccia.mp3"
}

interface AudioLibraryStoreState {
  currentPath: string;
  entries: LibraryEntry[];
  loading: boolean;
  selected: Set<string>;
  uploading: boolean;
  uploadProgress: { done: number; total: number };
  error: string | null;

  list: (path: string) => Promise<void>;
  navigate: (path: string) => Promise<void>;
  toggleSelect: (name: string) => void;
  clearSelection: () => void;
  createFolder: (name: string) => Promise<boolean>;
  moveSelected: (destPath: string) => Promise<boolean>;
  deleteSelected: () => Promise<boolean>;
  uploadFiles: (items: UploadItem[]) => Promise<boolean>;
}

export const useAudioLibraryStore = create<AudioLibraryStoreState>((set, get) => ({
  currentPath: '',
  entries: [],
  loading: false,
  selected: new Set(),
  uploading: false,
  uploadProgress: { done: 0, total: 0 },
  error: null,

  list: async (path) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/audio/library/list?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to list folder');
      set({ currentPath: data.path, entries: data.entries, loading: false, selected: new Set() });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  navigate: async (path) => { await get().list(path); },

  toggleSelect: (name) => {
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(name)) next.delete(name); else next.add(name);
      return { selected: next };
    });
  },

  clearSelection: () => set({ selected: new Set() }),

  createFolder: async (name) => {
    try {
      const res = await fetch('/api/audio/library/mkdir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: get().currentPath, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create folder');
      await get().list(get().currentPath);
      return true;
    } catch (e) { set({ error: (e as Error).message }); return false; }
  },

  moveSelected: async (destPath) => {
    const items = [...get().selected].map((name) => joinPath(get().currentPath, name));
    try {
      const res = await fetch('/api/audio/library/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, destPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to move');
      await get().list(get().currentPath);
      return data.errors?.length === 0;
    } catch (e) { set({ error: (e as Error).message }); return false; }
  },

  deleteSelected: async () => {
    const items = [...get().selected].map((name) => joinPath(get().currentPath, name));
    try {
      const res = await fetch('/api/audio/library/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      await get().list(get().currentPath);
      return data.errors?.length === 0;
    } catch (e) { set({ error: (e as Error).message }); return false; }
  },

  uploadFiles: async (items) => {
    if (items.length === 0) return true;
    set({ uploading: true, uploadProgress: { done: 0, total: items.length }, error: null });
    try {
      const formData = new FormData();
      // destPath e relativePaths devono precedere i campi "files" nella FormData:
      // il server li legge da req.body nella callback multer "destination",
      // che per il PRIMO file viene chiamata mentre lo stream multipart viene
      // ancora parsato — i campi successivi ai file non sarebbero ancora disponibili.
      formData.append('destPath', get().currentPath);
      formData.append('relativePaths', JSON.stringify(items.map((i) => i.relativePath)));
      for (const item of items) formData.append('files', item.file, item.file.name);

      const res = await fetch('/api/audio/library/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      set({ uploading: false, uploadProgress: { done: items.length, total: items.length } });
      await get().list(get().currentPath);
      return true;
    } catch (e) {
      set({ uploading: false, error: (e as Error).message });
      return false;
    }
  },
}));

function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}
