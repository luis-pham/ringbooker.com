'use client';

import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { Room, RoomEvent, Track } from 'livekit-client';

import { DEMO_VERTICALS, type DemoServiceCategory, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { apiUserVisibleMessage } from '@/lib/api-user-message';
import { DIRECT_REALTIME_DEMO_DURATION_MESSAGE, userMessageForDirectDemoRealtimeJson } from '@/lib/marketing-vertical-demo-errors';

type DemoStage = 'idle' | 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
type TranscriptTurn = { role: 'user' | 'assistant'; text: string };
type DirectRealtimeApiResponse = {
  ok: boolean;
  requestId?: string;
  clientSecret?: string;
  error?: string;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  turnDetectionAfterWelcome?: Record<string, unknown> | null;
  scriptedWelcomeLine?: string;
};
type DemoApiResponse = {
  ok: boolean;
  requestId?: string;
  previewToken?: string;
  liveKitUrl?: string;
  liveKitToken?: string;
  error?: string;
  message?: string;
};
type DemoStatusResponse = {
  ok: boolean;
  stage?: 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
  error?: string;
  message?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
const DEMO_STATUS_POLL_INTERVAL_MS = 2200;
const DEMO_STATUS_MAX_POLL_ATTEMPTS = 30;
const DEMO_STATUS_TIMEOUT_MESSAGE = 'The web demo is taking longer than expected. Please try again.';
const LIVEKIT_CONNECT_ERROR_MESSAGE = 'Unable to connect to the voice room. Please check your network and try again.';
const DIRECT_OPENAI_CONNECT_TIMEOUT_MS = 45_000;
const DIRECT_OPENAI_MAX_SESSION_MS = 5 * 60 * 1000;
const DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS = 1_200;
const OPENAI_REALTIME_WEBRTC_URL = 'https://api.openai.com/v1/realtime/calls';
const demoWebCallMode = process.env.NEXT_PUBLIC_DEMO_WEB_CALL_MODE === 'direct_openai' ? 'direct_openai' : 'livekit';
const demoWebRealtimeDebug = process.env.NEXT_PUBLIC_DEMO_WEB_REALTIME_DEBUG === 'true';

const DEMO_REALTIME_LOG_EVENT_TYPES = new Set([
  'session.created', 'session.updated', 'response.created', 'response.done', 'response.cancelled',
  'output_audio_buffer.started', 'output_audio_buffer.stopped',
  'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped', 'input_audio_buffer.committed',
  'error',
]);

function logDemoRealtime(phase: string, detail?: Record<string, unknown>) {
  if (!demoWebRealtimeDebug || typeof window === 'undefined') return;
  const payload = detail && Object.keys(detail).length > 0 ? detail : undefined;
  console.info('[rb-demo-realtime]', phase, payload ?? '');
}

function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'demo_session_server';
  const key = 'rb_demo_session_id';
  const cur = window.localStorage.getItem(key);
  if (cur) return cur;
  const next = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function splitStaff(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
}

function microphoneErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext)
    return 'Microphone access requires HTTPS or localhost.';
  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name?: unknown }).name ?? '')
        : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return 'Microphone access is blocked. Please allow microphone access in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'No microphone found. Please connect a microphone and try again.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Microphone is busy. Please close other apps using it and try again.';
  return 'Microphone access is needed for the web demo. Please allow access and try again.';
}

export type DemoCallEmbedProps = {
  vertical: DemoVerticalSlug;
  device: 'desktop' | 'mobile';
  shopServices?: string[];
  businessName?: string;
};

export function DemoCallEmbed({ vertical, device: _device, shopServices, businessName }: DemoCallEmbedProps) {
  const config = DEMO_VERTICALS[vertical];

  const businessConfig = useMemo(() => {
    const resolvedServices: DemoServiceCategory[] =
      shopServices && shopServices.length > 0
        ? [{ id: 'services', label: 'Services', items: shopServices.slice(0, 40).map((name) => ({ name, price: 0, enabled: true })) }]
        : config.serviceCategories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));
    return {
      businessName: businessName?.trim() || config.defaultBusinessName,
      city: config.defaultCity,
      primaryHours: config.hours.primary,
      secondaryHours: config.hours.secondary,
      staff: config.staffPlaceholder,
      services: resolvedServices,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, businessName, shopServices]);

  const [stage, setStage] = useState<DemoStage>('idle');
  const [statusText, setStatusText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileSiteKey);
  const [captchaHint, setCaptchaHint] = useState<string | null>(null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileRenderedRef = useRef(false);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const directPeerRef = useRef<RTCPeerConnection | null>(null);
  const directStreamRef = useRef<MediaStream | null>(null);
  const directDataChannelRef = useRef<RTCDataChannel | null>(null);
  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const directConnectTimerRef = useRef<number | null>(null);
  const directMaxDurationTimerRef = useRef<number | null>(null);
  const directEndCallTailGraceTimerRef = useRef<number | null>(null);
  const directRealtimeRequestIdRef = useRef<string | null>(null);
  const directDurationTimerStartedRef = useRef(false);
  const directPeerFailureMutedRef = useRef(false);
  const demoStartLockRef = useRef(false);
  const transcriptTurnsRef = useRef<TranscriptTurn[]>([]);

  const isActive = stage !== 'idle';
  const activePrompts = config.tryAsking;
  const visiblePrompts = showAllPrompts ? activePrompts : activePrompts.slice(0, 3);

  useEffect(
    () => () => {
      clearPollTimer();
      cleanupDirectRealtime();
    },
    [],
  );

  useEffect(() => {
    if (!isActive || !turnstileSiteKey) return;
    return () => {
      const tw = (window as Window & { turnstile?: { remove: (id: string) => void } }).turnstile;
      if (turnstileWidgetIdRef.current && tw) {
        try { tw.remove(turnstileWidgetIdRef.current); } catch { /* ignore */ }
      }
      turnstileWidgetIdRef.current = null;
      turnstileRenderedRef.current = false;
      setCaptchaToken(null);
    };
  }, [isActive]);

  useEffect(() => {
    if (!turnstileSiteKey || turnstileReady) return;
    const t = window.setInterval(() => {
      if ((window as Window & { turnstile?: unknown }).turnstile) setTurnstileReady(true);
    }, 300);
    return () => window.clearInterval(t);
  }, [turnstileReady]);

  useLayoutEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || turnstileRenderedRef.current || isActive) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = turnstileRef.current;
        const tw = (window as Window & {
          turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void };
        }).turnstile;
        if (!el || !tw || turnstileRenderedRef.current) return;
        try {
          turnstileWidgetIdRef.current = tw.render(el, {
            sitekey: turnstileSiteKey,
            theme: 'light',
            callback: (token: string) => { setCaptchaHint(null); setCaptchaToken(token); },
            'error-callback': () => { setCaptchaToken(null); setCaptchaHint('Verification could not load. Try disabling ad blockers or allow challenges.cloudflare.com.'); },
            'expired-callback': () => setCaptchaToken(null),
          });
          turnstileRenderedRef.current = true;
        } catch {
          setCaptchaHint('Verification widget failed to start. Please refresh the page.');
        }
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [turnstileReady, isActive, captchaEpoch]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || isActive) return;
    const t = window.setTimeout(() => {
      if (!turnstileRenderedRef.current) setCaptchaHint((h) => h ?? 'If you do not see a checkbox, allow scripts from Cloudflare or try another browser.');
    }, 8000);
    return () => window.clearTimeout(t);
  }, [turnstileReady, isActive, captchaEpoch]);

  function buildDemoPayload() {
    return {
      shopName: businessConfig.businessName,
      businessType: config.businessType,
      captchaToken: turnstileSiteKey ? captchaToken : 'dev-turnstile-bypass',
      sessionId: ensureSessionId(),
      website: '',
      demoConfig: {
        city: businessConfig.city,
        primaryHours: businessConfig.primaryHours,
        secondaryHours: businessConfig.secondaryHours,
        staffNames: splitStaff(businessConfig.staff),
        services: businessConfig.services.flatMap((c) =>
          c.items.map((item) => ({ category: c.label, name: item.name, price: item.price, duration: item.duration, enabled: item.enabled })),
        ),
      },
      demoVertical: config.slug,
      demoMode: 'quick',
      demoSource: 'onboarding_embed',
    };
  }

  function clearPollTimer() {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }

  function resetTurnstile() {
    if (!turnstileSiteKey) return;
    const tw = (window as Window & { turnstile?: { reset: (id: string) => void; remove: (id: string) => void } }).turnstile;
    if (turnstileWidgetIdRef.current && tw) {
      try { tw.remove(turnstileWidgetIdRef.current); }
      catch { try { tw.reset(turnstileWidgetIdRef.current); } catch { /* ignore */ } }
    }
    turnstileWidgetIdRef.current = null;
    turnstileRenderedRef.current = false;
    setCaptchaToken(null);
    setCaptchaHint(null);
    setCaptchaEpoch((e) => e + 1);
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (turnstileSiteKey && !captchaToken) errs.push('Please complete the human verification above.');
    return errs;
  }

  function clearDirectConnectTimer() {
    if (directConnectTimerRef.current) window.clearTimeout(directConnectTimerRef.current);
    directConnectTimerRef.current = null;
  }

  function clearDirectMaxDurationTimer() {
    if (directMaxDurationTimerRef.current != null) {
      window.clearTimeout(directMaxDurationTimerRef.current);
      directMaxDurationTimerRef.current = null;
    }
  }

  function clearDirectEndCallTailGraceTimer() {
    if (directEndCallTailGraceTimerRef.current != null) {
      window.clearTimeout(directEndCallTailGraceTimerRef.current);
      directEndCallTailGraceTimerRef.current = null;
    }
  }

  function releaseDirectRealtimeSlotFireAndForget(requestId: string, endReason: 'completed' | 'timeout' = 'completed') {
    const url = '/api/backend/public/demo/realtime-session/release';
    const payload = JSON.stringify({ requestId, endReason });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      if (sent) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(typeof window !== 'undefined' && window.location?.origin ? { Origin: window.location.origin } : {}) },
      body: payload,
    }).catch(() => { /* ignore */ });
  }

  function beginDirectDemoMaxDurationTimer() {
    if (directDurationTimerStartedRef.current) return;
    directDurationTimerStartedRef.current = true;
    clearDirectMaxDurationTimer();
    directMaxDurationTimerRef.current = window.setTimeout(() => {
      directPeerFailureMutedRef.current = true;
      cleanupDirectRealtime({ endReason: 'timeout' });
      resetTurnstile();
      setStage('failed');
      setStatusText(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
      setRequestError(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
    }, DIRECT_OPENAI_MAX_SESSION_MS);
  }

  function cleanupDirectRealtime(opts?: { endReason?: 'completed' | 'timeout' }) {
    clearDirectMaxDurationTimer();
    clearDirectConnectTimer();
    clearDirectEndCallTailGraceTimer();
    const releaseRequestId = directRealtimeRequestIdRef.current;
    directRealtimeRequestIdRef.current = null;
    directDurationTimerStartedRef.current = false;
    if (releaseRequestId) releaseDirectRealtimeSlotFireAndForget(releaseRequestId, opts?.endReason ?? 'completed');
    directDataChannelRef.current?.close();
    directDataChannelRef.current = null;
    if (directPeerRef.current) {
      directPeerRef.current.ontrack = null;
      directPeerRef.current.onconnectionstatechange = null;
      directPeerRef.current.close();
    }
    directPeerRef.current = null;
    directStreamRef.current?.getTracks().forEach((track) => track.stop());
    directStreamRef.current = null;
    if (directAudioRef.current) {
      directAudioRef.current.pause();
      directAudioRef.current.srcObject = null;
      directAudioRef.current = null;
    }
  }

  async function requestDemoMicrophone({ keepAlive }: { keepAlive: boolean }): Promise<MediaStream | null> {
    if (!window.isSecureContext) { setErrors([microphoneErrorMessage(null)]); return null; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrors(['Your browser does not support microphone access. Please try Chrome or Safari.']);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!keepAlive) stream.getTracks().forEach((track) => track.stop());
      return stream;
    } catch (error) {
      setErrors([microphoneErrorMessage(error)]);
      return null;
    }
  }

  async function pollStatus(p: { requestId: string; previewToken: string; attempt?: number }) {
    const attempt = p.attempt ?? 1;
    if (attempt > DEMO_STATUS_MAX_POLL_ATTEMPTS) {
      clearPollTimer();
      setStage('failed');
      setStatusText(DEMO_STATUS_TIMEOUT_MESSAGE);
      setRequestError(DEMO_STATUS_TIMEOUT_MESSAGE);
      if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
      return;
    }
    try {
      const res = await fetch(`/api/backend/public/demo/status/${encodeURIComponent(p.requestId)}?token=${encodeURIComponent(p.previewToken)}`);
      const body = (await res.json()) as DemoStatusResponse;
      if (!body.ok || !body.stage) {
        clearPollTimer();
        setRequestError(apiUserVisibleMessage(body, 'Unable to check demo status.'));
        setStage('failed');
        setStatusText('Unable to check demo status.');
        return;
      }
      setStage(body.stage);
      if (body.stage === 'queued' || body.stage === 'dialing') setStatusText('Connecting your browser session…');
      if (body.stage === 'live') setStatusText("You're connected — speak naturally or tap a prompt below.");
      if (body.stage === 'completed') { setStatusText('Session ended.'); return; }
      if (body.stage === 'failed') { setStatusText('The demo session could not complete. Try again.'); return; }
      const nextAttempt = body.stage === 'live' ? 1 : attempt + 1;
      pollTimerRef.current = window.setTimeout(() => void pollStatus({ ...p, attempt: nextAttempt }), DEMO_STATUS_POLL_INTERVAL_MS);
    } catch {
      clearPollTimer();
      setStage('failed');
      setStatusText('Network error while checking demo status.');
      setRequestError('Network error while checking demo status.');
    }
  }

  async function startDirectOpenAiDemo(preauthorizedStream?: MediaStream) {
    cleanupDirectRealtime();
    directPeerFailureMutedRef.current = false;
    clearPollTimer();
    setStatusText('Requesting microphone…');
    const stream = preauthorizedStream ?? await requestDemoMicrophone({ keepAlive: true });
    if (!stream) { setStage('idle'); setStatusText(''); return; }
    directStreamRef.current = stream;
    setStatusText('Creating demo session…');
    const sessionResponse = await fetch('/api/backend/public/demo/realtime-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin ? { Origin: window.location.origin } : {}),
      },
      body: JSON.stringify(buildDemoPayload()),
    });
    const sessionBody = (await sessionResponse.json().catch(() => ({}))) as DirectRealtimeApiResponse;
    if (!sessionResponse.ok || !sessionBody.ok || !sessionBody.clientSecret) {
      const msg = userMessageForDirectDemoRealtimeJson(sessionResponse.status, sessionBody as Record<string, unknown>);
      cleanupDirectRealtime();
      resetTurnstile();
      setRequestError(msg);
      setStage('idle');
      setStatusText('');
      return;
    }
    directRealtimeRequestIdRef.current = sessionBody.requestId ?? null;
    logDemoRealtime('session_ok', { mode: 'direct_openai', hasScriptedWelcome: Boolean(sessionBody.scriptedWelcomeLine?.trim()) });
    try {
      setStatusText('Connecting to the voice demo…');
      const pc = new RTCPeerConnection();
      directPeerRef.current = pc;
      let connected = false;
      directConnectTimerRef.current = window.setTimeout(() => {
        if (connected) return;
        directPeerFailureMutedRef.current = true;
        cleanupDirectRealtime();
        resetTurnstile();
        setStage('failed');
        setStatusText(DEMO_STATUS_TIMEOUT_MESSAGE);
        setRequestError(DEMO_STATUS_TIMEOUT_MESSAGE);
      }, DIRECT_OPENAI_CONNECT_TIMEOUT_MS);
      const audio = new Audio();
      audio.autoplay = true;
      directAudioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(() => { /* browser may require prior user gesture */ });
        connected = true;
        clearDirectConnectTimer();
        beginDirectDemoMaxDurationTimer();
        setStage('live');
        setStatusText("You're connected — the receptionist will greet you first, then you can speak.");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          connected = true;
          clearDirectConnectTimer();
          beginDirectDemoMaxDurationTimer();
          setStage('live');
          setStatusText("You're connected — speak naturally or tap a prompt below.");
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (directPeerFailureMutedRef.current) return;
          directPeerFailureMutedRef.current = true;
          clearDirectConnectTimer();
          cleanupDirectRealtime();
          resetTurnstile();
          setStage('failed');
          setStatusText('The web demo could not connect. Please check your connection and try again.');
          setRequestError('The web demo could not connect. Please check your connection and try again.');
        }
      };
      for (const track of stream.getAudioTracks()) {
        logDemoRealtime('mic_track', { trackId: track.id });
        pc.addTrack(track, stream);
      }
      const dc = pc.createDataChannel('oai-events');
      directDataChannelRef.current = dc;
      let initialGreetingRequested = false;
      let realtimeSessionReady = false;
      let vadResumeAfterWelcomeSent = false;
      let awaitingInitialGreetingAudioStop = false;
      let pendingDemoEndCall = false;
      const completePendingDemoEndCallAfterTailGrace = () => {
        if (directEndCallTailGraceTimerRef.current !== null) return;
        directEndCallTailGraceTimerRef.current = window.setTimeout(() => {
          directEndCallTailGraceTimerRef.current = null;
          if (!pendingDemoEndCall) return;
          pendingDemoEndCall = false;
          directPeerFailureMutedRef.current = true; // prevent closed-connection from showing error
          setStage('completed');
          setStatusText('Demo ended. Thanks for trying RingBooker!');
          cleanupDirectRealtime({ endReason: 'completed' });
        }, DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS);
        logDemoRealtime('end_call_tail_grace_started', {
          delayMs: DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS,
        });
      };
      const maybeResumeVadAfterWelcome = (fromEvent: string) => {
        const td = sessionBody.turnDetectionAfterWelcome;
        if (!td || typeof td !== 'object' || Array.isArray(td) || vadResumeAfterWelcomeSent || dc.readyState !== 'open' || td.create_response !== true) return;
        vadResumeAfterWelcomeSent = true;
        try {
          dc.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: td } } } }));
          logDemoRealtime('vad_resume_sent', { fromEvent });
        } catch { vadResumeAfterWelcomeSent = false; }
      };
      const requestInitialGreeting = () => {
        if (initialGreetingRequested || !realtimeSessionReady || dc.readyState !== 'open') return;
        initialGreetingRequested = true;
        awaitingInitialGreetingAudioStop = true;
        setStatusText('The receptionist is greeting you…');
        try {
          const scripted = sessionBody.scriptedWelcomeLine?.trim();
          const greetingInstructions = scripted
            ? `Speak first now. Say this opening line exactly once (natural contractions allowed), then stop and listen for the caller: ${scripted}`
            : 'Speak first now. Say only the exact WELCOME MESSAGE from RUNTIME BUSINESS CONFIG, naturally and once, then stop and listen. Do not wait for the caller to speak.';
          dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'The call just connected. Please say the configured WELCOME MESSAGE before I say anything.' }] } }));
          dc.send(JSON.stringify({ type: 'response.create', response: { instructions: greetingInstructions } }));
        } catch {
          initialGreetingRequested = false;
          awaitingInitialGreetingAudioStop = false;
        }
      };
      dc.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            error?: { message?: string; code?: string; type?: string };
            // response.done nests status under data.response.status, not top-level
            response?: { status?: string };
            type?: string;
            transcript?: string;
            name?: string;
            call_id?: string;
          };
          const evType = data.type;
          if (evType && DEMO_REALTIME_LOG_EVENT_TYPES.has(evType)) logDemoRealtime('oai_event', { type: evType, status: data.response?.status });
          if (data.type === 'session.created' || data.type === 'session.updated') {
            realtimeSessionReady = true;
            if (data.type === 'session.created') {
              // Register end_call tool so the AI can close the demo when done.
              try {
                dc.send(JSON.stringify({
                  type: 'session.update',
                  session: {
                    tools: [{
                      type: 'function',
                      name: 'end_call',
                      description: "End the demo call after the caller's request is fully complete — booking confirmed, link sent, question answered, or callback scheduled. Say a warm goodbye before calling this.",
                      parameters: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          reason: {
                            type: 'string',
                            enum: ['booking_completed', 'link_sent', 'question_answered', 'callback_scheduled', 'other'],
                          },
                        },
                        required: ['reason'],
                      },
                    }],
                    tool_choice: 'auto',
                  },
                }));
              } catch { /* non-fatal */ }
            }
            requestInitialGreeting();
          }
          if ((data.type === 'response.output_audio_transcript.done' || data.type === 'response.audio_transcript.done') && typeof data.transcript === 'string') {
            const text = data.transcript.trim();
            if (text) transcriptTurnsRef.current.push({ role: 'assistant', text: text.slice(0, 1000) });
          }
          if (data.type === 'conversation.item.input_audio_transcription.completed' && typeof data.transcript === 'string') {
            const text = data.transcript.trim();
            if (text) transcriptTurnsRef.current.push({ role: 'user', text: text.slice(0, 1000) });
          }
          if (data.type === 'response.created') setStatusText('AI receptionist is responding…');
          if (data.type === 'response.done') {
            if (!awaitingInitialGreetingAudioStop) {
              setStatusText("You're connected — speak naturally or tap a prompt below.");
            }
          }
          if (data.type === 'input_audio_buffer.speech_started') setStatusText('Listening…');
          // end_call tool: acknowledge then wait for audio to finish before closing UI.
          if (data.type === 'response.function_call_arguments.done' && data.name === 'end_call') {
            const callIdTool = typeof data.call_id === 'string' ? data.call_id : undefined;
            if (callIdTool && dc.readyState === 'open') {
              try {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callIdTool, output: JSON.stringify({ ok: true }) },
                }));
              } catch { /* non-fatal */ }
            }
            pendingDemoEndCall = true;
            setStatusText('Call ending…');
          }
          // Audio buffer done — if end_call was requested, close the demo session.
          if (awaitingInitialGreetingAudioStop && data.type === 'output_audio_buffer.stopped') {
            awaitingInitialGreetingAudioStop = false;
            setStatusText("You're connected — speak naturally or tap a prompt below.");
            maybeResumeVadAfterWelcome('output_audio_buffer.stopped');
          }
          if (pendingDemoEndCall && data.type === 'output_audio_buffer.stopped') {
            completePendingDemoEndCallAfterTailGrace();
          }
        } catch { /* ignore non-JSON */ }
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(OPENAI_REALTIME_WEBRTC_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionBody.clientSecret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });
      if (!sdpResponse.ok) throw new Error('webrtc_connect_failed');
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() });
    } catch {
      directPeerFailureMutedRef.current = true;
      cleanupDirectRealtime();
      resetTurnstile();
      setStage('failed');
      setStatusText('The web demo could not connect. Please check your connection and try again.');
      setRequestError('The web demo could not connect. Please check your connection and try again.');
    }
  }

  async function startLiveKitWebDemo(params: { micStream: MediaStream }) {
    const { micStream } = params;
    const micTrack = micStream.getAudioTracks()[0];
    if (!micTrack) {
      resetTurnstile();
      setStage('idle');
      setStatusText('');
      setErrors(['No microphone audio track. Please try again.']);
      return;
    }
    clearPollTimer();
    setStatusText('Starting browser demo…');
    try {
      const res = await fetch('/api/backend/public/demo/web-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && window.location?.origin ? { Origin: window.location.origin } : {}),
        },
        body: JSON.stringify(buildDemoPayload()),
      });
      const body = (await res.json()) as DemoApiResponse;
      if (!body.ok || !body.requestId || !body.previewToken) {
        resetTurnstile();
        micStream.getTracks().forEach((t) => t.stop());
        setStage('failed');
        setRequestError(apiUserVisibleMessage(body, 'Unable to start browser demo.'));
        return;
      }
      const liveKitUrl = body.liveKitUrl;
      const liveKitToken = body.liveKitToken;
      if (typeof liveKitUrl === 'string' && typeof liveKitToken === 'string' && liveKitUrl && liveKitToken) {
        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.Disconnected, () => { roomRef.current = null; });
        try {
          await room.connect(liveKitUrl, liveKitToken);
          await room.localParticipant.publishTrack(micTrack, { source: Track.Source.Microphone });
        } catch {
          room.disconnect();
          roomRef.current = null;
          throw new Error('livekit_connect_failed');
        }
      }
      setStatusText('Joining demo room…');
      await pollStatus({ requestId: body.requestId, previewToken: body.previewToken });
    } catch (error) {
      resetTurnstile();
      if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
      micStream.getTracks().forEach((t) => t.stop());
      setStage('failed');
      const message =
        error instanceof Error && error.message === 'livekit_connect_failed'
          ? LIVEKIT_CONNECT_ERROR_MESSAGE
          : 'Network error. Please try again.';
      setStatusText(message);
      setRequestError(message);
    }
  }

  async function startWebDemo() {
    const errs = validate();
    setErrors(errs);
    setRequestError(null);
    if (errs.length > 0) return;
    if (demoStartLockRef.current) return;
    demoStartLockRef.current = true;
    try {
      setStatusText('Requesting microphone…');
      const preflightStream = await requestDemoMicrophone({ keepAlive: true });
      if (!preflightStream) return;
      flushSync(() => {
        setStage('queued');
        setStatusText(demoWebCallMode === 'direct_openai' ? 'Requesting microphone…' : 'Starting browser demo…');
      });
      if (demoWebCallMode === 'direct_openai') await startDirectOpenAiDemo(preflightStream);
      else await startLiveKitWebDemo({ micStream: preflightStream });
    } finally {
      demoStartLockRef.current = false;
    }
  }

  function endWebDemo() {
    if (demoWebCallMode === 'direct_openai') {
      directPeerFailureMutedRef.current = true;
      transcriptTurnsRef.current = [];
      cleanupDirectRealtime();
      resetTurnstile();
      setStage('completed');
      setRequestError(null);
      setStatusText('Session ended.');
      return;
    }
    clearPollTimer();
    if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
    resetTurnstile();
    setStage('completed');
    setRequestError(null);
    setStatusText('Session ended.');
  }

  function resetDemo() {
    directPeerFailureMutedRef.current = false;
    clearPollTimer();
    cleanupDirectRealtime();
    if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
    resetTurnstile();
    setStage('idle');
    setRequestError(null);
    setStatusText('');
    setErrors([]);
    transcriptTurnsRef.current = [];
  }

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(prompt);
      window.setTimeout(() => setCopied(null), 1600);
    } catch { /* ignore */ }
  }

  const accentColor = config.accent;

  return (
    <div className="dce-shell" style={{ '--dce-va': accentColor } as React.CSSProperties}>
      <style>{`
        .dce-shell{display:flex;flex-direction:column;gap:14px}
        .dce-biz-tag{display:inline-flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,var(--dce-va) 30%,#E5E7EB);background:color-mix(in srgb,var(--dce-va) 5%,#fff);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700;color:var(--dce-va);width:fit-content}
        .dce-biz-icon{width:20px;height:20px;border-radius:6px;background:var(--dce-va);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0}
        .dce-idle-note{font-size:13px;color:#6B7280;line-height:1.55;margin:0}
        .dce-captcha-wrap{border:1px dashed #E5E7EB;border-radius:14px;padding:10px;background:#FAFAFA;display:flex;align-items:center;justify-content:center;min-height:70px}
        .dce-captcha-inner{min-height:65px;width:100%;max-width:340px;display:flex;align-items:center;justify-content:center}
        .dce-captcha-hint{font-size:12px;color:#9CA3AF;margin-top:6px;line-height:1.45}
        .dce-errors{display:flex;flex-direction:column;gap:6px}
        .dce-error{font-size:13px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:9px 12px}
        .dce-btn-start{width:100%;border:none;border-radius:999px;background:var(--dce-va);color:#fff;padding:14px;font-size:15px;font-weight:900;cursor:pointer;transition:.18s;box-shadow:0 8px 24px color-mix(in srgb,var(--dce-va) 28%,transparent);-webkit-appearance:none}
        .dce-btn-start:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
        .dce-btn-start:disabled{opacity:.55;cursor:not-allowed;transform:none}
        .dce-btn-note{font-size:12px;color:#9CA3AF;text-align:center;margin:0;line-height:1.5}
        .dce-status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #E5E7EB;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#374151;background:#fff;width:fit-content}
        .dce-status-pill.live{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
        .dce-status-pill.failed{background:#FEF2F2;border-color:#FECACA;color:#B91C1C}
        .dce-status-pill.completed{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8}
        .dce-status-pill.connecting{background:#FFFBEB;border-color:#FDE68A;color:#92400E}
        .dce-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
        .dce-dot.pulse{animation:dcePulse 1.2s ease-in-out infinite}
        @keyframes dcePulse{0%,100%{opacity:1}50%{opacity:.35}}
        .dce-status-txt{font-size:13px;color:#6B7280;line-height:1.5;margin:0}
        .dce-wave{height:36px;display:flex;justify-content:center;align-items:center;gap:3px}
        .dce-wave span{display:block;width:3px;border-radius:4px;background:#10B981;animation:dceWave 1.65s ease-in-out infinite}
        .dce-wave span:nth-child(1){height:8px}.dce-wave span:nth-child(2){height:20px;animation-delay:.12s}.dce-wave span:nth-child(3){height:28px;animation-delay:.24s}.dce-wave span:nth-child(4){height:16px;animation-delay:.36s}.dce-wave span:nth-child(5){height:24px;animation-delay:.48s}
        @keyframes dceWave{0%,100%{transform:scaleY(.4);opacity:.45}50%{transform:scaleY(1);opacity:1}}
        .dce-connecting-dots{height:36px;display:flex;justify-content:center;align-items:center;gap:6px}
        .dce-connecting-dots span{display:block;width:8px;height:8px;border-radius:50%;background:color-mix(in srgb,var(--dce-va) 55%,#E5E7EB);animation:dceBounc 1.2s ease-in-out infinite}
        .dce-connecting-dots span:nth-child(2){animation-delay:.2s}.dce-connecting-dots span:nth-child(3){animation-delay:.4s}
        @keyframes dceBounc{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-8px);opacity:1}}
        .dce-prompts-head{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF;margin:0}
        .dce-prompts{display:flex;flex-direction:column;gap:7px}
        .dce-prompt{display:flex;align-items:center;justify-content:space-between;border:1px solid color-mix(in srgb,var(--dce-va) 22%,#E5E7EB);background:color-mix(in srgb,var(--dce-va) 4%,#fff);border-radius:13px;padding:10px 12px;font-size:13px;font-weight:700;color:#243041;cursor:pointer;text-align:left;transition:.15s;width:100%;-webkit-appearance:none}
        .dce-prompt:hover{border-color:var(--dce-va);background:#fff;box-shadow:0 4px 12px color-mix(in srgb,var(--dce-va) 10%,transparent)}
        .dce-prompt-copy{font-size:10px;font-weight:900;color:#C4C9D4;text-transform:uppercase;flex-shrink:0;margin-left:8px}
        .dce-prompt:hover .dce-prompt-copy{color:var(--dce-va)}
        .dce-prompt-more{background:none;border:none;cursor:pointer;font-size:12px;font-weight:800;color:var(--dce-va);padding:2px 0;-webkit-appearance:none}
        .dce-btn-end{width:100%;border-radius:999px;background:#EF4444;color:#fff;border:none;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:.18s;box-shadow:0 4px 14px rgba(239,68,68,.28);-webkit-appearance:none}
        .dce-btn-end:hover:not(:disabled){background:#DC2626;transform:translateY(-1px)}
        .dce-btn-retry{width:100%;border:none;border-radius:999px;background:var(--dce-va);color:#fff;padding:12px;font-size:14px;font-weight:800;cursor:pointer;transition:.18s;-webkit-appearance:none}
        .dce-btn-retry:hover{filter:brightness(1.08)}
        .dce-sms-card{border:1px solid #E5E7EB;border-radius:16px;background:#F8FAFC;padding:14px}
        .dce-sms-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px}
        .dce-sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:16px 16px 16px 5px;padding:12px 14px;color:#334155;font-size:13px;line-height:1.55}
      `}</style>

      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />
      ) : null}

      {/* ── Idle ─────────────────────────────────────────────── */}
      {stage === 'idle' ? (
        <>
          <div className="dce-biz-tag">
            <span className="dce-biz-icon">{config.icon}</span>
            <span>{businessConfig.businessName}</span>
          </div>
          <p className="dce-idle-note">
            Talk to your AI receptionist in your browser. Your microphone will be requested when you tap Start.
          </p>
          {turnstileSiteKey ? (
            <div>
              <div className="dce-captcha-wrap">
                <div className="dce-captcha-inner" ref={turnstileRef} />
              </div>
              {captchaHint ? <p className="dce-captcha-hint">{captchaHint}</p> : null}
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="dce-errors">
              {errors.map((e, i) => <div key={i} className="dce-error">{e}</div>)}
            </div>
          ) : null}
          <button
            type="button"
            className="dce-btn-start"
            disabled={Boolean(turnstileSiteKey && !captchaToken)}
            onClick={() => void startWebDemo()}
          >
            Start web voice demo
          </button>
          <p className="dce-btn-note">Free · No credit card · Microphone required</p>
        </>
      ) : null}

      {/* ── Connecting ───────────────────────────────────────── */}
      {(stage === 'queued' || stage === 'dialing') ? (
        <>
          <div className="dce-status-pill connecting">
            <span className="dce-dot pulse" />
            Connecting
          </div>
          <p className="dce-status-txt">{statusText || 'Connecting your browser session…'}</p>
          <div className="dce-connecting-dots" aria-hidden>
            <span /><span /><span />
          </div>
        </>
      ) : null}

      {/* ── Live ─────────────────────────────────────────────── */}
      {stage === 'live' ? (
        <>
          <div className="dce-status-pill live">
            <span className="dce-dot pulse" />
            Live
          </div>
          <p className="dce-status-txt">{statusText || "You're connected — speak naturally."}</p>
          <div className="dce-wave" aria-hidden>
            <span /><span /><span /><span /><span />
          </div>
          <p className="dce-prompts-head">Try asking</p>
          <div className="dce-prompts">
            {visiblePrompts.map((p) => (
              <button key={p} type="button" className="dce-prompt" onClick={() => void copyPrompt(p)}>
                <span>{p}</span>
                <span className="dce-prompt-copy">{copied === p ? 'Copied' : 'Copy'}</span>
              </button>
            ))}
          </div>
          {activePrompts.length > 3 ? (
            <button type="button" className="dce-prompt-more" onClick={() => setShowAllPrompts((v) => !v)}>
              {showAllPrompts ? 'Show fewer' : `+${activePrompts.length - 3} more`}
            </button>
          ) : null}
          <button type="button" className="dce-btn-end" onClick={endWebDemo}>
            End call
          </button>
        </>
      ) : null}

      {/* ── Completed ────────────────────────────────────────── */}
      {stage === 'completed' ? (
        <>
          <div className="dce-status-pill completed">
            <span className="dce-dot" />
            Ended
          </div>
          <div className="dce-sms-card">
            <div className="dce-sms-label">What a follow-up SMS could look like</div>
            <div className="dce-sms-bubble">{config.smsPreview}</div>
          </div>
          <button type="button" className="dce-btn-retry" onClick={resetDemo}>
            Try another question
          </button>
        </>
      ) : null}

      {/* ── Failed ───────────────────────────────────────────── */}
      {stage === 'failed' ? (
        <>
          <div className="dce-status-pill failed">
            <span className="dce-dot" />
            Error
          </div>
          {requestError ? <div className="dce-error">{requestError}</div> : null}
          <button type="button" className="dce-btn-retry" onClick={resetDemo}>
            Try again
          </button>
        </>
      ) : null}
    </div>
  );
}
