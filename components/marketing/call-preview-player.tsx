'use client';

import { useEffect, useRef, useState } from 'react';

import { IPHONE_CALL_MOCKUP_CSS } from '@/components/marketing/iphone-call-mockup-css';
import { IphoneStatusBar } from '@/components/marketing/iphone-status-bar';

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
  variant = 'default',
}: {
  lines: CallLine[];
  businessName: string;
  accent: string;
  /** Mic icon sits slightly lower (vertical landing heroes). */
  variant?: 'default' | 'vertical';
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
    <div className={`cp ${accentClass}${variant === 'vertical' ? ' cp-vertical' : ''}`}>
      <div className="cp-frame iph-shell">
        <div className="cp-screen iph-shell">
          <div className="iph-bg" aria-hidden />
          {isActive ? <div className="cp-glow" /> : null}
          <IphoneStatusBar />
          <div className="cp-content">

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
          <div className="iph-home-bar" aria-hidden />
        </div>
      </div>

      <p className="cp-caption">
        {playerState === 'idle'
          ? '▶ Tap to hear a sample AI call'
          : playerState === 'done'
            ? 'Replay or Try a Live Demo →'
            : playerState === 'paused'
              ? 'Paused — tap to resume'
              : 'Simulated AI voice demo'}
      </p>

      <style>{`
        ${IPHONE_CALL_MOCKUP_CSS}
        .cp{user-select:none;--cp-accent:#7C3AED;--cp-accent-soft:rgba(124,58,237,.33);--cp-accent-pale:rgba(124,58,237,.2);--cp-accent-tint:rgba(124,58,237,.13)}
        .cp-accent-hair{--cp-accent:#B45309;--cp-accent-soft:rgba(180,83,9,.33);--cp-accent-pale:rgba(180,83,9,.2);--cp-accent-tint:rgba(180,83,9,.13)}
        .cp-accent-spa{--cp-accent:#0D9488;--cp-accent-soft:rgba(13,148,136,.33);--cp-accent-pale:rgba(13,148,136,.2);--cp-accent-tint:rgba(13,148,136,.13)}
        .cp-accent-med{--cp-accent:#4F46E5;--cp-accent-soft:rgba(79,70,229,.33);--cp-accent-pale:rgba(79,70,229,.2);--cp-accent-tint:rgba(79,70,229,.13)}
        .cp-accent-clinic{--cp-accent:#A21CAF;--cp-accent-soft:rgba(162,28,175,.33);--cp-accent-pale:rgba(162,28,175,.2);--cp-accent-tint:rgba(162,28,175,.13)}
        .cp-frame{max-width:272px;margin:0 auto}
        .cp-glow{position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,var(--cp-accent-soft) 0%,transparent 70%);top:30%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:1}
        .cp-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:24px 16px 10px;min-height:0}
        .cp-live-pill{display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);border-radius:999px;padding:3px 10px;font-size:9px;font-weight:600;color:#10B981;margin-bottom:8px;letter-spacing:.06em}
        .cp-live-pill span{width:5px;height:5px;border-radius:50%;background:#10B981;animation:cpPulse 1.4s ease-in-out infinite}
        .cp-eyebrow{margin-bottom:4px}
        .cp-business-name{margin-bottom:14px}
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
        .cp-speaker{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 11px;font-size:10px;font-weight:600;letter-spacing:.04em;transition:all .3s}
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
        .cp-done{display:flex;align-items:center;gap:6px;font-size:11px;color:#10B981;font-weight:500;margin-bottom:10px}
        .cp-done span{width:16px;height:16px;border-radius:50%;background:rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;font-size:9px}
        .cp-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:auto;padding-top:6px}
        .cp-control{border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}
        .cp-control:hover{transform:scale(1.08)}
        .cp-control-main{width:58px;height:58px;background:#34c759;box-shadow:0 6px 22px rgba(52,199,89,.4)}
        .cp-control-soft{width:36px;height:36px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16)}
        .cp-control-end{width:58px;height:58px}
        .cp-icon-play{width:18px;height:18px;fill:#fff;margin-left:2px}.cp-icon-small{width:14px;height:14px;fill:rgba(255,255,255,.85)}.cp-icon-end{width:18px;height:18px;fill:#fff}
        .cp-caption{text-align:center;font-size:11.5px;color:#9CA3AF;margin-top:10px;line-height:1.5}
        .cp-vertical .iph-shell.cp-screen{min-height:0;height:100%;max-height:100%}
        .cp-vertical .cp-content{padding:14px 14px 6px}
        .cp-vertical .cp-business-name{margin-bottom:8px;font-size:clamp(18px,3.8vw,24px)}
        .cp-vertical .cp-avatar-wrap{width:54px;height:54px;margin-bottom:8px}
        .cp-vertical .cp-avatar{width:54px;height:54px}
        .cp-vertical .cp-speaker-wrap{min-height:0;margin-bottom:4px}
        .cp-vertical .cp-wave-wrap{height:20px;min-height:20px;margin-bottom:6px}
        .cp-vertical .cp-controls{padding-top:2px}
        .cp-vertical .cp-control-main{width:52px;height:52px}
        .cp-vertical .iph-status{padding:12px 18px 4px;min-height:42px}
        .cp-vertical .iph-home-bar{margin:4px auto 8px}
        .cp-vertical .cp-avatar-icon:not(.cp-avatar-person){transform:translateY(6px)}
        @keyframes cpWave{0%,100%{transform:scaleY(.3);opacity:.35}50%{transform:scaleY(1);opacity:1}}
        @keyframes cpWaveSlow{0%,100%{transform:scaleY(.5);opacity:.2}50%{transform:scaleY(1);opacity:.45}}
        @keyframes cpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.3)}}
        @keyframes cpRing{0%{opacity:.7;transform:translate(-50%,-50%) scale(.85)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
      `}</style>
    </div>
  );
}
