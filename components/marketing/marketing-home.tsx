import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { IPHONE_CALL_MOCKUP_CSS } from '@/components/marketing/iphone-call-mockup-css';
import { HomeHeroPhoneMockup } from '@/components/marketing/home-hero-phone-mockup';
import { HomeIndustriesSection } from '@/components/marketing/home-industries-section';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';


const HOME_FAQS = [
  {
    q: 'Can RingBooker work with my current salon phone number?',
    a: 'Yes. RingBooker works by forwarding your existing number, so callers keep dialing the same number they already know. You can also use a new RingBooker number if you prefer.',
  },
  {
    q: 'Does RingBooker replace my booking software?',
    a: 'No. RingBooker handles the phone layer while your booking workflow stays familiar. Square Appointments is live today; other booking tools can start with call summaries and handoff while deeper integrations expand.',
  },
  {
    q: 'Can it handle reschedule and cancellation calls?',
    a: 'Yes. RingBooker can collect the caller intent, confirm the service and time, handle simple reschedules or cancellations based on your rules, and send a summary when a human follow-up is needed.',
  },
  {
    q: 'What happens if a caller wants to speak to a real person?',
    a: 'RingBooker can collect the caller’s request, mark it for human follow-up, and send your team a clear summary. On Professional and Custom plans, RingBooker can also transfer the call to the owner based on your handoff settings.',
  },
  {
    q: "Will my customers know they're talking to AI?",
    a: 'RingBooker is designed to be transparent and helpful. It can introduce itself as your virtual assistant, speak naturally, and hand off gracefully when a human is needed.',
  },
  {
    q: 'Can RingBooker text missed callers automatically?',
    a: 'Yes. Missed-call text back and smart callback workflows help recover callers who hang up, call after hours, or reach you during a busy service window.',
  },
  {
    q: 'Does it work for nail salons with Vietnamese-speaking owners?',
    a: 'Yes. RingBooker supports Vietnamese onboarding help and can be configured for English and Vietnamese call flows, summaries, and salon-specific scripts.',
  },
  {
    q: 'Can it answer calls after hours and on weekends?',
    a: 'Yes. RingBooker can answer after-hours and weekend calls, capture booking intent, send confirmations, and make sure your team sees what happened when you are back online.',
  },
];

const HOME_COMPARE_ROWS = [
  {
    bad: 'Loops on unexpected questions, then dumps to voicemail.',
    good: 'Two-strike fallback with callback offer and clean handoff.',
  },
  {
    bad: 'Asks too many questions before doing anything useful.',
    good: "Asks only what's needed to book, reschedule, or summarize.",
  },
  {
    bad: 'No context — your team starts from scratch every time.',
    good: 'Call summaries and intent notes so nobody repeats themselves.',
  },
  {
    bad: 'Designed for call centers, not beauty booking workflows.',
    good: 'Purpose-built for nail salons, spas, med spas, and clinics.',
  },
] as const;

const homeFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RingBooker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '79',
    priceCurrency: 'USD',
  },
  description:
    'RingBooker is an AI receptionist and answering service for salons, spas, med spas, and clinics: after-hours and peak-hour overflow, missed-call text back, protected revenue, and guided setup in about 15 minutes on your current number.',
};

/** 24×24 stroke icons — homepage only, matches soft “line” icon treatment */
function HomeLineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="home-line-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const styles: string[] = [
  String.raw`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--purple:var(--mk-brand-purple,#8B5CF6);--purple-dark:var(--mk-brand-purple-dark,#7C3AED);--purple-light:var(--mk-brand-purple-soft,#EDE9FE);--purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);--text-dark:var(--mk-text-strong,#111827);--text-gray:var(--mk-text-muted,#64748B);--text-light:var(--mk-text-soft,#94A3B8);--text-desc:var(--mk-text-desc,#64748B);--bg:var(--mk-bg-page,#fff);--bg-gray:var(--mk-bg-section,#F9FAFB);--border:var(--mk-border-soft,#E8ECF1);--home-shadow-soft:var(--mk-card-shadow,0 1px 2px rgba(17,24,39,.04));--home-shadow-hover:var(--mk-card-shadow-hover,0 4px 14px -6px rgba(17,24,39,.08));--home-card-border-hover:var(--mk-card-border-hover,rgba(167,139,250,.42));--r-pill:var(--mk-radius-pill,999px);--r-lg:var(--mk-radius-card,22px);--r-md:var(--mk-radius-input,16px);--r-sm:12px;--ind-accent-nail:var(--purple-ultra,#f5f0ff);--ind-accent-hair:#fff5f0;--ind-accent-day-spa:#f0faf5;--ind-accent-med-spa:#f0f4ff;--ind-accent-beauty-clinic:#fff0f8}html{scroll-behavior:smooth}body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}.home-line-icon{display:block;flex-shrink:0}.legacy-marketing{--mk-section-h2:clamp(28px,3.35vw,42px);--mk-section-h2-lh:1.14;--mk-section-h2-track:-1.1px;--mk-section-lead-lh:1.72;--mk-body-lh:1.68;--mk-card-title:16px}.home-hero-shell{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.08) 28%,rgba(255,255,255,0.42) 46%,rgba(255,255,255,0.82) 62%,rgba(255,255,255,0.98) 76%,#ffffff 88%,#ffffff 100%),radial-gradient(ellipse 96% 78% at 50% -22%,#EDE9FE 0%,#EDE9FE 14%,#F5F0FF 34%,#FDF4FF 52%,rgba(253,244,255,0.65) 72%,rgba(255,255,255,0.99) 94%,#ffffff 100%)}.home-hero-shell::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:138px;pointer-events:none;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.72) 34%,#ffffff 58%,#fcfbff 82%,#F9FAFB 100%)}.hero{min-height:auto;padding:100px 48px 48px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:transparent}.hero-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none}.hero-blob-1{width:560px;height:560px;background:#C4B5FD;top:-200px;left:-140px}.hero-blob-2{width:460px;height:460px;background:#F9A8D4;top:-100px;right:-120px}.hero-inner{position:relative;z-index:2;max-width:1180px;width:100%;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:40px 32px;align-items:center}.hero-copy{text-align:left;min-width:0}.hero-eyebrow{font-size:var(--mk-eyebrow);font-weight:600;color:var(--mk-hero-eyebrow,#64748b);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:16px;line-height:1.4}.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}h1.hero-h{font-size:var(--mk-hero-title);font-weight:600;line-height:var(--mk-hero-title-home-lh);letter-spacing:var(--mk-hero-title-home-track);color:var(--text-dark);margin-bottom:20px;word-break:break-word;text-align:left}h1.hero-h em{font-style:italic;font-weight:500;color:var(--purple-dark)}.hero-sub{font-size:var(--mk-hero-lead);color:var(--text-desc);line-height:var(--mk-hero-lead-lh);max-width:36rem;margin:0 0 28px;padding:0;font-weight:400;text-align:left}.hero-sub a.hero-sub-link{color:var(--purple-dark);font-weight:600;text-decoration:none;transition:color .18s ease}.hero-sub a.hero-sub-link:hover{color:#5b21b6;text-decoration:none}.hero-btns{display:flex;align-items:center;justify-content:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:0}.hero-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}.hero-stats-block{grid-column:1/-1;margin-top:8px;padding-top:28px;border-top:1px solid var(--border)}.hero-stats-footnote{margin:6px 0 0;padding:0;font-size:11px;line-height:1.45;color:var(--text-desc);font-weight:400}.hero-stat-footnote-mark{color:inherit;text-decoration:none;font-weight:500}.hero-stat-footnote-mark:hover{text-decoration:underline}.hero-stat{padding:8px 16px 4px;text-align:left;border-right:1px solid var(--border)}.hero-stat:last-child{border-right:none}.hero-stat-num{font-size:clamp(1.75rem,3vw,2.25rem);font-weight:600;color:var(--text-dark);letter-spacing:-.04em;line-height:1.1;font-variant-numeric:tabular-nums;margin-bottom:4px}.hero-stat-label{font-size:13px;color:var(--text-dark);font-weight:500;line-height:1.4}.btn-dark{background:var(--text-dark);color:#fff;padding:14px 30px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;transition:transform .15s,background .2s}.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}.btn-dark svg{width:16px;height:16px;fill:#fff}.btn-outline{background:transparent;color:var(--text-dark);padding:13px 26px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:600;text-decoration:none;border:1px solid var(--border);display:inline-flex;align-items:center;gap:8px;transition:border-color .2s,color .2s,background .2s,transform .15s}.btn-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.5)}.hero-btns .btn-hero-live{background:#0d0d0d;color:#fff;padding:15px 32px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);border:none;transition:transform .15s,background .2s,box-shadow .2s}.hero-btns .btn-hero-live:hover{background:#1a1a1a;transform:translateY(-1px);box-shadow:0 12px 32px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.12)}.hero-btns .btn-hero-live svg{width:16px;height:16px;flex-shrink:0}.hero-btns .btn-hero-live .btn-hero-live-phone{width:18px;height:18px}.hero-btns .btn-hero-live .btn-hero-live-phone path{fill:#FACC15}.hero-btns .btn-hero-live .btn-hero-live-arrow{color:#fff}.hero-btns .btn-outline.btn-hero-trial{background:#fff;color:#0d0d0d;border:1px solid #0d0d0d;padding:11px 20px;font-size:var(--mk-btn-sm);font-weight:600}.hero-btns .btn-outline.btn-hero-trial:hover{background:#f5f5f5;border-color:#0d0d0d;color:#0d0d0d;transform:translateY(-1px)}.leak-section{position:relative;margin-top:-34px;padding:96px 48px 80px;background:linear-gradient(180deg,rgba(249,250,251,0) 0%,#fcfbff 26%,#F9FAFB 100%)}.leak-inner,.compare-inner{max-width:1100px;margin:0 auto}.leak-intro{margin-bottom:8px}.leak-intro .sec-label,.leak-intro .sec-title,.leak-intro .sec-sub{text-align:left;margin-left:0;margin-right:0}.leak-intro .sec-title{max-width:none;margin-bottom:14px}.leak-intro .sec-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.leak-intro .sec-sub{max-width:44ch;margin-bottom:44px;line-height:1.65}.leak-body{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:36px 64px;align-items:start}.leak-list{display:flex;flex-direction:column;gap:0}.leak-item{display:grid;grid-template-columns:3.5rem minmax(0,1fr);gap:16px 26px;padding:20px 0;border-bottom:1px solid var(--border)}.leak-item:first-child{padding-top:0}.leak-item:last-child{border-bottom:none;padding-bottom:0}.leak-num{font-size:clamp(1.75rem,2.8vw,2.35rem);font-weight:500;line-height:1;color:#d1d5db;letter-spacing:-.04em;padding-top:1px;font-variant-numeric:tabular-nums}.leak-item h3{font-size:16px;font-weight:500;line-height:1.35;letter-spacing:-.25px;margin-bottom:8px;text-align:left;color:var(--text-dark)}.leak-item>div>p{font-size:15px;color:var(--text-desc);line-height:1.6;text-align:left;margin-bottom:10px;max-width:46ch}.leak-card{position:relative;background:#f2eee6;border:1px solid var(--border);border-radius:24px;padding:34px 28px 24px;box-shadow:var(--home-shadow-soft);transition:transform .2s,box-shadow .2s,border-color .2s}.leak-card:hover{transform:translateY(-1px);box-shadow:var(--home-shadow-hover);border-color:var(--home-card-border-hover)}.leak-divider{height:1px;background:#e5e7eb;margin:20px 0 16px}.leak-item .pain-resolve{margin-top:12px;border-left:2px solid #64748b;padding:4px 0 4px 10px;font-size:13px;font-weight:400;line-height:1.5;color:#64748b}.leak-card.leak-revenue{background:#f2eee6;padding:32px 28px 28px;box-sizing:border-box;display:flex;flex-direction:column}.leak-card.leak-revenue:hover{border-color:var(--border)}.leak-revenue{align-self:start;flex:1;display:flex;flex-direction:column}.leak-revenue-kicker{font-size:var(--mk-eyebrow);font-weight:600;color:var(--text-dark);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:10px;text-align:left;opacity:1}.leak-revenue-note{font-size:13px;color:var(--text-light);margin-bottom:20px;line-height:1.5;text-align:left}.leak-revenue-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 16px;align-items:center;margin-bottom:18px}.leak-revenue-row:last-of-type{margin-bottom:0}.leak-revenue-label{font-size:15px;color:var(--text-desc);line-height:1.45;grid-column:1;text-align:left}.leak-revenue-range{font-size:15px;font-weight:500;color:var(--text-dark);white-space:nowrap;grid-column:2;grid-row:1}.leak-revenue-bar{grid-column:1/-1;height:7px;border-radius:999px;background:#f1f5f9;overflow:hidden;margin-top:2px}.leak-revenue-bar span{display:block;height:100%;border-radius:999px}.leak-revenue-foot{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb}.leak-revenue-foot>p:first-child{font-size:15px;color:var(--text-desc);margin-bottom:10px;text-align:left}.leak-revenue-total{font-size:clamp(1.85rem,3.2vw,2.35rem);font-weight:600;color:var(--text-dark);letter-spacing:-.04em;line-height:1.12;font-variant-numeric:tabular-nums;text-align:left}.leak-revenue-total strong{font-weight:600;color:var(--purple-dark)}.compare-section{padding:88px 48px 72px;background:linear-gradient(180deg,#F9FAFB 0%,#fff 100%);color:var(--text-dark)}.compare-intro{margin-bottom:8px}.compare-intro .sec-label,.compare-intro .compare-title,.compare-intro .compare-lead{text-align:left;margin-left:0;margin-right:0}.compare-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);max-width:20ch;margin-bottom:14px;text-wrap:normal}.compare-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.compare-lead{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:44ch;font-weight:400}.compare-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:36px;border:1px solid var(--border);border-radius:20px;background:#fff;overflow:hidden;box-shadow:var(--home-shadow-soft)}.compare-col{padding:28px 26px 24px}.compare-col-bad{background:#fafafa;border-right:1px solid rgba(241,245,249,.95)}.compare-col-good{background:linear-gradient(180deg,#fafdfb 0%,#fff 100%)}.compare-col-label{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)}.compare-col-bad .compare-col-label{color:#94a3b8}.compare-col-good .compare-col-label{color:var(--purple-dark)}.compare-lines{list-style:none;display:flex;flex-direction:column;gap:0}.compare-line{display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid rgba(241,245,249,.9);font-size:var(--mk-body);line-height:1.58;font-weight:400}.compare-line:last-child{border-bottom:none;padding-bottom:0}.compare-line:first-child{padding-top:0}.compare-col-bad .compare-line{color:var(--text-desc)}.compare-col-good .compare-line{color:var(--text-dark)}.cmp-icon{width:20px;height:20px;min-width:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:3px}.cmp-icon svg{display:block}.compare-col-bad .cmp-icon{color:#F87171}.compare-col-good .cmp-icon{color:#34D399}.hero-visual{position:relative;margin-top:0;padding-top:20px;height:500px;display:flex;align-items:flex-start;justify-content:center;min-width:0}.phone-wrap{position:relative;z-index:3}.phone-frame{width:268px;height:500px}.phone-frame:not(.iph-shell){background:#0d0d0d;border-radius:44px;padding:11px;box-shadow:0 44px 84px rgba(0,0,0,.26),0 0 0 1px rgba(255,255,255,.06) inset}.phone-screen{width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative;box-sizing:border-box}.phone-screen:not(.iph-shell){background:#f3f4f6;border:1.5px solid #d1d5db;border-radius:35px}.p-status-bar{padding:14px 20px 8px;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}.p-time-txt{font-size:14px;font-weight:500;color:#fff}.p-icons-txt{font-size:10px;color:rgba(255,255,255,.7);letter-spacing:.5px}.vc-bg{position:absolute;inset:0;background:#f3f4f6}.vc-glow{position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,.08) 0%,transparent 68%);top:50%;left:50%;transform:translate(-50%,-60%);animation:glow-pulse 3s ease-in-out infinite}@keyframes glow-pulse{0%,100%{opacity:.7;transform:translate(-50%,-60%) scale(1)}50%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}}.vc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:8px 20px 12px}.iph-shell .vc-content{padding-top:28px}.vc-mini-status{display:flex;justify-content:space-between;width:100%;margin-bottom:16px}.vc-mini-time{font-size:14px;font-weight:500;color:#111827}.vc-mini-icons{font-size:10px;color:#64748b}.vc-label{font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}.vc-name{font-size:19px;font-weight:500;color:#111827;margin-bottom:4px}.vc-timer{font-size:14px;color:#94a3b8;margin-bottom:20px;font-variant-numeric:tabular-nums}.vc-wave{display:flex;align-items:center;justify-content:center;gap:2.5px;height:28px;margin-bottom:12px}.iph-shell .vc-wave span{width:3px;background:#34c759;border-radius:2px}.vc-wave span{width:3px;background:#10B981;border-radius:2px}.vc-wave span:nth-child(1){height:8px}.vc-wave span:nth-child(2){height:18px}.vc-wave span:nth-child(3){height:24px}.vc-wave span:nth-child(4){height:14px}.vc-wave span:nth-child(5){height:20px}.vc-wave span:nth-child(6){height:10px}.vc-wave span:nth-child(7){height:16px}.vc-wave span:nth-child(8){height:24px}.vc-wave span:nth-child(9){height:12px}.iph-shell .vc-wave.vc-wave-active span,.vc-wave.vc-wave-active span{animation:vc-wv .8s ease-in-out infinite}.iph-shell .vc-wave.vc-wave-active span:nth-child(2),.vc-wave.vc-wave-active span:nth-child(2){animation-delay:.07s}.iph-shell .vc-wave.vc-wave-active span:nth-child(3),.vc-wave.vc-wave-active span:nth-child(3){animation-delay:.14s}.iph-shell .vc-wave.vc-wave-active span:nth-child(4),.vc-wave.vc-wave-active span:nth-child(4){animation-delay:.21s}.iph-shell .vc-wave.vc-wave-active span:nth-child(5),.vc-wave.vc-wave-active span:nth-child(5){animation-delay:.28s}.iph-shell .vc-wave.vc-wave-active span:nth-child(6),.vc-wave.vc-wave-active span:nth-child(6){animation-delay:.35s}.iph-shell .vc-wave.vc-wave-active span:nth-child(7),.vc-wave.vc-wave-active span:nth-child(7){animation-delay:.42s}.iph-shell .vc-wave.vc-wave-active span:nth-child(8),.vc-wave.vc-wave-active span:nth-child(8){animation-delay:.49s}.iph-shell .vc-wave.vc-wave-active span:nth-child(9),.vc-wave.vc-wave-active span:nth-child(9){animation-delay:.56s}@keyframes vc-wv{0%,100%{transform:scaleY(.45);opacity:.5}50%{transform:scaleY(1);opacity:1}}.vc-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:auto}.vc-ctrl{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:default;border:none;padding:0;font:inherit}.vc-ctrl-mute{background:rgba(17,24,39,.08)}.vc-ctrl-mute svg{width:18px;height:18px;fill:#64748b}.vc-ctrl-spk{background:rgba(17,24,39,.08)}.vc-ctrl-spk svg{width:18px;height:18px;fill:#64748b}.trusted{padding:36px 48px 56px;text-align:center}.trusted-label{font-size:var(--mk-meta);color:var(--text-light);font-weight:500;margin-bottom:28px}.logo-row{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}.logo-item{display:flex;align-items:center;gap:8px;font-size:var(--mk-body-md);font-weight:500;color:#C4C9D4;transition:color .2s;cursor:default}.logo-item:hover{color:#6B7280}.logo-ico{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px}.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:var(--purple-dark);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px;text-align:center;opacity:.95}.sec-label-left{text-align:left}.sec-label-center{text-align:center}.section-label-wrap{text-align:center;margin-bottom:4px}.sec-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);text-align:center;margin-bottom:14px;color:var(--text-dark);max-width:22ch;margin-left:auto;margin-right:auto;text-wrap:balance}.sec-title-air{margin-bottom:52px}.sec-sub{font-size:var(--mk-section-lead);color:var(--text-desc);text-align:center;margin-bottom:40px;line-height:var(--mk-section-lead-lh);font-weight:400;max-width:720px;margin-left:auto;margin-right:auto}.emphasis-5min{color:var(--purple-dark);font-weight:500}.features{--cov-accent:#EE5D43;--cov-peach:#F9E4E1;--cov-sage:#E1ECE6;--cov-sand:#F2EEE6;padding:88px 48px 72px;background:linear-gradient(180deg,rgba(249,250,251,0) 0%,#fcfbff 26%,#F9FAFB 100%)}.coverage-inner{max-width:1100px;margin:0 auto}.coverage-intro{margin-bottom:40px}.coverage-intro .coverage-kicker,.coverage-intro .coverage-title,.coverage-intro .coverage-lead{text-align:left;margin-left:0;margin-right:0}.coverage-kicker{font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:var(--purple-dark);margin-bottom:14px;opacity:.95}.coverage-title{font-size:var(--mk-section-h2);font-weight:500;line-height:1.12;letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);max-width:38ch;margin-bottom:12px;text-wrap:normal}.coverage-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.coverage-lead{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:40ch;font-weight:400}.coverage-rows{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--border)}.coverage-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;align-items:stretch;min-height:300px}.coverage-row-reverse .coverage-copy{order:2}.coverage-row-reverse .coverage-visual{order:1}.coverage-copy{background:transparent;min-width:0;padding:40px 36px;display:flex;align-items:center;justify-content:center}.coverage-copy-inner{width:100%;max-width:36ch}.coverage-item-kicker{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--cov-accent);margin-bottom:14px}.coverage-copy h3{font-size:clamp(1.35rem,2.4vw,1.75rem);font-weight:500;line-height:1.18;letter-spacing:-.4px;color:var(--text-dark);margin-bottom:14px;max-width:22ch}.coverage-copy p{font-size:15px;color:var(--text-desc);line-height:1.65;margin-bottom:16px;font-weight:400;max-width:38ch}.coverage-link{font-size:15px;font-weight:500;color:var(--purple-dark);text-decoration:none;transition:color .18s ease}.coverage-link:hover{color:var(--purple)}.coverage-visual{position:relative;width:100%;min-width:0;min-height:300px;display:flex;align-items:center;justify-content:center;padding:36px 28px}.coverage-visual-peach{background:var(--cov-peach)}.coverage-visual-sage{background:var(--cov-sage)}.coverage-visual-sand{background:var(--cov-sand)}.coverage-visual-num{position:absolute;top:clamp(12px,2vw,20px);right:clamp(16px,3vw,28px);font-size:clamp(3.5rem,8vw,5.5rem);font-weight:500;line-height:1;color:rgba(17,24,39,.06);letter-spacing:-.05em;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums}.coverage-panel{position:relative;z-index:1;width:min(100%,260px);background:#fff;border-radius:16px;padding:16px 16px 14px;box-shadow:var(--home-shadow-soft);border:1px solid var(--border)}.coverage-panel-title{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px}.coverage-call-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9}.coverage-call-row:last-child{border-bottom:none;padding-bottom:0}.coverage-call-row:first-child{padding-top:0}.coverage-call-ico{width:28px;height:28px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#64748b;flex-shrink:0}.coverage-call-ico .home-line-icon{width:14px;height:14px}.coverage-call-main{flex:1;min-width:0}.coverage-call-label{font-size:13px;font-weight:500;color:var(--text-dark);line-height:1.3}.coverage-call-time{font-size:12px;color:var(--text-desc);line-height:1.35}.coverage-badge{font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:4px 7px;border-radius:999px;white-space:nowrap;flex-shrink:0}.coverage-badge-answered{color:#047857;background:#ecfdf5}.coverage-badge-missed{color:#B45309;background:#fffbeb}.coverage-badge-ready{color:#1d4ed8;background:#eff6ff}.coverage-badge-delivered{color:#047857;background:#ecfdf5}.coverage-status-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12px}.coverage-status-row:last-child{border-bottom:none}.coverage-status-label{color:var(--text-desc);font-weight:400}.coverage-status-value{color:var(--text-dark);font-weight:500;text-align:right}.coverage-status-highlight .coverage-status-value{color:#047857}.coverage-msg-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9}.coverage-msg-row:last-child{border-bottom:none}.coverage-msg-text{font-size:12px;color:var(--text-desc);line-height:1.45;flex:1;min-width:0}.coverage-msg-text strong{color:var(--text-dark);font-weight:500}.feat-ico{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--purple-dark);border:1px solid rgba(196,181,253,.35);background:linear-gradient(180deg,#fff,#faf9ff)}.feat-ico .home-line-icon{flex-shrink:0}.fi-p{color:var(--purple-dark);background:linear-gradient(180deg,#faf9ff,#f5f3ff);border-color:rgba(196,181,253,.35)}.deep-section{padding:72px 48px 0}.deep-section-confirmation{padding:24px 48px 0}.deep-wrap{padding:0 48px;max-width:1200px;margin:0 auto}.deep-wrap-flush{padding:0}.deep-s1{padding:36px 0 24px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}.deep-s1 .d-text h2{font-size:clamp(20px,2vw,27px);font-weight:500;line-height:1.2;letter-spacing:-.6px;margin-bottom:10px;color:var(--text-dark)}.deep-s1 .d-text p{font-size:var(--mk-body);color:var(--text-desc);line-height:1.68;margin-bottom:16px;font-weight:400}.deep-s2-outer .d-text h2{font-size:clamp(20px,2vw,27px);font-weight:500;line-height:1.2;letter-spacing:-.6px;margin-bottom:16px;color:var(--text-dark)}.deep-s2-outer .d-text p{font-size:var(--mk-body-md);color:var(--text-desc);line-height:1.68;margin-bottom:24px;font-weight:400}.checklist{list-style:none;display:flex;flex-direction:column;gap:11px;margin-bottom:28px}.checklist li{display:flex;align-items:flex-start;gap:11px;font-size:var(--mk-body);font-weight:500;color:var(--text-dark)}.chart-wrap{background:#fff;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--home-shadow-soft);border:1px solid var(--border)}.chart-inner{padding:24px 28px 0}.chart-tiny-label{font-size:13px;color:var(--text-desc);font-weight:500;margin-bottom:2px}.chart-big-row{display:flex;align-items:baseline;gap:12px;margin-bottom:20px}.chart-big{font-size:34px;font-weight:500;letter-spacing:-.8px;color:var(--text-dark)}.chart-badge{background:var(--purple-ultra);color:var(--purple-dark);font-size:var(--mk-badge);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 12px;border-radius:var(--r-pill);border:1px solid rgba(196,181,253,.4)}.linechart-svg-wrap{position:relative;height:140px;margin:0 -1px}.linechart-svg-wrap svg{width:100%;height:100%}.x-labels{display:flex;justify-content:space-between;padding:10px 28px 20px;font-size:13px;color:#94A3B8;font-weight:500}.x-label-active{font-weight:600;color:var(--text-dark)}.deep-s2-outer{background:linear-gradient(180deg,#ecfdf5 0%,#f0fdf9 45%,#fff 100%);border:1px solid rgba(167,243,208,.55);border-radius:var(--r-lg);padding:52px 48px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;box-shadow:var(--home-shadow-soft)}.convo-card{background:#fff;border-radius:var(--r-lg);padding:26px 26px 30px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft);position:relative}.convo-avatars{display:flex;margin-bottom:20px}.convo-avatar{width:38px;height:38px;border-radius:50%;border:2.5px solid #fff;margin-right:-10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;color:#fff}.convo-avatar:nth-child(1){background:linear-gradient(135deg,#C4B5FD,#93C5FD)}.convo-avatar:nth-child(2){background:linear-gradient(135deg,#FCA5A5,#FCD34D)}.convo-avatar:nth-child(3){background:linear-gradient(135deg,#6EE7B7,#60A5FA)}.convo-quote{font-size:20px;font-weight:500;color:var(--text-dark);line-height:1.3;margin-bottom:18px;letter-spacing:-.35px}.convo-wave{height:50px;width:100%;opacity:.15}.convo-wave path{fill:none;stroke:var(--text-dark);stroke-width:1.5px}.industries .metrics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 16px}.industries .metrics-cell{padding:8px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;border:0;border-radius:0}.metrics-cell{padding:8px 12px;display:flex;flex-direction:column;align-items:center;text-align:center}.metrics-value{font-size:34px;font-weight:500;letter-spacing:-.8px;color:var(--text-dark);line-height:1.1;margin:0 0 8px}.metrics-label{font-size:15px;font-weight:500;color:var(--text-dark);line-height:1.35;margin-bottom:6px}.metrics-sublabel{font-size:13px;color:var(--text-desc);line-height:1.5;font-weight:400;margin:0}@media(max-width:767px){.industries .metrics-grid{display:flex;flex-direction:column;gap:0;width:100%;max-width:none;margin-top:40px;border:1px solid var(--border);border-radius:20px;background:#fff;overflow:hidden;box-shadow:var(--home-shadow-soft)}.industries .metrics-cell{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;gap:2px 16px;width:100%;padding:18px 20px;text-align:left;background:transparent;border-radius:0;border:none;border-bottom:1px solid var(--border)}.industries .metrics-cell:last-child{border-bottom:none}.metrics-cell{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;gap:2px 16px;width:100%;padding:18px 20px;text-align:left;border-bottom:1px solid var(--border)}.metrics-cell:last-child{border-bottom:none}.metrics-value{grid-column:2;grid-row:1/-1;align-self:center;font-size:36px;font-weight:500;letter-spacing:-.6px;margin:0}.metrics-label{grid-column:1;grid-row:1;font-size:14px;font-weight:500;color:var(--text-desc);margin:0;line-height:1.35}.metrics-sublabel{grid-column:1;grid-row:2;font-size:12px;color:var(--text-light,#94a3b8);line-height:1.45;margin:0}.legacy-marketing .industries .metrics-label{font-size:14px !important}.legacy-marketing .industries .metrics-sublabel{font-size:12px !important}.legacy-marketing .industries .metrics-value{font-size:36px !important}}.summary-board{margin:48px auto 0;max-width:960px;border-radius:24px;border:1px solid var(--border);background:linear-gradient(180deg,#fffdf9 0%,#fffaf5 100%);box-shadow:var(--home-shadow-soft);padding:0;overflow:hidden}.summary-board-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid rgba(226,214,203,.8);margin-bottom:18px}.summary-board-title{font-size:24px;font-weight:500;letter-spacing:-.45px;line-height:1.2;color:var(--text-dark)}.summary-badge{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:#e9fbf4;color:#0f8f68;border:1px solid rgba(16,185,129,.16);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.summary-list{display:flex;flex-direction:column;gap:12px}.summary-row{display:grid;grid-template-columns:auto 1fr auto auto;gap:14px;align-items:center;padding:16px 14px;border-radius:16px;border:1px solid var(--border);background:#fff}.summary-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#f6d9e2,#f7ece8);color:#9b5f8b;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0}.summary-main{min-width:0}.summary-name{font-size:14px;font-weight:600;color:var(--text-dark);line-height:1.25;margin-bottom:3px}.summary-copy{font-size:13px;color:var(--text-light);line-height:1.45}.summary-tag{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}.summary-tag.booking{background:#e9fbf4;color:#0f8f68}.summary-tag.reschedule{background:#fff4db;color:#b77710}.summary-tag.cancel{background:#fde8e8;color:#cc4b4b}.summary-tag.inquiry{background:#e8f7fb;color:#117aa0}.summary-time{font-size:12px;color:var(--text-light);white-space:nowrap}.pricing{padding:88px 48px 72px;background:var(--bg-gray);color:var(--text-dark)}.pricing-inner{max-width:1100px;margin:0 auto}.pricing-intro{margin-bottom:8px}.pricing-intro .sec-label,.pricing-intro .pricing-title,.pricing-intro .pricing-lead{text-align:center;margin-left:auto;margin-right:auto}.pricing-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);max-width:18ch;margin-bottom:14px;text-wrap:balance}.pricing-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.pricing-lead{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:44ch;font-weight:400;margin-bottom:32px}.price-toggle{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:40px}.pt-btn{padding:10px 22px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:inherit}.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 4px 14px rgba(124,58,237,.25)}.pt-btn:not(.on){background:transparent;color:var(--text-desc)}.save-badge{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#16a34a;background:none;border:none;padding:0;white-space:nowrap;max-width:0;opacity:0;transform:translateX(-8px);overflow:hidden;margin-left:0;pointer-events:none;transition:opacity .22s ease,transform .22s ease,max-width .28s ease,margin-left .22s ease}.save-badge.is-visible{max-width:200px;opacity:1;transform:translateX(0);margin-left:6px;pointer-events:auto}.save-dot{width:6px;height:6px;border-radius:50%;background:#16a34a;flex-shrink:0}@media(prefers-reduced-motion:reduce){.save-badge{transition:none}.save-badge:not(.is-visible){display:none}.save-badge.is-visible{display:inline-flex}}.price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}.plan{background:#fff;border-radius:var(--r-lg);padding:28px 22px 24px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;transition:transform .2s,box-shadow .2s,border-color .2s;box-shadow:var(--home-shadow-soft)}.plan:hover{transform:translateY(-1px);box-shadow:var(--home-shadow-hover);border-color:var(--home-card-border-hover)}.plan.star{padding-top:44px;background:linear-gradient(180deg,#faf9ff 0%,#fff 85%);border-color:rgba(167,139,250,.55);box-shadow:var(--home-shadow-soft)}.plan.star:hover{border-color:rgba(167,139,250,.65);box-shadow:var(--home-shadow-hover)}.plan-badge{position:absolute;top:18px;right:18px;left:auto;transform:none;background:var(--purple);color:#fff;font-size:var(--mk-badge);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 12px;border-radius:var(--r-pill);white-space:nowrap;box-shadow:0 4px 12px rgba(124,58,237,.2)}.plan-name{font-size:var(--mk-card-title);font-weight:600;margin-bottom:8px;color:var(--text-dark)}.plan-desc{font-size:var(--mk-caption);color:var(--text-desc);margin-bottom:16px;line-height:1.55;font-weight:400}.plan-price{font-size:38px;font-weight:500;letter-spacing:-1.5px;margin-bottom:5px;color:var(--text-dark)}.plan-price-custom{font-size:var(--mk-card-title);font-weight:600;letter-spacing:-.2px;line-height:1.35;color:var(--text-dark)}.plan-price .plan-price-period{font-size:var(--mk-body);font-weight:500;color:var(--text-gray);letter-spacing:0}.plan-price .plan-price-billed{display:block;font-size:13px;font-weight:500;color:var(--text-desc);letter-spacing:0;line-height:1.45;margin-top:4px}.plan-cta-subnote{font-size:12px;color:var(--text-desc);text-align:center;margin:8px 0 0;font-weight:400;line-height:1.45}.plan-div{height:1px;background:var(--border);margin:18px 0 20px}.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px;flex:1}.plan-feats li{display:flex;align-items:flex-start;gap:10px;font-size:var(--mk-caption);color:#475569;line-height:1.45;font-weight:400}.price-grid .plan-feats li::before{content:"";width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#C4B5FD,#A78BFA);margin-top:6px;flex-shrink:0;box-shadow:0 0 0 1px rgba(139,92,246,.2)}.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto;text-decoration:none}.pb-outline{background:transparent;border:1px solid var(--border);color:var(--text-dark)}.pb-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.4)}.pb-dark{background:var(--text-dark);color:#fff}.pb-dark:hover{background:#1f2937;transform:translateY(-1px)}.pricing-foot{margin-top:28px;font-size:13px;line-height:1.6;color:var(--text-desc);text-align:center;font-weight:400}.steps-section{padding:88px 48px;background:linear-gradient(180deg,#fff 0%,#fcfbff 100%)}.steps-inner{max-width:1100px;margin:0 auto}.steps-intro{margin-bottom:44px}.steps-intro .sec-label,.steps-intro .steps-title,.steps-intro .steps-copy{text-align:left;margin-left:0;margin-right:0}.steps-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);max-width:20ch;margin-bottom:14px;text-wrap:balance}.steps-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.steps-copy{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:44ch;font-weight:400}.steps-shell{position:relative;--step-marker-size:50px}.steps-rail{position:absolute;left:16.666%;right:16.666%;top:calc(var(--step-marker-size)/2);height:0;z-index:0;border-top:1px dashed #d1d5db}.steps-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;position:relative}.step-card{position:relative;background:transparent;border:none;border-radius:0;padding:0;text-align:center;box-shadow:none}.step-marker{width:var(--step-marker-size);height:var(--step-marker-size);border-radius:999px;border:1.5px solid var(--purple);background:#fff;color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:500;margin:0 auto 22px;position:relative;z-index:1}.step-card h3{font-size:var(--mk-card-title);font-weight:500;letter-spacing:-.2px;line-height:1.35;margin-bottom:10px;color:var(--text-dark);max-width:280px;margin-left:auto;margin-right:auto}.step-card p{font-size:var(--mk-body);color:var(--text-desc);line-height:var(--mk-body-lh);max-width:300px;margin:0 auto;font-weight:400}.industries{padding:88px 48px;background:linear-gradient(180deg,#F9FAFB 0%,#fff 100%)}.industries-inner{max-width:1100px;margin:0 auto}.industries-intro{margin-bottom:8px}.industries-intro .sec-label,.industries-intro .industries-title,.industries-intro .industries-lead{text-align:left;margin-left:0;margin-right:0}.industries-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);max-width:22ch;margin-bottom:14px;text-wrap:balance}.industries-title em{font-style:italic;font-weight:500;color:var(--purple-dark)}.industries-lead{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:44ch;font-weight:400}.industries-tabs-wrap{margin-top:36px}.industries-tabs{display:flex;flex-wrap:wrap;gap:8px}.industries-tab-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:0;padding:10px 16px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--text-gray);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;font-family:inherit;transition:all .2s ease}.industries-tab-btn svg{width:18px;height:18px;flex-shrink:0}.industries-tab-btn.is-active{background:var(--purple);border-color:var(--purple);color:#fff}.industries-tab-btn:not(.is-active):hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.5)}.industries-panel{margin-top:20px;border-radius:24px;border:1px solid var(--border);background:#fff;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);box-shadow:var(--home-shadow-soft)}.industries-panel-copy{padding:32px 28px;display:flex;flex-direction:column;justify-content:center;min-width:0}.industries-panel-eyebrow{font-size:var(--mk-eyebrow);font-weight:600;color:var(--purple-dark);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:14px;opacity:.95}.industries-panel h3{font-size:20px;font-weight:600;letter-spacing:-.45px;color:var(--text-dark);margin:0 0 14px;line-height:1.25}.industries-panel-desc{font-size:var(--mk-body);color:var(--text-desc);line-height:var(--mk-body-lh);font-weight:400;margin:0 0 18px}.industries-panel-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}.industries-panel-chip{display:inline-flex;align-items:center;background:var(--ind-accent-nail);color:var(--purple-dark);font-size:var(--mk-badge);font-weight:600;letter-spacing:.02em;padding:6px 12px;border-radius:var(--r-pill);border:1px solid rgba(196,181,253,.4)}.industries-panel-cta{align-self:flex-start;margin:0}.industries-panel-visual{position:relative;min-height:340px;overflow:hidden}.industries-panel-visual[data-vertical="nail-salon"]{background:var(--ind-accent-nail)}.industries-panel-visual[data-vertical="hair-salon"]{background:var(--ind-accent-hair)}.industries-panel-visual[data-vertical="day-spa"]{background:var(--ind-accent-day-spa)}.industries-panel-visual[data-vertical="med-spa"]{background:var(--ind-accent-med-spa)}.industries-panel-visual[data-vertical="beauty-clinic"]{background:var(--ind-accent-beauty-clinic)}.industries-panel-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.industries .metrics-grid{margin-top:48px}.home-carousel{position:relative}.home-carousel-controls{display:none;align-items:center;justify-content:center;gap:12px;margin-top:18px}.home-carousel-nav-btn{width:36px;height:36px;border-radius:999px;border:1px solid #ddd6fe;background:#fff;color:#6d28d9;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:500;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.10)}.home-carousel-nav-btn:hover{background:#f5f3ff}.home-carousel-nav-btn[hidden]{display:none}.home-carousel-dots{display:flex;justify-content:center;gap:8px}.home-carousel-dot{width:10px;height:10px;border-radius:999px;background:#d1d5db;border:none;cursor:pointer;transition:all .2s ease}.home-carousel-dot.active{width:26px;background:#8b5cf6}.flow-section{padding:20px 48px 72px;background:#fff}.flow-inner{max-width:1100px;margin:0 auto;background:linear-gradient(135deg,#fdfcff,#fff);border:1px solid var(--border);border-radius:28px;padding:32px 28px;box-shadow:var(--home-shadow-soft)}.flow-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;align-items:stretch}.flow-list{display:flex;flex-direction:column;gap:14px}.flow-row{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:18px;background:#fff;border:1px solid var(--border);box-shadow:0 1px 3px rgba(17,24,39,.04)}.flow-dot{width:34px;height:34px;min-width:34px;border-radius:12px;background:var(--purple-ultra);color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;border:1px solid rgba(196,181,253,.35)}.flow-row h4{font-size:15px;margin-bottom:4px;font-weight:600;color:var(--text-dark)}.flow-row p{font-size:14px;color:var(--text-desc);line-height:1.62;font-weight:400}.demo-shot{border-radius:24px;border:1px dashed rgba(196,181,253,.55);background:linear-gradient(135deg,#faf9ff,#fff);min-height:420px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.demo-shot::before{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(139,92,246,.08)}.demo-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(196,181,253,.4);border-radius:999px;padding:7px 12px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--purple-dark);width:fit-content;position:relative;z-index:1}.demo-window{background:#fff;border-radius:22px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft);padding:18px;position:relative;z-index:1}.demo-window h4{font-size:16px;margin-bottom:10px}.demo-window p{font-size:14px;color:var(--text-gray);line-height:1.65}.demo-lines{display:flex;flex-direction:column;gap:10px;margin-top:18px}.demo-line{height:12px;border-radius:999px;background:linear-gradient(90deg,#ede9fe,#f5f3ff)}.demo-line.sm{width:42%}.demo-line.md{width:68%}.demo-line.lg{width:88%}.demo-note{font-size:14px;color:var(--text-light);font-weight:600;letter-spacing:.03em;position:relative;z-index:1}.scope-section{padding:0 48px 72px;background:#fff}.scope-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:18px}.scope-card{border-radius:24px;padding:26px 24px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft)}.scope-card h3{font-size:20px;font-weight:600;letter-spacing:-.45px;margin-bottom:8px;color:var(--text-dark)}.scope-card p{font-size:var(--mk-body);color:var(--text-desc);line-height:1.68;margin-bottom:18px;font-weight:400}.scope-card.ok{background:linear-gradient(180deg,#f7f2ff 0%,#fff 100%)}.scope-card.later{background:linear-gradient(180deg,#fff9ef 0%,#fff 100%)}.scope-list{list-style:none;display:flex;flex-direction:column;gap:10px}.scope-list li{display:flex;gap:10px;align-items:flex-start;font-size:var(--mk-body);line-height:1.6}.scope-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;flex-shrink:0;margin-top:1px}.scope-icon.ok{background:#ede9fe;color:var(--purple-dark)}.scope-icon.later{background:#fff7ed;color:#c2410c}.user-preview{padding:72px 48px;background:var(--bg-gray)}.user-preview-inner{max-width:1100px;margin:0 auto}.user-grid{display:grid;grid-template-columns:.95fr 1.05fr;gap:24px;align-items:center}.user-copy .sec-label{text-align:left;margin-bottom:16px}.user-copy h2{text-align:left;font-size:clamp(28px,3.6vw,44px);font-weight:500;line-height:1.12;letter-spacing:-1.1px;margin-bottom:14px;color:var(--text-dark)}.user-copy p{font-size:var(--mk-body-md);color:var(--text-desc);line-height:1.72;margin-bottom:24px;text-align:left;font-weight:400}.user-shot{border-radius:28px;background:linear-gradient(180deg,#ffffff,#f8fafc);padding:14px;box-shadow:var(--home-shadow-soft);border:1px solid var(--border)}.user-shell{position:relative;background:linear-gradient(135deg,#f7f2ff 0%,#ffffff 55%,#f5f3ff 100%);border-radius:22px;overflow:hidden;aspect-ratio:16/9;min-height:auto;border:1px solid #E5E7EB;display:block}.user-brand .mini-logo{position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center}.user-brand .mini-logo:before,.user-brand .mini-logo:after{content:"";position:absolute;border-radius:50%;background:#8B5CF6}.user-brand .mini-logo:before{width:30px;height:30px;opacity:.12}.user-brand .mini-logo:after{width:22px;height:22px;opacity:.2}.user-brand .mini-core{width:16px;height:16px;border-radius:50%;background:#8B5CF6;position:relative;z-index:1}.user-nav div{padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #E5E7EB;font-size:12.5px;font-weight:600;color:#6B7280}.user-nav div.active{background:#ede9fe;color:#7C3AED;border-color:#ddd6fe}.user-stat strong{display:block;font-size:22px;letter-spacing:-.8px;margin-bottom:4px}.user-stat span{font-size:14px;color:#6B7280}.user-preview-img{width:100%;height:100%;display:block;object-fit:cover;border-radius:22px}.user-table-row:last-child{border-bottom:none}@media(max-width:960px){.steps-grid,.flow-grid,.scope-inner,.user-grid{grid-template-columns:1fr}.steps-section{padding-top:72px;padding-bottom:72px}.steps-intro{margin-bottom:34px}.steps-title{font-size:34px;letter-spacing:var(--mk-section-h2-track)}.steps-copy{font-size:var(--mk-section-lead)}.steps-shell{padding-top:0}.steps-rail{display:none}.step-marker{margin-bottom:18px}.step-card h3{font-size:var(--mk-card-title)}.step-card p{max-width:100%}.summary-board{margin-top:34px;padding:0}.summary-board-head{align-items:flex-start;flex-direction:column}.summary-board-title{font-size:22px}.summary-row{grid-template-columns:auto 1fr;gap:10px}.summary-tag,.summary-time{grid-column:2}.summary-tag{justify-self:start}.summary-time{margin-top:-4px}.user-shell{aspect-ratio:16/10}.steps-section,.flow-section,.scope-section,.user-preview,.industries{padding-left:22px;padding-right:22px}.industries-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding:4px 2px 8px}.industries-tabs::-webkit-scrollbar{display:none}.industries-tab-btn{flex:0 0 auto;font-size:12px;padding:8px 12px}.industries-panel{grid-template-columns:1fr}.industries-panel-copy{padding:24px 20px}.industries-panel-visual{min-height:260px}.home-carousel-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth;padding:6px 2px 10px}.home-carousel-track::-webkit-scrollbar{display:none}.home-carousel-slide{scroll-snap-align:start}.home-carousel-controls{display:flex}.home-carousel-track .plan{margin:0;box-sizing:border-box;transform:none;flex:0 0 calc((100% - 16px) / 2);height:auto}.home-carousel-track .plan:hover{transform:none}}@media(max-width:640px){.summary-row{padding:14px 12px}.home-carousel-track .plan{flex-basis:100%}.home-carousel-controls{justify-content:center}}.user-image-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center}.user-image-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(139,92,246,.20);border-radius:999px;padding:8px 12px;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--purple-dark);margin-bottom:16px;box-shadow:var(--home-shadow-soft)}.user-image-icon{width:74px;height:74px;border-radius:22px;background:linear-gradient(135deg,#ede9fe,#f5f3ff);border:1px solid #ddd6fe;display:flex;align-items:center;justify-content:center;color:var(--purple-dark);font-size:30px;font-weight:600;margin-bottom:16px}.user-image-title{font-size:20px;font-weight:600;letter-spacing:-.5px;margin-bottom:8px}.user-image-copy{max-width:420px;font-size:var(--mk-body);color:var(--text-gray);line-height:1.7}.user-image-corners::before,.user-image-corners::after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(139,92,246,.08);filter:blur(4px)}.user-image-corners::before{top:-36px;right:-36px}.user-image-corners::after{bottom:-42px;left:-42px}.cta-outer{padding:0 48px 72px;display:flex;justify-content:center}.cta-inner{width:100%;max-width:1100px}.cta-banner{position:relative;overflow:hidden;border-radius:var(--r-lg);background:#0d0d0d;border:none;padding:clamp(48px,6vw,72px) clamp(28px,5vw,56px);display:flex;justify-content:center;align-items:center;text-align:center;box-shadow:none}.cta-banner::before{content:"";position:absolute;right:-30px;top:-40px;width:280px;height:280px;background:rgba(255,255,255,.07);border-radius:50%;pointer-events:none}.cta-stack{position:relative;z-index:1;max-width:720px;width:100%}.cta-title{font-size:clamp(1.75rem,3.2vw,2.5rem);font-weight:500;color:#fff;letter-spacing:-.03em;line-height:1.15;margin-bottom:16px;text-wrap:balance}.cta-title em{font-style:italic;font-weight:500;color:#EDE9FE}.cta-lead{font-size:15px;color:rgba(255,255,255,.78);line-height:1.65;margin:0 auto 28px;max-width:52ch;font-weight:400}.cta-row{display:flex;align-items:center;justify-content:center;gap:20px 28px;flex-wrap:wrap;margin-bottom:18px}.cta-banner .btn-hero-live{background:#7C3AED;color:#fff;padding:15px 32px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;box-shadow:none;transition:transform .15s,background .2s}.cta-banner .btn-hero-live:hover{background:#6D28D9;transform:translateY(-1px);box-shadow:none}.cta-banner .btn-hero-live svg{width:16px;height:16px;flex-shrink:0}.cta-banner .btn-hero-live .btn-hero-live-phone{width:18px;height:18px}.cta-banner .btn-hero-live .btn-hero-live-phone path{fill:#FACC15}.cta-banner .btn-hero-live .btn-hero-live-arrow{color:#fff}.cta-banner .btn-outline.btn-hero-trial{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);box-shadow:none;text-decoration:none;transition:background .2s,border-color .2s,color .2s,transform .15s}.cta-banner .btn-outline.btn-hero-trial:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.5);color:#fff;transform:translateY(-1px);box-shadow:none}footer{background:var(--bg-gray);border-top:1px solid var(--border);padding:60px 48px 32px}.footer-inner{max-width:1100px;margin:0 auto}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:50px}.footer-brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px;margin-bottom:14px}.footer-desc{font-size:13.5px;color:var(--text-gray);line-height:1.65;margin-bottom:20px}.footer-social{display:flex;gap:10px}.soc-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;text-decoration:none}.soc-btn:hover{border-color:var(--purple);background:var(--purple-ultra)}.soc-btn svg{width:14px;height:14px;fill:var(--text-gray)}.soc-btn:hover svg{fill:var(--purple)}.footer-col h4{font-size:11.5px;font-weight:500;color:var(--text-dark);text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px}.footer-col a{display:block;font-size:13.5px;color:var(--text-gray);text-decoration:none;margin-bottom:10px;transition:color .2s}.footer-col a:hover{color:var(--text-dark)}.footer-bottom{border-top:1px solid var(--border);padding-top:22px;display:flex;justify-content:space-between;align-items:center}.footer-bottom p{font-size:14px;color:var(--text-light)}.rv{transition:opacity .85s ease,transform .85s ease}.rv.hidden{opacity:0;transform:translateY(22px)}.rv.show{opacity:1;transform:translateY(0)}.rv.d1{transition-delay:.1s}.rv.d2{transition-delay:.2s}.rv.d3{transition-delay:.3s}.rv.d4{transition-delay:.4s}.reveal{opacity:1;transform:none}.reveal.vis{opacity:1;transform:none}@media(max-width:960px){.leak-body{grid-template-columns:1fr;gap:48px;align-items:start}.leak-item{padding:22px 0;gap:18px}.leak-card.leak-revenue{height:auto}.leak-revenue{max-width:520px}.leak-card.leak-revenue{padding:32px 26px 28px}.coverage-row,.coverage-row-reverse{grid-template-columns:1fr;min-height:0}.coverage-row-reverse .coverage-copy,.coverage-row-reverse .coverage-visual{order:unset}.coverage-copy{padding:40px 28px}.coverage-visual{min-height:280px;padding:36px 24px}.coverage-panel{width:min(100%,320px)}.compare-board{grid-template-columns:1fr}.compare-col-bad{border-right:none;border-bottom:1px solid rgba(241,245,249,.95)}.deep-s1,.deep-s2-outer,.price-grid,.footer-grid{grid-template-columns:1fr}.cta-banner{padding:40px 24px}.cta-row{flex-direction:column;align-items:stretch;gap:14px}.cta-banner .btn-hero-live,.cta-banner .btn-outline.btn-hero-trial{justify-content:center;width:100%}footer,.hero,.leak-section,.compare-section,.features,.trusted,.pricing,.mfaq-section,.cta-outer,.deep-section,.deep-section-confirmation{padding-left:22px;padding-right:22px}.industry-tag{backdrop-filter:none}.hero-blob,.vc-glow,.user-image-corners::before,.user-image-corners::after{display:none}.pulse-dot,.vc-wave span,.vc-wave.vc-wave-active span{animation:none}.hero-inner{grid-template-columns:1fr;gap:28px;text-align:left}.hero-copy{text-align:left}h1.hero-h,.hero-sub{text-align:left}.hero-sub{margin-left:0;margin-right:0}.hero-btns{justify-content:flex-start}.hero-stats-block{margin-top:4px}.hero-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-stat{border-bottom:1px solid var(--border)}.hero-stat:nth-child(2n){border-right:none}.hero-stat:nth-last-child(-n+2){border-bottom:none}.hero-stat{text-align:center}.hero-visual{height:440px;padding-top:16px;margin-top:8px}.phone-frame{width:228px;height:426px}.phone-frame:not(.iph-shell){border-radius:40px;padding:10px}.phone-screen:not(.iph-shell){border-radius:32px}.deep-s2-outer{padding:36px 22px 40px;gap:32px}.deep-s2-outer .d-text h2{font-size:clamp(19px,4.8vw,24px);line-height:1.2;margin-bottom:14px}.deep-s2-outer .d-text p{font-size:15px;line-height:1.72}.deep-s2-outer .checklist li{font-size:14px}.deep-s2-outer .convo-card{padding:22px 20px 26px}.deep-s2-outer .convo-quote{font-size:clamp(18px,4.5vw,21px)}.deep-s1 .d-text{padding-left:28px;padding-right:28px}}@media(max-width:640px){.hero{min-height:auto;padding-top:96px;padding-bottom:36px}.hero-visual{height:400px;padding-top:12px;margin-top:34px}.phone-frame{width:214px;height:400px}.phone-frame:not(.iph-shell){border-radius:38px;padding:9px;box-shadow:0 26px 48px rgba(0,0,0,.2)}.phone-screen:not(.iph-shell){border-radius:30px}.pricing .plan{box-shadow:0 1px 2px rgba(17,24,39,.04)}.pricing .plan:hover{transform:none;box-shadow:0 1px 2px rgba(17,24,39,.04)}.pricing .plan.star,.pricing .plan.star:hover{box-shadow:0 0 0 1px rgba(139,92,246,.08)}h1.hero-h{font-size:clamp(36px,7.2vw,58px);letter-spacing:-2px;line-height:1.12}.hero-sub{margin-bottom:26px}.hero-btns{flex-direction:column;align-items:stretch;gap:10px}.hero-btns .btn-hero-live,.hero-btns .btn-hero-trial{width:100%;justify-content:center}.features,.compare-section,.pricing{padding-top:var(--mk-space-section-y-mobile);padding-bottom:64px}.steps-section,.industries{padding-top:var(--mk-space-section-y-mobile);padding-bottom:64px}.sec-sub{margin-bottom:32px}.steps-intro{margin-bottom:28px}.steps-grid{gap:24px}.cta-title{font-size:clamp(1.5rem,6vw,2rem)}.deep-s2-outer{padding:28px 18px 32px;gap:26px}}.legacy-marketing>nav,.legacy-marketing>footer,.legacy-marketing>.topbar{display:none !important}.legacy-marketing .trusted-label,.legacy-marketing .sec-label,.legacy-marketing .coverage-copy p,.legacy-marketing .checklist li,.legacy-marketing .industries .metrics-sublabel,.legacy-marketing .plan-desc,.legacy-marketing .plan-feats li,.legacy-marketing .save-badge,.legacy-marketing .industry-tag,.legacy-marketing .industry-sub,.legacy-marketing .industry-link,.legacy-marketing .step-num,.legacy-marketing .step-card p,.legacy-marketing .demo-badge,.legacy-marketing .scope-card p,.legacy-marketing .scope-list li,.legacy-marketing .user-nav div,.legacy-marketing .user-image-badge,.legacy-marketing .user-image-copy,.legacy-marketing .footer-col h4,.legacy-marketing .footer-desc,.legacy-marketing .footer-col a{font-size:14px !important}@media(max-width:768px){.legacy-marketing .save-badge.is-visible{font-size:13px !important;line-height:1.2;letter-spacing:normal}}`,
  IPHONE_CALL_MOCKUP_CSS,
];

const scripts: string[] = [
  String.raw`
// Pricing toggle
function setPrice(m) {
  const mo = m === 'monthly'
  const monthlyToggle = document.getElementById('tog-m')
  const annualToggle = document.getElementById('tog-a')
  const starterPrice = document.getElementById('ps')
  const proPrice = document.getElementById('pp')
  if (!monthlyToggle || !annualToggle || !starterPrice || !proPrice) return
  monthlyToggle.classList.toggle('on', mo)
  annualToggle.classList.toggle('on', !mo)
  const saveBadge = document.getElementById('home-pt-save-badge')
  if (saveBadge) saveBadge.classList.toggle('is-visible', !mo)
  starterPrice.innerHTML = mo
    ? '$79<span class="plan-price-period">/mo</span>'
    : '$63<span class="plan-price-period">/mo</span><span class="plan-price-billed">Billed $758/year</span>'
  proPrice.innerHTML = mo
    ? '$149<span class="plan-price-period">/mo</span>'
    : '$119<span class="plan-price-period">/mo</span><span class="plan-price-billed">Billed $1,428/year</span>'
}
window.__ringbookerSetPrice = setPrice

// Voice call timer
let secs = 24
let timerId = null
const updateVoiceTimer = () => {
  secs++
  const m = String(Math.floor(secs/60)).padStart(2,'0')
  const s = String(secs%60).padStart(2,'0')
  const el = document.getElementById('vc-timer')
  if(el) el.textContent = m + ':' + s
}
const startVoiceTimer = () => {
  if (timerId || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timerId = window.setInterval(updateVoiceTimer, 1000)
}
const stopVoiceTimer = () => {
  if (!timerId) return
  window.clearInterval(timerId)
  timerId = null
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopVoiceTimer()
  else startVoiceTimer()
})
startVoiceTimer()

// Waveform trigger
const wfEl = document.getElementById('wfbig')
if(wfEl && 'IntersectionObserver' in window) {
  const wfObs = new IntersectionObserver(es => {
    es.forEach(e => { if(e.isIntersecting) wfEl.classList.add('playing') })
  }, { threshold:.4 })
  wfObs.observe(wfEl)
}

`,
  String.raw`
const setPriceSafe = (mode) => {
  const fn = window.__ringbookerSetPrice
  if (typeof fn === 'function') fn(mode)
}
document.getElementById('tog-m')?.addEventListener('click', () => setPriceSafe('monthly'))
document.getElementById('tog-a')?.addEventListener('click', () => setPriceSafe('annual'))
document.addEventListener('click', (event) => {
  const target = event.target && event.target.closest ? event.target.closest('#tog-m,#tog-a') : null
  if (!target) return
  event.preventDefault()
  setPriceSafe(target.id === 'tog-a' ? 'annual' : 'monthly')
})
setPriceSafe('monthly')
`,
  String.raw`
(() => {
  try {
    const initCarousel = ({
      rootId,
      trackSelector,
      cardSelector,
      prevId,
      nextId,
      dotsId,
      dotClassName,
    }) => {
      const root = document.getElementById(rootId)
      if (!root) return
      const track = root.querySelector(trackSelector)
      const cards = Array.from(root.querySelectorAll(cardSelector))
      const prevBtn = document.getElementById(prevId)
      const nextBtn = document.getElementById(nextId)
      const dotsHost = document.getElementById(dotsId)
      if (!track || !cards.length || !dotsHost) return

      let dots = []
      let active = 0

      const cardStep = () => {
        const style = window.getComputedStyle(track)
        const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0
        return cards[0].getBoundingClientRect().width + gap
      }

      const maxIndex = () => {
        const step = cardStep()
        if (!step) return 0
        const scrollable = Math.max(0, track.scrollWidth - track.clientWidth)
        return Math.max(0, Math.ceil(scrollable / step))
      }

      const updateDots = () => {
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === active)
          dot.setAttribute('aria-current', index === active ? 'true' : 'false')
        })
        if (prevBtn) prevBtn.hidden = active <= 0
        if (nextBtn) nextBtn.hidden = active >= maxIndex()
        dotsHost.hidden = false
      }

      const setActive = (nextIndex, smooth = true) => {
        active = Math.max(0, Math.min(nextIndex, maxIndex()))
        track.scrollTo({ left: cardStep() * active, behavior: smooth ? 'smooth' : 'auto' })
        updateDots()
      }

      const renderDots = () => {
        dotsHost.innerHTML = ''
        const count = maxIndex() + 1
        for (let i = 0; i < count; i += 1) {
          const dot = document.createElement('button')
          dot.type = 'button'
          dot.className = dotClassName
          dot.setAttribute('aria-label', 'Go to slide ' + String(i + 1))
          dot.addEventListener('click', () => setActive(i))
          dotsHost.appendChild(dot)
        }
        dots = Array.from(dotsHost.querySelectorAll('.' + dotClassName))
        updateDots()
      }

      const syncFromScroll = () => {
        const step = cardStep()
        if (!step) return
        active = Math.max(0, Math.min(Math.round(track.scrollLeft / step), maxIndex()))
        updateDots()
      }

      prevBtn?.addEventListener('click', () => setActive(active - 1))
      nextBtn?.addEventListener('click', () => setActive(active + 1))
      track.addEventListener('scroll', syncFromScroll, { passive: true })
      window.addEventListener('resize', () => {
        renderDots()
        setActive(active, false)
      })

      requestAnimationFrame(() => {
        renderDots()
        setActive(0, false)
      })
    }

    initCarousel({
      rootId: 'pricingCarousel',
      trackSelector: '.home-carousel-track',
      cardSelector: '.plan',
      prevId: 'pricingPrev',
      nextId: 'pricingNext',
      dotsId: 'pricingDots',
      dotClassName: 'home-carousel-dot',
    })
  } catch (error) {
    console.error('Home carousels init failed', error)
  }
})();
`,
  String.raw`
(() => {
  const rvEls = Array.from(document.querySelectorAll('.rv'))
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (rvEls.length) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      rvEls.forEach((el) => el.classList.add('show'))
    } else {
      const rvObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.remove('hidden')
          entry.target.classList.add('show')
          rvObserver.unobserve(entry.target)
        })
      }, { threshold: 0.05 })
      rvEls.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight) {
          el.classList.add('show')
        } else {
          el.classList.add('hidden')
          rvObserver.observe(el)
        }
      })
      setTimeout(() => {
        document.querySelectorAll('.rv:not(.show)').forEach((el) => {
          el.classList.remove('hidden')
          el.classList.add('show')
        })
      }, 2000)
    }
  }

  if (reducedMotion) return
  if (!('IntersectionObserver' in window)) return

  const THRESHOLD = 0.2
  const style = document.createElement('style')
  style.textContent = [
    '@keyframes v-anim-phone-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
    '.v-anim-phone-float{animation:v-anim-phone-float 5s ease-in-out infinite;will-change:transform}',
    '.home-pain-pre{opacity:0;transform:translateY(24px);transition:opacity 600ms ease-out,transform 600ms ease-out}',
    '.home-pain-in{opacity:1;transform:translateY(0)}',
    '.home-call-pre{opacity:0;transform:translateY(12px);transition:opacity 400ms ease-out,transform 400ms ease-out}',
    '.home-call-in{opacity:1;transform:translateY(0)}',
    '.home-stat-fade-pre{opacity:0;transition:opacity 1200ms ease-out}',
    '.home-stat-fade-in{opacity:1}',
    '.home-step-pre{opacity:0;transform:translateX(-16px);transition:opacity 500ms ease-out,transform 500ms ease-out}',
    '.home-step-in{opacity:1;transform:translateX(0)}',
  ].join('')
  document.head.appendChild(style)

  const homePhone = document.querySelector('[data-home-phone-float] .phone-frame')
  if (homePhone) homePhone.classList.add('v-anim-phone-float')

  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

  const observeOnce = (target, onEnter) => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        observer.unobserve(entry.target)
        onEnter(entry.target)
      })
    }, { threshold: THRESHOLD })
    observer.observe(target)
    return observer
  }

  const animateCounter = (el, delay) => {
    const target = Number.parseInt(el.getAttribute('data-count') || '0', 10)
    const suffix = el.getAttribute('data-suffix') || ''
    const duration = 1200
    window.setTimeout(() => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const value = Math.round(easeOutExpo(t) * target)
        el.textContent = String(value) + suffix
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
  }

  const animateStatFade = (el, delay) => {
    const display = el.getAttribute('data-display') || el.textContent || ''
    el.textContent = display
    el.classList.add('home-stat-fade-pre')
    window.setTimeout(() => {
      el.classList.add('home-stat-fade-in')
    }, delay)
  }

  const heroStats = document.querySelector('.hero-stats')
  if (heroStats) {
    const statNums = Array.from(heroStats.querySelectorAll('.hero-stat-num'))
    statNums.forEach((el) => {
      if (el.hasAttribute('data-fade-only')) {
        el.classList.add('home-stat-fade-pre')
        return
      }
      const suffix = el.getAttribute('data-suffix') || ''
      el.textContent = '0' + suffix
    })
    observeOnce(heroStats, () => {
      statNums.forEach((el, index) => {
        const delay = index * 100
        if (el.hasAttribute('data-fade-only')) {
          animateStatFade(el, delay)
          return
        }
        animateCounter(el, delay)
      })
    })
  }

  const industryMetrics = document.getElementById('by-the-numbers')
  if (industryMetrics) {
    const statNums = Array.from(industryMetrics.querySelectorAll('.metrics-value[data-count]'))
    statNums.forEach((el) => {
      const suffix = el.getAttribute('data-suffix') || ''
      el.textContent = '0' + suffix
    })
    observeOnce(industryMetrics, () => {
      statNums.forEach((el, index) => {
        animateCounter(el, index * 120)
      })
    })
  }

  const revenueCard = document.getElementById('home-leak-revenue-card')
  if (revenueCard) {
    const bars = Array.from(revenueCard.querySelectorAll('.leak-revenue-bar span[data-width]'))
    bars.forEach((bar) => {
      bar.style.width = '0%'
    })
    observeOnce(revenueCard, () => {
      bars.forEach((bar, index) => {
        const finalWidth = bar.getAttribute('data-width') + '%'
        const delay = index * 150
        window.setTimeout(() => {
          const start = performance.now()
          const duration = 900
          const from = 0
          const to = Number.parseFloat(bar.getAttribute('data-width') || '0')
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration)
            const value = from + (to - from) * easeOutCubic(t)
            bar.style.width = value + '%'
            if (t < 1) requestAnimationFrame(tick)
            else bar.style.width = finalWidth
          }
          requestAnimationFrame(tick)
        }, delay)
      })
    })
  }

  const leakList = document.getElementById('home-leak-list')
  if (leakList) {
    const painItems = Array.from(leakList.querySelectorAll('.leak-item'))
    painItems.forEach((item) => item.classList.add('home-pain-pre'))
    observeOnce(leakList, () => {
      painItems.forEach((item, index) => {
        window.setTimeout(() => item.classList.add('home-pain-in'), index * 150)
      })
    })
  }

  const setupCallStagger = (panelId, rowSelector, delayForIndex) => {
    const panel = document.getElementById(panelId)
    if (!panel) return
    const rows = Array.from(panel.querySelectorAll(rowSelector))
    rows.forEach((row) => row.classList.add('home-call-pre'))
    observeOnce(panel, () => {
      rows.forEach((row, index) => {
        window.setTimeout(() => row.classList.add('home-call-in'), delayForIndex(index))
      })
    })
  }

  setupCallStagger('home-tonights-calls-panel', '.coverage-call-row', (index) => index * 300)
  setupCallStagger('home-call-summary-panel', '.coverage-status-row', (index) => index * 300)
  setupCallStagger('home-missed-call-recovery-panel', '.coverage-msg-row', (index) => index * 350)

  const homeHowSection = document.querySelector('[data-home-how-section]')
  if (homeHowSection) {
    const scroller = homeHowSection.querySelector('[data-home-step-scroller]')
    if (scroller) {
      const cards = Array.from(scroller.querySelectorAll('[data-home-step-card]'))
      cards.forEach((card) => card.classList.add('home-step-pre'))
      observeOnce(homeHowSection, () => {
        cards.forEach((card, index) => {
          window.setTimeout(() => card.classList.add('home-step-in'), index * 250)
        })
      })
    }
  }
})()
`,
];

export const templateTitle =
  'AI Receptionist and Answering Service for Salons, Spas & Clinics | Recover Missed Bookings & Revenue';

export function MarketingHomeTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-home"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader />
        <div className="legacy-marketing">
        {/* HERO — primary nav is MarketingHeader (state-aware); legacy duplicate nav removed */}
        <div className="home-hero-shell">
        <section className="hero">
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="hero-eyebrow">AI voice receptionist for beauty businesses</p>
            <h1 className="hero-h">
                Every <em>missed</em> call
              <br />
                is a booking
                <br />
                lost forever.
            </h1>
            <p className="hero-sub">
              An AI receptionist for{' '}
              <Link className="hero-sub-link" href="/industries/nail-salon">
                nail salons
              </Link>
              ,{' '}
              <Link className="hero-sub-link" href="/industries/hair-salon">
                hair salons
              </Link>
              ,{' '}
              <Link className="hero-sub-link" href="/industries/spa">
                spas
              </Link>
              ,{' '}
              <Link className="hero-sub-link" href="/industries/med-spa">
                med spas
              </Link>
              , and{' '}
              <Link className="hero-sub-link" href="/industries/beauty-clinic">
                beauty clinics
              </Link>{' '}
              — built to recover missed bookings, protect revenue, and cover after-hours calls and peak-hour overflow on your current number. Guided setup in about 15 minutes.
            </p>
            <div className="hero-btns">
              <a href="/demo" className="btn-hero-live" data-demo-picker>
                <DemoCtaPhoneIcon className="btn-hero-live-phone" width={18} height={18} />
                Try a Live Demo Call
                <svg className="btn-hero-live-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                </svg>
              </a>
              <a href="/#pricing" className="btn-outline btn-hero-trial">
                Start 14-Day Free Trial
              </a>
	            </div>
	              </div>
            <div className="hero-visual" data-home-phone-float>
              <HomeHeroPhoneMockup />
            </div>
            <div className="hero-stats-block">
            <div className="hero-stats" aria-label="Key product facts">
              <div className="hero-stat">
                <div className="hero-stat-num" data-count="24" data-suffix="/7">24/7</div>
                <div className="hero-stat-label">Call coverage</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-num" data-count="15" data-suffix=" min">15 min</div>
                <div className="hero-stat-label">Setup time</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-num" data-count="5">5</div>
                <div className="hero-stat-label">Languages</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-num" data-fade-only="true" data-display="&lt;1s">&lt;1s</div>
                <div className="hero-stat-label">
                  response on live calls
                  <a href="#hero-stat-response-footnote" className="hero-stat-footnote-mark" aria-label="Response time footnote">*</a>
                </div>
                <p className="hero-stats-footnote" id="hero-stat-response-footnote">
                  * Median ~1.0s measured end-to-end on real phone calls.
                </p>
              </div>
            </div>
            </div>
          </div>
        </section>
        </div>
        <section className="leak-section" id="missed-calls">
          <div className="leak-inner">
            <div className="leak-intro">
              <div className="sec-label sec-label-left">Where calls get lost</div>
              <h2 className="sec-title reveal">
                Your phone is <em>leaking</em>
                <br />
                <em>bookings.</em> every day.
              </h2>
            <p className="sec-sub reveal">
                Most missed opportunities happen at predictable moments. Each one costs real revenue that you never see.
            </p>
            </div>
            <div className="leak-body">
              <div className="leak-list" id="home-leak-list">
              {[
                {
                    num: '01',
                    title: 'Staff are with clients',
                    body: 'Calls arrive during nails, cuts, or treatments. Nobody can step away. The phone rings out.',
                  footer: 'RingBooker answers without interrupting your team',
                  },
                  {
                    num: '02',
                  title: 'After-hours callers move on',
                    body: 'Evening and weekend callers ask about availability and pricing. Voicemail means they call your competitor next.',
                    footer: 'Captures booking intent even when you\u2019re closed',
                  },
                  {
                    num: '03',
                    title: 'One line can\u2019t handle overflow',
                    body: 'Two callers at once — one hangs up. That\u2019s a booking you\u2019ll never know you missed.',
                    footer: 'Overflow handled, no busy signal',
                  },
                ].map(({ num, title, body, footer }) => (
                  <article className="leak-item reveal" key={num}>
                    <div className="leak-num" aria-hidden="true">
                      {num}
                    </div>
                    <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <div className="pain-resolve">{footer}</div>
                  </div>
                </article>
              ))}
              </div>
              <aside className="leak-card leak-revenue reveal" id="home-leak-revenue-card" aria-labelledby="leak-revenue-heading">
                <p id="leak-revenue-heading" className="leak-revenue-kicker">
                  Estimated revenue lost per month
                </p>
                <p className="leak-revenue-note">Illustrative ranges for a busy 2–4 chair salon — not a guarantee.</p>
                {[
                  { label: 'After-hours missed calls', range: '$720 – $1,080', width: '88', barColor: '#E24B4A' },
                  { label: 'In-service missed calls', range: '$560 – $840', width: '70', barColor: '#E86B6A' },
                  { label: 'Peak-hour overflow', range: '$360 – $540', width: '44', barColor: '#F0A0A0' },
                ].map(({ label, range, width, barColor }) => (
                  <div className="leak-revenue-row" key={label}>
                    <span className="leak-revenue-label">{label}</span>
                    <span className="leak-revenue-range">{range}</span>
                    <div className="leak-revenue-bar" aria-hidden="true">
                      <span data-width={width} style={{ width: `${width}%`, background: barColor }} />
                    </div>
                  </div>
                ))}
                <div className="leak-revenue-foot">
                  <p>Total range</p>
                  <p className="leak-revenue-total">
                    $1,640 – <strong>$2,460</strong>
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
        {/* CORE COVERAGE */}
        <section className="features" id="features">
          <div className="coverage-inner">
            <div className="coverage-intro">
              <p className="coverage-kicker reveal">Core coverage</p>
              <h2 className="coverage-title reveal">
                The phone moments
                <br />
                <em>RingBooker</em> covers
              </h2>
              <p className="coverage-lead reveal">
                Built around the exact situations where beauty businesses lose bookings — not generic call-center logic.
              </p>
            </div>
            <div className="coverage-rows">
            <article className="coverage-row reveal">
              <div className="coverage-copy">
                <div className="coverage-copy-inner">
                  <p className="coverage-item-kicker">After-hours &amp; overflow</p>
                  <h3>Answers every call, even at 11 PM.</h3>
                  <p>
                    When your team is busy or closed, callers still get a real response — not voicemail and not your competitor.
                  </p>
                  <Link className="coverage-link" href="#how-it-works">
                    Try a Live Demo →
                  </Link>
                </div>
              </div>
              <div className="coverage-visual coverage-visual-peach" aria-hidden="true">
                <span className="coverage-visual-num">01</span>
                <div className="coverage-panel" id="home-tonights-calls-panel">
                  <p className="coverage-panel-title">Tonight&apos;s calls</p>
                  {[
                    { label: 'Incoming call', time: '9:41 PM' },
                    { label: 'Overflow call', time: '8:12 PM' },
                    { label: 'After-hours call', time: '7:05 PM' },
                    { label: 'Missed callback', time: '6:48 PM' },
                  ].map(({ label, time }) => (
                    <div className="coverage-call-row" key={time}>
                      <span className="coverage-call-ico" aria-hidden="true">
                <HomeLineIcon>
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </HomeLineIcon>
                      </span>
                      <div className="coverage-call-main">
                        <p className="coverage-call-label">{label}</p>
                        <p className="coverage-call-time">{time}</p>
              </div>
                      <span className="coverage-badge coverage-badge-answered">Answered</span>
            </div>
                  ))}
              </div>
            </div>
            </article>
            <article className="coverage-row coverage-row-reverse reveal">
              <div className="coverage-copy">
                <div className="coverage-copy-inner">
                  <p className="coverage-item-kicker">Booking changes</p>
                  <h3>Reschedule, cancel, and confirm on the call.</h3>
                  <p>
                    RingBooker captures intent, applies your rules, and sends confirmations — without your front desk playing phone tag.
                  </p>
                  <Link className="coverage-link" href="#how-it-works">
                    Try a Live Demo →
                  </Link>
              </div>
            </div>
              <div className="coverage-visual coverage-visual-sage" aria-hidden="true">
                <span className="coverage-visual-num">02</span>
                <div className="coverage-panel" id="home-call-summary-panel">
                  <p className="coverage-panel-title">Call summary</p>
                  <div className="coverage-status-row">
                    <span className="coverage-status-label">Caller intent</span>
                    <span className="coverage-status-value">Reschedule</span>
              </div>
                  <div className="coverage-status-row">
                    <span className="coverage-status-label">Requested date</span>
                    <span className="coverage-status-value">Thu · 2:30 PM</span>
            </div>
                  <div className="coverage-status-row">
                    <span className="coverage-status-label">Service</span>
                    <span className="coverage-status-value">Balayage + trim</span>
              </div>
                  <div className="coverage-status-row coverage-status-highlight">
                    <span className="coverage-status-label">Confirmed</span>
                    <span className="coverage-status-value">SMS sent</span>
            </div>
              </div>
              </div>
            </article>
            <article className="coverage-row reveal">
              <div className="coverage-copy">
                <div className="coverage-copy-inner">
                  <p className="coverage-item-kicker">Missed-call recovery</p>
                  <h3>Text back and follow up before they book elsewhere.</h3>
                  <p>
                    Callers who hang up or reach you after hours get an automatic text and a clear path back to booking.
                  </p>
                  <Link className="coverage-link" href="#how-it-works">
                    Try a Live Demo →
                  </Link>
                </div>
              </div>
              <div className="coverage-visual coverage-visual-sand" aria-hidden="true">
                <span className="coverage-visual-num">03</span>
                <div className="coverage-panel" id="home-missed-call-recovery-panel">
                  <p className="coverage-panel-title">Missed call recovery</p>
                  <div className="coverage-msg-row">
                    <p className="coverage-msg-text">
                      <strong>Auto text sent:</strong> &ldquo;Sorry we missed you — reply to book.&rdquo;
                    </p>
                    <span className="coverage-badge coverage-badge-delivered">Delivered</span>
                  </div>
                  <div className="coverage-msg-row">
                    <p className="coverage-msg-text">
                      <strong>Caller replied:</strong> &ldquo;Thursday 3pm gel manicure&rdquo;
                    </p>
                    <span className="coverage-badge coverage-badge-ready">Ready</span>
                  </div>
                  <div className="coverage-msg-row">
                    <p className="coverage-msg-text">
                      <strong>Next step:</strong> Owner review in dashboard
                    </p>
                    <span className="coverage-badge coverage-badge-answered">Queued</span>
                  </div>
                </div>
              </div>
            </article>
            </div>
          </div>
        </section>
        {/* HOW IT WORKS */}
        <section className="steps-section" id="how-it-works" data-home-how-section>
          <div className="steps-inner">
            <div className="steps-intro rv">
              <div className="sec-label sec-label-left">How it works</div>
              <h2 className="steps-title reveal">
                Live in <em>15 minutes.</em>
                <br />
                No migration needed.
              </h2>
              <p className="steps-copy reveal">Keep your current phone number. Keep your booking tools. Just forward your line and RingBooker handles the rest.</p>
            </div>
            <div className="steps-shell">
              <div className="steps-rail" aria-hidden="true" />
              <div className="steps-grid" data-home-step-scroller>
                <article className="step-card" data-home-step-card>
                  <div className="step-marker">1</div>
                  <h3>Forward your number</h3>
                  <p>Keep the number your clients know. RingBooker sits behind your line and catches every missed, busy, or after-hours call.</p>
                </article>
                <article className="step-card" data-home-step-card>
                  <div className="step-marker">2</div>
                  <h3>Import your details</h3>
                  <p>Paste your website URL to auto-fill your hours, services, and pricing — or enter your details manually. Review, adjust, and connect your tools.</p>
                </article>
                <article className="step-card" data-home-step-card>
                  <div className="step-marker">3</div>
                  <h3>Start recovering bookings</h3>
                  <p>Callers get help instantly. Your team gets the summary, booking details, and next action.</p>
                </article>
              </div>
            </div>
          </div>
        </section>
        <section className="industries" id="industries">
          <div className="industries-inner">
            <div className="industries-intro rv">
              <div className="sec-label sec-label-left">Industries</div>
              <h2 className="industries-title reveal">
                Built for <em>beauty</em> appointment workflows.
              </h2>
              <p className="industries-lead reveal">
                Each vertical has different call patterns, from walk-ins to consultation-driven bookings.
              </p>
                  </div>
            <HomeIndustriesSection className="reveal rv d1" />
            <div className="metrics-grid reveal rv d1" id="by-the-numbers">
              <article className="metrics-cell">
                <div className="metrics-value" data-count="500" data-suffix="+">500+</div>
                <div className="metrics-label">Demo calls completed</div>
                <p className="metrics-sublabel">Across all salon verticals</p>
              </article>
              <article className="metrics-cell">
                <div className="metrics-value" data-count="200" data-suffix="+">200+</div>
                <div className="metrics-label">Salon profiles built</div>
                <p className="metrics-sublabel">From real salon websites</p>
              </article>
              <article className="metrics-cell">
                <div className="metrics-value" data-count="5">5</div>
                <div className="metrics-label">Languages supported</div>
                <p className="metrics-sublabel">EN · ES · KO · ZH · VI</p>
              </article>
            </div>
          </div>
        </section>
        <section className="compare-section" id="ai-phone-agent-differences">
          <div className="compare-inner">
            <div className="compare-intro rv">
              <div className="sec-label sec-label-left">Why RingBooker</div>
              <h2 className="compare-title reveal">
                Not another <em>generic</em> AI agent.
              </h2>
              <p className="compare-lead reveal">
                Salon calls are fast, messy, and impatient. RingBooker is built around that reality — not call-center logic.
              </p>
            </div>
            <div className="compare-board reveal">
              <div className="compare-col compare-col-bad rv">
                <p className="compare-col-label">Generic AI phone agent</p>
                <ul className="compare-lines">
                  {HOME_COMPARE_ROWS.map(({ bad }) => (
                    <li className="compare-line" key={bad}>
                      <span className="cmp-icon" aria-hidden="true">
                        <svg viewBox="0 0 10 10" width="10" height="10">
                          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                </span>
                      <span>{bad}</span>
              </li>
                  ))}
                </ul>
              </div>
              <div className="compare-col compare-col-good rv d1">
                <p className="compare-col-label">RingBooker</p>
                <ul className="compare-lines">
                  {HOME_COMPARE_ROWS.map(({ good }) => (
                    <li className="compare-line" key={good}>
                      <span className="cmp-icon" aria-hidden="true">
                        <svg viewBox="0 0 10 10" width="10" height="10">
                          <path
                            d="M2 5.2l2.2 2.3L8 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                </span>
                      <span>{good}</span>
              </li>
                  ))}
            </ul>
              </div>
            </div>
          </div>
        </section>
        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="pricing-inner">
            <div className="pricing-intro rv">
              <div className="sec-label sec-label-center">Pricing</div>
              <h2 className="pricing-title reveal">
                Start with the coverage
                <br />
                <em>you need.</em>
              </h2>
              <p className="pricing-lead reveal">
                14-day free trial. No card to start — only required when you go live. No contracts · Cancel anytime. Prices exclude applicable taxes. Final total shown at checkout.
              </p>
            </div>
            <div className="price-toggle">
              <button className="pt-btn on" id="tog-m" type="button">Monthly</button>
              <button className="pt-btn" id="tog-a" type="button">Annual</button>
              <span className="save-badge" id="home-pt-save-badge">
                <span className="save-dot" aria-hidden />
                Save up to $358/yr
              </span>
            </div>
            <div className="home-carousel" id="pricingCarousel">
            <div className="price-grid home-carousel-track reveal">
              <div className="plan home-carousel-slide rv">
                <div className="plan-name">Starter</div>
                <div className="plan-desc">For smaller salons, spas, and clinics that need reliable after-hours and overflow call coverage.</div>
                <div className="plan-price" id="ps">$79<span className="plan-price-period">/mo</span></div>
                <p className="plan-cta-subnote">+ tax where applicable</p>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Up to 100 captured calls/month</li>
                  <li>Works with your current business number</li>
                  <li>After-hours and overflow call answering</li>
                  <li>Booking request capture — via your booking link</li>
                  <li>Missed-call text back</li>
                  <li>Callback request capture for calls that need a human</li>
                  <li>Call summaries with next steps</li>
                  <li>Call transcripts</li>
                  <li>Guided setup and test call</li>
                </ul>
                <a className="plan-btn pb-outline" href="/user/signup?plan=starter">
                  Start 14-Day Free Trial →
                </a>
              </div>
              <div className="plan star home-carousel-slide rv d1">
                <div className="plan-badge">Most popular</div>
                <div className="plan-name">Professional</div>
                <div className="plan-desc">For busier teams that need stronger follow-up, caller context, and provider preference capture.</div>
                <div className="plan-price" id="pp">$149<span className="plan-price-period">/mo</span></div>
                <p className="plan-cta-subnote">+ tax where applicable</p>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Up to 200 captured calls/month</li>
                  <li>Everything in Starter</li>
                  <li>Reminder SMS and stronger follow-up</li>
                  <li>Booking platform sync — Square, Mindbody, and more coming soon</li>
                  <li>Returning caller notes and preferences</li>
                  <li>Preferred stylist or provider context</li>
                  <li>Owner call transfer with caller context</li>
                  <li>Bilingual workflows where configured</li>
                  <li>Call recovery insights</li>
                  <li>Call transcripts and audio recordings</li>
                  <li>Priority support</li>
                </ul>
                <a className="plan-btn pb-dark" href="/user/signup?plan=professional">
                  Start 14-Day Free Trial →
                </a>
              </div>
              <div className="plan home-carousel-slide rv d2">
                <div className="plan-name">Custom</div>
                <div className="plan-desc">Multi-location setup, custom routing, and higher call volume — built around your operation.</div>
                <div className="plan-price plan-price-custom">Multi-location</div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Multi-location setup</li>
                  <li>Custom call flows, routing, and escalation rules</li>
                  <li>Custom multilingual routing and workflows</li>
                  <li>Custom integration planning</li>
                  <li>Custom captured call volume</li>
                  <li>Concierge onboarding</li>
                  <li>Priority implementation support</li>
                </ul>
                <a className="plan-btn pb-outline" href="/contact?intent=enterprise&source=homepage_custom">
                  Get in touch →
                </a>
                <p className="plan-cta-subnote">Usually responds within 1 business day</p>
              </div>
            </div>
              <div className="home-carousel-controls" aria-label="Pricing carousel controls">
                <button type="button" id="pricingPrev" className="home-carousel-nav-btn" aria-label="Previous pricing plan">‹</button>
                <div className="home-carousel-dots" id="pricingDots" aria-label="Pricing carousel indicators" />
                <button type="button" id="pricingNext" className="home-carousel-nav-btn" aria-label="Next pricing plan">›</button>
              </div>
            </div>
            <p className="pricing-foot rv d2">
              14-day free trial. No card to start — only required when you go live. No contracts · Cancel anytime. Prices exclude applicable taxes. Final total shown at checkout.
            </p>
          </div>
        </section>
        <MarketingFaqAccordion items={HOME_FAQS} />
        {/* CTA BANNER */}
        <div className="cta-outer">
          <div className="cta-inner">
            <div className="cta-banner reveal">
              <div className="cta-stack">
                <h2 className="cta-title">
                  Stop letting calls go to <em>voicemail.</em>
                </h2>
                <p className="cta-lead">
                  Setup in 15 minutes. Keep your current number. Start recovering bookings tonight.
                </p>
                <div className="cta-row">
                  <a href="/demo" className="btn-hero-live" data-demo-picker>
                    <DemoCtaPhoneIcon className="btn-hero-live-phone" width={18} height={18} />
                    Try a Live Demo Call
                    <svg className="btn-hero-live-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                  </a>
                  <Link href="/user/signup?plan=starter" className="btn-outline btn-hero-trial">
                    Start 14-Day Free Trial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        <MarketingFooter />
      </>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }} />

    </MarketingLayout>
  );
}
