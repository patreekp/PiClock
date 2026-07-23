import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useTranslation } from '../../i18n/useTranslation';
import bellSound from '../../assets/sounds/bell.mp3';

type Phase = 'focus' | 'shortBreak' | 'longBreak';

interface TimerState {
  phase: Phase;
  sessionIndex: number;
  secondsLeft: number;
  running: boolean;
  cycleComplete: boolean;
}

// ── Bell sound ────────────────────────────────────────────────────────────────
function playBell() {
  try {
    const audio = new Audio(bellSound);
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch (_) {}
}

// ── Hourglass SVG ─────────────────────────────────────────────────────────────
const Hourglass = ({ progress }: { progress: number }) => {
  const TOP_Y1 = 12, TOP_Y2 = 68;
  const BOT_Y2 = 128;
  const topHeight = TOP_Y2 - TOP_Y1;
  const botHeight = BOT_Y2 - 74;

  const topSandHeight = topHeight * (1 - progress);
  const topSandY = TOP_Y1 + (topHeight - topSandHeight);
  const botSandHeight = botHeight * progress;
  const botSandY = BOT_Y2 - botSandHeight;
  const showTrickle = progress < 0.99;

  return (
    <svg viewBox="0 0 140 142" width="100%" height="100%" style={{ overflow: 'visible' }} aria-hidden="true">
      <defs>
        <clipPath id="hg-top-sand-clip">
          <rect x="0" y={topSandY} width="140" height={topSandHeight} />
        </clipPath>
        <clipPath id="hg-bot-sand-clip">
          <rect x="0" y={botSandY} width="140" height={botSandHeight} />
        </clipPath>
      </defs>
      <polygon points="10,12 130,12 70,68" fill="var(--color-bg)" stroke="var(--color-fg)" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="10,12 130,12 70,68" fill="var(--color-fg)" clipPath="url(#hg-top-sand-clip)" />
      <rect x="66" y="67" width="8" height="8" fill="var(--color-fg)" opacity="0.3" />
      <polygon points="10,128 130,128 70,72" fill="var(--color-bg)" stroke="var(--color-fg)" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="10,128 130,128 70,72" fill="var(--color-fg)" clipPath="url(#hg-bot-sand-clip)" />
      <line x1="8" y1="12" x2="132" y2="12" stroke="var(--color-fg)" strokeWidth="3" strokeLinecap="round" />
      <line x1="8" y1="128" x2="132" y2="128" stroke="var(--color-fg)" strokeWidth="3" strokeLinecap="round" />
      {showTrickle && (
        <line x1="70" y1="74" x2="70" y2="88" stroke="var(--color-fg)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      )}
    </svg>
  );
};

// ── Arc (pie) SVG ─────────────────────────────────────────────────────────────
const ArcPie = ({ progress }: { progress: number }) => {
  const cx = 70, cy = 70, r = 54;
  const angle = (1 - progress) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const isFullCircle = progress <= 0.001;
  const isEmptyCircle = progress >= 0.999;

  return (
    <svg viewBox="0 0 140 140" width="100%" height="100%" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-fg)" strokeWidth="1.5" opacity="0.12" />
      {!isEmptyCircle && (
        isFullCircle
          ? <circle cx={cx} cy={cy} r={r} fill="var(--color-fg)" />
          : <path d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${largeArc},1 ${x.toFixed(2)},${y.toFixed(2)} Z`} fill="var(--color-fg)" />
      )}
      <circle cx={cx} cy={cy} r={36} fill="var(--color-bg)" />
    </svg>
  );
};

// ── Session pips ──────────────────────────────────────────────────────────────
const SessionPips = ({ total, current }: { total: number; current: number }) => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        width: i === current ? '24px' : '7px',
        height: '3px',
        borderRadius: '2px',
        background: 'var(--color-fg)',
        opacity: i < current ? 1 : i === current ? 1 : 0.18,
        transition: 'all 0.3s ease',
      }} />
    ))}
  </div>
);

// ── Icon button ───────────────────────────────────────────────────────────────
const IconBtn = ({ onClick, children, large, disabled }: {
  onClick: () => void; children: React.ReactNode; large?: boolean; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: large ? '68px' : '50px',
      height: large ? '68px' : '50px',
      borderRadius: '50%',
      border: '2px solid var(--color-fg)',
      background: large ? 'var(--color-fg)' : 'transparent',
      color: large ? 'var(--color-bg)' : 'var(--color-fg)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.25 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'opacity 0.2s',
      WebkitTapHighlightColor: 'transparent',
    }}
  >{children}</button>
);

// ── Main component ────────────────────────────────────────────────────────────
const PomodoroPage = () => {
  const { config } = useAppStore();
  const { t } = useTranslation();
  const {
    phase, sessionIndex, status, secondsLeft, endsAt,
    phaseCompleteSignal, connect, start, pause, reset, skip,
  } = usePomodoroStore();

  const { pomodoroStyle, pomodoroSessions } = config;

  useEffect(() => { connect(); }, [connect]);

  // Bell quando il server segnala fine-fase naturale
  const lastBellSignal = useRef(0);
  useEffect(() => {
    if (phaseCompleteSignal > lastBellSignal.current) {
      lastBellSignal.current = phaseCompleteSignal;
      playBell();
    }
  }, [phaseCompleteSignal]);

  // Tick locale — ricalcola il countdown da endsAt ogni secondo, nessun evento SSE necessario
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const displaySecondsLeft = status === 'running' && endsAt
    ? Math.max(0, Math.round((endsAt - Date.now()) / 1000))
    : secondsLeft;

  const running = status === 'running';
  const cycleComplete = status === 'cycleComplete';

  const totalSecs = (() => {
    if (phase === 'focus') return config.pomodoroFocusMin * 60;
    if (phase === 'shortBreak') return config.pomodoroShortBreakMin * 60;
    return config.pomodoroLongBreakMin * 60;
  })() || 1;

  const progress = Math.max(0, Math.min(1, 1 - displaySecondsLeft / totalSecs));
  const mm = String(Math.floor(displaySecondsLeft / 60)).padStart(2, '0');
  const ss = String(displaySecondsLeft % 60).padStart(2, '0');
  const phaseLabel = phase === 'focus' ? t('pomodoro.focus') : phase === 'shortBreak' ? t('pomodoro.shortBreak') : t('pomodoro.longBreak');
  const sessionLabel = `${sessionIndex + 1} ${t('pomodoro.of')} ${pomodoroSessions}`;
  const isResetDisabled = status === 'idle' && phase === 'focus' && sessionIndex === 0;

  const handlePlayPause = () => { running ? pause() : start(); };

  return (
    <div style={{
      height: '100%', width: '100%',
      display: 'flex', flexDirection: 'row', alignItems: 'stretch',
      padding: '32px 40px', boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        width: '300px', flexShrink: 0,
        paddingRight: '32px',
      }}>
        <div>
          <h2 style={{
            fontSize: '44px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--color-fg)', margin: 0,
          }}>
            {cycleComplete ? t('pomodoro.done') : phaseLabel}
          </h2>
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--color-fg)',
            opacity: 0.35, marginTop: '10px', marginBottom: 0,
          }}>
            {cycleComplete ? '\u00a0' : sessionLabel}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            fontSize: '72px', fontWeight: 200, letterSpacing: '0.02em',
            color: 'var(--color-fg)', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {mm}:{ss}
          </div>
          {!cycleComplete && <SessionPips total={pomodoroSessions} current={sessionIndex} />}
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <IconBtn onClick={reset} disabled={isResetDisabled}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" fill="currentColor" />
            </svg>
          </IconBtn>
          <IconBtn onClick={handlePlayPause} large>
            {running ? (
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                <rect x="1" y="1" width="7" height="20" rx="1.5" fill="currentColor" />
                <rect x="12" y="1" width="7" height="20" rx="1.5" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                <polygon points="2,1 19,11 2,21" fill="currentColor" />
              </svg>
            )}
          </IconBtn>
          <IconBtn onClick={skip} disabled={cycleComplete}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <polygon points="1,2 13,9 1,16" fill="currentColor" />
              <rect x="14" y="2" width="3" height="14" rx="1" fill="currentColor" />
            </svg>
          </IconBtn>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: cycleComplete ? 0.2 : 1,
        transition: 'opacity 0.5s',
      }}>
        <div style={{ width: '320px', height: '320px' }}>
          {pomodoroStyle === 'hourglass'
            ? <Hourglass progress={progress} />
            : <ArcPie progress={progress} />
          }
        </div>
      </div>
    </div>
  );
};

export default PomodoroPage;