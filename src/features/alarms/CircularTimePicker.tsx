import React, { useState, useRef, useCallback } from 'react';

interface Props {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

type Mode = 'hours' | 'minutes';

const pad = (n: number) => String(n).padStart(2, '0');

const R_OUTER = 110;
const R_INNER = 72;
const SVG_SIZE = 280;
const HIT_R = 22;

function getAngle(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  return (a + 360) % 360;
}

const CircularTimePicker: React.FC<Props> = ({
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
}) => {
  const [hStr, mStr] = value.split(':');
  const [hours, setHours] = useState(parseInt(hStr ?? '7', 10));
  const [minutes, setMinutes] = useState(parseInt(mStr ?? '0', 10));
  const [mode, setMode] = useState<Mode>('hours');
  const svgRef = useRef<SVGSVGElement>(null);

  const buildTime = useCallback(
    (h: number, m: number) => `${pad(h)}:${pad(m)}`,
    []
  );

  const hitFromEvent = useCallback(
    (clientX: number, clientY: number): { dx: number; dy: number; dist: number } | null => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const scale = rect.width / SVG_SIZE;
      const dx = (clientX - (rect.left + rect.width / 2)) / scale;
      const dy = (clientY - (rect.top + rect.height / 2)) / scale;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { dx, dy, dist };
    },
    []
  );

  const handleDialInteract = useCallback(
    (clientX: number, clientY: number) => {
      const hit = hitFromEvent(clientX, clientY);
      if (!hit || hit.dist > 135) return;
      const angle = getAngle(hit.dx, hit.dy);

      if (mode === 'hours') {
        const isInner = hit.dist < 91;
        let h = Math.round(angle / 30) % 12;
        if (isInner) h += 12;
        if (h === 12 && !isInner) h = 0;
        setHours(h);
        onChange(buildTime(h, minutes));
        // auto-advance to minutes
        setTimeout(() => setMode('minutes'), 250);
      } else {
        let m = (Math.round(angle / 30) % 12) * 5;
        if (m === 60) m = 0;
        setMinutes(m);
        onChange(buildTime(hours, m));
      }
    },
    [mode, hours, minutes, onChange, buildTime, hitFromEvent]
  );

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    handleDialInteract(e.clientX, e.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (t) handleDialInteract(t.clientX, t.clientY);
  };

  // ── SVG elements ──────────────────────────────────────────────
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
        items.push(
          <line
            key={`line-${h}`}
            x1={0} y1={0} x2={x} y2={y}
            stroke="var(--color-fg)"
            strokeWidth={1.5}
            opacity={0.35}
          />
        );
        items.push(
          <circle
            key={`sel-${h}`}
            cx={x} cy={y} r={HIT_R}
            fill="var(--color-fg)"
          />
        );
      }

      items.push(
        <text
          key={`h-${h}`}
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isOuter ? 15 : 13}
          fontFamily="inherit"
          fontWeight={selected ? 700 : 400}
          fill={
            selected
              ? 'var(--color-bg)'
              : isOuter
              ? 'var(--color-fg)'
              : 'var(--color-fg)'
          }
          opacity={selected ? 1 : isOuter ? 1 : 0.5}
        >
          {pad(h)}
        </text>
      );
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const m = i * 5;
      const angle = i * 30;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x = R_OUTER * Math.cos(rad);
      const y = R_OUTER * Math.sin(rad);
      const selected = minutes === m;

      if (selected) {
        items.push(
          <line
            key={`line-m${i}`}
            x1={0} y1={0} x2={x} y2={y}
            stroke="var(--color-fg)"
            strokeWidth={1.5}
            opacity={0.35}
          />
        );
        items.push(
          <circle
            key={`sel-m${i}`}
            cx={x} cy={y} r={HIT_R}
            fill="var(--color-fg)"
          />
        );
      }

      items.push(
        <text
          key={`m-${i}`}
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontFamily="inherit"
          fontWeight={selected ? 700 : 400}
          fill={selected ? 'var(--color-bg)' : 'var(--color-fg)'}
        >
          {pad(m)}
        </text>
      );
    }
  }

  return (
    <div
      className="flex flex-col items-center gap-4 select-none"
      style={{ color: 'var(--color-fg)' }}
    >
      {/* Mode label */}
      <span className="text-xs uppercase tracking-[0.3em] font-bold opacity-40">
        {mode === 'hours' ? 'hours' : 'minutes'}
      </span>

      {/* Digital display — tap to switch mode */}
      <div className="flex items-center gap-1 font-mono-clock font-bold text-[14vw] leading-none tracking-tighter tabular-nums">
        <button
          onClick={() => setMode('hours')}
          className="transition-opacity focus:outline-none"
          style={{ opacity: mode === 'hours' ? 1 : 0.25 }}
        >
          {pad(hours)}
        </button>
        <span style={{ opacity: 0.3 }}>:</span>
        <button
          onClick={() => setMode('minutes')}
          className="transition-opacity focus:outline-none"
          style={{ opacity: mode === 'minutes' ? 1 : 0.25 }}
        >
          {pad(minutes)}
        </button>
      </div>

      {/* Dial */}
      <svg
        ref={svgRef}
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`${-SVG_SIZE / 2} ${-SVG_SIZE / 2} ${SVG_SIZE} ${SVG_SIZE}`}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none', cursor: 'pointer', maxWidth: '70vw', maxHeight: '70vw' }}
      >
        {/* Background circle */}
        <circle r={128} fill="var(--color-fg)" opacity={0.07} />
        {/* Center dot */}
        <circle r={4} fill="var(--color-fg)" opacity={0.4} />
        {items}
      </svg>

      {/* Buttons */}
      <div className="flex w-full" style={{ borderTop: '1px solid var(--color-fg)', opacity: 1 }}>
        <button
          onClick={onCancel}
          className="flex-1 py-5 text-xs uppercase font-bold tracking-widest hover:opacity-60 transition-opacity active:opacity-40"
          style={{ borderRight: '1px solid var(--color-fg)' }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => onConfirm(buildTime(hours, minutes))}
          className="flex-1 py-5 text-xs uppercase font-bold tracking-widest hover:opacity-90 transition-opacity active:opacity-70"
          style={{ backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default CircularTimePicker;