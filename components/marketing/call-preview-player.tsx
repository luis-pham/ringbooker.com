'use client';

import { useEffect, useRef, useState } from 'react';

export type CallLine = { role: 'ai' | 'caller'; text: string };
type PlayerState = 'idle' | 'playing' | 'paused' | 'done';
type SpeakerState = 'ai-speaking' | 'caller-speaking' | 'listening';

function resolveAccentClass(accent: string): string {
  if (accent === '#B45309') return 'cp-accent-hair';
  if (accent === '#0D9488') return 'cp-accent-spa';
  if (accent === '#4F46E5') return 'cp-accent-med';
  if (accent === '#A21CAF') return 'cp-accent-clinic';
  return 'cp-accent-nail';
}

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
    return () => {
      playing = false;
    };
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
    return () => {
      playing = false;
    };
  }

  useEffect(() => () => clearTimer(), []);

  const isAI = speakerState === 'ai-speaking';
  const isCaller = speakerState === 'caller-speaking';
  const isActive = playerState === 'playing';
  const currentLineData = currentLine >= 0 && currentLine < lines.length ? lines[currentLine] : null;
  const accentClass = resolveAccentClass(accent);

  const statusLabel =
    isAI ? 'AI Speaking' :
    isCaller ? 'Caller Speaking' :
    isActive ? 'Listening…' :
    playerState === 'done' ? 'Call Ended' :
    playerState === 'paused' ? 'Paused' : '';

  const callMode =
    isAI ? 'ai' :
    isCaller ? 'caller' :
    isActive ? 'listening' :
    playerState === 'done' ? 'done' :
    playerState === 'paused' ? 'paused' : 'idle';

  return (
    <div className={`cp ${accentClass}`}>
      <div className="cp-frame">
        <div className="cp-screen">
          <div className="cp-bg" />
          {isActive ? <div className="cp-glow" /> : null}
          <div className="cp-content">
            <div className="cp-statusbar">
              <span>9:41</span>
              <span className="cp-status-icons">● ▲ ■</span>
            </div>

            {isActive ? (
              <div className="cp-live-pill">
                <span />
                LIVE
              </div>
            ) : null}

            <div className="cp-eyebrow">
              {playerState === 'idle' ? 'Sample Call' : playerState === 'done' ? 'Call Summary' : 'Active Call'}
            </div>
            <div className="cp-business-name">{businessName}</div>

            <div className={`cp-avatar-wrap ${isActive ? 'cp-avatar-active' : ''}`}>
              {isActive ? (
                <>
                  <div className="cp-ring cp-ring-one" />
                  <div className="cp-ring cp-ring-two" />
                </>
              ) : null}
              <div className={`cp-avatar cp-avatar-${callMode}`}>
                {isCaller ? (
                  <svg viewBox="0 0 24 24" className="cp-avatar-icon cp-avatar-person">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="cp-avatar-icon">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </div>
            </div>

            <div className="cp-speaker-wrap">
              {statusLabel ? <div className={`cp-speaker cp-speaker-${callMode}`}>{statusLabel}</div> : null}
            </div>

            <div className="cp-wave-wrap">
              {(isAI || isCaller) ? (
                Array.from({ length: 9 }).map((_, i) => <span key={i} className={`cp-wave cp-wave-${i + 1} ${isCaller ? 'cp-wave-caller' : ''}`} />)
              ) : null}
              {!isAI && !isCaller && isActive ? (
                Array.from({ length: 3 }).map((_, i) => <span key={i} className={`cp-wave-idle cp-wave-idle-${i + 1}`} />)
              ) : null}
            </div>

            {currentLineData ? (
              <div className={`cp-dialog cp-dialog-${currentLineData.role}`}>
                "{currentLineData.text}"
              </div>
            ) : null}

            {playerState === 'done' ? (
              <div className="cp-done">
                <span>✓</span>
                Demo complete
              </div>
            ) : null}

            <div className="cp-controls">
              {(playerState === 'idle' || playerState === 'done') ? (
                <button onClick={play} title="Play" className="cp-control cp-control-main">
                  <svg viewBox="0 0 24 24" className="cp-icon-play">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              ) : null}

              {playerState === 'playing' ? (
                <>
                  <button onClick={pause} title="Pause" className="cp-control cp-control-soft">
                    <svg viewBox="0 0 24 24" className="cp-icon-small"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  </button>
                  <button onClick={stop} title="End call" className="cp-control cp-control-end">
                    <svg viewBox="0 0 24 24" className="cp-icon-end">
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" />
                    </svg>
                  </button>
                </>
              ) : null}

              {playerState === 'paused' ? (
                <>
                  <button onClick={resume} title="Resume" className="cp-control cp-control-main">
                    <svg viewBox="0 0 24 24" className="cp-icon-play">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <button onClick={stop} title="Stop" className="cp-control cp-control-soft">
                    <svg viewBox="0 0 24 24" className="cp-icon-small"><path d="M6 6h12v12H6z" /></svg>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <p className="cp-caption">
        {playerState === 'idle'
          ? '▶ Tap to hear a sample AI call'
          : playerState === 'done'
            ? 'Replay or try a live demo call →'
            : playerState === 'paused'
              ? 'Paused — tap to resume'
              : 'Simulated AI voice demo'}
      </p>

      <style>{`
        .cp{user-select:none;--cp-accent:#7C3AED;--cp-accent-soft:rgba(124,58,237,.33);--cp-accent-pale:rgba(124,58,237,.2);--cp-accent-tint:rgba(124,58,237,.13)}
        .cp-accent-hair{--cp-accent:#B45309;--cp-accent-soft:rgba(180,83,9,.33);--cp-accent-pale:rgba(180,83,9,.2);--cp-accent-tint:rgba(180,83,9,.13)}
        .cp-accent-spa{--cp-accent:#0D9488;--cp-accent-soft:rgba(13,148,136,.33);--cp-accent-pale:rgba(13,148,136,.2);--cp-accent-tint:rgba(13,148,136,.13)}
        .cp-accent-med{--cp-accent:#4F46E5;--cp-accent-soft:rgba(79,70,229,.33);--cp-accent-pale:rgba(79,70,229,.2);--cp-accent-tint:rgba(79,70,229,.13)}
        .cp-accent-clinic{--cp-accent:#A21CAF;--cp-accent-soft:rgba(162,28,175,.33);--cp-accent-pale:rgba(162,28,175,.2);--cp-accent-tint:rgba(162,28,175,.13)}
        .cp-frame{background:#0d0d0d;border-radius:36px;padding:10px;box-shadow:0 32px 72px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.06) inset;max-width:248px;margin:0 auto}
        .cp-screen{background:#1a1a2e;border-radius:28px;overflow:hidden;min-height:400px;display:flex;flex-direction:column;position:relative}
        .cp-bg{position:absolute;inset:0;background:linear-gradient(165deg,#1a0533 0%,#2d1b69 45%,#1a0d3a 100%)}
        .cp-glow{position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,var(--cp-accent-soft) 0%,transparent 70%);top:30%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
        .cp-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:14px 14px 18px}
        .cp-statusbar{display:flex;justify-content:space-between;width:100%;margin-bottom:12px}
        .cp-statusbar span{font-size:13px;font-weight:700;color:#fff}
        .cp-statusbar .cp-status-icons{font-size:9px;color:rgba(255,255,255,.6)}
        .cp-live-pill{display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);border-radius:999px;padding:3px 10px;font-size:9px;font-weight:800;color:#10B981;margin-bottom:8px;letter-spacing:.06em}
        .cp-live-pill span{width:5px;height:5px;border-radius:50%;background:#10B981;animation:cpPulse 1.4s ease-in-out infinite}
        .cp-eyebrow{font-size:9px;color:rgba(255,255,255,.4);letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}
        .cp-business-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:16px;text-align:center;line-height:1.2}
        .cp-avatar-wrap{position:relative;margin-bottom:14px;width:62px;height:62px}
        .cp-ring{position:absolute;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%);animation:cpRing 2.2s ease-out infinite}
        .cp-ring-one{width:76px;height:76px;border:1px solid var(--cp-accent-soft)}
        .cp-ring-two{width:96px;height:96px;border:1px solid var(--cp-accent-pale);animation-delay:.55s}
        .cp-avatar{position:relative;z-index:1;width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .4s}
        .cp-avatar-ai{background:linear-gradient(135deg,var(--cp-accent),var(--cp-accent-soft));box-shadow:0 0 0 3px var(--cp-accent-pale)}
        .cp-avatar-caller{background:rgba(255,255,255,.18)}
        .cp-avatar-listening,.cp-avatar-idle,.cp-avatar-done,.cp-avatar-paused{background:linear-gradient(135deg,var(--cp-accent-soft),var(--cp-accent-tint))}
        .cp-avatar-icon{width:26px;height:26px;fill:#fff}
        .cp-avatar-person{fill:rgba(255,255,255,.9)}
        .cp-speaker-wrap{min-height:26px;margin-bottom:8px;display:flex;align-items:center;justify-content:center}
        .cp-speaker{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 11px;font-size:10px;font-weight:800;letter-spacing:.04em;transition:all .3s}
        .cp-speaker-ai{background:var(--cp-accent-tint);border:1px solid var(--cp-accent-soft);color:var(--cp-accent)}
        .cp-speaker-caller{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff}
        .cp-speaker-listening,.cp-speaker-done,.cp-speaker-paused{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4)}
        .cp-wave-wrap{height:28px;display:flex;align-items:center;justify-content:center;gap:2.5px;margin-bottom:10px;min-height:28px}
        .cp-wave,.cp-wave-idle{display:block;width:3px;border-radius:3px;background:var(--cp-accent);animation:cpWave .85s ease-in-out infinite}
        .cp-wave-caller{background:rgba(255,255,255,.65)}
        .cp-wave-1{height:7px}.cp-wave-2{height:18px;animation-delay:.065s}.cp-wave-3{height:26px;animation-delay:.13s}.cp-wave-4{height:14px;animation-delay:.195s}.cp-wave-5{height:22px;animation-delay:.26s}.cp-wave-6{height:10px;animation-delay:.325s}.cp-wave-7{height:20px;animation-delay:.39s}.cp-wave-8{height:15px;animation-delay:.455s}.cp-wave-9{height:24px;animation-delay:.52s}
        .cp-wave-idle{background:rgba(255,255,255,.2);animation:cpWaveSlow 2s ease-in-out infinite}.cp-wave-idle-1{height:6px}.cp-wave-idle-2{height:10px;animation-delay:.3s}.cp-wave-idle-3{height:6px;animation-delay:.6s}
        .cp-dialog{border-radius:14px;padding:9px 11px;font-size:11.5px;color:#fff;line-height:1.45;text-align:center;margin-bottom:10px;max-width:100%;width:100%;box-sizing:border-box;transition:all .3s}
        .cp-dialog-ai{background:var(--cp-accent-tint);border:1px solid var(--cp-accent-pale);border-bottom-right-radius:4px}
        .cp-dialog-caller{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12);border-bottom-left-radius:4px}
        .cp-done{display:flex;align-items:center;gap:6px;font-size:11px;color:#10B981;font-weight:700;margin-bottom:10px}
        .cp-done span{width:16px;height:16px;border-radius:50%;background:rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;font-size:9px}
        .cp-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:auto;padding-top:6px}
        .cp-control{border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}
        .cp-control:hover{transform:scale(1.08)}
        .cp-control-main{width:46px;height:46px;background:var(--cp-accent);box-shadow:0 6px 20px var(--cp-accent-soft)}
        .cp-control-soft{width:36px;height:36px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16)}
        .cp-control-end{width:46px;height:46px;background:#EF4444;box-shadow:0 4px 16px rgba(239,68,68,.45)}
        .cp-icon-play{width:18px;height:18px;fill:#fff;margin-left:2px}.cp-icon-small{width:14px;height:14px;fill:rgba(255,255,255,.85)}.cp-icon-end{width:18px;height:18px;fill:#fff}
        .cp-caption{text-align:center;font-size:11.5px;color:#9CA3AF;margin-top:10px;line-height:1.5}
        @keyframes cpWave{0%,100%{transform:scaleY(.3);opacity:.35}50%{transform:scaleY(1);opacity:1}}
        @keyframes cpWaveSlow{0%,100%{transform:scaleY(.5);opacity:.2}50%{transform:scaleY(1);opacity:.45}}
        @keyframes cpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.3)}}
        @keyframes cpRing{0%{opacity:.7;transform:translate(-50%,-50%) scale(.85)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
      `}</style>
    </div>
  );
}
