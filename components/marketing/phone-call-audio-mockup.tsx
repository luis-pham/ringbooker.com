'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { IphoneStatusBar } from '@/components/marketing/iphone-status-bar';
import { VERTICAL_DEMO_AUDIO } from '@/lib/marketing/demo-audio-cdn';

export { MARKETING_DEMO_AUDIO_CDN, marketingDemoAudioUrl, VERTICAL_DEMO_AUDIO } from '@/lib/marketing/demo-audio-cdn';

export const PHONE_CALL_AUDIO_MOCKUP_CSS = `
.iph-shell .vc-content{
  display:flex;
  flex-direction:column;
  align-items:center;
  flex:1;
  padding:8px 20px 12px;
  text-align:center;
}
.cp-vertical .iph-shell .vc-content{padding:14px 14px 6px}
.iph-shell .vc-label,
.iph-shell .vc-call-status{
  margin-bottom:6px;
  font-size:11px;
  font-weight:500;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:rgba(255,255,255,.55);
  line-height:1.4;
}
.iph-shell .vc-call-status{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
}
.iph-shell .vc-call-status--active{
  color:#34c759;
}
.iph-shell .vc-name{
  font-size:19px;
  font-weight:500;
}
.iph-shell .vc-call-status-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#34c759;
  flex-shrink:0;
  animation:pca-pulse 1.4s ease-in-out infinite;
}
@keyframes pca-pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.45;transform:scale(1.2)}
}
.pca-audio{
  position:absolute;
  width:1px;
  height:1px;
  left:0;
  top:0;
  opacity:0;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0;
  pointer-events:none;
}
.iph-shell .vc-timer{
  margin-bottom:12px;
  font-variant-numeric:tabular-nums;
}
.cp-vertical .iph-shell .vc-timer{margin-bottom:8px}
.iph-shell .vc-wave{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:2.5px;
  height:28px;
  margin-bottom:12px;
}
.cp-vertical .iph-shell .vc-wave{
  height:20px;
  margin-bottom:6px;
}
.iph-shell .vc-wave span{
  width:3px;
  background:#34c759;
  border-radius:2px;
}
.iph-shell .vc-wave span:nth-child(1){height:8px}
.iph-shell .vc-wave span:nth-child(2){height:18px}
.iph-shell .vc-wave span:nth-child(3){height:24px}
.iph-shell .vc-wave span:nth-child(4){height:14px}
.iph-shell .vc-wave span:nth-child(5){height:20px}
.iph-shell .vc-wave span:nth-child(6){height:10px}
.iph-shell .vc-wave span:nth-child(7){height:16px}
.iph-shell .vc-wave span:nth-child(8){height:24px}
.iph-shell .vc-wave span:nth-child(9){height:12px}
.iph-shell .vc-wave.vc-wave-active span{
  animation:pca-wv .8s ease-in-out infinite;
}
.iph-shell .vc-wave.vc-wave-active span:nth-child(2){animation-delay:.07s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(3){animation-delay:.14s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(4){animation-delay:.21s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(5){animation-delay:.28s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(6){animation-delay:.35s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(7){animation-delay:.42s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(8){animation-delay:.49s}
.iph-shell .vc-wave.vc-wave-active span:nth-child(9){animation-delay:.56s}
@keyframes pca-wv{
  0%,100%{transform:scaleY(.45);opacity:.5}
  50%{transform:scaleY(1);opacity:1}
}
.iph-shell .vc-controls{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:18px;
  margin-top:auto;
  width:100%;
  position:relative;
  z-index:6;
  flex-shrink:0;
}
.cp-vertical .iph-shell .vc-controls{
  gap:14px;
  padding-top:2px;
}
.iph-shell .vc-ctrl{
  width:44px;
  height:44px;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  border:none;
  padding:0;
  font:inherit;
  flex-shrink:0;
}
.iph-shell .vc-ctrl-mute,
.iph-shell .vc-ctrl-spk{
  cursor:default;
}
.iph-shell .vc-ctrl-play.cp-control-main,
.iph-shell .vc-ctrl-end{
  cursor:pointer;
  width:58px;
  height:58px;
  flex-shrink:0;
  box-sizing:border-box;
}
.cp-vertical .iph-shell .vc-ctrl-play.cp-control-main,
.cp-vertical .iph-shell .vc-ctrl-end{
  width:52px;
  height:52px;
}
.iph-shell .vc-ctrl-play .cp-icon-play{
  width:18px;
  height:18px;
  fill:#fff;
  margin-left:2px;
}
.iph-shell .vc-ctrl-mute svg,
.iph-shell .vc-ctrl-spk svg{
  width:18px;
  height:18px;
}
.iph-shell .vc-ctrl-end svg{
  width:22px;
  height:22px;
  fill:#fff;
}
@media (prefers-reduced-motion: reduce){
  .iph-shell .vc-wave span,
  .iph-shell .vc-wave.vc-wave-active span,
  .iph-shell .vc-call-status-dot{
    animation:none !important;
  }
}
`;

type PlaybackState = 'idle' | 'playing' | 'paused';

function formatMmSs(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type PhoneCallAudioMockupProps = {
  businessName: string;
  audioSrc: string;
  /** Home hero uses `.phone-wrap`; vertical landings use `.cp-frame` inside `.cp`. */
  shell?: 'home' | 'vertical';
};

function CallScreenBody({
  businessName,
  timerLabel,
  waveActive,
  isPlaying,
  playbackState,
  onCenterClick,
}: {
  businessName: string;
  timerLabel: string;
  waveActive: boolean;
  isPlaying: boolean;
  playbackState: PlaybackState;
  onCenterClick: () => void;
}) {
  return (
    <>
      <div className="iph-bg" aria-hidden />
      <div className="vc-glow" aria-hidden />
      <IphoneStatusBar />
      <div className="vc-content">
        {isPlaying ? (
          <div className="vc-call-status vc-call-status--active">
            <span className="vc-call-status-dot" aria-hidden />
            Active Call
          </div>
        ) : (
          <div className="vc-call-status">Sample Call</div>
        )}
        <div className="vc-name">{businessName}</div>
        <div className="vc-timer">{timerLabel}</div>
        <div className={`vc-wave${waveActive ? ' vc-wave-active' : ''}`}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="vc-controls">
          <div className="vc-ctrl vc-ctrl-mute">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          </div>
          {isPlaying ? (
            <button type="button" className="vc-ctrl vc-ctrl-end" onClick={onCenterClick} aria-label="Pause demo call">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
                  transform="rotate(135 12 12)"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="vc-ctrl vc-ctrl-play cp-control cp-control-main"
              onClick={onCenterClick}
              aria-label={playbackState === 'paused' ? 'Resume demo call' : 'Play demo call'}
            >
              <svg viewBox="0 0 24 24" className="cp-icon-play" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          <div className="vc-ctrl vc-ctrl-spk">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="iph-home-bar" aria-hidden />
    </>
  );
}

export function PhoneCallAudioMockup({ businessName, audioSrc, shell = 'home' }: PhoneCallAudioMockupProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [timerLabel, setTimerLabel] = useState('00:00');

  const isPlaying = playbackState === 'playing';
  const waveActive = isPlaying;

  const resetToIdle = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaybackState('idle');
    setTimerLabel('00:00');
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 1;

    // Browsers may ignore preload="auto" for cross-origin or initially-hidden elements.
    // Calling load() here explicitly starts buffering so readyState reaches
    // HAVE_CURRENT_DATA before the user's first click — ensuring audio.play()
    // succeeds within the user-gesture propagation window on the first attempt.
    if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      audio.load();
    }

    const onTimeUpdate = () => {
      setTimerLabel(formatMmSs(audio.currentTime));
    };

    const onEnded = () => {
      resetToIdle();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSrc, resetToIdle]);

  const handlePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackState('playing');
    setTimerLabel(formatMmSs(audio.currentTime));
    audio.volume = 1;

    try {
      // Single attempt — must stay within the user-gesture propagation window.
      // No async gap (no waiting for canplay) between click and play() call,
      // because crossing a macrotask boundary (e.g. addEventListener 'canplay')
      // invalidates the user-activation token on strict-autoplay browsers.
      // The audio.load() call in useEffect ensures the buffer is warm before
      // the user reaches the button so this first attempt reliably succeeds.
      await audio.play();
      setTimerLabel(formatMmSs(audio.currentTime));
    } catch {
      resetToIdle();
    }
  }, [resetToIdle]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaybackState('paused');
    setTimerLabel(formatMmSs(audio.currentTime));
  }, []);

  const handleCenterClick = useCallback(() => {
    if (playbackState === 'playing') {
      handlePause();
      return;
    }
    void handlePlay();
  }, [playbackState, handlePause, handlePlay]);

  const screenProps = {
    businessName,
    timerLabel,
    waveActive,
    isPlaying,
    playbackState,
    onCenterClick: handleCenterClick,
  };

  const screen = (
    <>
      <audio
        key={audioSrc}
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        playsInline
        className="pca-audio"
        aria-hidden
      />
      <CallScreenBody {...screenProps} />
    </>
  );

  const mockupStyles = <style dangerouslySetInnerHTML={{ __html: PHONE_CALL_AUDIO_MOCKUP_CSS }} />;

  if (shell === 'vertical') {
    return (
      <>
        <div className="cp-frame iph-shell">
          <div className="cp-screen iph-shell">{screen}</div>
        </div>
        {mockupStyles}
      </>
    );
  }

  return (
    <>
      <div className="phone-wrap">
        <div className="phone-frame iph-shell">
          <div className="phone-screen iph-shell">{screen}</div>
        </div>
      </div>
      {mockupStyles}
    </>
  );
}
