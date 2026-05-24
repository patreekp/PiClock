/**
 * ui-themed.tsx
 * Componenti UI che usano CSS variables (--color-fg / --color-bg)
 * invece delle classi Tailwind bg-current/text-background che non funzionano
 * correttamente con il tema e-paper di PiClock.
 *
 * Posizione: src/components/ui-themed.tsx
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ── Stili base ────────────────────────────────────────────────────────────────
const activeBtnStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-fg)',
  color: 'var(--color-bg)',
};

const inactiveBtnStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: 'var(--color-fg)',
};

// ── ThemedSwitch ──────────────────────────────────────────────────────────────
// Sostituisce shadcn Switch — usa CSS variables per il colore attivo
interface ThemedSwitchProps {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  className?: string;
}

export const ThemedSwitch = ({ checked, onCheckedChange, className }: ThemedSwitchProps) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn('relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none', className)}
    style={{
      width: '3.5rem',   // w-14
      height: '2rem',    // h-8
      backgroundColor: checked ? 'var(--color-fg)' : 'transparent',
      border: '2px solid var(--color-fg)',
    }}
  >
    <span
      className="absolute top-1/2 -translate-y-1/2 rounded-full transition-transform duration-200"
      style={{
        width: '1.25rem',
        height: '1.25rem',
        backgroundColor: checked ? 'var(--color-bg)' : 'var(--color-fg)',
        transform: `translateY(-50%) translateX(${checked ? '1.75rem' : '0.2rem'})`,
      }}
    />
  </button>
);

// ── ThemedToggleGroup ─────────────────────────────────────────────────────────
// Bottoni segmentati tipo Off/Locale/Audjust o 1min/5min/10min
export interface ToggleOption<T extends string | number> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ThemedToggleGroupProps<T extends string | number> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function ThemedToggleGroup<T extends string | number>({
  options, value, onChange, className,
}: ThemedToggleGroupProps<T>) {
  return (
    <div className={cn('flex border border-current overflow-hidden flex-shrink-0', className)}>
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            title={opt.disabled ? 'Non disponibile' : undefined}
            style={isActive && !opt.disabled ? activeBtnStyle : inactiveBtnStyle}
            className={cn(
              'flex items-center gap-2 px-4 h-12 text-xs font-bold uppercase tracking-widest transition-opacity',
              i !== 0 && 'border-l border-current',
              opt.disabled ? 'opacity-20 cursor-not-allowed' : !isActive && 'hover:opacity-60',
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── ThemedButton ──────────────────────────────────────────────────────────────
// Bottone outline standard (es. "Modifica", "+", "Nuova")
interface ThemedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'solid';
  children: React.ReactNode;
  className?: string;
}

export const ThemedButton = ({
  variant = 'outline', children, className, style, disabled, ...props
}: ThemedButtonProps) => {
  const baseStyle: React.CSSProperties = variant === 'solid'
    ? { backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)', ...style }
    : { backgroundColor: 'transparent', color: 'var(--color-fg)', border: '1px solid var(--color-fg)', ...style };

  return (
    <button
      disabled={disabled}
      style={baseStyle}
      className={cn(
        'flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-opacity',
        'hover:opacity-70 active:opacity-50',
        disabled && 'opacity-30 cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};