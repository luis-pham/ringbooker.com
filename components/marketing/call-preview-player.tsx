'use client';

import { useEffect, useRef, useState } from 'react';

export type CallLine = { role: 'ai' | 'caller'; text: string };
type PlayerState = 'idle' | 'playing' | 'paused' | 'done';
type SpeakerState = 'ai-speaking' | 'caller-speaking' | 'listening';

const WAVEFORM_HEIGHTS = [7, 18, 26, 14, 22, 10, 20, 15, 24];

export function CallPreviewPlayer({
  lines,
  businessName,
  accent,
}: {
  lines: CallLine[];
  businessName: string;
  accent: string;
}) {
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [currentLine, setCurrentLine] = useState(-1);
  const [speakerState, setSpeakerState] = useState<SpeakerState>('listening');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineIndexRef = useRef(0);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function advanceLine(idx: number, isPlaying: () => boolean) {
    if (!isPlaying()) return;
    if (idx >= lines.length) {
      setPlayerState('done');
      setCurrentLine(-1);
      setSpeakerState('listening');
      return;
    }
    const line = lines[idx];
    lineIndexRef.current = idx;
    setCurrentLine(idx);
    setSpeakerState(line.role === 'ai' ? 'ai-speaking' : 'caller-speaking');
    timerRef.current = setTimeout(() => {
      if (!isPlaying()) return;
      setSpeakerState('listening');
      timerRef.current = setTimeout(() => advanceLine(idx + 1, isPlaying), 550);
    }, line.text.length * 42 + 1400);
  }

  function play() {
    clearTimer();
    let playing = true;
    const isPlaying = () => playing;
    setPlayerState('playing');
    advanceLine(0, isPlaying);
    return () => { playing = false; };
  }

  function pause() {
    clearTimer();
    setPlayerState('paused');
    setSpeakerState('listening');
  }

  function stop() {
    clearTimer();
    setPlayerState('idle');
    setCurrentLine(-1);
    setSpeakerState('listening');
    lineIndexRef.current = 0;
  }

  function resume() {
    setPlayerState('playing');
    let playing = true;
    const isPlaying = () => playing;
    advanceLine(lineIndexRef.current, isPlaying);
    return () => { playing = false; };
  }

  useEffect(() => () => clearTimer(), []);

  const isAI = speakerState === 'ai-speaking';
  const isCaller = speakerState === 'caller-speaking';
  const isActive = playerState === 'playing';
  const currentLineData = currentLine >= 0 && currentLine < lines.length ? lines[currentLine] : null;

  const statusLabel =
    isAI ? 'AI Speaking' :
    isCaller ? 'Caller Speaking' :
    isActive ? 'Listening…' :
    playerState === 'done' ? 'Call Ended' :
    playerState === 'paused' ? 'Paused' : '';

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Phone frame */}
      <div style={{
        background: '#0d0d0d',
        borderRadius: 36,
        padding: 10,
        boxShadow: '0 32px 72px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06) inset',
        maxWidth: 248,
        margin: '0 auto',
      }}>
        <div style={{
          background: '#1a1a2e',
          borderRadius: 28,
          overflow: 'hidden',
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {/* BG gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg,#1a0533 0%,#2d1b69 45%,#1a0d3a 100%)' }} />

          {/* Glow behind avatar */}
          {isActive && (
            <div style={{
              position: 'absolute', width: 200, height: 200, borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
              top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
              pointerEvents: 'none',
            }} />
          )}

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '14px 14px 18px' }}>

            {/* Status bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>9:41</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.6)' }}>● ▲ ⬛</span>
            </div>

            {/* Live pill */}
            {isActive && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)',
                borderRadius: 999, padding: '3px 10px', fontSize: 9, fontWeight: 800, color: '#10B981',
                marginBottom: 8, letterSpacing: '.06em',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', animation: 'cpPulse 1.4s ease-in-out infinite' }} />
                LIVE
              </div>
            )}

            {/* Business name */}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              {playerState === 'idle' ? 'Sample Call' : playerState === 'done' ? 'Call Summary' : 'Active Call'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16, textAlign: 'center', lineHeight: 1.2 }}>
              {businessName}
            </div>

            {/* Avatar + rings */}
            <div style={{ position: 'relative', marginBottom: 14, width: 62, height: 62 }}>
              {isActive && (
                <>
                  <div style={{
                    position: 'absolute', width: 76, height: 76, borderRadius: '50%',
                    border: `1px solid ${accent}55`,
                    top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    animation: 'cpRing 2.2s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', width: 96, height: 96, borderRadius: '50%',
                    border: `1px solid ${accent}30`,
                    top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    animation: 'cpRing 2.2s ease-out .55s infinite',
                  }} />
                </>
              )}
              <div style={{
                position: 'relative', zIndex: 1,
                width: 62, height: 62, borderRadius: '50%',
                background: isAI
                  ? `linear-gradient(135deg, ${accent}, ${accent}bb)`
                  : isCaller
                    ? 'rgba(255,255,255,.18)'
                    : `linear-gradient(135deg, ${accent}88, ${accent}44)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isAI ? `0 0 0 3px ${accent}44` : 'none',
                transition: 'all .4s',
              }}>
                {isCaller ? (
                  <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: 'rgba(255,255,255,.9)' }}>
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: '#fff' }}>
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Speaker state label */}
            <div style={{ minHeight: 26, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {statusLabel ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: isAI ? `${accent}25` : isCaller ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${isAI ? `${accent}50` : isCaller ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)'}`,
                  borderRadius: 999, padding: '4px 11px',
                  fontSize: 10, fontWeight: 800, letterSpacing: '.04em',
                  color: isAI ? accent : isCaller ? '#fff' : 'rgba(255,255,255,.4)',
                  transition: 'all .3s',
                }}>
                  {statusLabel}
                </div>
              ) : null}
            </div>

            {/* Waveform */}
            <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2.5, marginBottom: 10, minHeight: 28 }}>
              {(isAI || isCaller) && WAVEFORM_HEIGHTS.map((h, i) => (
                <span key={i} style={{
                  display: 'block', width: 3, borderRadius: 3,
                  background: isAI ? accent : 'rgba(255,255,255,.65)',
                  height: h,
                  animation: 'cpWave .85s ease-in-out infinite',
                  animationDelay: `${i * 0.065}s`,
                }} />
              ))}
              {!isAI && !isCaller && isActive && (
                [6, 10, 6].map((h, i) => (
                  <span key={i} style={{
                    display: 'block', width: 3, borderRadius: 3,
                    background: 'rgba(255,255,255,.2)',
                    height: h,
                    animation: 'cpWaveSlow 2s ease-in-out infinite',
                    animationDelay: `${i * 0.3}s`,
                  }} />
                ))
              )}
            </div>

            {/* Current dialog line */}
            {currentLineData && (
              <div style={{
                background: isAI ? `${accent}22` : 'rgba(255,255,255,.1)',
                border: `1px solid ${isAI ? `${accent}40` : 'rgba(255,255,255,.12)'}`,
                borderRadius: isCaller ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                padding: '9px 11px',
                fontSize: 11.5, color: '#fff', lineHeight: 1.45,
                textAlign: 'center', marginBottom: 10, maxWidth: '100%',
                width: '100%', boxSizing: 'border-box' as const,
                transition: 'all .3s',
              }}>
                "{currentLineData.text}"
              </div>
            )}
            {playerState === 'done' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10B981', fontWeight: 700, marginBottom: 10 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</span>
                Demo complete
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 'auto', paddingTop: 6 }}>
              {(playerState === 'idle' || playerState === 'done') && (
                <button
                  onClick={play}
                  title="Play"
                  style={{
                    width: 46, height: 46, borderRadius: '50%', background: accent,
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 20px ${accent}70`, transition: 'transform .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff', marginLeft: 2 }}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
              {playerState === 'playing' && (
                <>
                  <button onClick={pause} title="Pause" style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'rgba(255,255,255,.85)' }}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  </button>
                  <button onClick={stop} title="End call" style={{ width: 46, height: 46, borderRadius: '50%', background: '#EF4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(239,68,68,.45)' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff' }}>
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" />
                    </svg>
                  </button>
                </>
              )}
              {playerState === 'paused' && (
                <>
                  <button onClick={resume} title="Resume" style={{ width: 46, height: 46, borderRadius: '50%', background: accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${accent}70` }}>
                    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff', marginLeft: 2 }}><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <button onClick={stop} title="Stop" style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'rgba(255,255,255,.8)' }}><path d="M6 6h12v12H6z" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p style={{ textAlign: 'center', fontSize: 11.5, color: '#9CA3AF', marginTop: 10, lineHeight: 1.5 }}>
        {playerState === 'idle'
          ? '▶ Tap to hear a sample AI call'
          : playerState === 'done'
            ? 'Replay or try a live demo call →'
            : playerState === 'paused'
              ? 'Paused — tap to resume'
              : 'Simulated AI voice demo'}
      </p>

      <style>{`
        @keyframes cpWave { 0%,100%{transform:scaleY(.3);opacity:.35} 50%{transform:scaleY(1);opacity:1} }
        @keyframes cpWaveSlow { 0%,100%{transform:scaleY(.5);opacity:.2} 50%{transform:scaleY(1);opacity:.45} }
        @keyframes cpPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.3)} }
        @keyframes cpRing { 0%{opacity:.7;transform:translate(-50%,-50%) scale(.85)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </div>
  );
}
