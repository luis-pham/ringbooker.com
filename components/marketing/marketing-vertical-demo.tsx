'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICALS, type DemoServiceCategory, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { apiUserVisibleMessage } from '@/lib/api-user-message';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

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
  message?: string;
};
type DemoStatusResponse = {
  ok: boolean;
  stage?: 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
  call?: { startedAt?: string | null; endedAt?: string | null; outcome?: string | null } | null;
  error?: string;
  message?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
const sipPilotUi = process.env.NEXT_PUBLIC_OPENAI_SIP_DEMO_UI === 'true';
const sipPilotNumber = process.env.NEXT_PUBLIC_OPENAI_SIP_DEMO_NUMBER?.trim() ?? '';

const VERTICAL_DEMO_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Does this demo use my real business phone line?',
    a: 'No. The demo places a one-time outbound call to the number you enter so you can hear the experience. It does not change forwarding or settings on your live business line.',
  },
  {
    q: 'How long does a demo call take?',
    a: 'Most demos take about two to three minutes. You can try natural booking, reschedule, or pricing-style questions during the call.',
  },
  {
    q: 'Is the demo free?',
    a: 'Yes. Live web demos are free and intended to help you evaluate tone, pacing, and call handling before you start a trial.',
  },
  {
    q: 'What if the call does not connect?',
    a: 'Check your number format, try again, and confirm your phone can receive the outbound call. If it still fails, use the contact page and we can help troubleshoot.',
  },
  {
    q: 'Will RingBooker work with my current number later?',
    a: 'Yes. Production setup uses call forwarding on your existing business number. The demo is only a preview experience.',
  },
];

const verticalDemoFaqJsonLd = buildFaqPageJsonLd(VERTICAL_DEMO_FAQ_ITEMS);

const styles: string[] = [
  String.raw`
  /* ─── base ─────────────────────────────────────────────── */
  .vd-faq-outer{background:linear-gradient(180deg,#fafafa 0%,#fff 100%);border-top:1px solid #E5E7EB;padding:8px 0 28px}
  .vd-page{padding-top:80px;background:linear-gradient(160deg,color-mix(in srgb,var(--va) 7%,#fff) 0%,#fff 55%);min-height:100dvh}
  .vd-theme-nail-salon{--va:#7C3AED}
  .vd-theme-hair-salon{--va:#B45309}
  .vd-theme-day-spa{--va:#0D9488}
  .vd-theme-med-spa{--va:#4F46E5}
  .vd-theme-beauty-clinic{--va:#A21CAF}
  .vd-wrap{margin:0 auto;padding:18px 20px 56px;display:flex;flex-direction:column}

  /* page header (full-width, centered) */
  .vd-page-header{max-width:1120px;margin:0 auto;padding:24px 20px 8px;display:flex;flex-direction:column;align-items:center}
  .vd-breadcrumb{align-self:flex-start;font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8);margin-bottom:10px}
  .vd-breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}
  .vd-breadcrumb a:hover{color:var(--va)}
  .vd-breadcrumb > span{margin:0 6px}

  /* badge + heading */
  .vd-badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    border:1px solid color-mix(in srgb,var(--va) 30%,#E5E7EB);
    background:rgba(255,255,255,0.88);
    border-radius:999px;
    padding:7px 18px;
    font-size:var(--mk-eyebrow);
    font-weight:700;
    line-height:1.2;
    letter-spacing:var(--mk-eyebrow-ls);
    text-transform:uppercase;
    color:var(--va);
    margin:0 auto 22px;
    width:fit-content;
    backdrop-filter:blur(8px);
  }
  .vd-icon{width:22px;height:22px;border-radius:7px;background:var(--va);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0}

  @media(min-width:800px){
    .vd-page-header{padding:34px 40px 10px}
  }

  /* phone field — hero */
  .vd-phone-label{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#111827;margin-bottom:7px}
  .vd-phone-label .demo-cta-phone{flex-shrink:0}
  .vd-phone-input{width:100%;border:2px solid color-mix(in srgb,var(--va) 40%,#E5E7EB);border-radius:16px;padding:14px 16px;font-size:17px;font-weight:700;color:#111827;background:#fff;outline:none;transition:border-color .18s,box-shadow .18s;box-shadow:0 2px 8px color-mix(in srgb,var(--va) 10%,transparent);-webkit-appearance:none;margin-bottom:14px}
  .vd-phone-input:focus{border-color:var(--va);box-shadow:0 0 0 4px color-mix(in srgb,var(--va) 14%,transparent)}
  .vd-phone-input::placeholder{color:#C4C9D4}

  /* fields */
  .vd-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
  .vd-field-compact{margin:0}
  .vd-field label{font-size:13px;font-weight:700;color:#374151}
  .vd-field input,.vd-field textarea{width:100%;border:1px solid #E5E7EB;border-radius:13px;padding:11px 13px;font-size:14px;color:#111827;background:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none}
  .vd-field input:focus,.vd-field textarea:focus{border-color:var(--va)}
  .vd-field textarea{min-height:68px;resize:vertical}
  .vd-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}

  /* topic chips (pre-call info) */
  .vd-topics{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px}
  .vd-topic{border:1px solid color-mix(in srgb,var(--va) 20%,#E5E7EB);background:color-mix(in srgb,var(--va) 5%,#fff);border-radius:999px;padding:6px 11px;font-size:12px;font-weight:700;color:#4B5563}

  /* advanced toggle */
  .vd-adv-toggle{display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:#6B7280;padding:10px 0;margin-bottom:4px}
  .vd-adv-toggle:hover{color:var(--va)}
  .vd-adv-chevron{font-size:10px;transition:transform .2s;display:inline-block}
  .vd-adv-chevron.open{transform:rotate(180deg)}
  .vd-adv-body{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:12px;margin-bottom:14px}

  /* service editor */
  .vd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  .vd-tab{border:1px solid #E5E7EB;background:#fff;border-radius:999px;padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer}
  .vd-tab.on{background:var(--va);border-color:var(--va);color:#fff}
  .vd-svc-row{display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:center;border:1px solid #E5E7EB;border-radius:13px;padding:10px 12px;background:#fff}
  .vd-svc-row input[type=checkbox]{accent-color:var(--va);width:16px;height:16px}
  .vd-svc-name{font-size:13px;font-weight:700;color:#1F2937}
  .vd-svc-dur{font-size:11px;color:#9CA3AF;margin-top:1px}
  .vd-svc-price{width:72px;border:1px solid #E5E7EB;border-radius:9px;padding:7px 8px;text-align:right;font-size:13px;font-weight:700;-webkit-appearance:none}
  .vd-svc-label{font-size:12px;font-weight:800;color:#6B7280;margin-bottom:8px}
  .vd-svc-list{display:flex;flex-direction:column;gap:7px}

  /* live prompts */
  .vd-prompts-head{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF;margin:16px 0 10px}
  .vd-prompts{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
  .vd-prompt{display:flex;align-items:center;justify-content:space-between;border:1px solid color-mix(in srgb,var(--va) 22%,#E5E7EB);background:color-mix(in srgb,var(--va) 4%,#fff);border-radius:13px;padding:11px 13px;font-size:13px;font-weight:700;color:#243041;cursor:pointer;text-align:left;transition:.15s}
  .vd-prompt:hover{border-color:var(--va);background:#fff;box-shadow:0 4px 12px color-mix(in srgb,var(--va) 10%,transparent)}
  .vd-prompt-copy{font-size:10px;font-weight:900;color:#C4C9D4;text-transform:uppercase;flex-shrink:0;margin-left:8px}
  .vd-prompt:hover .vd-prompt-copy{color:var(--va)}
  .vd-prompt-more{background:none;border:none;cursor:pointer;font-size:12px;font-weight:800;color:var(--va);padding:2px 0;margin-bottom:10px}
  .vd-copied{font-size:12px;font-weight:800;color:var(--va);margin:0 0 8px}

  /* errors */
  .vd-errors{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
  .vd-error{font-size:13px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:9px 12px}

  /* CTA */
  .vd-cta{width:100%;border:none;border-radius:999px;background:var(--va);color:#fff;padding:16px;font-size:16px;font-weight:900;cursor:pointer;transition:.18s;box-shadow:0 8px 24px color-mix(in srgb,var(--va) 28%,transparent);-webkit-appearance:none}
  .vd-cta:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
  .vd-cta:disabled{opacity:.55;cursor:not-allowed}
  .vd-cta-note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:8px;line-height:1.5}
  .vd-sip-panel{margin-top:18px;padding:16px;border-radius:18px;border:1px dashed color-mix(in srgb,var(--va) 35%,#E5E7EB);background:color-mix(in srgb,var(--va) 4%,#fff)}
  .vd-sip-head{font-size:13px;font-weight:900;color:#111827;margin-bottom:6px}
  .vd-sip-copy{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--va);margin:6px 0 10px;word-break:break-all}
  .vd-sip-hint{font-size:12px;color:#6B7280;line-height:1.55;margin-bottom:12px}
  .vd-sip-secondary{width:100%;border-radius:999px;border:2px solid color-mix(in srgb,var(--va) 45%,#E5E7EB);background:#fff;color:var(--va);padding:14px;font-size:14px;font-weight:900;cursor:pointer;transition:.18s}
  .vd-sip-secondary:hover:not(:disabled){background:color-mix(in srgb,var(--va) 8%,#fff)}
  .vd-sip-secondary:disabled{opacity:.5;cursor:not-allowed}
  .vd-captcha{margin-bottom:14px}

  /* status */
  .vd-status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #E5E7EB;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#374151;background:#fff;margin-bottom:16px;width:fit-content}
  .vd-status-pill.live{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
  .vd-status-pill.failed{background:#FEF2F2;border-color:#FECACA;color:#B91C1C}
  .vd-status-pill.completed{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8}
  .vd-status-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
  .vd-status-dot.pulse{animation:vdPulse 1.2s ease-in-out infinite}
  @keyframes vdPulse{0%,100%{opacity:1}50%{opacity:.35}}
  .vd-status-h{font-size:22px;font-weight:900;letter-spacing:-.5px;color:#111827;margin:0 0 6px}
  .vd-status-body{font-size:14px;line-height:1.6;color:#6B7280;margin:0 0 18px}
  .vd-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:20px}
  .vd-step{border:1px solid #E5E7EB;border-radius:12px;padding:8px 6px;text-align:center;font-size:11px;font-weight:800;color:#9CA3AF}
  .vd-step.on{border-color:var(--va);background:color-mix(in srgb,var(--va) 10%,#fff);color:#111827}
  .vd-wave{height:30px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:14px}
  .vd-wave span{display:block;width:3px;border-radius:4px;background:var(--va);animation:vdWave 1.1s ease-in-out infinite}
  .vd-wave span:nth-child(1){height:8px}.vd-wave span:nth-child(2){height:20px;animation-delay:.08s}.vd-wave span:nth-child(3){height:28px;animation-delay:.16s}.vd-wave span:nth-child(4){height:16px;animation-delay:.24s}.vd-wave span:nth-child(5){height:24px;animation-delay:.32s}
  @keyframes vdWave{0%,100%{transform:scaleY(.4);opacity:.4}50%{transform:scaleY(1);opacity:1}}

  /* sms + completion */
  .vd-sms{border:1px solid #E5E7EB;border-radius:18px;background:#F8FAFC;padding:14px;margin-bottom:14px}
  .vd-sms-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px}
  .vd-sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:16px 16px 16px 5px;padding:12px 14px;color:#334155;font-size:13px;line-height:1.55}
  .vd-complete-cta{display:flex;flex-direction:column;gap:9px;margin-top:4px}
  .vd-btn-primary{display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;border:none;border-radius:999px;padding:14px 20px;font-size:15px;font-weight:900;cursor:pointer;text-decoration:none;transition:.18s}
  .vd-btn-primary:hover{background:#1F2937;transform:translateY(-1px)}
  .vd-btn-ghost{display:flex;align-items:center;justify-content:center;background:#fff;color:#374151;border:1px solid #E5E7EB;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:.18s}
  .vd-btn-ghost:hover{border-color:var(--va);color:var(--va)}

  /* footer links */
  .vd-others{display:flex;flex-wrap:wrap;gap:7px;padding-top:22px;border-top:1px solid #F1F5F9;margin-top:28px}
  .vd-other{border:1px solid #E5E7EB;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;color:#4B5563;background:#fff;text-decoration:none}
  .vd-other:hover{border-color:var(--va);color:var(--va)}
  .vd-disclaimer{font-size:12px;color:#9CA3AF;line-height:1.5;padding-top:16px;margin-top:16px;border-top:1px solid #F1F5F9}

  /* ─── right panel (desktop only) ──────────────────────── */
  .vd-right{display:none}

  /* phone card */
  .vd-phone{width:min(100%,286px);min-height:500px;margin:0 auto;background:linear-gradient(165deg,#1a0533 0%,#2d1b69 50%,#1a0d3a 100%);border:10px solid #0B0B10;border-radius:42px;padding:22px 18px;position:relative;overflow:hidden;color:#fff;box-shadow:0 34px 70px rgba(17,24,39,.25),0 0 0 1px rgba(255,255,255,.06) inset;display:flex;flex-direction:column}
  .vd-phone::before{content:'';position:absolute;inset:-70px -60px auto auto;width:200px;height:200px;border-radius:50%;background:color-mix(in srgb,var(--va) 35%,transparent)}
  .vd-phone-top{display:flex;justify-content:space-between;color:rgba(255,255,255,.5);font-size:12px;margin-bottom:34px;position:relative}
  .vd-phone-time{font-weight:700}
  .vd-phone-icons{font-size:9px}
  .vd-phone-avatar{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,var(--va),color-mix(in srgb,var(--va) 60%,#000));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;margin:0 auto 10px;box-shadow:0 0 0 8px rgba(255,255,255,.07),0 0 32px color-mix(in srgb,var(--va) 40%,transparent);position:relative}
  .vd-phone-name{text-align:center;position:relative;margin-bottom:4px;font-size:17px;font-weight:800}
  .vd-phone-subtitle{color:rgba(255,255,255,.5);font-size:11px;font-weight:700;letter-spacing:.06em;text-align:center;text-transform:uppercase;position:relative;margin-bottom:16px}
  .vd-phone-wave{height:26px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:16px}
  .vd-phone-wave span{display:block;width:3px;border-radius:3px;background:color-mix(in srgb,var(--va) 80%,#C4B5FD);animation:vdWave 1.1s ease-in-out infinite}
  .vd-phone-wave span:nth-child(1){height:7px}.vd-phone-wave span:nth-child(2){height:18px;animation-delay:.08s}.vd-phone-wave span:nth-child(3){height:24px;animation-delay:.16s}.vd-phone-wave span:nth-child(4){height:14px;animation-delay:.24s}.vd-phone-wave span:nth-child(5){height:20px;animation-delay:.32s}
  /* call state indicators */
  .vd-states{display:grid;grid-template-columns:1fr;gap:8px;margin-top:auto}
  .vd-state{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:12px;padding:10px 11px;display:flex;align-items:center;gap:7px}
  .vd-state-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25);flex-shrink:0}
  .vd-state-text{font-size:11.5px;font-weight:700;color:rgba(255,255,255,.45);line-height:1.2}
  .vd-state.ai-answer .vd-state-dot{background:var(--va);box-shadow:0 0 6px color-mix(in srgb,var(--va) 80%,transparent);animation:vdPulse 1.4s infinite}
  .vd-state.ai-answer .vd-state-text{color:#fff}
  .vd-state.ai-answer{border-color:color-mix(in srgb,var(--va) 50%,transparent);background:color-mix(in srgb,var(--va) 15%,transparent)}
  .vd-state-user-live{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.1)}
  .vd-state-user-live .vd-state-dot{background:#fff}
  .vd-state-user-live .vd-state-text{color:#fff}
  /* form card */
  .vd-form-card{border:1px solid #E5E7EB;border-radius:24px;background:#fff;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.04)}

  /* ─── desktop breakpoint ──────────────────────────────── */
  @media(min-width:800px){
    .vd-page{background:linear-gradient(145deg,color-mix(in srgb,var(--va) 6%,#fff) 0%,#fff 60%)}
    .vd-wrap{
      max-width:1100px;
      display:grid;
      grid-template-columns:1fr 320px;
      gap:52px;
      align-items:start;
      padding:8px 40px 72px;
    }
    .vd-right{display:flex;flex-direction:column;gap:0;position:sticky;top:96px;align-items:center}
  }
  @media(min-width:1200px){
    .vd-wrap{max-width:1120px;grid-template-columns:1fr 340px;gap:64px;padding:8px 48px 80px}
  }
  `,
];

function cloneServices(services: DemoServiceCategory[]): DemoServiceCategory[] {
  return services.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));
}
function normalizePhone(value: string): string {
  const t = value.trim();
  if (t.startsWith('+')) return t;
  const d = t.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return t;
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
  const [sipPrepMessage, setSipPrepMessage] = useState<string | null>(null);
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

  const visiblePrompts = showAllPrompts ? config.tryAsking : config.tryAsking.slice(0, 4);
  const hiddenCount = Math.max(0, config.tryAsking.length - 4);
  const isSubmitting = stage === 'queued' || stage === 'dialing' || stage === 'live';
  const isActive = stage !== 'idle';
  const activeStep = stage === 'idle' ? 0 : stage === 'queued' ? 1 : stage === 'dialing' ? 2 : stage === 'live' ? 3 : 4;

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
      if (!body.ok || !body.stage) {
        setRequestError(apiUserVisibleMessage(body, 'Unable to check demo status.'));
        return;
      }
      setStage(body.stage);
      if (body.stage === 'queued') setStatusText('Preparing your demo call — this takes a few seconds.');
      if (body.stage === 'dialing') setStatusText('Calling your number now. Pick up and try a prompt.');
      if (body.stage === 'live') setStatusText('You\'re connected — say anything naturally or use a prompt below.');
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

  async function saveSipPilotContext() {
    const errs = validate();
    setErrors(errs);
    setRequestError(null);
    setSipPrepMessage(null);
    if (errs.length > 0) return;
    setSipPrepMessage('Saving…');
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
      const res = await fetch('/api/backend/public/demo/sip-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!body.ok) {
        setSipPrepMessage(null);
        setRequestError(apiUserVisibleMessage(body, 'Unable to save call-in pilot context.'));
        return;
      }
      setSipPrepMessage(`Saved. Call ${sipPilotNumber} from the phone number you entered above so the pilot can match your context.`);
    } catch {
      setSipPrepMessage(null);
      setRequestError('Network error while saving call-in pilot context.');
    }
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
        resetTurnstile(); setStage('failed'); setRequestError(apiUserVisibleMessage(body, 'Unable to start demo call.'));
        return;
      }
      setStatusText('Request sent — calling your number now.');
      await pollStatus({ requestId: body.requestId, previewToken: body.previewToken });
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

  const verticalLabel = config.businessType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
      { '@type': 'ListItem', position: 2, name: 'Demo', item: 'https://ringbooker.com/demo' },
      { '@type': 'ListItem', position: 3, name: verticalLabel, item: `https://ringbooker.com/demo/${config.slug}` },
    ],
  };

  return (
    <MarketingLayout styles={styles} scriptPrefix={`vertical-demo-${config.slug}`}>
      <>
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={() => setTurnstileReady(true)} />
        ) : null}
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />

        <div className={`vd-page vd-theme-${config.slug}`}>

          {/* ══ PAGE HEADER (centered, full-width) ════════════════ */}
          <div className="vd-page-header">
            <nav className="vd-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>›</span>
              <Link href="/demo">Demo</Link>
              <span>›</span>
              <span>{verticalLabel}</span>
            </nav>
            <div className="vd-badge">{config.eyebrow}</div>
          </div>

          <div className="vd-wrap">

            {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
            <div>
              {/* ── FORM ── */}
              {!isActive ? (
                <div className="vd-form-card">
                  {/* Phone — primary hero field */}
                  <label className="vd-phone-label" htmlFor="vd-phone">
                    <DemoCtaPhoneIcon width={16} height={16} />
                    Your phone number — we call you
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

                  {/* Business name */}
                  <div className="vd-field">
                    <label htmlFor="vd-biz">Business name (for this demo)</label>
                    <input id="vd-biz" value={business.businessName} onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))} />
                  </div>

                  {/* Topic chips — what the demo covers */}
                  <div className="vd-topics">
                    <span className="vd-topic">📅 Booking</span>
                    <span className="vd-topic">💰 Pricing</span>
                    <span className="vd-topic">🔄 Reschedule</span>
                    {vertical === 'nail-salon' ? <span className="vd-topic">🇻🇳 Vietnamese</span> : null}
                    {vertical === 'med-spa' ? <span className="vd-topic">💉 Consultation</span> : null}
                    {vertical === 'day-spa' ? <span className="vd-topic">💑 Couples</span> : null}
                    {vertical === 'hair-salon' ? <span className="vd-topic">✂️ Stylist match</span> : null}
                    {vertical === 'beauty-clinic' ? <span className="vd-topic">✨ Provider continuity</span> : null}
                  </div>

                  {/* Advanced toggle */}
                  <button type="button" className="vd-adv-toggle" onClick={() => setShowAdvanced((v) => !v)}>
                    <span className={`vd-adv-chevron ${showAdvanced ? 'open' : ''}`}>▼</span>
                    Customize hours, staff &amp; services
                  </button>

                  {showAdvanced ? (
                    <div className="vd-adv-body">
                      <div className="vd-2col">
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-city">City / state</label>
                          <input id="vd-city" value={business.city} onChange={(e) => setBusiness((c) => ({ ...c, city: e.target.value }))} />
                        </div>
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-staff">{config.staffLabel}</label>
                          <input id="vd-staff" value={business.staff} placeholder={config.staffPlaceholder} onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))} />
                        </div>
                      </div>
                      <div className="vd-2col">
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-ph">Primary hours</label>
                          <input id="vd-ph" value={business.primaryHours} onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))} />
                        </div>
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-sh">Secondary hours</label>
                          <input id="vd-sh" value={business.secondaryHours} onChange={(e) => setBusiness((c) => ({ ...c, secondaryHours: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <div className="vd-svc-label">{config.serviceLabel}</div>
                        <div className="vd-tabs">
                          {business.services.map((cat) => (
                            <button key={cat.id} type="button" className={`vd-tab ${selectedCategory === cat.id ? 'on' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                              {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="vd-svc-list">
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
                      <div className="vd-field vd-field-compact">
                        <label htmlFor="vd-notes">Extra context</label>
                        <textarea id="vd-notes" value={business.notes} placeholder={config.safetyNote} onChange={(e) => setBusiness((c) => ({ ...c, notes: e.target.value }))} />
                      </div>
                    </div>
                  ) : null}

                  {/* Captcha */}
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
                  <p className="vd-cta-note">Outbound web demo only · Your real phone system is never changed</p>
                  {sipPilotUi && sipPilotNumber ? (
                    <div className="vd-sip-panel">
                      <div className="vd-sip-head">Pilot: inbound call</div>
                      <div className="vd-sip-copy">{sipPilotNumber}</div>
                      <p className="vd-sip-hint">
                        Optional second path for staging: save your salon context, then dial this number from the same mobile
                        number you entered above. Your pilot inbound line must reach RingBooker so we can load the context you saved here.
                      </p>
                      <button type="button" className="vd-sip-secondary" disabled={isSubmitting} onClick={() => void saveSipPilotContext()}>
                        Save context for call-in pilot
                      </button>
                      {sipPrepMessage ? <p className="vd-cta-note" style={{ marginTop: 10 }}>{sipPrepMessage}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                /* ── STATUS VIEW ── */
                <div>
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
                      <div className="vd-wave"><span /><span /><span /><span /><span /></div>
                      <div className="vd-prompts-head">Say one of these</div>
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
                          {showAllPrompts ? 'Show fewer' : `+${hiddenCount} more`}
                        </button>
                      ) : null}
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
                      {requestError ? <div className="vd-errors"><div className="vd-error">{requestError}</div></div> : null}
                      <button type="button" className="vd-btn-ghost" onClick={resetDemo}>← Try again</button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Other verticals + disclaimer */}
              <div className="vd-others">
                {Object.values(DEMO_VERTICALS).filter((v) => v.slug !== vertical).map((v) => (
                  <Link key={v.slug} href={`/demo/${v.slug}`} className="vd-other">
                    {v.businessType.replace(/-/g, ' ')}
                  </Link>
                ))}
              </div>
              <p className="vd-disclaimer">{config.demoVsReal}</p>
            </div>

            {/* ══ RIGHT COLUMN (desktop only) ══════════════════════ */}
            <div className="vd-right">
              {/* Phone preview card */}
              <div className="vd-phone">
                <div className="vd-phone-top">
                  <span className="vd-phone-time">9:41</span>
                  <span className="vd-phone-icons">● ▲ ■</span>
                </div>
                <div className="vd-phone-avatar" aria-hidden />
                <div className="vd-phone-name">{business.businessName || config.defaultBusinessName}</div>
                <div className="vd-phone-subtitle">{stage === 'live' ? 'Active Call' : stage === 'completed' ? 'Call Summary' : 'Demo Preview'}</div>
                <div className="vd-phone-wave"><span /><span /><span /><span /><span /></div>
                <div className="vd-states">
                  <div className={`vd-state ${stage === 'dialing' || (stage === 'live' && activeStep === 3) ? 'ai-answer' : ''}`}>
                    <span className="vd-state-dot" />
                    <span className="vd-state-text">AI Answering</span>
                  </div>
                  <div className={`vd-state ${stage === 'live' ? 'ai-answer vd-state-user-live' : ''}`}>
                    <span className="vd-state-dot" />
                    <span className="vd-state-text">User Speaking</span>
                  </div>
                  <div className="vd-state">
                    <span className="vd-state-dot" />
                    <span className="vd-state-text">AI Listening</span>
                  </div>
                  <div className="vd-state">
                    <span className="vd-state-dot" />
                    <span className="vd-state-text">AI Responding</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="vd-faq-outer">
          <MarketingFaqAccordion
            items={VERTICAL_DEMO_FAQ_ITEMS}
            eyebrow="Common Questions"
            title="About this live demo"
            subtitle={null}
            embedded
          />
        </div>

        <MarketingFooter />
        {verticalDemoFaqJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(verticalDemoFaqJsonLd) }}
          />
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      </>
    </MarketingLayout>
  );
}
