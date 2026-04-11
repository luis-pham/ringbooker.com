'use client';

import Link from 'next/link';
import Script from 'next/script';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MarketingChromeStyles, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICALS, type DemoServiceCategory, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

type DemoStage = 'idle' | 'queued' | 'dialing' | 'live' | 'completed' | 'failed';

type DemoBusinessConfig = {
  businessName: string;
  phoneNumber: string;
  city: string;
  primaryHours: string;
  secondaryHours: string;
  staff: string;
  notes: string;
  services: DemoServiceCategory[];
};

type DemoApiResponse = {
  ok: boolean;
  requestId?: string;
  previewToken?: string;
  error?: string;
};

type DemoStatusResponse = {
  ok: boolean;
  stage?: 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
  call?: { startedAt?: string | null; endedAt?: string | null; outcome?: string | null } | null;
  error?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

const VERTICAL_LANDING: Record<DemoVerticalSlug, string> = {
  'nail-salon': '/nail-salon',
  'hair-salon': '/hair-salon',
  'day-spa': '/spa',
  'med-spa': '/med-spa',
  'beauty-clinic': '/beauty-clinic',
};

const styles: string[] = [
  String.raw`
  .vd-wrap{
    min-height:100dvh;
    padding-top:68px;
    display:flex;
    flex-direction:column;
    align-items:center;
    background:linear-gradient(160deg,color-mix(in srgb,var(--va) 8%,#fff) 0%,#fff 50%);
  }
  .vd-card{
    width:100%;max-width:460px;
    margin:0 auto;
    padding:28px 20px 48px;
    display:flex;flex-direction:column;gap:0;
  }
  .vd-back{
    display:inline-flex;align-items:center;gap:6px;
    font-size:13px;font-weight:700;color:#6B7280;text-decoration:none;
    margin-bottom:20px;
  }
  .vd-back:hover{color:var(--va)}
  .vd-badge{
    display:inline-flex;align-items:center;gap:8px;
    border:1px solid color-mix(in srgb,var(--va) 30%,#E5E7EB);
    background:color-mix(in srgb,var(--va) 8%,#fff);
    border-radius:999px;padding:7px 12px;
    font-size:12px;font-weight:800;color:var(--va);
    margin-bottom:14px;width:fit-content;
  }
  .vd-icon{
    width:22px;height:22px;border-radius:7px;
    background:var(--va);color:#fff;
    display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:900;flex-shrink:0;
  }
  .vd-h1{
    font-size:clamp(24px,6vw,32px);font-weight:900;
    line-height:1.12;letter-spacing:-0.6px;
    color:#111827;margin:0 0 8px;
  }
  .vd-sub{
    font-size:14px;line-height:1.6;color:#6B7280;
    margin:0 0 24px;
  }
  /* phone input — hero treatment */
  .vd-phone-wrap{
    position:relative;margin-bottom:14px;
  }
  .vd-phone-label{
    display:block;font-size:13px;font-weight:800;color:#111827;margin-bottom:7px;
  }
  .vd-phone-input{
    width:100%;border:2px solid color-mix(in srgb,var(--va) 40%,#E5E7EB);
    border-radius:16px;padding:14px 16px;
    font-size:17px;font-weight:700;color:#111827;
    background:#fff;outline:none;
    transition:border-color .18s,box-shadow .18s;
    box-shadow:0 2px 8px color-mix(in srgb,var(--va) 10%,transparent);
    -webkit-appearance:none;
  }
  .vd-phone-input:focus{
    border-color:var(--va);
    box-shadow:0 0 0 4px color-mix(in srgb,var(--va) 14%,transparent);
  }
  .vd-phone-input::placeholder{color:#C4C9D4}
  /* secondary fields */
  .vd-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
  .vd-field label{font-size:13px;font-weight:700;color:#374151}
  .vd-field input,.vd-field textarea{
    width:100%;border:1px solid #E5E7EB;border-radius:13px;
    padding:11px 13px;font-size:14px;color:#111827;background:#fff;
    outline:none;transition:border-color .15s;-webkit-appearance:none;
  }
  .vd-field input:focus,.vd-field textarea:focus{border-color:var(--va)}
  .vd-field textarea{min-height:68px;resize:vertical}
  .vd-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  /* advanced toggle */
  .vd-adv-toggle{
    display:flex;align-items:center;gap:8px;
    background:none;border:none;cursor:pointer;
    font-size:13px;font-weight:700;color:#6B7280;
    padding:10px 0;margin-bottom:4px;
  }
  .vd-adv-toggle:hover{color:var(--va)}
  .vd-adv-chevron{
    font-size:10px;transition:transform .2s;
    display:inline-block;
  }
  .vd-adv-chevron.open{transform:rotate(180deg)}
  .vd-adv-body{
    background:#F9FAFB;border:1px solid #E5E7EB;
    border-radius:18px;padding:16px;
    display:flex;flex-direction:column;gap:12px;
    margin-bottom:14px;
  }
  /* service tabs */
  .vd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  .vd-tab{
    border:1px solid #E5E7EB;background:#fff;border-radius:999px;
    padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer;
  }
  .vd-tab.on{background:var(--va);border-color:var(--va);color:#fff}
  .vd-svc-row{
    display:grid;grid-template-columns:18px 1fr auto;
    gap:10px;align-items:center;
    border:1px solid #E5E7EB;border-radius:13px;padding:10px 12px;
    background:#fff;
  }
  .vd-svc-row input[type=checkbox]{accent-color:var(--va);width:16px;height:16px}
  .vd-svc-name{font-size:13px;font-weight:700;color:#1F2937}
  .vd-svc-dur{font-size:11px;color:#9CA3AF;margin-top:1px}
  .vd-svc-price{
    width:72px;border:1px solid #E5E7EB;border-radius:9px;
    padding:7px 8px;text-align:right;font-size:13px;font-weight:700;
    -webkit-appearance:none;
  }
  /* prompts */
  .vd-prompts-head{
    font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
    color:#9CA3AF;margin:18px 0 10px;
  }
  .vd-prompts{display:flex;flex-direction:column;gap:7px;margin-bottom:18px}
  .vd-prompt{
    display:flex;align-items:center;justify-content:space-between;
    border:1px solid color-mix(in srgb,var(--va) 20%,#E5E7EB);
    background:color-mix(in srgb,var(--va) 4%,#fff);
    border-radius:13px;padding:11px 13px;
    font-size:13px;font-weight:700;color:#243041;
    cursor:pointer;text-align:left;transition:.15s;
  }
  .vd-prompt:hover{
    border-color:var(--va);background:#fff;
    box-shadow:0 4px 12px color-mix(in srgb,var(--va) 10%,transparent);
  }
  .vd-prompt-copy{font-size:10px;font-weight:900;color:#C4C9D4;text-transform:uppercase;flex-shrink:0;margin-left:8px}
  .vd-prompt:hover .vd-prompt-copy{color:var(--va)}
  .vd-prompt-more{
    background:none;border:none;cursor:pointer;
    font-size:12px;font-weight:800;color:var(--va);
    padding:2px 0;margin-bottom:14px;
  }
  .vd-copied{font-size:12px;font-weight:800;color:var(--va);margin:-8px 0 10px}
  /* errors */
  .vd-errors{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
  .vd-error{font-size:13px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:9px 12px}
  /* CTA */
  .vd-cta{
    width:100%;border:none;border-radius:999px;
    background:var(--va);color:#fff;
    padding:16px;font-size:16px;font-weight:900;
    cursor:pointer;transition:.18s;
    box-shadow:0 8px 24px color-mix(in srgb,var(--va) 30%,transparent);
    -webkit-appearance:none;
  }
  .vd-cta:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
  .vd-cta:disabled{opacity:.55;cursor:not-allowed}
  .vd-cta-note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:8px;line-height:1.5}
  /* turnstile */
  .vd-captcha{margin-bottom:14px}
  /* status view */
  .vd-status{display:flex;flex-direction:column;gap:0}
  .vd-status-pill{
    display:inline-flex;align-items:center;gap:8px;
    border:1px solid #E5E7EB;border-radius:999px;
    padding:8px 14px;font-size:13px;font-weight:800;color:#374151;
    background:#fff;margin-bottom:16px;width:fit-content;
  }
  .vd-status-pill.live{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
  .vd-status-pill.failed{background:#FEF2F2;border-color:#FECACA;color:#B91C1C}
  .vd-status-pill.completed{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8}
  .vd-status-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
  .vd-status-dot.pulse{animation:vdPulse 1.2s ease-in-out infinite}
  @keyframes vdPulse{0%,100%{opacity:1}50%{opacity:.35}}
  .vd-status-h{font-size:22px;font-weight:900;letter-spacing:-.5px;color:#111827;margin:0 0 6px}
  .vd-status-body{font-size:14px;line-height:1.6;color:#6B7280;margin:0 0 18px}
  .vd-steps{
    display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:20px;
  }
  .vd-step{
    border:1px solid #E5E7EB;border-radius:12px;
    padding:8px 6px;text-align:center;
    font-size:11px;font-weight:800;color:#9CA3AF;
  }
  .vd-step.on{
    border-color:var(--va);
    background:color-mix(in srgb,var(--va) 10%,#fff);
    color:#111827;
  }
  /* wave animation for live state */
  .vd-wave{height:30px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:14px}
  .vd-wave span{display:block;width:3px;border-radius:4px;background:var(--va);animation:vdWave 1.1s ease-in-out infinite}
  .vd-wave span:nth-child(1){height:8px}.vd-wave span:nth-child(2){height:20px;animation-delay:.08s}.vd-wave span:nth-child(3){height:28px;animation-delay:.16s}.vd-wave span:nth-child(4){height:16px;animation-delay:.24s}.vd-wave span:nth-child(5){height:24px;animation-delay:.32s}
  @keyframes vdWave{0%,100%{transform:scaleY(.4);opacity:.4}50%{transform:scaleY(1);opacity:1}}
  /* SMS preview */
  .vd-sms{border:1px solid #E5E7EB;border-radius:18px;background:#F8FAFC;padding:14px;margin-bottom:14px}
  .vd-sms-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px}
  .vd-sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:16px 16px 16px 5px;padding:12px 14px;color:#334155;font-size:13px;line-height:1.55}
  /* completion CTA */
  .vd-complete-cta{
    display:flex;flex-direction:column;gap:9px;margin-top:4px;
  }
  .vd-btn-primary{
    display:flex;align-items:center;justify-content:center;
    background:#111827;color:#fff;border:none;border-radius:999px;
    padding:14px 20px;font-size:15px;font-weight:900;
    cursor:pointer;text-decoration:none;transition:.18s;
  }
  .vd-btn-primary:hover{background:#1F2937;transform:translateY(-1px)}
  .vd-btn-ghost{
    display:flex;align-items:center;justify-content:center;
    background:#fff;color:#374151;
    border:1px solid #E5E7EB;border-radius:999px;
    padding:12px 20px;font-size:14px;font-weight:700;
    cursor:pointer;transition:.18s;
  }
  .vd-btn-ghost:hover{border-color:var(--va);color:var(--va)}
  /* other verticals */
  .vd-others{display:flex;flex-wrap:wrap;gap:7px;margin-top:28px;padding-top:22px;border-top:1px solid #F1F5F9}
  .vd-other{
    border:1px solid #E5E7EB;border-radius:999px;
    padding:7px 12px;font-size:12px;font-weight:700;
    color:#4B5563;background:#fff;text-decoration:none;
  }
  .vd-other:hover{border-color:var(--va);color:var(--va)}
  /* disclaimer */
  .vd-disclaimer{
    font-size:12px;color:#9CA3AF;line-height:1.5;
    border-top:1px solid #F1F5F9;padding-top:16px;margin-top:24px;
  }
  `,
];

function cloneServices(services: DemoServiceCategory[]): DemoServiceCategory[] {
  return services.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return trimmed;
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

function stageLabel(stage: DemoStage): string {
  if (stage === 'queued') return 'Preparing…';
  if (stage === 'dialing') return 'Calling now';
  if (stage === 'live') return 'Connected';
  if (stage === 'completed') return 'Demo complete';
  if (stage === 'failed') return 'Try again';
  return 'Ready';
}

export function MarketingVerticalDemoTemplate({ vertical }: { vertical: DemoVerticalSlug }) {
  const config = DEMO_VERTICALS[vertical];
  const landingPath = VERTICAL_LANDING[vertical];

  const [business, setBusiness] = useState<DemoBusinessConfig>({
    businessName: config.defaultBusinessName,
    phoneNumber: '',
    city: config.defaultCity,
    primaryHours: config.hours.primary,
    secondaryHours: config.hours.secondary,
    staff: config.staffPlaceholder,
    notes: '',
    services: cloneServices(config.serviceCategories),
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(config.serviceCategories[0]?.id ?? '');
  const [stage, setStage] = useState<DemoStage>('idle');
  const [statusText, setStatusText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileSiteKey);
  const pollTimerRef = useRef<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileRenderedRef = useRef(false);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  const activeCategory = useMemo(
    () => business.services.find((c) => c.id === selectedCategory) ?? business.services[0],
    [business.services, selectedCategory],
  );

  const visiblePrompts = showAllPrompts ? config.tryAsking : config.tryAsking.slice(0, 3);
  const hiddenCount = Math.max(0, config.tryAsking.length - 3);
  const isSubmitting = stage === 'queued' || stage === 'dialing' || stage === 'live';
  const activeStep = stage === 'idle' || stage === 'failed' ? 0 : stage === 'queued' ? 1 : stage === 'dialing' ? 2 : stage === 'live' ? 3 : 4;

  useEffect(() => () => { if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current); }, []);

  useEffect(() => {
    if (!turnstileSiteKey || turnstileReady) return;
    const t = window.setInterval(() => {
      if ((window as Window & { turnstile?: unknown }).turnstile) setTurnstileReady(true);
    }, 300);
    return () => window.clearInterval(t);
  }, [turnstileReady]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || turnstileRenderedRef.current || !turnstileRef.current) return;
    const tw = (window as Window & { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void } }).turnstile;
    if (!tw) return;
    turnstileWidgetIdRef.current = tw.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      callback: (token: string) => setCaptchaToken(token),
      'error-callback': () => setCaptchaToken(null),
      'expired-callback': () => setCaptchaToken(null),
    });
    turnstileRenderedRef.current = true;
  }, [turnstileReady]);

  function updateService(catId: string, idx: number, patch: Partial<DemoServiceCategory['items'][number]>) {
    setBusiness((cur) => ({
      ...cur,
      services: cur.services.map((c) =>
        c.id === catId ? { ...c, items: c.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)) } : c,
      ),
    }));
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!business.businessName.trim()) errs.push('Business name is required.');
    if (business.phoneNumber.trim().length < 7) errs.push('Enter the phone number we should call for the demo.');
    if (turnstileSiteKey && !captchaToken) errs.push('Please complete the verification below.');
    return errs;
  }

  async function pollStatus(p: { requestId: string; previewToken: string }) {
    try {
      const res = await fetch(`/api/backend/public/demo/status/${encodeURIComponent(p.requestId)}?token=${encodeURIComponent(p.previewToken)}`);
      const body = (await res.json()) as DemoStatusResponse;
      if (!body.ok || !body.stage) { setRequestError(body.error ?? 'Unable to check demo status.'); return; }
      setStage(body.stage);
      if (body.stage === 'queued') setStatusText('Preparing your demo call — this takes a few seconds.');
      if (body.stage === 'dialing') setStatusText('Calling your number now. Pick up and say anything.');
      if (body.stage === 'live') setStatusText('You\'re connected. Try one of the prompts below or just speak naturally.');
      if (body.stage === 'completed') { setStatusText('Done! Here\'s what the follow-up SMS would look like.'); return; }
      if (body.stage === 'failed') { setStatusText('Call didn\'t go through. Check the number and try again.'); return; }
      pollTimerRef.current = window.setTimeout(() => void pollStatus(p), 2200);
    } catch {
      setRequestError('Network error while checking demo status.');
    }
  }

  function resetTurnstile() {
    if (!turnstileSiteKey || !turnstileWidgetIdRef.current) return;
    (window as Window & { turnstile?: { reset: (id: string) => void } }).turnstile?.reset(turnstileWidgetIdRef.current);
    setCaptchaToken(null);
  }

  async function startDemo() {
    const errs = validate();
    setErrors(errs);
    setRequestError(null);
    if (errs.length > 0) return;
    setStage('queued');
    setStatusText('Submitting demo request…');
    const payload = {
      shopName: business.businessName,
      phoneNumber: normalizePhone(business.phoneNumber),
      businessType: config.businessType,
      notes: business.notes || undefined,
      captchaToken: turnstileSiteKey ? captchaToken : 'dev-turnstile-bypass',
      sessionId: ensureSessionId(),
      website: '',
      demoConfig: {
        city: business.city || config.defaultCity,
        primaryHours: business.primaryHours,
        secondaryHours: business.secondaryHours,
        staffNames: splitStaff(business.staff),
        services: business.services.flatMap((c) =>
          c.items.map((item) => ({ category: c.label, name: item.name, price: item.price, duration: item.duration, enabled: item.enabled })),
        ),
      },
      demoVertical: config.slug,
      demoMode: 'quick',
      demoSource: 'vertical_demo_page',
    };
    try {
      const res = await fetch('/api/backend/public/demo/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = (await res.json()) as DemoApiResponse;
      if (!body.ok || !body.requestId || !body.previewToken) {
        resetTurnstile(); setStage('failed'); setRequestError(body.error ?? 'Unable to start demo call.');
        return;
      }
      const p = { requestId: body.requestId, previewToken: body.previewToken };
      setStatusText('Request sent — calling your number now.');
      await pollStatus(p);
    } catch {
      resetTurnstile(); setStage('failed'); setRequestError('Network error. Please try again.');
    }
  }

  async function copyPrompt(prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setCopied(prompt); window.setTimeout(() => setCopied(null), 1600); } catch { /* ignore */ }
  }

  function resetDemo() {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    setStage('idle'); setRequestError(null); setStatusText('');
    window.setTimeout(() => phoneRef.current?.focus(), 100);
  }

  const isActive = stage !== 'idle';

  return (
    <MarketingLayout styles={styles} scriptPrefix={`vertical-demo-${config.slug}`}>
      <>
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={() => setTurnstileReady(true)} />
        ) : null}
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />

        <div className="vd-wrap" style={{ '--va': config.accent } as CSSProperties}>
          <div className="vd-card">

            {/* Back link */}
            <Link href={landingPath} className="vd-back">
              ← Back to {config.businessType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Link>

            {/* Badge + title */}
            <div className="vd-badge">
              <span className="vd-icon">{config.icon}</span>
              {config.eyebrow}
            </div>
            <h1 className="vd-h1">{config.title}</h1>
            <p className="vd-sub">{config.subtitle}</p>

            {/* ── FORM (hidden during active call) ── */}
            {!isActive ? (
              <>
                {/* Phone — hero field */}
                <div className="vd-phone-wrap">
                  <label className="vd-phone-label" htmlFor="vd-phone">
                    📞 Your phone number — we call you
                  </label>
                  <input
                    ref={phoneRef}
                    id="vd-phone"
                    className="vd-phone-input"
                    inputMode="tel"
                    placeholder="+1 (714) 555-0199"
                    value={business.phoneNumber}
                    onChange={(e) => setBusiness((c) => ({ ...c, phoneNumber: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>

                {/* Business name */}
                <div className="vd-field">
                  <label htmlFor="vd-biz">Business name</label>
                  <input
                    id="vd-biz"
                    value={business.businessName}
                    onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))}
                  />
                </div>

                {/* Advanced toggle */}
                <button type="button" className="vd-adv-toggle" onClick={() => setShowAdvanced((v) => !v)}>
                  <span className={`vd-adv-chevron ${showAdvanced ? 'open' : ''}`}>▼</span>
                  Customize hours, staff &amp; services
                </button>

                {showAdvanced ? (
                  <div className="vd-adv-body">
                    <div className="vd-2col">
                      <div className="vd-field" style={{ margin: 0 }}>
                        <label htmlFor="vd-city">City / state</label>
                        <input id="vd-city" value={business.city} onChange={(e) => setBusiness((c) => ({ ...c, city: e.target.value }))} />
                      </div>
                      <div className="vd-field" style={{ margin: 0 }}>
                        <label htmlFor="vd-staff">{config.staffLabel}</label>
                        <input id="vd-staff" value={business.staff} placeholder={config.staffPlaceholder} onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))} />
                      </div>
                    </div>
                    <div className="vd-2col">
                      <div className="vd-field" style={{ margin: 0 }}>
                        <label htmlFor="vd-h1">Primary hours</label>
                        <input id="vd-h1" value={business.primaryHours} onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))} />
                      </div>
                      <div className="vd-field" style={{ margin: 0 }}>
                        <label htmlFor="vd-h2">Secondary hours</label>
                        <input id="vd-h2" value={business.secondaryHours} onChange={(e) => setBusiness((c) => ({ ...c, secondaryHours: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 8 }}>{config.serviceLabel}</div>
                      <div className="vd-tabs">
                        {business.services.map((cat) => (
                          <button key={cat.id} type="button" className={`vd-tab ${selectedCategory === cat.id ? 'on' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                            {cat.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {activeCategory?.items.map((item, idx) => (
                          <div className="vd-svc-row" key={`${activeCategory.id}-${item.name}`}>
                            <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, idx, { enabled: e.target.checked })} />
                            <div>
                              <div className="vd-svc-name">{item.name}</div>
                              {item.duration ? <div className="vd-svc-dur">{item.duration}</div> : null}
                            </div>
                            <input className="vd-svc-price" type="number" inputMode="numeric" min={0} value={item.price} onChange={(e) => updateService(activeCategory.id, idx, { price: Number(e.target.value) || 0 })} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="vd-field" style={{ margin: 0 }}>
                      <label htmlFor="vd-notes">Extra context</label>
                      <textarea id="vd-notes" value={business.notes} placeholder="e.g. Vietnamese callers are common, consultations required for injectables…" onChange={(e) => setBusiness((c) => ({ ...c, notes: e.target.value }))} />
                    </div>
                  </div>
                ) : null}

                {/* Prompts */}
                <div className="vd-prompts-head">Say one of these when you answer</div>
                <div className="vd-prompts">
                  {visiblePrompts.map((p) => (
                    <button key={p} type="button" className="vd-prompt" onClick={() => void copyPrompt(p)}>
                      <span>"{p}"</span>
                      <span className="vd-prompt-copy">Copy</span>
                    </button>
                  ))}
                </div>
                {hiddenCount > 0 ? (
                  <button type="button" className="vd-prompt-more" onClick={() => setShowAllPrompts((v) => !v)}>
                    {showAllPrompts ? 'Show fewer' : `+${hiddenCount} more ideas`}
                  </button>
                ) : null}
                {copied ? <div className="vd-copied">Copied!</div> : null}

                {/* Turnstile */}
                {turnstileSiteKey ? <div className="vd-captcha" ref={turnstileRef} /> : null}

                {/* Errors */}
                {errors.length > 0 || requestError ? (
                  <div className="vd-errors">
                    {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                    {requestError ? <div className="vd-error">{requestError}</div> : null}
                  </div>
                ) : null}

                {/* CTA */}
                <button type="button" className="vd-cta" onClick={() => void startDemo()} disabled={isSubmitting}>
                  {isSubmitting ? 'Starting…' : 'Call me now →'}
                </button>
                <p className="vd-cta-note">Outbound demo call only · Your real phone system is not affected</p>
              </>
            ) : (
              /* ── STATUS VIEW ── */
              <div className="vd-status">
                <div className={`vd-status-pill ${stage}`}>
                  <span className={`vd-status-dot ${stage === 'queued' || stage === 'dialing' || stage === 'live' ? 'pulse' : ''}`} />
                  {stageLabel(stage)}
                </div>

                <h2 className="vd-status-h">
                  {stage === 'queued' ? 'Preparing your call…' :
                   stage === 'dialing' ? 'Calling your number now' :
                   stage === 'live' ? 'You\'re connected!' :
                   stage === 'completed' ? 'Demo complete' : 'Something went wrong'}
                </h2>
                <p className="vd-status-body">{statusText}</p>

                <div className="vd-steps">
                  {['Ready', 'Queued', 'Calling', 'Live', 'Done'].map((label, i) => (
                    <div key={label} className={`vd-step ${activeStep >= i ? 'on' : ''}`}>{label}</div>
                  ))}
                </div>

                {stage === 'live' ? (
                  <>
                    <div className="vd-wave">
                      <span /><span /><span /><span /><span />
                    </div>
                    <div className="vd-prompts-head">Say one of these</div>
                    <div className="vd-prompts">
                      {config.tryAsking.slice(0, 4).map((p) => (
                        <button key={p} type="button" className="vd-prompt" onClick={() => void copyPrompt(p)}>
                          <span>"{p}"</span>
                          <span className="vd-prompt-copy">Copy</span>
                        </button>
                      ))}
                    </div>
                    {copied ? <div className="vd-copied">Copied!</div> : null}
                  </>
                ) : null}

                {stage === 'completed' ? (
                  <>
                    <div className="vd-sms">
                      <div className="vd-sms-label">Demo SMS preview</div>
                      <div className="vd-sms-bubble">{config.smsPreview}</div>
                    </div>
                    <div className="vd-complete-cta">
                      <Link href="/user/signup" className="vd-btn-primary">Start Free 14-Day Trial →</Link>
                      <button type="button" className="vd-btn-ghost" onClick={resetDemo}>Try another scenario</button>
                    </div>
                  </>
                ) : null}

                {stage === 'failed' ? (
                  <div className="vd-complete-cta">
                    <button type="button" className="vd-btn-ghost" onClick={resetDemo}>← Try again</button>
                  </div>
                ) : null}

                {requestError ? <div className="vd-errors"><div className="vd-error">{requestError}</div></div> : null}
              </div>
            )}

            {/* Other verticals */}
            <div className="vd-others">
              {Object.values(DEMO_VERTICALS).filter((v) => v.slug !== vertical).map((v) => (
                <Link key={v.slug} href={`/demo/${v.slug}`} className="vd-other">
                  {v.icon} {v.businessType.replace(/-/g, ' ')}
                </Link>
              ))}
            </div>

            {/* Disclaimer */}
            <p className="vd-disclaimer">{config.demoVsReal}</p>
          </div>
        </div>
      </>
    </MarketingLayout>
  );
}
