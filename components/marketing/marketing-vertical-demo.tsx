'use client';

import Link from 'next/link';
import Script from 'next/script';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICALS, type DemoServiceCategory, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

type DemoStage = 'idle' | 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
type DemoMode = 'quick' | 'advanced';

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
  call?: {
    startedAt?: string | null;
    endedAt?: string | null;
    outcome?: string | null;
    transcriptStatus?: string | null;
  } | null;
  error?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

const styles: string[] = [
  String.raw`
    :root{
      --purple:#8B5CF6;--purple-dark:#7C3AED;--purple-light:#EDE9FE;--text-dark:#111827;
      --text-gray:#6B7280;--text-light:#9CA3AF;--bg:#fff;--bg-gray:#F9FAFB;--border:#E5E7EB;
      --green:#10B981;--red:#EF4444;--blue:#3B82F6;--r-pill:999px;--r-lg:24px;--r-md:16px;
      --shadow:0 16px 48px rgba(17,24,39,.08);
    }
    *{box-sizing:border-box}
    .vertical-demo-page{padding-top:68px;background:linear-gradient(180deg,#F8F5FF 0%,#fff 34%,#fff 100%)}
    .vertical-demo-hero{padding:58px 20px 26px}
    .vertical-demo-hero-inner{max-width:1040px;margin:0 auto;display:grid;grid-template-columns:1.02fr .98fr;gap:24px;align-items:center}
    .demo-kicker{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:#fff;border:1px solid rgba(139,92,246,.24);color:#6D28D9;font-size:13px;font-weight:800}
    .demo-mark{width:22px;height:22px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:var(--vertical-accent)}
    .vertical-demo-hero h1{margin:16px 0 12px;font-size:clamp(34px,5vw,58px);line-height:1.04;letter-spacing:-1.8px}
    .vertical-demo-hero p{margin:0;color:var(--text-gray);font-size:16px;line-height:1.7;max-width:700px}
    .safety-strip{margin-top:18px;display:grid;gap:8px}
    .safety-pill{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border:1px solid #E9D5FF;background:rgba(255,255,255,.82);border-radius:16px;color:#4B5563;font-size:13px;line-height:1.5}
    .demo-phone-card{background:#111827;color:#fff;border-radius:32px;padding:24px;box-shadow:0 24px 70px rgba(17,24,39,.18);overflow:hidden;position:relative}
    .demo-phone-card::before{content:'';position:absolute;inset:-90px -80px auto auto;width:240px;height:240px;border-radius:50%;background:color-mix(in srgb,var(--vertical-accent) 45%,transparent)}
    .phone-topline{position:relative;display:flex;justify-content:space-between;color:rgba(255,255,255,.65);font-size:12px;margin-bottom:26px}
    .phone-avatar{position:relative;width:82px;height:82px;margin:0 auto 18px;border-radius:50%;background:linear-gradient(135deg,var(--vertical-accent),#8B5CF6);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px;box-shadow:0 0 0 9px rgba(255,255,255,.08)}
    .phone-title{text-align:center;position:relative}
    .phone-title strong{display:block;font-size:20px}
    .phone-title span{display:block;color:rgba(255,255,255,.68);font-size:14px;margin-top:4px}
    .demo-wave{height:34px;margin:22px 0 6px;display:flex;justify-content:center;align-items:center;gap:4px}
    .demo-wave span{display:block;width:4px;border-radius:5px;background:#C4B5FD;animation:demoWave 1.1s ease-in-out infinite}
    .demo-wave span:nth-child(1){height:10px}.demo-wave span:nth-child(2){height:24px;animation-delay:.08s}.demo-wave span:nth-child(3){height:32px;animation-delay:.16s}.demo-wave span:nth-child(4){height:18px;animation-delay:.24s}.demo-wave span:nth-child(5){height:28px;animation-delay:.32s}
    @keyframes demoWave{0%,100%{transform:scaleY(.5);opacity:.45}50%{transform:scaleY(1);opacity:1}}
    .phone-scenario{position:relative;margin-top:20px;padding:16px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}
    .phone-scenario h3{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6)}
    .phone-scenario p{margin:0;color:rgba(255,255,255,.84);font-size:14px;line-height:1.6}
    .vertical-demo-main{padding:10px 20px 88px}
    .vertical-demo-shell{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);gap:22px;align-items:start}
    .demo-panel{background:#fff;border:1px solid var(--border);border-radius:28px;box-shadow:var(--shadow);padding:24px}
    .mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
    .mode-button{border:1px solid var(--border);border-radius:20px;background:#fff;padding:16px;text-align:left;cursor:pointer;transition:.2s}
    .mode-button strong{display:block;font-size:16px;color:#111827}
    .mode-button span{display:block;margin-top:4px;color:#6B7280;font-size:13px;line-height:1.45}
    .mode-button.active{border-color:var(--vertical-accent);box-shadow:0 12px 28px color-mix(in srgb,var(--vertical-accent) 18%,transparent);background:linear-gradient(180deg,#fff,#FAFAFF)}
    .demo-section{padding:18px 0;border-top:1px solid #F1F5F9}
    .demo-section:first-of-type{border-top:0;padding-top:0}
    .section-label{margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--vertical-accent)}
    .section-title{margin:0 0 6px;font-size:22px;line-height:1.18;letter-spacing:-.4px}
    .section-copy{margin:0 0 16px;color:var(--text-gray);font-size:14px;line-height:1.65}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .field{display:flex;flex-direction:column;gap:8px}
    .field.full{grid-column:1/-1}
    .field label{font-size:14px;font-weight:800;color:#111827}
    .field input,.field textarea{width:100%;border:1px solid var(--border);border-radius:15px;padding:13px 14px;background:#fff;color:#111827}
    .field textarea{min-height:84px;resize:vertical}
    .helper{font-size:12px;color:#9CA3AF;line-height:1.45}
    .advanced-block{display:grid;gap:14px}
    .service-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .service-tab{border:1px solid var(--border);background:#fff;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:800;cursor:pointer}
    .service-tab.active{background:var(--vertical-accent);border-color:var(--vertical-accent);color:#fff}
    .service-list{display:grid;gap:9px}
    .service-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid #E5E7EB;border-radius:16px;padding:12px}
    .service-row input[type='checkbox']{width:18px;height:18px;accent-color:var(--vertical-accent)}
    .service-name{font-weight:800;font-size:14px;color:#1F2937}
    .service-name span{display:block;margin-top:2px;color:#9CA3AF;font-weight:700;font-size:12px}
    .service-price{width:92px;border:1px solid var(--border);border-radius:12px;padding:9px;text-align:right;font-weight:800}
    .demo-callout{border:1px solid color-mix(in srgb,var(--vertical-accent) 28%,#E5E7EB);background:linear-gradient(180deg,#fff, color-mix(in srgb,var(--vertical-accent) 6%,#fff));border-radius:24px;padding:16px;box-shadow:0 14px 34px color-mix(in srgb,var(--vertical-accent) 10%,transparent)}
    .demo-only-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid color-mix(in srgb,var(--vertical-accent) 34%,#E5E7EB);background:#fff;border-radius:999px;padding:6px 10px;color:var(--vertical-accent);font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
    .demo-only-pill::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--vertical-accent)}
    .callout-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:8px}
    .callout-title-row h2{margin:0;font-size:21px;line-height:1.18;letter-spacing:-.45px}
    .natural-signal{display:inline-flex;align-items:center;white-space:nowrap;border-radius:999px;background:#111827;color:#fff;padding:7px 10px;font-size:11px;font-weight:900}
    .callout-helper{margin:0 0 14px;color:#5B6472;font-size:14px;line-height:1.6}
    .try-grid{display:grid;grid-template-columns:1fr;gap:9px}
    .try-chip{position:relative;border:1px solid color-mix(in srgb,var(--vertical-accent) 26%,#E5E7EB);background:rgba(255,255,255,.86);border-radius:16px;padding:12px 42px 12px 13px;text-align:left;font-size:13px;font-weight:850;color:#243041;cursor:pointer;transition:.2s;box-shadow:0 1px 0 rgba(255,255,255,.9) inset}
    .try-chip::after{content:'Copy';position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:900;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em}
    .try-chip:hover{transform:translateY(-1px);border-color:var(--vertical-accent);color:#111827;background:#fff;box-shadow:0 10px 22px color-mix(in srgb,var(--vertical-accent) 10%,transparent)}
    .prompt-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap}
    .more-prompts{border:0;background:transparent;color:var(--vertical-accent);font-size:13px;font-weight:900;cursor:pointer;padding:4px 0}
    .copy-note{font-size:12px;color:#7C8493;font-weight:750}
    .copied{font-size:12px;color:#6D28D9;font-weight:900;margin-top:8px}
    .cta-stack{display:grid;gap:10px}
    .btn-dark,.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:14px 20px;border-radius:999px;font-size:15px;font-weight:900;border:0;cursor:pointer;text-decoration:none;transition:.2s}
    .btn-dark{background:#111827;color:#fff}.btn-dark:hover:not(:disabled){background:#1F2937;transform:translateY(-1px)}.btn-dark:disabled{opacity:.55;cursor:not-allowed}
    .btn-outline{background:#fff;color:#111827;border:1px solid var(--border)}.btn-outline:hover{border-color:var(--vertical-accent);color:var(--vertical-accent)}
    .error-list{display:grid;gap:8px;margin-top:12px}.error{font-size:13px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:9px 11px}
    .status-card{position:sticky;top:88px}
    .status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #E5E7EB;background:#fff;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:900;color:#374151}
    .status-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    .status-pill.live{background:#ECFDF5;border-color:#A7F3D0;color:#047857}.status-pill.failed{background:#FEF2F2;border-color:#FECACA;color:#B91C1C}.status-pill.completed{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8}
    .status-title{margin:16px 0 8px;font-size:25px;letter-spacing:-.6px}
    .status-copy{margin:0;color:#6B7280;line-height:1.65;font-size:14px}
    .status-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}
    .status-step{border:1px solid #E5E7EB;border-radius:16px;padding:10px 8px;text-align:center;color:#9CA3AF;font-size:11px;font-weight:900}
    .status-step.active{border-color:var(--vertical-accent);background:color-mix(in srgb,var(--vertical-accent) 10%,#fff);color:#111827}
    .sms-preview{margin-top:16px;border:1px solid #E5E7EB;border-radius:22px;background:#F8FAFC;padding:16px}
    .sms-preview h3{margin:0 0 9px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748B}
    .sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:18px 18px 18px 6px;padding:13px 14px;color:#334155;font-size:14px;line-height:1.55}
    .clarity-box{margin-top:16px;padding:14px;border-radius:20px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-size:13px;line-height:1.55}
    .vertical-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
    .vertical-link{border:1px solid #E5E7EB;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;color:#4B5563;background:#fff}
    @media (max-width:960px){.vertical-demo-hero-inner,.vertical-demo-shell{grid-template-columns:1fr}.status-card{position:static}.vertical-demo-hero{padding-top:42px}.demo-phone-card{order:-1}}
    @media (max-width:640px){.vertical-demo-hero,.vertical-demo-main{padding-left:16px;padding-right:16px}.demo-panel{padding:18px;border-radius:24px}.mode-switch,.form-grid{grid-template-columns:1fr}.service-row{grid-template-columns:auto 1fr}.service-price{grid-column:1/-1;justify-self:end}.status-steps{grid-template-columns:repeat(2,1fr)}.btn-dark,.btn-outline{width:100%}.callout-title-row{display:block}.natural-signal{margin-top:10px}.try-chip{padding-right:13px}.try-chip::after{display:none}.prompt-actions{display:block}.copy-note{display:block;margin-top:8px}}
  `,
];

function cloneServices(services: DemoServiceCategory[]): DemoServiceCategory[] {
  return services.map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item })),
  }));
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
  return trimmed;
}

function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'demo_session_server';
  const key = 'rb_demo_session_id';
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const next = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function splitStaff(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}



function stageLabel(stage: DemoStage): string {
  if (stage === 'queued') return 'Preparing demo';
  if (stage === 'dialing') return 'Calling now';
  if (stage === 'live') return 'Connected';
  if (stage === 'completed') return 'Demo complete';
  if (stage === 'failed') return 'Try again';
  return 'Ready';
}

export function MarketingVerticalDemoTemplate({ vertical }: { vertical: DemoVerticalSlug }) {
  const config = DEMO_VERTICALS[vertical];
  const [mode, setMode] = useState<DemoMode>('quick');
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
  const [selectedCategory, setSelectedCategory] = useState(config.serviceCategories[0]?.id ?? 'default');
  const [stage, setStage] = useState<DemoStage>('idle');
  const [statusText, setStatusText] = useState('Ready to place a safe outbound demo call.');
  const [errors, setErrors] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ requestId: string; previewToken: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileSiteKey);
  const pollTimerRef = useRef<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileRenderedRef = useRef(false);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const activeCategory = useMemo(
    () => business.services.find((category) => category.id === selectedCategory) ?? business.services[0],
    [business.services, selectedCategory],
  );
  const visiblePrompts = showAllPrompts ? config.tryAsking : config.tryAsking.slice(0, 3);
  const hiddenPromptCount = Math.max(0, config.tryAsking.length - visiblePrompts.length);
  const isSubmitting = stage === 'queued' || stage === 'dialing' || stage === 'live';

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey || turnstileReady) return;
    const timer = window.setInterval(() => {
      if ((window as Window & { turnstile?: unknown }).turnstile) setTurnstileReady(true);
    }, 300);
    return () => window.clearInterval(timer);
  }, [turnstileReady]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || turnstileRenderedRef.current || !turnstileRef.current) return;
    const maybeTurnstile = (
      window as Window & {
        turnstile?: {
          render: (el: HTMLElement, options: Record<string, unknown>) => string;
          reset: (widgetId: string) => void;
        };
      }
    ).turnstile;
    if (!maybeTurnstile) return;
    turnstileWidgetIdRef.current = maybeTurnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      callback: (token: string) => setCaptchaToken(token),
      'error-callback': () => setCaptchaToken(null),
      'expired-callback': () => setCaptchaToken(null),
    });
    turnstileRenderedRef.current = true;
  }, [turnstileReady]);

  function updateService(categoryId: string, index: number, patch: Partial<DemoServiceCategory['items'][number]>) {
    setBusiness((current) => ({
      ...current,
      services: current.services.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
            }
          : category,
      ),
    }));
  }

  function validate(): string[] {
    const next: string[] = [];
    if (!business.businessName.trim()) next.push('Business name is required.');
    if (business.phoneNumber.trim().length < 7) next.push('Phone number for the demo callback is required.');
    if (turnstileSiteKey && !captchaToken) next.push('Please complete captcha verification.');
    return next;
  }

  async function pollStatus(nextPreview: { requestId: string; previewToken: string }) {
    try {
      const response = await fetch(
        `/api/backend/public/demo/status/${encodeURIComponent(nextPreview.requestId)}?token=${encodeURIComponent(nextPreview.previewToken)}`,
      );
      const body = (await response.json()) as DemoStatusResponse;
      if (!body.ok || !body.stage) {
        setRequestError(body.error ?? 'Unable to refresh demo status.');
        return;
      }
      setStage(body.stage);
      if (body.stage === 'queued') setStatusText('Preparing your outbound demo call.');
      if (body.stage === 'dialing') setStatusText('Calling the number you entered now.');
      if (body.stage === 'live') setStatusText('Connected. Try one of the demo prompts while you are on the call.');
      if (body.stage === 'completed') {
        setStatusText('Demo complete. Here is the SMS behavior RingBooker would show.');
        return;
      }
      if (body.stage === 'failed') {
        setStatusText('The call did not complete. Check the number and try again.');
        return;
      }
      pollTimerRef.current = window.setTimeout(() => void pollStatus(nextPreview), 2200);
    } catch {
      setRequestError('Network error while tracking demo status.');
    }
  }

  function resetTurnstile() {
    if (!turnstileSiteKey || !turnstileWidgetIdRef.current) return;
    (
      window as Window & {
        turnstile?: { reset: (widgetId: string) => void };
      }
    ).turnstile?.reset(turnstileWidgetIdRef.current);
    setCaptchaToken(null);
  }

  async function startDemo() {
    const nextErrors = validate();
    setErrors(nextErrors);
    setRequestError(null);
    if (nextErrors.length > 0) return;

    setStage('queued');
    setStatusText('Submitting your isolated demo request.');

    const normalizedPhone = normalizePhone(business.phoneNumber);
    const payload = {
      shopName: business.businessName,
      phoneNumber: normalizedPhone,
      businessType: config.businessType,
      // notes is for user-supplied context only — no prompt injection possible here since
      // the server sanitizes it and wraps in a fixed template before prompt insertion.
      notes: business.notes || undefined,
      captchaToken: turnstileSiteKey ? captchaToken : 'dev-turnstile-bypass',
      sessionId: ensureSessionId(),
      website: '',
      // Structured config — server builds the system prompt from this, never from raw client text.
      demoConfig: {
        city: business.city || config.defaultCity,
        primaryHours: business.primaryHours,
        secondaryHours: business.secondaryHours,
        staffNames: splitStaff(business.staff),
        services: business.services.flatMap((category) =>
          category.items.map((item) => ({
            category: category.label,
            name: item.name,
            price: item.price,
            duration: item.duration,
            enabled: item.enabled,
          })),
        ),
      },
      demoVertical: config.slug,
      demoMode: mode,
      demoSource: 'vertical_demo_page',
    };

    try {
      const response = await fetch('/api/backend/public/demo/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as DemoApiResponse;
      if (!body.ok || !body.requestId || !body.previewToken) {
        resetTurnstile();
        setStage('failed');
        setRequestError(body.error ?? 'Unable to start demo call.');
        return;
      }
      const nextPreview = { requestId: body.requestId, previewToken: body.previewToken };
      setPreview(nextPreview);
      setStatusText('Live demo requested. We are calling your number now.');
      await pollStatus(nextPreview);
    } catch {
      resetTurnstile();
      setStage('failed');
      setRequestError('Network error while requesting live demo call.');
    }
  }

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(prompt);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  function resetDemo() {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    setPreview(null);
    setStage('idle');
    setRequestError(null);
    setStatusText('Ready to place a safe outbound demo call.');
  }

  const activeStep = stage === 'idle' ? 0 : stage === 'queued' ? 1 : stage === 'dialing' ? 2 : stage === 'live' ? 3 : 4;

  return (
    <MarketingLayout styles={styles} scriptPrefix={`vertical-demo-${config.slug}`}>
      <>
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={() => setTurnstileReady(true)} />
        ) : null}
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />

        <main className="vertical-demo-page" style={{ '--vertical-accent': config.accent } as CSSProperties}>
          <section className="vertical-demo-hero">
            <div className="vertical-demo-hero-inner">
              <div>
                <div className="demo-kicker">
                  <span className="demo-mark">{config.icon}</span>
                  {config.eyebrow}
                </div>
                <h1>{config.title}</h1>
                <p>{config.subtitle}</p>
                <div className="safety-strip">
                  <div className="safety-pill">Demo only: outbound web call to the number you enter.</div>
                  <div className="safety-pill">No changes to your current phone system, routing, calendar, or customer data.</div>
                </div>
              </div>
              <div className="demo-phone-card">
                <div className="phone-topline">
                  <span>Live demo</span>
                  <span>2-3 min</span>
                </div>
                <div className="phone-avatar">{config.icon}</div>
                <div className="phone-title">
                  <strong>{business.businessName || config.defaultBusinessName}</strong>
                  <span>{config.quickScenario}</span>
                </div>
                <div className="demo-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="phone-scenario">
                  <h3>Demo script shape</h3>
                  <p>Greeting, booking scenario, pricing or reschedule question, then a demo SMS confirmation wrap-up.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="vertical-demo-main">
            <div className="vertical-demo-shell">
              <div className="demo-panel">
                <div className="mode-switch" role="tablist" aria-label="Demo mode">
                  <button type="button" className={`mode-button ${mode === 'quick' ? 'active' : ''}`} onClick={() => setMode('quick')}>
                    <strong>Quick Demo</strong>
                    <span>Prefilled setup. Add your phone number and hear the wow fast.</span>
                  </button>
                  <button type="button" className={`mode-button ${mode === 'advanced' ? 'active' : ''}`} onClick={() => setMode('advanced')}>
                    <strong>Advanced Demo</strong>
                    <span>Customize team, hours, services, and vertical-specific context.</span>
                  </button>
                </div>

                <div className="demo-section">
                  <p className="section-label">Demo setup</p>
                  <h2 className="section-title">{mode === 'quick' ? 'Just confirm where we should call.' : 'Make the demo feel like your business.'}</h2>
                  <p className="section-copy">{config.safetyNote}</p>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="demoBusinessName">Business name</label>
                      <input id="demoBusinessName" value={business.businessName} onChange={(e) => setBusiness((current) => ({ ...current, businessName: e.target.value }))} />
                      <p className="helper">Used only inside this demo call persona.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="demoPhone">Phone number for callback</label>
                      <input id="demoPhone" inputMode="tel" placeholder="+1 (714) 555-0199" value={business.phoneNumber} onChange={(e) => setBusiness((current) => ({ ...current, phoneNumber: e.target.value }))} />
                      <p className="helper">We call this number for the outbound web demo.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="demoCity">City / state</label>
                      <input id="demoCity" value={business.city} onChange={(e) => setBusiness((current) => ({ ...current, city: e.target.value }))} />
                      <p className="helper">Helps the AI sound local and specific.</p>
                    </div>
                  </div>
                </div>

                {mode === 'advanced' ? (
                  <div className="demo-section advanced-block">
                    <div>
                      <p className="section-label">Advanced context</p>
                      <h2 className="section-title">Tune hours, team, and services.</h2>
                      <p className="section-copy">These fields change the demo script only. They do not touch production scheduling or inbound routing.</p>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="demoPrimaryHours">Primary hours</label>
                        <input id="demoPrimaryHours" value={business.primaryHours} onChange={(e) => setBusiness((current) => ({ ...current, primaryHours: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label htmlFor="demoSecondaryHours">Secondary hours</label>
                        <input id="demoSecondaryHours" value={business.secondaryHours} onChange={(e) => setBusiness((current) => ({ ...current, secondaryHours: e.target.value }))} />
                      </div>
                      <div className="field full">
                        <label htmlFor="demoStaff">{config.staffLabel}</label>
                        <input id="demoStaff" value={business.staff} onChange={(e) => setBusiness((current) => ({ ...current, staff: e.target.value }))} placeholder={config.staffPlaceholder} />
                        <p className="helper">Comma-separated names. Used for provider/stylist/technician preference handling.</p>
                      </div>
                      <div className="field full">
                        <label htmlFor="demoNotes">Extra demo notes</label>
                        <textarea id="demoNotes" value={business.notes} onChange={(e) => setBusiness((current) => ({ ...current, notes: e.target.value }))} placeholder="Example: Saturday is busy, consults are required for injectables, or Vietnamese callers are common." />
                      </div>
                    </div>
                    <div>
                      <h3 className="section-title">{config.serviceLabel}</h3>
                      <div className="service-tabs">
                        {business.services.map((category) => (
                          <button key={category.id} type="button" className={`service-tab ${selectedCategory === category.id ? 'active' : ''}`} onClick={() => setSelectedCategory(category.id)}>
                            {category.label}
                          </button>
                        ))}
                      </div>
                      <div className="service-list">
                        {activeCategory?.items.map((item, index) => (
                          <div className="service-row" key={`${activeCategory.id}-${item.name}`}>
                            <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, index, { enabled: e.target.checked })} />
                            <div className="service-name">
                              {item.name}
                              {item.duration ? <span>{item.duration}</span> : null}
                            </div>
                            <input className="service-price" type="number" inputMode="numeric" min={0} value={item.price} onChange={(e) => updateService(activeCategory.id, index, { price: Number(e.target.value) || 0 })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="demo-section">
                  <div className="demo-callout" aria-label="Demo-only starter prompts">
                    <div className="demo-only-pill">Demo-only prompts</div>
                    <div className="callout-title-row">
                      <h2>Try one of these to get started</h2>
                      <span className="natural-signal">Or just speak naturally</span>
                    </div>
                    <p className="callout-helper">
                      These are just example scenarios to help you get a fast, successful demo. You are not limited to these prompts.
                    </p>
                    <div className="try-grid">
                      {visiblePrompts.map((prompt) => (
                        <button key={prompt} type="button" className="try-chip" onClick={() => void copyPrompt(prompt)}>
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="prompt-actions">
                      {hiddenPromptCount > 0 || showAllPrompts ? (
                        <button
                          type="button"
                          className="more-prompts"
                          aria-expanded={showAllPrompts}
                          onClick={() => setShowAllPrompts((current) => !current)}
                        >
                          {showAllPrompts ? 'Show fewer ideas' : `More ideas (${hiddenPromptCount})`}
                        </button>
                      ) : (
                        <span />
                      )}
                      <span className="copy-note">Tap a prompt to copy it, or say it in your own words.</span>
                    </div>
                    {copied ? <div className="copied">Copied: {copied}</div> : null}
                  </div>
                </div>

                {turnstileSiteKey ? (
                  <div className="demo-section">
                    <p className="section-label">Verification</p>
                    <div ref={turnstileRef} />
                  </div>
                ) : null}

                {errors.length > 0 ? (
                  <div className="error-list">
                    {errors.map((error) => (
                      <div key={error} className="error">
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}
                {requestError ? (
                  <div className="error-list">
                    <div className="error">{requestError}</div>
                  </div>
                ) : null}

                <div className="demo-section cta-stack">
                  <button type="button" className="btn-dark" onClick={() => void startDemo()} disabled={isSubmitting}>
                    {isSubmitting ? 'Starting demo call...' : 'Start outbound demo call'}
                  </button>
                  <p className="section-copy">What happens next: RingBooker calls the number above, you answer, then test the prompts naturally.</p>
                </div>
              </div>

              <aside className="demo-panel status-card">
                <div className={`status-pill ${stage === 'live' ? 'live' : stage === 'failed' ? 'failed' : stage === 'completed' ? 'completed' : ''}`}>
                  <span className="status-dot" />
                  {stageLabel(stage)}
                </div>
                <h2 className="status-title">Live demo status</h2>
                <p className="status-copy">{statusText}</p>
                <div className="status-steps" aria-label="Demo status steps">
                  {['Ready', 'Calling', 'Connected', 'Complete'].map((label, index) => (
                    <div key={label} className={`status-step ${activeStep >= index ? 'active' : ''}`}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="sms-preview">
                  <h3>Demo SMS preview</h3>
                  <div className="sms-bubble">{config.smsPreview}</div>
                </div>
                <div className="clarity-box">{config.demoVsReal}</div>
                {preview ? (
                  <div className="clarity-box">
                    Demo request ID: {preview.requestId}
                    {stage === 'failed' || stage === 'completed' ? (
                      <>
                        <br />
                        <button type="button" className="btn-outline" onClick={resetDemo}>
                          Try another scenario
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <div className="vertical-links">
                  {Object.values(DEMO_VERTICALS).map((item) => (
                    <Link key={item.slug} className="vertical-link" href={`/demo/${item.slug}`}>
                      {item.icon} {item.businessType}
                    </Link>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
