import React, { useState, useRef, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

type Mode = 'hours' | 'minutes';

const pad = (n: number) => String(n).padStart(2, '0');

const R_OUTER = 88;
const R_INNER = 57;
const SVG_SIZE = 220;
const HIT_R = 19;

function getAngle(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  return (a + 360) % 360;
}

const CircularTimePicker: React.FC<Props> = ({
  value, onChange, onConfirm, onCancel,
  confirmLabel = 'OK', cancelLabel = 'Cancel',
  onDelete, deleteLabel = 'Delete',
}) => {
  const [hStr, mStr] = value.split(':');
  const [hours, setHours] = useState(parseInt(hStr ?? '7', 10));
  const [minutes, setMinutes] = useState(parseInt(mStr ?? '0', 10));
  const [mode, setMode] = useState<Mode>('hours');
  const svgRef = useRef<SVGSVGElement>(null);

  const buildTime = useCallback((h: number, m: number) => `${pad(h)}:${pad(m)}`, []);

  const adjustMinutes = useCallback((delta: number) => {
    setMinutes(prev => {
      const next = (prev + delta + 60) % 60;
      onChange(buildTime(hours, next));
      return next;
    });
  }, [hours, onChange, buildTime]);

  const hitFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = rect.width / SVG_SIZE;
    const dx = (clientX - (rect.left + rect.width / 2)) / scale;
    const dy = (clientY - (rect.top + rect.height / 2)) / scale;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { dx, dy, dist };
  }, []);

  const handleDialInteract = useCallback((clientX: number, clientY: number) => {
    const hit = hitFromEvent(clientX, clientY);
    if (!hit || hit.dist > 108) return;
    const angle = getAngle(hit.dx, hit.dy);

    if (mode === 'hours') {
      const isInner = hit.dist < 73;
      let h = Math.round(angle / 30) % 12;
      if (isInner) h += 12;
      if (h === 12 && !isInner) h = 0;
      setHours(h);
      onChange(buildTime(h, minutes));
      setTimeout(() => setMode('minutes'), 250);
    } else {
      let m = (Math.round(angle / 30) % 12) * 5;
      if (m === 60) m = 0;
      setMinutes(m);
      onChange(buildTime(hours, m));
    }
  }, [mode, hours, minutes, onChange, buildTime, hitFromEvent]);

  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    handleDialInteract(e.clientX, e.clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    if (t) handleDialInteract(t.clientX, t.clientY);
  };

  const items: React.ReactNode[] = [];

  if (mode === 'hours') {
    for (let h = 0; h < 24; h++) {
      const isOuter = h < 12;
      const r = isOuter ? R_OUTER : R_INNER;
      const angle = (h % 12) * 30;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x = r * Math.cos(rad);
      const y = r * Math.sin(rad);
      const selected = h === hours;
      if (selected) {
        items.push(<line key={`line-${h}`} x1={0} y1={0} x2={x} y2={y} stroke="var(--color-fg)" strokeWidth={1.5} opacity={0.35} />);
        items.push(<circle key={`sel-${h}`} cx={x} cy={y} r={HIT_R} fill="var(--color-fg)" />);
      }
      items.push(
        <text key={`h-${h}`} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={isOuter ? 12 : 11} fontFamily="inherit"
          fontWeight={selected ? 700 : 400}
          fill={selected ? 'var(--color-bg)' : 'var(--color-fg)'}
          opacity={selected ? 1 : isOuter ? 1 : 0.5}>
          {pad(h)}
        </text>
      );
    }
  } else {
    // Lancetta sempre al minuto esatto (0–59), indipendentemente dal dial a step 5
    const exactAngle = minutes * 6; // 360° / 60 min = 6° per minuto
    const exactRad = ((exactAngle - 90) * Math.PI) / 180;
    const exactX = R_OUTER * Math.cos(exactRad);
    const exactY = R_OUTER * Math.sin(exactRad);
    items.push(<line key="line-m-exact" x1={0} y1={0} x2={exactX} y2={exactY} stroke="var(--color-fg)" strokeWidth={1.5} opacity={0.35} />);
    items.push(<circle key="sel-m-exact" cx={exactX} cy={exactY} r={HIT_R} fill="var(--color-fg)" />);
    items.push(
      <text key="sel-m-exact-label" x={exactX} y={exactY} textAnchor="middle" dominantBaseline="central"
        fontSize={12} fontFamily="inherit" fontWeight={700}
        fill="var(--color-bg)">
        {pad(minutes)}
      </text>
    );

    // Tacche a step 5 sull'anello — etichette, senza pallino se già coperte dalla lancetta esatta
    for (let i = 0; i < 12; i++) {
      const m = i * 5;
      const angle = i * 30;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x = R_OUTER * Math.cos(rad);
      const y = R_OUTER * Math.sin(rad);
      if (minutes === m) continue; // già disegnato dalla lancetta esatta
      items.push(
        <text key={`m-${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={12} fontFamily="inherit" fontWeight={400}
          fill="var(--color-fg)">
          {pad(m)}
        </text>
      );
    }
  }

  // Bottone laterale +1/-1
  const SideButton = ({
    delta, label, side,
  }: {
    delta: number; label: string; side: 'left' | 'right';
  }) => (
    <button
      onClick={(e) => { e.stopPropagation(); adjustMinutes(delta); }}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); adjustMinutes(delta); }}
      className="flex flex-col items-center justify-center font-bold transition-opacity hover:opacity-60 active:opacity-40"
      style={{
        width: '64px',
        height: SVG_SIZE + 'px',
        fontSize: '22px',
        opacity: 0.9,
        color: 'var(--color-fg)',
        flexShrink: 0,
      }}
      aria-label={`${delta > 0 ? 'Aumenta' : 'Diminuisci'} minuti di 1`}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.45, marginBottom: '4px' }}>
        {delta > 0 ? '+1' : '−1'}
      </span>
      <span style={{ fontSize: '28px', lineHeight: 1 }}>{label}</span>
    </button>
  );

  return (
    <div
      onClick={stopProp}
      onTouchEnd={stopProp}
      className="flex flex-col items-center select-none"
      style={{ color: 'var(--color-fg)', width: '100%' }}
    >
      {/* Mode label */}
      <span className="text-xs uppercase tracking-[0.3em] font-bold opacity-40" style={{ marginBottom: '2px' }}>
        {mode === 'hours' ? 'hours' : 'minutes'}
      </span>

      {/* Digital display */}
      <div className="flex items-center gap-1 font-mono-clock font-bold leading-none tracking-tighter tabular-nums"
        style={{ fontSize: '60px', marginBottom: '4px' }}>
        <button onClick={(e) => { e.stopPropagation(); setMode('hours'); }}
          className="focus:outline-none transition-opacity"
          style={{ opacity: mode === 'hours' ? 1 : 0.25 }}>
          {pad(hours)}
        </button>
        <span style={{ opacity: 0.3 }}>:</span>
        <button onClick={(e) => { e.stopPropagation(); setMode('minutes'); }}
          className="focus:outline-none transition-opacity"
          style={{ opacity: mode === 'minutes' ? 1 : 0.25 }}>
          {pad(minutes)}
        </button>
      </div>

      {/* Dial + bottoni laterali */}
      <div className="flex items-center justify-center" style={{ width: '100%' }}>
        {/* Bottone -1: placeholder invisibile in modalità ore per mantenere layout stabile */}
        {mode === 'minutes' ? (
          <SideButton delta={-1} label="−" side="left" />
        ) : (
          <div style={{ width: '64px', height: SVG_SIZE + 'px', flexShrink: 0 }} />
        )}

        <svg
          ref={svgRef}
          width={SVG_SIZE} height={SVG_SIZE}
          viewBox={`${-SVG_SIZE / 2} ${-SVG_SIZE / 2} ${SVG_SIZE} ${SVG_SIZE}`}
          onClick={handleClick}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <circle r={102} fill="var(--color-fg)" opacity={0.07} />
          <circle r={4} fill="var(--color-fg)" opacity={0.4} />
          {items}
        </svg>

        {/* Bottone +1 */}
        {mode === 'minutes' ? (
          <SideButton delta={1} label="+" side="right" />
        ) : (
          <div style={{ width: '64px', height: SVG_SIZE + 'px', flexShrink: 0 }} />
        )}
      </div>

      {/* Bottoni azione — full width */}
      <div className="flex" style={{ borderTop: '1px solid var(--color-fg)', width: '100%', marginTop: '8px' }}>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
            className="flex-1 py-4 text-xs uppercase font-bold tracking-widest transition-opacity hover:opacity-60"
            style={{ borderRight: '1px solid var(--color-fg)' }}
          >
            {deleteLabel}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onCancel(); }}
          className="flex-1 py-4 text-xs uppercase font-bold tracking-widest transition-opacity hover:opacity-60"
          style={{ borderRight: '1px solid var(--color-fg)' }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm(buildTime(hours, minutes)); }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onConfirm(buildTime(hours, minutes)); }}
          className="flex-1 py-4 text-xs uppercase font-bold tracking-widest"
          style={{ backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default CircularTimePicker;