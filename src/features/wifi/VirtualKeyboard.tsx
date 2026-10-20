import React, { useState } from 'react';
import { ArrowBigUp, Delete, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tastiera virtuale a tema PiClock — solo lettere A-Z, numeri e simboli comuni.
 * Nessun accento, nessuna emoji, nessun autocomplete: pensata per l'inserimento
 * di password WiFi su un touchscreen senza tastiera fisica.
 */
interface VirtualKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  className?: string;
}

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '_', '=', '+', '!', '?', '@', '#', '$', '%'],
  ['/', '\\', ':', ';', '.', ',', "'", '"', '~', '^'],
  ['(', ')', '[', ']', '{', '}', '<', '>', '&', '*'],
];

const ROW_OFFSETS = ['0%', '2%', '6%', '10%'];

const keyBaseClass = 'flex items-center justify-center h-11 font-bold transition-opacity hover:opacity-60 active:opacity-40 select-none';
const keyStyle: React.CSSProperties = {
  border: '1px solid var(--color-fg)',
  borderColor: 'color-mix(in srgb, var(--color-fg) 20%, transparent)',
  background: 'transparent',
  color: 'var(--color-fg)',
};
const actionKeyStyle: React.CSSProperties = { ...keyStyle, borderColor: 'var(--color-fg)' };
const enterKeyStyle: React.CSSProperties = { backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' };

export const VirtualKeyboard = ({ value, onChange, onSubmit, maxLength = 64, className }: VirtualKeyboardProps) => {
  const [page, setPage] = useState<'letters' | 'symbols'>('letters');
  const [shift, setShift] = useState(false);

  const pressKey = (char: string) => {
    if (value.length >= maxLength) return;
    onChange(value + (page === 'letters' && shift ? char.toUpperCase() : char));
  };
  const pressBackspace = () => onChange(value.slice(0, -1));
  const pressSpace = () => { if (value.length < maxLength) onChange(value + ' '); };

  const rows = page === 'letters' ? LETTER_ROWS : SYMBOL_ROWS;

  return (
    <div
      className={cn('flex flex-col gap-2 select-none', className)}
      style={{ touchAction: 'none' }}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5" style={{ marginLeft: ROW_OFFSETS[i] ?? '0%', marginRight: ROW_OFFSETS[i] ?? '0%' }}>
          {row.map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => pressKey(char)}
              className={cn(keyBaseClass, 'flex-1 text-base')}
              style={{ ...keyStyle, textTransform: page === 'letters' && shift ? 'uppercase' : 'none' }}
            >
              {char}
            </button>
          ))}
        </div>
      ))}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setPage(page === 'letters' ? 'symbols' : 'letters')}
          className={cn(keyBaseClass, 'text-xs uppercase tracking-widest')}
          style={{ ...actionKeyStyle, flex: '0 0 20%' }}
        >
          {page === 'letters' ? '123' : 'ABC'}
        </button>
        {page === 'letters' && (
          <button
            type="button"
            onClick={() => setShift(!shift)}
            className={keyBaseClass}
            style={{ ...actionKeyStyle, flex: '0 0 14%', backgroundColor: shift ? 'var(--color-fg)' : 'transparent', color: shift ? 'var(--color-bg)' : 'var(--color-fg)' }}
            aria-label="shift"
          >
            <ArrowBigUp size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={pressSpace}
          className={cn(keyBaseClass, 'text-xs uppercase tracking-widest')}
          style={{ ...actionKeyStyle, flex: 1 }}
        >
          Space
        </button>
        <button
          type="button"
          onClick={pressBackspace}
          className={keyBaseClass}
          style={{ ...actionKeyStyle, flex: '0 0 14%' }}
          aria-label="backspace"
        >
          <Delete size={18} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className={keyBaseClass}
          style={{ ...enterKeyStyle, flex: '0 0 16%' }}
          aria-label="enter"
        >
          <CornerDownLeft size={18} />
        </button>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
