'use client';

import Link from 'next/link';
import Script from 'next/script';
import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICALS, type DemoServiceCategory, type DemoVerticalConfig, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { apiUserVisibleMessage } from '@/lib/api-user-message';
import { DIRECT_REALTIME_DEMO_DURATION_MESSAGE, userMessageForDirectDemoRealtimeJson } from '@/lib/marketing-vertical-demo-errors';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

type DemoStage = 'idle' | 'queued' | 'dialing' | 'live' | 'completed' | 'failed';

type DemoBusinessConfig = {
  businessName: string;
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
  liveKitUrl?: string;
  liveKitToken?: string;
  error?: string;
  message?: string;
};
type DirectRealtimeApiResponse = {
  ok: boolean;
  requestId?: string;
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  error?: string;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
};
type DemoStatusResponse = {
  ok: boolean;
  stage?: 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
  call?: { startedAt?: string | null; endedAt?: string | null; outcome?: string | null } | null;
  error?: string;
  message?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

/** Legacy shared demo line when per-vertical `DEMO_PHONE_*` env is unset (server passes prop from env). */
const LEGACY_VERTICAL_DEMO_PHONE_E164 = '+16265013960';

function normalizeDemoPhoneE164(raw?: string | null): string {
  const t = raw?.trim();
  if (!t) return LEGACY_VERTICAL_DEMO_PHONE_E164;
  const compact = t.replace(/[^\d+]/g, '');
  if (compact.startsWith('+') && compact.length >= 8) return compact;
  const d = t.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return LEGACY_VERTICAL_DEMO_PHONE_E164;
}

function formatE164ForDisplay(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    const n = d.slice(1);
    return `+1 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (d.length === 10) {
    return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return e164;
}

const DEMO_STATUS_POLL_INTERVAL_MS = 2200;
const DEMO_STATUS_MAX_POLL_ATTEMPTS = 30;
const DEMO_STATUS_TIMEOUT_MESSAGE = 'The web demo is taking longer than expected. Please try again, or call the demo number instead.';
const LIVEKIT_CONNECT_ERROR_MESSAGE = 'Unable to connect to the voice room. Please check your network and try again, or call the demo number instead.';
const DIRECT_OPENAI_CONNECT_TIMEOUT_MS = 45_000;
const DIRECT_OPENAI_MAX_SESSION_MS = 5 * 60 * 1000;
const OPENAI_REALTIME_WEBRTC_URL = 'https://api.openai.com/v1/realtime/calls';
const demoWebCallMode = process.env.NEXT_PUBLIC_DEMO_WEB_CALL_MODE === 'direct_openai' ? 'direct_openai' : 'livekit';

const VERTICAL_DEMO_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Does this demo use my real business phone line?',
    a: 'No. The browser demo runs in this page with your microphone — it does not change forwarding or settings on your live business line. If you call the optional demo phone number, that uses a fixed sample profile for this vertical.',
  },
  {
    q: 'How long does a demo take?',
    a: 'Most demos take about two to three minutes. You can try natural booking, reschedule, or pricing-style questions during the session.',
  },
  {
    q: 'Is the demo free?',
    a: 'Yes. Live web demos are free and intended to help you evaluate tone, pacing, and call handling before you start a trial.',
  },
  {
    q: 'What if the browser demo does not connect?',
    a: 'Allow microphone access, check your network, and try again. You can also call the demo line listed on this page. If it still fails, use the contact page and we can help troubleshoot.',
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
  .vd-faq-outer{max-width:1120px;margin:0 auto;padding:8px 20px 48px;background:transparent;border-top:none}
  @media(min-width:800px){.vd-faq-outer{padding:12px 40px 64px}}
  .vd-page{padding-top:80px;background:linear-gradient(160deg,color-mix(in srgb,var(--va) 7%,#fff) 0%,#fff 55%);min-height:100dvh}
  .vd-theme-nail-salon{--va:#7C3AED}
  .vd-theme-hair-salon{--va:#B45309}
  .vd-theme-day-spa{--va:#0D9488}
  .vd-theme-med-spa{--va:#4F46E5}
  .vd-theme-beauty-clinic{--va:#A21CAF}
  .vd-wrap{margin:0 auto;padding:18px 20px 56px;display:flex;flex-direction:column}

  /* page header (full-width, centered) */
  .vd-page-header{max-width:1120px;margin:0 auto;padding:24px 20px 18px;display:flex;flex-direction:column;align-items:center}
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
  .vd-hero-h1{
    margin:0 auto 12px;
    max-width:min(920px,100%);
    font-size:clamp(26px,3.6vw,40px);
    font-weight:900;
    letter-spacing:-.03em;
    line-height:1.1;
    text-align:center;
    color:#111827;
    text-wrap:balance;
  }
  .vd-hero-sub{
    margin:0 auto 0;
    max-width:min(560px,100%);
    font-size:16px;
    line-height:1.62;
    text-align:center;
    color:#64748B;
    font-weight:500;
  }
  @media(min-width:800px){
    .vd-hero-h1{margin-bottom:14px}
    .vd-hero-sub{font-size:17px;max-width:min(600px,100%);line-height:1.65}
    .vd-page-header{padding:34px 40px 26px}
  }

  /* fields */
  .vd-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
  .vd-field-compact{margin:0}
  .vd-field label{font-size:13px;font-weight:700;color:#374151}
  .vd-field input,.vd-field textarea{width:100%;border:1px solid #E5E7EB;border-radius:13px;padding:11px 13px;font-size:14px;color:#111827;background:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none}
  .vd-field input:focus,.vd-field textarea:focus{border-color:var(--va)}
  .vd-field textarea{min-height:68px;resize:vertical}
  .vd-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}

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
  .vd-cta{width:100%;border:none;border-radius:999px;background:var(--va);color:#fff;padding:16px;font-size:16px;font-weight:900;cursor:pointer;transition:.18s;box-shadow:0 10px 28px color-mix(in srgb,var(--va) 32%,transparent);-webkit-appearance:none}
  .vd-cta:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 12px 32px color-mix(in srgb,var(--va) 38%,transparent)}
  .vd-cta:disabled{opacity:.55;cursor:not-allowed}
  .vd-cta-note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:8px;line-height:1.5}
  .vd-phone-demo-secondary{margin-top:22px;padding:16px;border-radius:18px;border:1px solid #E5E7EB;background:#F9FAFB}
  .vd-phone-demo-title{font-size:13px;font-weight:900;color:#111827;margin-bottom:6px}
  .vd-phone-demo-text{font-size:13px;color:#64748B;line-height:1.55;margin:0 0 10px}
  .vd-phone-demo-num-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}
  .vd-phone-demo-num{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--va)}
  .vd-phone-demo-copy{border:1px solid #E5E7EB;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;color:#374151;cursor:pointer}
  .vd-phone-demo-copy:hover{border-color:var(--va);color:var(--va)}
  .vd-phone-demo-tel{display:none}
  .vd-phone-demo-note{font-size:11px;color:#9CA3AF;line-height:1.45;margin:10px 0 0}
  @media(max-width:799px){
    .vd-badge{display:none}
    .vd-phone-demo-tel{display:inline-flex;align-items:center;justify-content:center;width:100%;border-radius:999px;border:2px solid color-mix(in srgb,var(--va) 45%,#E5E7EB);background:#fff;color:var(--va);padding:12px;font-size:14px;font-weight:900;text-decoration:none;margin-top:4px}
  }
  .vd-sip-panel{margin-top:18px;padding:16px;border-radius:18px;border:1px dashed color-mix(in srgb,var(--va) 35%,#E5E7EB);background:color-mix(in srgb,var(--va) 4%,#fff)}
  .vd-sip-head{font-size:13px;font-weight:900;color:#111827;margin-bottom:6px}
  .vd-sip-copy{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--va);margin:6px 0 10px;word-break:break-all}
  .vd-sip-hint{font-size:12px;color:#6B7280;line-height:1.55;margin-bottom:12px}
  .vd-sip-secondary{width:100%;border-radius:999px;border:2px solid color-mix(in srgb,var(--va) 45%,#E5E7EB);background:#fff;color:var(--va);padding:14px;font-size:14px;font-weight:900;cursor:pointer;transition:.18s}
  .vd-sip-secondary:hover:not(:disabled){background:color-mix(in srgb,var(--va) 8%,#fff)}
  .vd-sip-secondary:disabled{opacity:.5;cursor:not-allowed}
  .vd-captcha{margin-bottom:14px;min-height:70px;min-width:240px;border:1px dashed #E5E7EB;border-radius:14px;padding:10px;background:#FAFAFA;display:flex;align-items:center;justify-content:center}
  .vd-captcha-inner{min-height:65px;width:100%;max-width:340px;display:flex;align-items:center;justify-content:center}
  .vd-captcha-label{font-size:13px;font-weight:700;color:#374151;margin-bottom:8px}
  .vd-captcha-hint{font-size:12px;color:#9CA3AF;margin-top:8px;line-height:1.45}

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
  .vd-wave{height:30px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:14px}
  .vd-wave span{display:block;width:3px;border-radius:4px;background:#10B981;animation:vdWave 1.65s ease-in-out infinite}
  .vd-wave span:nth-child(1){height:8px}.vd-wave span:nth-child(2){height:20px;animation-delay:.12s}.vd-wave span:nth-child(3){height:28px;animation-delay:.24s}.vd-wave span:nth-child(4){height:16px;animation-delay:.36s}.vd-wave span:nth-child(5){height:24px;animation-delay:.48s}
  @keyframes vdWave{0%,100%{transform:scaleY(.4);opacity:.45}50%{transform:scaleY(1);opacity:1}}

  /* sms + completion */
  .vd-sms{border:1px solid #E5E7EB;border-radius:18px;background:#F8FAFC;padding:14px;margin-bottom:14px}
  .vd-sms-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px}
  .vd-sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:16px 16px 16px 5px;padding:12px 14px;color:#334155;font-size:13px;line-height:1.55}
  .vd-complete-cta{display:flex;flex-direction:column;gap:9px;margin-top:4px}
  .vd-btn-primary{display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;border:none;border-radius:999px;padding:14px 20px;font-size:15px;font-weight:900;cursor:pointer;text-decoration:none;transition:.18s}
  .vd-btn-primary:hover{background:#1F2937;transform:translateY(-1px)}
  .vd-btn-ghost{display:flex;align-items:center;justify-content:center;background:#EF4444;color:#fff;border:1px solid #EF4444;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:.18s;box-shadow:0 4px 14px rgba(239,68,68,.35)}
  .vd-btn-ghost:hover{background:#DC2626;border-color:#DC2626;color:#fff;transform:translateY(-1px);box-shadow:0 6px 18px rgba(220,38,38,.38)}
  .vd-btn-ghost:focus-visible{outline:2px solid #FECACA;outline-offset:2px}

  /* footer links */
  .vd-others{display:flex;flex-wrap:wrap;gap:7px;padding-top:22px;border-top:1px solid #F1F5F9;margin-top:28px}
  .vd-other{border:1px solid #E5E7EB;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;color:#4B5563;background:#fff;text-decoration:none}
  .vd-other:hover{border-color:var(--va);color:var(--va)}
  .vd-disclaimer{font-size:12px;color:#9CA3AF;line-height:1.5;padding-top:16px;margin-top:16px}

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
  .vd-phone-wave span{display:block;width:3px;border-radius:3px;background:#10B981;animation:vdWave 1.1s ease-in-out infinite}
  .vd-phone-wave span:nth-child(1){height:7px}.vd-phone-wave span:nth-child(2){height:18px;animation-delay:.08s}.vd-phone-wave span:nth-child(3){height:24px;animation-delay:.16s}.vd-phone-wave span:nth-child(4){height:14px;animation-delay:.24s}.vd-phone-wave span:nth-child(5){height:20px;animation-delay:.32s}
  .vd-phone-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:120px;padding:4px 0 8px}
  .vd-phone-connecting{display:flex;align-items:center;justify-content:center;gap:9px;color:#10B981;font-size:15px;font-weight:800;letter-spacing:.02em;margin-bottom:4px}
  .vd-phone-connecting-dot{width:8px;height:8px;border-radius:50%;background:#10B981;animation:vdPulse 1s ease-in-out infinite}
  .vd-phone-dock{display:flex;justify-content:center;align-items:flex-end;padding:8px 0 6px;width:100%}
  .vd-phone-ios-act{display:flex;flex-direction:column;align-items:center;gap:7px;width:100%}
  .vd-phone-ios-btn{border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;transition:transform .15s,filter .15s,box-shadow .15s}
  .vd-phone-ios-btn--accept,.vd-phone-ios-btn--end{width:auto;height:auto;padding:0;background:transparent;box-shadow:none;border-radius:0}
  .vd-phone-ios-btn--accept:hover:not(:disabled),.vd-phone-ios-btn--end:hover:not(:disabled){filter:none;transform:none;box-shadow:none}
  .vd-phone-ios-btn-face{
    width:40px;height:40px;aspect-ratio:1;border-radius:999px;
    display:flex;align-items:center;justify-content:center;
    background:#10B981;color:#fff;flex-shrink:0;
    box-shadow:0 12px 28px rgba(16,185,129,.42);
    transition:transform .15s,filter .15s,box-shadow .15s;
  }
  .vd-phone-ios-btn--accept:hover:not(:disabled) .vd-phone-ios-btn-face{filter:brightness(1.06);transform:scale(1.03);box-shadow:0 14px 34px rgba(16,185,129,.48)}
  .vd-phone-ios-btn--accept:disabled .vd-phone-ios-btn-face{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .vd-phone-ios-btn--accept:disabled{cursor:not-allowed}
  .vd-phone-ios-btn-face svg{width:16px;height:16px;display:block}
  /* End call: same ring as Start; chained selector beats base green */
  .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{
    background:#EF4444;
    box-shadow:0 12px 28px rgba(239,68,68,.45);
  }
  .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end svg path{fill:currentColor}
  .vd-phone-ios-btn--end:hover:not(:disabled) .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{
    filter:brightness(1.06);transform:scale(1.03);box-shadow:0 14px 34px rgba(239,68,68,.52);
  }
  .vd-phone-ios-btn--end:disabled .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .vd-phone-ios-btn:focus-visible{outline:2px solid rgba(255,255,255,.55);outline-offset:3px}
  .vd-phone-ios-btn:disabled{opacity:1;cursor:not-allowed}
  .vd-phone-ios-btn--end:disabled{cursor:not-allowed}
  .vd-phone-ios-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.88);letter-spacing:.02em;line-height:1.25;text-align:center;max-width:200px}
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
    .vd-wave{display:none}
    .vd-phone-ios-btn-face{width:56px;height:56px}
    .vd-phone-ios-btn-face svg{width:20px;height:20px}
  }
  @media(min-width:1200px){
    .vd-wrap{max-width:1120px;grid-template-columns:1fr 340px;gap:64px;padding:8px 48px 80px}
  }
  `,
];

function cloneServices(services: DemoServiceCategory[]): DemoServiceCategory[] {
  return services.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));
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
  if (stage === 'queued') return 'Connecting';
  if (stage === 'dialing') return 'Connecting';
  if (stage === 'live') return 'Live';
  if (stage === 'completed') return 'Ended';
  if (stage === 'failed') return 'Error';
  return 'Ready';
}

function microphoneErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Microphone access requires HTTPS or localhost. Please open the web demo on a secure URL, or call the demo number instead.';
  }

  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name?: unknown }).name ?? '')
        : '';

  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'Microphone access is blocked for this site. Please allow microphone access in your browser site settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Please connect a microphone or call the demo number instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone is busy or unavailable. Please close other apps using it, then try again.';
  }

  return 'Microphone access is needed to start the web demo. Please allow microphone access and try again.';
}


export function MarketingVerticalDemoTemplate({
  vertical,
  demoPhoneE164,
}: {
  vertical: DemoVerticalSlug;
  /** E.164 from server `DEMO_PHONE_*` env; falls back to legacy shared line when unset. */
  demoPhoneE164?: string | null;
}) {
  const config = DEMO_VERTICALS[vertical];
  const otherDemoVerticals = useMemo((): DemoVerticalConfig[] => [], []);
  const resolvedDemoPhoneE164 = useMemo(() => normalizeDemoPhoneE164(demoPhoneE164), [demoPhoneE164]);
  const verticalDemoPhoneTel = useMemo(() => `tel:${resolvedDemoPhoneE164}`, [resolvedDemoPhoneE164]);
  const verticalDemoPhoneDisplay = useMemo(() => formatE164ForDisplay(resolvedDemoPhoneE164), [resolvedDemoPhoneE164]);

  const [business, setBusiness] = useState<DemoBusinessConfig>({
    businessName: config.defaultBusinessName,
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
  const [demoLineCopied, setDemoLineCopied] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileSiteKey);
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
  const directRealtimeRequestIdRef = useRef<string | null>(null);
  const directDurationTimerStartedRef = useRef(false);
  const directPeerFailureMutedRef = useRef(false);
  const demoStartLockRef = useRef(false);

  const [captchaHint, setCaptchaHint] = useState<string | null>(null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);

  const activeCategory = useMemo(
    () => business.services.find((c) => c.id === selectedCategory) ?? business.services[0],
    [business.services, selectedCategory],
  );

  const visiblePrompts = showAllPrompts ? config.tryAsking : config.tryAsking.slice(0, 4);
  const hiddenCount = Math.max(0, config.tryAsking.length - 4);
  const isSubmitting = stage === 'queued' || stage === 'dialing' || stage === 'live';
  const isActive = stage !== 'idle';
  useEffect(() => () => {
    clearPollTimer();
    cleanupDirectRealtime();
  }, []);

  /** When leaving the form for the live demo, remove Turnstile so the widget can mount again on return. */
  useEffect(() => {
    if (!isActive || !turnstileSiteKey) return;
    return () => {
      const tw = (window as Window & { turnstile?: { remove: (id: string) => void } }).turnstile;
      if (turnstileWidgetIdRef.current && tw) {
        try {
          tw.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      turnstileWidgetIdRef.current = null;
      turnstileRenderedRef.current = false;
      setCaptchaToken(null);
    };
  }, [isActive, turnstileSiteKey]);

  useEffect(() => {
    if (!turnstileSiteKey || turnstileReady) return;
    const t = window.setInterval(() => {
      if ((window as Window & { turnstile?: unknown }).turnstile) setTurnstileReady(true);
    }, 300);
    return () => window.clearInterval(t);
  }, [turnstileReady, turnstileSiteKey]);

  useLayoutEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || turnstileRenderedRef.current || isActive) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = turnstileRef.current;
        const tw = (window as Window & { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void } }).turnstile;
        if (!el || !tw || turnstileRenderedRef.current) return;
        try {
          turnstileWidgetIdRef.current = tw.render(el, {
            sitekey: turnstileSiteKey,
            theme: 'light',
            callback: (token: string) => {
              setCaptchaHint(null);
              setCaptchaToken(token);
            },
            'error-callback': () => {
              setCaptchaToken(null);
              setCaptchaHint('Verification could not load. Try disabling ad blockers or allow challenges.cloudflare.com.');
            },
            'expired-callback': () => setCaptchaToken(null),
          });
          turnstileRenderedRef.current = true;
        } catch {
          setCaptchaHint('Verification widget failed to start. Please refresh the page.');
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [turnstileReady, turnstileSiteKey, isActive, captchaEpoch]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || isActive) return;
    const t = window.setTimeout(() => {
      if (!turnstileRenderedRef.current) {
        setCaptchaHint((h) => h ?? 'If you do not see a checkbox, allow scripts from Cloudflare or try another browser.');
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [turnstileReady, turnstileSiteKey, isActive, captchaEpoch]);

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
    if (turnstileSiteKey && !captchaToken) errs.push('Please complete human verification (checkbox above).');
    return errs;
  }

  function clearPollTimer() {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }

  async function pollStatus(p: { requestId: string; previewToken: string; attempt?: number }) {
    const attempt = p.attempt ?? 1;
    if (attempt > DEMO_STATUS_MAX_POLL_ATTEMPTS) {
      clearPollTimer();
      setStage('failed');
      setStatusText(DEMO_STATUS_TIMEOUT_MESSAGE);
      setRequestError(DEMO_STATUS_TIMEOUT_MESSAGE);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      return;
    }

    try {
      const res = await fetch(`/api/backend/public/demo/status/${encodeURIComponent(p.requestId)}?token=${encodeURIComponent(p.previewToken)}`);
      const body = (await res.json()) as DemoStatusResponse;
      if (!body.ok || !body.stage) {
        clearPollTimer();
        setRequestError(apiUserVisibleMessage(body, 'Unable to check demo status.'));
        setStage('failed');
        setStatusText('Unable to check demo status. Please try again.');
        return;
      }
      setStage(body.stage);
      if (body.stage === 'queued') setStatusText('Connecting your browser session to the demo room…');
      if (body.stage === 'dialing') setStatusText('Connecting your browser session to the demo room…');
      if (body.stage === 'live') setStatusText('You\'re connected — speak naturally or tap a prompt below.');
      if (body.stage === 'completed') {
        setStatusText('Session ended. Here\'s what a follow-up SMS could look like.');
        return;
      }
      if (body.stage === 'failed') {
        setStatusText('The demo session could not complete. You can try again or call the demo line.');
        return;
      }
      const nextAttempt = body.stage === 'live' ? 1 : attempt + 1;
      pollTimerRef.current = window.setTimeout(() => void pollStatus({ ...p, attempt: nextAttempt }), DEMO_STATUS_POLL_INTERVAL_MS);
    } catch {
      clearPollTimer();
      setStage('failed');
      setStatusText('Network error while checking demo status.');
      setRequestError('Network error while checking demo status.');
    }
  }

  function resetTurnstile() {
    if (!turnstileSiteKey) return;
    const tw = (window as Window & { turnstile?: { reset: (id: string) => void; remove: (id: string) => void } }).turnstile;
    if (turnstileWidgetIdRef.current && tw) {
      try {
        tw.remove(turnstileWidgetIdRef.current);
      } catch {
        try {
          tw.reset(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
    }
    turnstileWidgetIdRef.current = null;
    turnstileRenderedRef.current = false;
    setCaptchaToken(null);
    setCaptchaHint(null);
    setCaptchaEpoch((e) => e + 1);
  }

  async function copyDemoPhoneNumber() {
    try {
      await navigator.clipboard.writeText(resolvedDemoPhoneE164);
      setDemoLineCopied(true);
      window.setTimeout(() => setDemoLineCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function requestDemoMicrophone({ keepAlive }: { keepAlive: boolean }): Promise<MediaStream | null> {
    if (!window.isSecureContext) {
      setErrors([microphoneErrorMessage(null)]);
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrors([
        'Your browser does not support microphone access for the web demo. Please try Chrome or Safari, or call the demo number instead.',
      ]);
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!keepAlive) {
        stream.getTracks().forEach((track) => track.stop());
      }
      return stream;
    } catch (error) {
      setErrors([microphoneErrorMessage(error)]);
      return null;
    }
  }

  function buildDemoPayload() {
    return {
      shopName: business.businessName,
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

  function releaseDirectRealtimeSlotFireAndForget(requestId: string) {
    void fetch('/api/backend/public/demo/realtime-session/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin
          ? { Origin: window.location.origin }
          : {}),
      },
      body: JSON.stringify({ requestId }),
    }).catch(() => {
      /* ignore */
    });
  }

  function beginDirectDemoMaxDurationTimer() {
    if (directDurationTimerStartedRef.current) return;
    directDurationTimerStartedRef.current = true;
    clearDirectMaxDurationTimer();
    directMaxDurationTimerRef.current = window.setTimeout(() => {
      directPeerFailureMutedRef.current = true;
      cleanupDirectRealtime();
      resetTurnstile();
      setStage('failed');
      setStatusText(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
      setRequestError(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
    }, DIRECT_OPENAI_MAX_SESSION_MS);
  }

  function cleanupDirectRealtime() {
    clearDirectMaxDurationTimer();
    clearDirectConnectTimer();
    const releaseRequestId = directRealtimeRequestIdRef.current;
    directRealtimeRequestIdRef.current = null;
    directDurationTimerStartedRef.current = false;
    if (releaseRequestId) {
      releaseDirectRealtimeSlotFireAndForget(releaseRequestId);
    }
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

  async function startDirectOpenAiDemo(preauthorizedStream?: MediaStream) {
    cleanupDirectRealtime();
    directPeerFailureMutedRef.current = false;
    clearPollTimer();
    setStatusText('Requesting microphone…');

    const stream = preauthorizedStream ?? await requestDemoMicrophone({ keepAlive: true });
    if (!stream) {
      setStage('idle');
      setStatusText('');
      return;
    }
    directStreamRef.current = stream;

    setStatusText('Creating demo session…');
    const sessionResponse = await fetch('/api/backend/public/demo/realtime-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin
          ? { Origin: window.location.origin }
          : {}),
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
        void audio.play().catch(() => {
          /* Browser may require the user gesture already used to start the demo. */
        });
        connected = true;
        clearDirectConnectTimer();
        beginDirectDemoMaxDurationTimer();
        setStage('live');
        setStatusText('You\'re connected — the receptionist will greet you first, then you can speak or tap a prompt below.');
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          connected = true;
          clearDirectConnectTimer();
          beginDirectDemoMaxDurationTimer();
          setStage('live');
          setStatusText('You\'re connected — the receptionist will greet you first, then you can speak or tap a prompt below.');
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

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      const dc = pc.createDataChannel('oai-events');
      directDataChannelRef.current = dc;
      let initialGreetingRequested = false;
      let realtimeSessionReady = false;
      const requestInitialGreeting = () => {
        if (initialGreetingRequested || !realtimeSessionReady || dc.readyState !== 'open') return;
        // Set before sends: `session.created` / `session.updated` may arrive back-to-back; guard must flip before I/O.
        initialGreetingRequested = true;
        setStatusText('The receptionist is greeting you…');
        try {
          dc.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: 'The call just connected. Please say the configured WELCOME MESSAGE before I say anything.',
                  },
                ],
              },
            }),
          );
          dc.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                instructions:
                  'Speak first now. Say only the exact WELCOME MESSAGE from RUNTIME BUSINESS CONFIG, naturally and once, then stop and listen. Do not say "welcome to the demo" or mention the demo unless the WELCOME MESSAGE itself says it. Do not wait for the caller to speak.',
              },
            }),
          );
        } catch {
          initialGreetingRequested = false;
        }
      };
      dc.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { error?: { message?: string }; type?: string };
          if (data.type === 'session.created' || data.type === 'session.updated') {
            realtimeSessionReady = true;
            requestInitialGreeting();
          }
          if (data.type === 'response.created') setStatusText('AI receptionist is responding…');
          if (data.type === 'response.done') {
            setStatusText('You\'re connected — speak naturally or tap a prompt below.');
          }
          if (data.type === 'input_audio_buffer.speech_started') setStatusText('Listening…');
          if (data.type === 'error') {
            console.warn('OpenAI Realtime web demo event error', data.error);
          }
        } catch {
          /* Ignore non-JSON data channel frames. */
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(OPENAI_REALTIME_WEBRTC_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionBody.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!sdpResponse.ok) {
        throw new Error('webrtc_connect_failed');
      }
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      });
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
      setErrors(['No microphone audio track was returned. Please try again or call the demo number instead.']);
      return;
    }

    clearPollTimer();
    setStatusText('Starting browser demo…');
    const payload = buildDemoPayload();
    try {
      const res = await fetch('/api/backend/public/demo/web-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { Origin: window.location.origin }
            : {}),
        },
        body: JSON.stringify(payload),
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
        room.on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
        });
        try {
          await room.connect(liveKitUrl, liveKitToken);
          // Publish the mic track acquired during the Start click (same user-gesture chain). Calling
          // setMicrophoneEnabled after await fetch often loses activation and surfaces NotAllowedError.
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
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      micStream.getTracks().forEach((t) => t.stop());
      setStage('failed');
      const message = error instanceof Error && error.message === 'livekit_connect_failed'
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
      // Request mic while the Start button click is still the active user gesture.
      // Some browsers are flaky on first permission prompt if we unmount the form first.
      // Keep the LiveKit preflight stream alive until publishTrack — do not stop tracks before async work.
      setStatusText('Requesting microphone…');
      const preflightStream = await requestDemoMicrophone({ keepAlive: true });
      if (!preflightStream) return;

      flushSync(() => {
        setStage('queued');
        setStatusText(
          demoWebCallMode === 'direct_openai' ? 'Requesting microphone…' : 'Starting browser demo…',
        );
      });

      if (demoWebCallMode === 'direct_openai') await startDirectOpenAiDemo(preflightStream);
      else await startLiveKitWebDemo({ micStream: preflightStream });
    } finally {
      demoStartLockRef.current = false;
    }
  }

  async function copyPrompt(prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setCopied(prompt); window.setTimeout(() => setCopied(null), 1600); } catch { /* ignore */ }
  }

  function endDirectDemo() {
    directPeerFailureMutedRef.current = true;
    cleanupDirectRealtime();
    resetTurnstile();
    setStage('completed');
    setRequestError(null);
    setStatusText('Session ended. Here\'s what a follow-up SMS could look like.');
  }

  function endWebDemoFromPhone() {
    if (demoWebCallMode === 'direct_openai') {
      endDirectDemo();
      return;
    }
    clearPollTimer();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    resetTurnstile();
    setStage('completed');
    setRequestError(null);
    setStatusText('Session ended. Here\'s what a follow-up SMS could look like.');
  }

  function resetDemo() {
    directPeerFailureMutedRef.current = false;
    clearPollTimer();
    cleanupDirectRealtime();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    resetTurnstile();
    setStage('idle');
    setRequestError(null);
    setStatusText('');
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
            <h1 className="vd-hero-h1">{config.title}</h1>
            <p className="vd-hero-sub">{config.subtitle}</p>
          </div>

          <div className="vd-wrap">

            {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
            <div>
              {/* ── FORM ── */}
              {!isActive ? (
                <div className="vd-form-card">
                  <div className="vd-field" style={{ marginBottom: 14 }}>
                    <label htmlFor="vd-biz">Business name for this demo</label>
                    <input id="vd-biz" value={business.businessName} onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))} />
                  </div>

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
                  {turnstileSiteKey ? (
                    <div style={{ marginBottom: 14 }}>
                      <div className="vd-captcha-label">Human verification</div>
                      <div className="vd-captcha">
                        <div className="vd-captcha-inner" ref={turnstileRef} />
                      </div>
                      {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                    </div>
                  ) : null}

                  {/* Errors */}
                  {errors.length > 0 || requestError ? (
                    <div className="vd-errors">
                      {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                      {requestError ? <div className="vd-error">{requestError}</div> : null}
                    </div>
                  ) : null}

                  {/* CTA */}
                  <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                    {isSubmitting ? 'Starting…' : 'Start Demo Call'}
                  </button>
                  <p className="vd-cta-note">
                    Talk to RingBooker in your browser using this demo setup. No phone number required.
                  </p>

                  <div className="vd-phone-demo-secondary">
                    <div className="vd-phone-demo-title">Prefer to call?</div>
                    <p className="vd-phone-demo-text">Call the demo line and speak with the AI receptionist.</p>
                    <div className="vd-phone-demo-num-row">
                      <span className="vd-phone-demo-num">{verticalDemoPhoneDisplay}</span>
                      <button type="button" className="vd-phone-demo-copy" onClick={() => void copyDemoPhoneNumber()}>
                        {demoLineCopied ? 'Copied' : 'Copy number'}
                      </button>
                    </div>
                    <a className="vd-phone-demo-tel" href={verticalDemoPhoneTel}>
                      Call demo number
                    </a>
                    <p className="vd-phone-demo-note">{config.phoneDemoProfileCopy}</p>
                  </div>
                </div>
              ) : (
                /* ── STATUS VIEW ── */
                <div>
                  <div className={`vd-status-pill ${stage}`}>
                    <span className={`vd-status-dot ${stage === 'queued' || stage === 'dialing' || stage === 'live' ? 'pulse' : ''}`} />
                    {stageLabel(stage)}
                  </div>

                  <h2 className="vd-status-h">
                    {stage === 'queued' || stage === 'dialing' ? 'Connecting…' :
                     stage === 'live' ? 'Your AI receptionist demo is ready' :
                     stage === 'completed' ? 'Demo complete' : 'Something went wrong'}
                  </h2>
                  <p className="vd-status-body">{statusText}</p>

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
                      {demoWebCallMode === 'direct_openai' ? (
                        <div className="vd-complete-cta">
                          <button type="button" className="vd-btn-ghost" onClick={endDirectDemo}>End demo</button>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {stage === 'completed' ? (
                    <>
                      <div className="vd-sms">
                        <div className="vd-sms-label">Demo SMS preview</div>
                        <div className="vd-sms-bubble">{config.smsPreview}</div>
                      </div>
                      <div className="vd-complete-cta">
                        <Link href="/pricing" className="vd-btn-primary">Start Free 14-Day Trial →</Link>
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
              {otherDemoVerticals.length > 0 ? (
                <div className="vd-others">
                  {otherDemoVerticals.map((v) => (
                    <Link key={v.slug} href={`/demo/${v.slug}`} className="vd-other">
                      {v.businessType.replace(/-/g, ' ')}
                    </Link>
                  ))}
                </div>
              ) : null}
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
                <div className="vd-phone-subtitle">
                  {stage === 'queued' || stage === 'dialing'
                    ? 'Connecting…'
                    : stage === 'live'
                      ? 'Active Call'
                      : stage === 'completed'
                        ? 'Call Summary'
                        : stage === 'failed'
                          ? 'Call failed'
                          : 'LIVE DEMO CALL'}
                </div>
                <div className="vd-phone-mid">
                  {stage === 'queued' || stage === 'dialing' ? (
                    <div className="vd-phone-connecting" aria-live="polite">
                      <span className="vd-phone-connecting-dot" aria-hidden />
                      Connecting…
                    </div>
                  ) : (
                    <div className="vd-phone-wave">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
                <div className="vd-phone-dock">
                  {stage === 'live' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--end" onClick={endWebDemoFromPhone} aria-label="End call">
                        <span className="vd-phone-ios-btn-face vd-phone-ios-btn-face--end" aria-hidden>
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
                              transform="rotate(135 12 12)"
                            />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">End Call</span>
                    </div>
                  ) : null}
                  {stage === 'idle' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--accept" onClick={() => void startWebDemo()} disabled={isSubmitting} aria-label="Start Demo Call">
                        <span className="vd-phone-ios-btn-face" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">Start Demo Call</span>
                    </div>
                  ) : null}
                  {stage === 'completed' || stage === 'failed' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--accept" onClick={resetDemo} aria-label="Start Demo Call">
                        <span className="vd-phone-ios-btn-face" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">Start Demo Call</span>
                    </div>
                  ) : null}
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
