import React, { useEffect, useRef, useState } from 'react';
import { useAudioLibraryStore, type LibraryEntry, type UploadItem } from '../../store/useAudioLibraryStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ThemedButton } from '@/components/ui-themed';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Folder, FolderPlus, Music2, Upload, FolderInput, Trash2,
  ChevronRight, Loader2, X, Check,
} from 'lucide-react';

const SUPPORTS_FOLDER_PICKER = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function breadcrumbParts(path: string): { label: string; path: string }[] {
  if (!path) return [];
  const segments = path.split('/');
  return segments.map((label, i) => ({ label, path: segments.slice(0, i + 1).join('/') }));
}

// Legge ricorsivamente file e cartelle droppati via drag & drop (desktop).
function readEntry(entry: FileSystemEntry, basePath: string): Promise<UploadItem[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file: File) => resolve([{ file, relativePath: basePath + file.name }]));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const collected: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(async (batch) => {
          if (batch.length === 0) {
            const nested = await Promise.all(collected.map((e) => readEntry(e, `${basePath}${entry.name}/`)));
            resolve(nested.flat());
          } else {
            collected.push(...batch);
            readBatch();
          }
        });
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

async function collectFromDataTransfer(dt: DataTransfer): Promise<UploadItem[]> {
  const entries = Array.from(dt.items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => e !== null);
  const nested = await Promise.all(entries.map((e) => readEntry(e, '')));
  return nested.flat();
}

const EntryIcon = ({ entry }: { entry: LibraryEntry }) => (
  entry.type === 'dir' ? <Folder size={18} className="opacity-70 flex-shrink-0" /> : <Music2 size={16} className="opacity-50 flex-shrink-0" />
);

// ── Breadcrumb riusato sia dal browser principale sia dal picker destinazione ──
const Breadcrumb = ({ path, rootLabel, onNavigate }: { path: string; rootLabel: string; onNavigate: (p: string) => void }) => (
  <div className="flex items-center gap-1 text-xs uppercase tracking-widest opacity-60 flex-wrap">
    <button onClick={() => onNavigate('')} className="hover:opacity-100 font-bold">{rootLabel}</button>
    {breadcrumbParts(path).map((seg) => (
      <React.Fragment key={seg.path}>
        <ChevronRight size={12} className="opacity-40" />
        <button onClick={() => onNavigate(seg.path)} className="hover:opacity-100 font-bold">{seg.label}</button>
      </React.Fragment>
    ))}
  </div>
);

// ── Dialog per scegliere la cartella di destinazione di uno "Sposta" ──────────
const FolderPickerDialog = ({ open, onClose, onConfirm, rootLabel }: {
  open: boolean; onClose: () => void; onConfirm: (destPath: string) => void; rootLabel: string;
}) => {
  const { t } = useTranslation();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const load = async (p: string) => {
    const res = await fetch(`/api/audio/library/list?path=${encodeURIComponent(p)}`);
    const data = await res.json();
    if (res.ok) { setPath(data.path); setEntries(data.entries.filter((e: LibraryEntry) => e.type === 'dir')); }
  };

  useEffect(() => { if (open) load(''); }, [open]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await fetch('/api/audio/library/mkdir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, name }),
    });
    setNewFolderOpen(false); setNewFolderName('');
    load(path);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[var(--color-bg)] text-[var(--color-fg)] border border-current rounded-none shadow-none max-w-md">
        <DialogHeader><DialogTitle className="text-xl font-bold uppercase tracking-widest">{t('library.moveTitle')}</DialogTitle></DialogHeader>
        <div className="py-2 space-y-3">
          <Breadcrumb path={path} rootLabel={rootLabel} onNavigate={load} />
          <div className="max-h-64 overflow-y-auto border border-current/10 custom-scrollbar">
            {entries.length === 0 && <p className="p-4 text-xs opacity-40 uppercase tracking-widest">{t('library.noSubfolders')}</p>}
            {entries.map((e) => (
              <button
                key={e.name}
                onClick={() => load(path ? `${path}/${e.name}` : e.name)}
                className="w-full flex items-center gap-2 p-3 border-b border-current/10 last:border-b-0 hover:opacity-60 text-left"
              >
                <Folder size={16} className="opacity-60" /> <span className="font-bold text-sm">{e.name}</span>
              </button>
            ))}
          </div>
          {newFolderOpen ? (
            <div className="flex gap-2">
              <Input
                autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                className="bg-transparent border-current rounded-none h-10 text-sm flex-1"
              />
              <ThemedButton onClick={handleCreateFolder} className="h-10 px-3 text-xs">{t('dialog.save')}</ThemedButton>
            </div>
          ) : (
            <ThemedButton onClick={() => setNewFolderOpen(true)} className="h-10 px-3 text-xs">
              <FolderPlus size={14} /> {t('library.newFolder')}
            </ThemedButton>
          )}
        </div>
        <DialogFooter className="flex gap-3 sm:justify-start">
          <ThemedButton variant="solid" onClick={() => onConfirm(path)} className="flex-1 h-12 text-sm">{t('library.moveHere')}</ThemedButton>
          <ThemedButton onClick={onClose} className="flex-1 h-12 text-sm">{t('dialog.cancel')}</ThemedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AudioLibraryManager = () => {
  const { t } = useTranslation();
  const {
    currentPath, entries, loading, selected, uploading, uploadProgress, error,
    list, navigate, toggleSelect, clearSelection, createFolder, moveSelected, deleteSelected, uploadFiles,
  } = useAudioLibraryStore();

  const [dragOver, setDragOver] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { list(''); }, []);

  const handleRowClick = (entry: LibraryEntry) => {
    if (entry.type === 'dir') navigate(currentPath ? `${currentPath}/${entry.name}` : entry.name);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (await createFolder(name)) { setNewFolderOpen(false); setNewFolderName(''); }
  };

  const handleMoveConfirm = async (destPath: string) => {
    await moveSelected(destPath);
    setMoveDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    await deleteSelected();
    setDeleteDialogOpen(false);
  };

  const handleFilesPicked = (fileList: FileList | null) => {
    if (!fileList) return;
    const items: UploadItem[] = Array.from(fileList).map((file) => ({
      file, relativePath: file.webkitRelativePath || file.name,
    }));
    uploadFiles(items);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = await collectFromDataTransfer(e.dataTransfer);
    uploadFiles(items);
  };

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      <Breadcrumb path={currentPath} rootLabel={t('library.root')} onNavigate={navigate} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="border-2 border-dashed p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-opacity"
        style={{ borderColor: dragOver ? 'var(--color-fg)' : 'color-mix(in srgb, var(--color-fg) 25%, transparent)', opacity: dragOver ? 1 : 0.8 }}
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-60">
          <Upload size={16} /> {t('library.dropHint')}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ThemedButton onClick={() => filesInputRef.current?.click()} className="h-10 px-4 text-xs">{t('library.chooseFiles')}</ThemedButton>
          {SUPPORTS_FOLDER_PICKER && (
            <ThemedButton onClick={() => folderInputRef.current?.click()} className="h-10 px-4 text-xs">{t('library.chooseFolder')}</ThemedButton>
          )}
        </div>
        <input ref={filesInputRef} type="file" multiple hidden onChange={(e) => { handleFilesPicked(e.target.files); e.target.value = ''; }} />
        <input ref={folderInputRef} type="file" multiple hidden {...{ webkitdirectory: 'true' }} onChange={(e) => { handleFilesPicked(e.target.files); e.target.value = ''; }} />
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-60">
          <Loader2 size={14} className="animate-spin" /> {t('library.uploading')}
        </div>
      )}
      {error && <p className="text-xs uppercase tracking-widest" style={{ color: '#c0392b' }}>{error}</p>}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {newFolderOpen ? (
          <div className="flex gap-2">
            <Input
              autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder={t('library.folderNamePlaceholder')}
              className="bg-transparent border-current rounded-none h-10 text-sm"
            />
            <ThemedButton onClick={handleCreateFolder} className="h-10 px-3 text-xs">{t('dialog.save')}</ThemedButton>
            <ThemedButton onClick={() => setNewFolderOpen(false)} className="h-10 px-3 text-xs">{t('dialog.cancel')}</ThemedButton>
          </div>
        ) : (
          <ThemedButton onClick={() => setNewFolderOpen(true)} className="h-10 px-4 text-xs">
            <FolderPlus size={14} /> {t('library.newFolder')}
          </ThemedButton>
        )}

        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest opacity-60">{t('library.selectedCount', { count: selectedCount })}</span>
            <ThemedButton onClick={() => setMoveDialogOpen(true)} className="h-10 px-4 text-xs"><FolderInput size={14} /> {t('library.move')}</ThemedButton>
            <ThemedButton onClick={() => setDeleteDialogOpen(true)} className="h-10 px-4 text-xs"><Trash2 size={14} /> {t('library.delete')}</ThemedButton>
            <button onClick={clearSelection} className="opacity-40 hover:opacity-100 p-1" aria-label="clear selection"><X size={16} /></button>
          </div>
        )}
      </div>

      {/* Entry list */}
      <div className="border border-current/10">
        {loading && (
          <div className="p-6 flex items-center justify-center opacity-50"><Loader2 size={18} className="animate-spin" /></div>
        )}
        {!loading && entries.length === 0 && (
          <p className="p-6 text-center text-sm opacity-40 uppercase tracking-widest">{t('library.empty')}</p>
        )}
        {!loading && entries.map((entry) => {
          const isSelected = selected.has(entry.name);
          return (
            <div key={entry.name} className="flex items-center gap-3 p-3 border-b border-current/10 last:border-b-0 hover:bg-current/5 transition-colors">
              <button
                onClick={() => toggleSelect(entry.name)}
                aria-label="select"
                className="w-5 h-5 flex-shrink-0 flex items-center justify-center border"
                style={{ borderColor: 'var(--color-fg)', backgroundColor: isSelected ? 'var(--color-fg)' : 'transparent' }}
              >
                {isSelected && <Check size={12} style={{ color: 'var(--color-bg)' }} />}
              </button>
              <button onClick={() => handleRowClick(entry)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <EntryIcon entry={entry} />
                <span className="font-bold truncate">{entry.name}</span>
              </button>
              {entry.size !== null && <span className="text-xs font-mono opacity-50 flex-shrink-0">{formatSize(entry.size)}</span>}
            </div>
          );
        })}
      </div>

      <FolderPickerDialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} onConfirm={handleMoveConfirm} rootLabel={t('library.root')} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[var(--color-bg)] text-[var(--color-fg)] border border-current rounded-none shadow-none max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-bold uppercase tracking-widest">{t('library.delete')}</DialogTitle></DialogHeader>
          <p className="py-2 text-sm opacity-70">{t('library.deleteConfirm', { count: selectedCount })}</p>
          <DialogFooter className="flex gap-3 sm:justify-start">
            <ThemedButton variant="solid" onClick={handleDeleteConfirm} className="flex-1 h-12 text-sm">{t('library.delete')}</ThemedButton>
            <ThemedButton onClick={() => setDeleteDialogOpen(false)} className="flex-1 h-12 text-sm">{t('dialog.cancel')}</ThemedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudioLibraryManager;
