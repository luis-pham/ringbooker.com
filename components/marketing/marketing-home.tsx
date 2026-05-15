import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
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

const homeTrialNoChargeVerified = process.env.NEXT_PUBLIC_PADDLE_TRIAL_CONFIG_VERIFIED === 'true';

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
    'AI phone answering and booking revenue recovery for salons, spas, med spas, and clinics: after-hours and peak-hour overflow, missed-call text back, protected revenue, and guided setup in about 15 minutes on your current number.',
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
  String.raw`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --purple:var(--mk-brand-purple,#8B5CF6);
  --purple-dark:var(--mk-brand-purple-dark,#7C3AED);
  --purple-light:var(--mk-brand-purple-soft,#EDE9FE);
  --purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);
  --text-dark:var(--mk-text-strong,#111827);
  --text-gray:var(--mk-text-muted,#64748B);
  --text-light:var(--mk-text-soft,#94A3B8);
  --text-desc:var(--mk-text-desc,#64748B);
  --bg:var(--mk-bg-page,#fff);
  --bg-gray:var(--mk-bg-section,#F9FAFB);
  --border:var(--mk-border-soft,#E8ECF1);
  --home-shadow-soft:0 20px 40px -8px rgba(17,24,39,.06),0 8px 16px -6px rgba(17,24,39,.04);
  --home-shadow-hover:0 22px 44px -8px rgba(17,24,39,.09),0 10px 20px -6px rgba(17,24,39,.05);
  --r-pill:var(--mk-radius-pill,999px);
  --r-lg:var(--mk-radius-card,22px);
  --r-md:var(--mk-radius-input,16px);
  --r-sm:12px;
}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}
.home-line-icon{display:block;flex-shrink:0}
.legacy-marketing{
  --mk-section-h2:clamp(28px,3.35vw,42px);
  --mk-section-h2-lh:1.14;
  --mk-section-h2-track:-1.1px;
  --mk-section-lead-lh:1.72;
  --mk-body-lh:1.68;
  --mk-card-title:16px;
}

/* Primary site nav is MarketingHeader (.mk-nav in marketing-chrome). Legacy duplicate nav CSS removed — bare "nav{}" selectors were overriding .mk-nav on this page only. */

/* ─── HOME HERO: full-bleed background shell ─── */
.home-hero-shell{
  position:relative;
  overflow:hidden;
  background:
    linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.08) 28%,rgba(255,255,255,0.42) 46%,rgba(255,255,255,0.82) 62%,rgba(255,255,255,0.98) 76%,#ffffff 88%,#ffffff 100%),
    radial-gradient(ellipse 96% 78% at 50% -22%,#EDE9FE 0%,#EDE9FE 14%,#F5F0FF 34%,#FDF4FF 52%,rgba(253,244,255,0.65) 72%,rgba(255,255,255,0.99) 94%,#ffffff 100%);
}
.home-hero-shell::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:-1px;
  height:138px;
  pointer-events:none;
  z-index:1;
  background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.72) 34%,#ffffff 58%,#fcfbff 82%,#F9FAFB 100%);
}
.hero{
  min-height:100vh;
  padding:100px 48px 60px;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  overflow:hidden;
  background:transparent;
}
.hero-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none}
.hero-blob-1{width:560px;height:560px;background:#C4B5FD;top:-200px;left:-140px}
.hero-blob-2{width:460px;height:460px;background:#F9A8D4;top:-100px;right:-120px}
.hero-inner{position:relative;z-index:2;text-align:center;max-width:820px;width:100%}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
h1.hero-h{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-home-lh);letter-spacing:var(--mk-hero-title-home-track);color:var(--text-dark);margin-bottom:20px;word-break:break-word}
h1.hero-h .hl{display:inline-block;background:var(--purple);color:#fff;border-radius:var(--r-pill);padding:0.12em 0.55em;margin:0.08em 0.12em;max-width:100%;box-sizing:border-box;line-height:1.2;vertical-align:baseline}
.hero-sub{font-size:var(--mk-hero-lead);color:var(--text-desc);line-height:var(--mk-hero-lead-lh);max-width:min(640px,100%);margin:0 auto 36px;padding:0 12px;font-weight:400}
.hero-sub a.hero-sub-link{color:var(--purple-dark);font-weight:600;text-decoration:none;transition:color .18s ease}
.hero-sub a.hero-sub-link:hover{color:#5b21b6;text-decoration:none}
	.hero-btns{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:0}
	.btn-dark{background:var(--text-dark);color:#fff;padding:14px 30px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;transition:transform .15s,background .2s}
	.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
	.btn-dark svg{width:16px;height:16px;fill:#fff}
	.btn-outline{background:transparent;color:var(--text-dark);padding:13px 26px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:600;text-decoration:none;border:1px solid var(--border);display:inline-flex;align-items:center;gap:8px;transition:border-color .2s,color .2s,background .2s,transform .15s}
	.btn-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.5)}
	.hero-btns .btn-hero-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:15px 32px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(91,33,182,.22),0 2px 8px rgba(91,33,182,.12);border:none;transition:transform .15s,filter .2s,box-shadow .2s}
	.hero-btns .btn-hero-live:hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:0 12px 36px rgba(91,33,182,.28),0 4px 12px rgba(91,33,182,.14)}
	.hero-btns .btn-hero-live svg{width:16px;height:16px;flex-shrink:0}
	.hero-btns .btn-hero-live .btn-hero-live-phone{width:18px;height:18px}
	.hero-btns .btn-hero-live .btn-hero-live-phone path{fill:#FACC15}
	.hero-btns .btn-hero-live .btn-hero-live-arrow{color:#fff}
	/* Match current-number secondary CTA: frosted pill + tinted border (not gray btn-outline) */
	.hero-btns .btn-outline.btn-hero-trial{
		background:rgba(255,255,255,.56);
		color:var(--purple-dark);
		border:1px solid rgba(196,181,253,.55);
		padding:11px 20px;
		font-size:var(--mk-btn-sm);
		font-weight:600;
	}
	.hero-btns .btn-outline.btn-hero-trial:hover{
		background:#fff;
		border-color:rgba(196,181,253,.75);
		color:var(--purple-dark);
		transform:translateY(-1px);
	}

	/* ─── SEO PROOF + OBJECTION BLOCKS ─── */
	.leak-section{position:relative;margin-top:-34px;padding:122px 48px 88px;background:linear-gradient(180deg,rgba(249,250,251,0) 0%,#fcfbff 26%,#F9FAFB 100%)}
	.leak-inner,.compare-inner{max-width:1100px;margin:0 auto}
	.leak-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
	.leak-card{position:relative;background:linear-gradient(180deg,#fbfaff 0%,#ffffff 82%);border:1px solid var(--border);border-radius:24px;padding:34px 28px 24px;box-shadow:0 10px 24px -14px rgba(17,24,39,.12),0 4px 10px -8px rgba(17,24,39,.06);transition:transform .2s,box-shadow .2s,border-color .2s}
	.leak-card:hover{transform:translateY(-2px);box-shadow:0 18px 34px -18px rgba(17,24,39,.14),0 8px 14px -10px rgba(17,24,39,.08);border-color:rgba(167,139,250,.45)}
	.leak-icon{width:48px;height:48px;margin:0 0 18px;border-radius:15px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
	.leak-icon.tone-purple{color:var(--purple-dark);background:linear-gradient(180deg,#faf9ff,#f5f3ff);border:1px solid rgba(196,181,253,.35)}
	.leak-icon.tone-green{color:#047857;background:linear-gradient(180deg,#ecfdf5,#f0fdf4);border:1px solid rgba(52,211,153,.3)}
	.leak-icon.tone-yellow{color:#B45309;background:linear-gradient(180deg,#fffbeb,#fff7ed);border:1px solid rgba(251,191,36,.25)}
	.leak-icon .home-line-icon{margin:0}
	.leak-card h3{font-size:16px;font-weight:700;line-height:1.35;letter-spacing:-.25px;margin-bottom:10px;text-align:left;color:var(--text-dark);white-space:nowrap}
	.leak-card p{font-size:15px;color:var(--text-desc);line-height:1.74;text-align:left}
	.leak-divider{height:1px;background:#e5e7eb;margin:20px 0 16px}
.leak-point{display:flex;align-items:flex-start;gap:10px;font-size:15px;line-height:1.6;font-weight:500;color:var(--text-desc)}
	.leak-point-dot{width:8px;height:8px;border-radius:50%;background:#10B981;flex-shrink:0;margin-top:8px}
	.compare-section{padding:88px 48px 72px;background:linear-gradient(180deg,#F9FAFB 0%,#fff 100%);color:var(--text-dark)}
	.compare-grid{display:grid;gap:0;margin-top:28px;border:1px solid var(--border);border-radius:20px;background:#fff;overflow:hidden;box-shadow:var(--home-shadow-soft)}
	.compare-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(241,245,249,.9)}
	.compare-row:last-child{border-bottom:none}
	.compare-cell{padding:15px 18px;background:#fff}
	.compare-cell.bad{background:#fafafa;border-right:1px solid rgba(241,245,249,.95)}
	.compare-cell.good{background:#fafdfb}
	.compare-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;color:#94A3B8;display:flex;align-items:center;gap:7px}
	.compare-cell.good .compare-eyebrow{color:#059669}
	.compare-cell.bad .compare-eyebrow{color:#DC2626}
	.compare-cell p{font-size:var(--mk-body);line-height:1.58;color:var(--text-desc)}
	.compare-cell.good p{color:#0f5132}
	.cmp-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
	.cmp-icon svg{display:block}
	.compare-cell.bad .cmp-icon{background:#F87171}
	.compare-cell.good .cmp-icon{background:#34D399}

	.current-number-setup{padding:88px 48px 84px;background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)}
	.current-number-inner{max-width:1120px;margin:0 auto}
	.current-number-intro{max-width:820px;margin:0 auto 52px;text-align:center}
.current-number-title{font-size:var(--mk-section-h2);font-weight:700;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);margin-bottom:14px;max-width:22ch;text-wrap:balance;margin-left:auto;margin-right:auto}
	.current-number-copy{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:760px;margin:0 auto;font-weight:400}
	.current-number-actions{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:28px;flex-wrap:wrap}
	.current-btn-primary,.current-btn-secondary{
	  min-width:286px;
	  padding:15px 28px;
	  border-radius:999px;
	  text-decoration:none;
	  font-size:14px;
	  font-weight:600;
	  text-align:center;
	  transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease;
	}
	.current-btn-primary{background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;box-shadow:0 12px 28px rgba(124,58,237,.18)}
	.current-btn-primary:hover{transform:translateY(-1px);box-shadow:0 16px 34px rgba(124,58,237,.22)}
	.current-btn-secondary{background:rgba(255,255,255,.56);color:var(--purple-dark);border:1px solid rgba(196,181,253,.55)}
	.current-btn-secondary:hover{background:#fff;transform:translateY(-1px)}
	.current-number-flow{position:relative;padding-top:24px}
	.current-flow-line{
	  position:absolute;
	  left:15%;
	  right:15%;
	  top:70px;
	  height:0;
	  border-top:2px dashed rgba(148,163,184,.55);
	}
	.current-flow-pulse{position:absolute;top:64px;left:15%;width:calc(70% - 12px);height:12px;z-index:2;pointer-events:none}
	.current-flow-pulse::before{
	  content:"";
	  position:absolute;
	  left:0;
	  top:0;
	  width:12px;
	  height:12px;
	  border-radius:50%;
	  background:#10b981;
	  box-shadow:0 0 0 10px rgba(16,185,129,.08);
	  animation:current-flow-slide 4.2s linear infinite;
	}
	@keyframes current-flow-slide{
	  0%{left:0;opacity:.25}
	  12%{opacity:1}
	  88%{opacity:1}
	  100%{left:calc(100% - 12px);opacity:.25}
	}
	.current-number-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:34px;position:relative}
	.current-step{text-align:center;position:relative}
	.current-step-icon{
	  width:92px;
	  height:92px;
	  border-radius:999px;
	  margin:0 auto 24px;
	  display:flex;
	  align-items:center;
	  justify-content:center;
	  border:3px solid rgba(59,130,246,.85);
	  background:rgba(59,130,246,.09);
	  color:#3166b8;
	  position:relative;
	  z-index:3;
	}
	.current-step-icon.center{
	  border-color:#1fa77d;
	  background:rgba(16,185,129,.10);
	  color:#16906c;
	}
	.current-step-glyph{width:34px;height:34px;display:block}
	.current-step-glyph path,.current-step-glyph circle,.current-step-glyph rect,.current-step-glyph polyline,.current-step-glyph line{
	  fill:none;
	  stroke:currentColor;
	  stroke-width:1.9;
	  stroke-linecap:round;
	  stroke-linejoin:round;
	}
	.current-step h3{font-size:var(--mk-card-title);font-weight:600;line-height:1.3;letter-spacing:-.2px;margin-bottom:8px;color:var(--text-dark);max-width:280px;margin-left:auto;margin-right:auto}
	.current-step p{font-size:var(--mk-body-md);line-height:1.55;color:var(--text-desc);max-width:300px;margin:0 auto}

	/* ─── HERO VISUAL ─── */
.hero-visual{position:relative;margin-top:56px;height:580px;display:flex;align-items:center;justify-content:center}

/* floating cards */
.fc{position:absolute;background:#fff;border-radius:var(--r-md);padding:14px 18px;box-shadow:0 8px 28px rgba(0,0,0,.09);z-index:4;opacity:0}
.fc-1{top:30px;left:-60px;animation:fc-enter-left .7s cubic-bezier(.22,1,.36,1) .2s forwards,flt 4s ease-in-out 1s infinite}
.fc-2{top:40px;right:-50px;animation:fc-enter-right .7s cubic-bezier(.22,1,.36,1) .4s forwards,flt 4s ease-in-out 1.3s infinite}
.fc-3{bottom:100px;left:-80px;min-width:170px;animation:fc-enter-left .7s cubic-bezier(.22,1,.36,1) .6s forwards,flt 4s ease-in-out 1.8s infinite}
.fc-4{bottom:120px;right:-60px;animation:fc-enter-right .7s cubic-bezier(.22,1,.36,1) .8s forwards,flt 4s ease-in-out 2.1s infinite}
@keyframes fc-enter-left{0%{opacity:0;transform:translateX(-40px) translateY(12px)}100%{opacity:1;transform:translateX(0) translateY(0)}}
@keyframes fc-enter-right{0%{opacity:0;transform:translateX(40px) translateY(12px)}100%{opacity:1;transform:translateX(0) translateY(0)}}
@keyframes flt{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.fc-big{font-size:26px;font-weight:800;color:var(--purple)}
.fc-big.green{color:#10B981}
.fc-sm{font-size:11px;color:var(--text-gray);margin-top:2px}
.fc-mini{font-size:11px;color:var(--text-light)}
.fc-mini-top{margin-bottom:6px}
.fc-mini-bottom{margin-top:5px}
.fc-tag{display:inline-flex;align-items:center;gap:5px;background:var(--purple-ultra);color:var(--purple-dark);font-size:11px;font-weight:600;padding:4px 9px;border-radius:var(--r-pill);margin-top:5px;border:1px solid rgba(196,181,253,.35)}
.fc-tag.g{background:#D1FAE5;color:#065F46}
.wv{display:flex;align-items:center;gap:2px;height:24px}
.wv span{width:3px;background:var(--purple);border-radius:2px;animation:wwave 1s ease-in-out infinite}
.wv span:nth-child(1){height:7px}.wv span:nth-child(2){height:16px;animation-delay:.1s}.wv span:nth-child(3){height:22px;animation-delay:.2s}.wv span:nth-child(4){height:13px;animation-delay:.3s}.wv span:nth-child(5){height:19px;animation-delay:.4s}.wv span:nth-child(6){height:9px;animation-delay:.5s}.wv span:nth-child(7){height:14px;animation-delay:.6s}
@keyframes wwave{0%,100%{transform:scaleY(.55);opacity:.55}50%{transform:scaleY(1);opacity:1}}

/* ─── PHONE FRAME ─── */
.phone-wrap{position:relative;z-index:3}
.phone-frame{width:272px;height:540px;background:#0d0d0d;border-radius:48px;padding:12px;box-shadow:0 48px 90px rgba(0,0,0,.26),0 0 0 1px rgba(255,255,255,.06) inset}
.phone-screen{background:#1a1a2e;border-radius:38px;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative}

/* status bar */
.p-status-bar{padding:14px 20px 8px;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}
.p-time-txt{font-size:14px;font-weight:700;color:#fff}
.p-icons-txt{font-size:10px;color:rgba(255,255,255,.7);letter-spacing:.5px}

/* voice call screen */
.vc-bg{position:absolute;inset:0;background:linear-gradient(160deg,#1a0533 0%,#2d1b69 40%,#1a0d3a 100%)}
.vc-glow{position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,.35) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-60%);animation:glow-pulse 3s ease-in-out infinite}
@keyframes glow-pulse{0%,100%{opacity:.7;transform:translate(-50%,-60%) scale(1)}50%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}}

.vc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:10px 20px 20px}
.vc-mini-status{display:flex;justify-content:space-between;width:100%;margin-bottom:16px}
.vc-mini-time{font-size:14px;font-weight:700;color:#fff}
.vc-mini-icons{font-size:10px;color:rgba(255,255,255,.6)}
.vc-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.5);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.vc-name{font-size:18px;font-weight:700;color:#fff;margin-bottom:4px}
.vc-timer{font-size:14px;color:rgba(255,255,255,.45);margin-bottom:20px;font-variant-numeric:tabular-nums}

/* waveform */
.vc-wave{display:flex;align-items:center;justify-content:center;gap:2.5px;height:28px;margin-bottom:12px}
.vc-wave span{width:3px;background:#10B981;border-radius:2px;animation:vc-wv .8s ease-in-out infinite}
.vc-wave span:nth-child(1){height:8px}.vc-wave span:nth-child(2){height:18px;animation-delay:.07s}.vc-wave span:nth-child(3){height:24px;animation-delay:.14s}.vc-wave span:nth-child(4){height:14px;animation-delay:.21s}.vc-wave span:nth-child(5){height:20px;animation-delay:.28s}.vc-wave span:nth-child(6){height:10px;animation-delay:.35s}.vc-wave span:nth-child(7){height:16px;animation-delay:.42s}.vc-wave span:nth-child(8){height:24px;animation-delay:.49s}.vc-wave span:nth-child(9){height:12px;animation-delay:.56s}
@keyframes vc-wv{0%,100%{transform:scaleY(.45);opacity:.5}50%{transform:scaleY(1);opacity:1}}

/* call controls */
.vc-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:auto}
.vc-ctrl{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:default}
.vc-ctrl-mute{background:rgba(255,255,255,.12)}
.vc-ctrl-mute svg{width:18px;height:18px;fill:rgba(255,255,255,.7)}
.vc-ctrl-end{width:54px;height:54px;background:#EF4444;box-shadow:0 4px 16px rgba(239,68,68,.4)}
.vc-ctrl-end svg{width:22px;height:22px;fill:#fff}
.vc-ctrl-spk{background:rgba(255,255,255,.12)}
.vc-ctrl-spk svg{width:18px;height:18px;fill:rgba(255,255,255,.7)}

/* ─── TRUSTED ─── */
.trusted{padding:36px 48px 56px;text-align:center}
.trusted-label{font-size:var(--mk-meta);color:var(--text-light);font-weight:500;margin-bottom:28px}
.logo-row{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}
.logo-item{display:flex;align-items:center;gap:8px;font-size:var(--mk-body-md);font-weight:700;color:#C4C9D4;transition:color .2s;cursor:default}
.logo-item:hover{color:#6B7280}
.logo-ico{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px}

/* ─── SECTION SHARED ─── */
.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:var(--purple-dark);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px;text-align:center;opacity:.95}
.sec-label-left{text-align:left}
.sec-label-center{text-align:center}
.section-label-wrap{text-align:center;margin-bottom:4px}
.sec-title{font-size:var(--mk-section-h2);font-weight:700;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);text-align:center;margin-bottom:14px;color:var(--text-dark);max-width:22ch;margin-left:auto;margin-right:auto;text-wrap:balance}
.sec-title-air{margin-bottom:52px}
.sec-sub{font-size:var(--mk-section-lead);color:var(--text-desc);text-align:center;margin-bottom:40px;line-height:var(--mk-section-lead-lh);font-weight:400;max-width:720px;margin-left:auto;margin-right:auto}
.emphasis-5min{color:var(--purple-dark);font-weight:700}

/* ─── FEATURES GRID ─── */
.features{padding:88px 48px 72px;background:var(--bg-gray)}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:1100px;margin:0 auto}
.feat-card{background:#fff;border-radius:var(--r-lg);padding:26px 22px;border:1px solid var(--border);transition:transform .2s,box-shadow .2s,border-color .2s;text-align:center;display:flex;flex-direction:column;align-items:center;box-shadow:var(--home-shadow-soft)}
.feat-card:hover{transform:translateY(-2px);box-shadow:var(--home-shadow-hover);border-color:rgba(196,181,253,.5)}
.feat-ico{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--purple-dark);border:1px solid rgba(196,181,253,.35);background:linear-gradient(180deg,#fff,#faf9ff)}
.feat-ico .home-line-icon{flex-shrink:0}
.fi-y{color:#B45309;background:linear-gradient(180deg,#fffbeb,#fff7ed);border-color:rgba(251,191,36,.25)}.fi-g{color:#047857;background:linear-gradient(180deg,#ecfdf5,#f0fdf4);border-color:rgba(52,211,153,.3)}.fi-p{color:var(--purple-dark);background:linear-gradient(180deg,#faf9ff,#f5f3ff);border-color:rgba(196,181,253,.35)}
.feat-card h3{font-size:var(--mk-card-title);font-weight:600;line-height:1.35;margin-bottom:8px;color:var(--text-dark);letter-spacing:-.2px}
.feat-card p{font-size:var(--mk-body);color:var(--text-desc);line-height:var(--mk-body-lh);text-align:left;width:100%;font-weight:400}

/* ─── DEEP SECTIONS ─── */
.deep-section{padding:72px 48px 0}
.deep-section-confirmation{padding:24px 48px 0}
.deep-wrap{padding:0 48px;max-width:1200px;margin:0 auto}
.deep-wrap-flush{padding:0}
.deep-s1{padding:36px 0 24px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.deep-s1 .d-text h2{font-size:clamp(20px,2vw,27px);font-weight:700;line-height:1.2;letter-spacing:-.6px;margin-bottom:10px;color:var(--text-dark)}
.deep-s1 .d-text p{font-size:var(--mk-body);color:var(--text-desc);line-height:1.68;margin-bottom:16px;font-weight:400}
.deep-s2-outer .d-text h2{font-size:clamp(20px,2vw,27px);font-weight:700;line-height:1.2;letter-spacing:-.6px;margin-bottom:16px;color:var(--text-dark)}
.deep-s2-outer .d-text p{font-size:var(--mk-body-md);color:var(--text-desc);line-height:1.68;margin-bottom:24px;font-weight:400}
.checklist{list-style:none;display:flex;flex-direction:column;gap:11px;margin-bottom:28px}
.checklist li{display:flex;align-items:flex-start;gap:11px;font-size:var(--mk-body);font-weight:500;color:var(--text-dark)}
.ck-ico{width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.ck-ico svg{display:block;width:18px;height:18px;flex-shrink:0}
.ck-ico svg path{fill:#8B5CF6}
.chart-wrap{background:#fff;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--home-shadow-soft);border:1px solid var(--border)}
.chart-inner{padding:24px 28px 0}
.chart-tiny-label{font-size:13px;color:var(--text-desc);font-weight:500;margin-bottom:2px}
.chart-big-row{display:flex;align-items:baseline;gap:12px;margin-bottom:20px}
.chart-big{font-size:34px;font-weight:700;letter-spacing:-.8px;color:var(--text-dark)}
.chart-badge{background:var(--purple-ultra);color:var(--purple-dark);font-size:var(--mk-badge);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 12px;border-radius:var(--r-pill);border:1px solid rgba(196,181,253,.4)}
.linechart-svg-wrap{position:relative;height:140px;margin:0 -1px}
.linechart-svg-wrap svg{width:100%;height:100%}
.x-labels{display:flex;justify-content:space-between;padding:10px 28px 20px;font-size:13px;color:#94A3B8;font-weight:500}
.x-label-active{font-weight:600;color:var(--text-dark)}
.deep-s2-outer{background:linear-gradient(180deg,#ecfdf5 0%,#f0fdf9 45%,#fff 100%);border:1px solid rgba(167,243,208,.55);border-radius:var(--r-lg);padding:52px 48px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;box-shadow:var(--home-shadow-soft)}
.convo-card{background:#fff;border-radius:var(--r-lg);padding:26px 26px 30px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft);position:relative}
.convo-avatars{display:flex;margin-bottom:20px}
.convo-avatar{width:38px;height:38px;border-radius:50%;border:2.5px solid #fff;margin-right:-10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff}
.convo-avatar:nth-child(1){background:linear-gradient(135deg,#C4B5FD,#93C5FD)}
.convo-avatar:nth-child(2){background:linear-gradient(135deg,#FCA5A5,#FCD34D)}
.convo-avatar:nth-child(3){background:linear-gradient(135deg,#6EE7B7,#60A5FA)}
.convo-quote{font-size:20px;font-weight:700;color:var(--text-dark);line-height:1.3;margin-bottom:18px;letter-spacing:-.35px}
.convo-wave{height:50px;width:100%;opacity:.15}
.convo-wave path{fill:none;stroke:var(--text-dark);stroke-width:1.5px}
/* ─── BY THE NUMBERS (metrics) — replaces former testimonials block ─── */
.home-metrics{padding:88px 48px;background:#fff}
.metrics-inner{max-width:1120px;margin:0 auto}
.metrics-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:0;
  margin-top:40px;
  border:1px solid var(--border);
  border-radius:20px;
  background:#fff;
  overflow:hidden;
  box-shadow:var(--home-shadow-soft);
}
.metrics-cell{
  padding:26px 22px;
  border-right:1px solid rgba(241,245,249,.95);
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
}
.metrics-cell:nth-child(4n){border-right:none}
.metrics-value{font-size:34px;font-weight:700;letter-spacing:-.8px;color:var(--text-dark);line-height:1.1;margin:12px 0 8px}
.metrics-label{font-size:15px;font-weight:700;color:var(--text-dark);line-height:1.35;margin-bottom:6px}
.metrics-sublabel{font-size:13px;color:var(--text-desc);line-height:1.5;font-weight:400}
.metrics-lang-row{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:2px}
.metric-pill{
  display:inline-flex;
  align-items:center;
  padding:4px 9px;
  border-radius:999px;
  background:var(--purple-ultra);
  color:var(--purple-dark);
  border:1px solid rgba(196,181,253,.55);
  font-size:11px;
  font-weight:600;
  line-height:1.2;
}
.metrics-trust{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  margin-top:40px;
  max-width:760px;
  margin-left:auto;
  margin-right:auto;
}
.metrics-trust-line{flex:1;height:1px;background:var(--border);min-width:24px}
.metrics-trust-text{
  font-size:13px;
  color:var(--text-desc);
  text-align:center;
  margin:0;
  line-height:1.55;
  font-weight:400;
}
.metrics-checks{
  list-style:none;
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:12px 32px;
  margin:28px 0 0;
  padding:0;
}
.metrics-checks li{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:var(--mk-body);
  font-weight:500;
  color:var(--text-dark);
}
@media(max-width:767px){
  .metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .metrics-cell{
    border-right:1px solid rgba(241,245,249,.95);
    border-bottom:1px solid rgba(241,245,249,.95);
  }
  .metrics-cell:nth-child(2n){border-right:none}
  .metrics-cell:nth-last-child(-n+2){border-bottom:none}
  .metrics-trust-line{display:none}
  .metrics-trust{gap:0}
  .metrics-checks{flex-direction:column;align-items:center;gap:14px}
}

.summary-board{
  margin:48px auto 0;
  max-width:960px;
  border-radius:24px;
  border:1px solid var(--border);
  background:linear-gradient(180deg,#fffdf9 0%,#fffaf5 100%);
  box-shadow:0 18px 40px -24px rgba(17,24,39,.1),0 8px 16px -12px rgba(17,24,39,.05);
  padding:0;
  overflow:hidden;
}
.summary-board-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  padding-bottom:16px;
  border-bottom:1px solid rgba(226,214,203,.8);
  margin-bottom:18px;
}
.summary-board-title{font-size:24px;font-weight:500;letter-spacing:-.45px;line-height:1.2;color:var(--text-dark)}
.summary-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:6px 10px;
  border-radius:999px;
  background:#e9fbf4;
  color:#0f8f68;
  border:1px solid rgba(16,185,129,.16);
  font-size:11px;
  font-weight:600;
  letter-spacing:.08em;
  text-transform:uppercase;
  white-space:nowrap;
}
.summary-list{display:flex;flex-direction:column;gap:12px}
.summary-row{
  display:grid;
  grid-template-columns:auto 1fr auto auto;
  gap:14px;
  align-items:center;
  padding:16px 14px;
  border-radius:16px;
  border:1px solid var(--border);
  background:#fff;
}
.summary-avatar{
  width:38px;
  height:38px;
  border-radius:50%;
  background:linear-gradient(135deg,#f6d9e2,#f7ece8);
  color:#9b5f8b;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  font-weight:700;
  flex-shrink:0;
}
.summary-main{min-width:0}
.summary-name{font-size:14px;font-weight:600;color:var(--text-dark);line-height:1.25;margin-bottom:3px}
.summary-copy{font-size:13px;color:var(--text-light);line-height:1.45}
.summary-tag{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:6px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:600;
  white-space:nowrap;
}
.summary-tag.booking{background:#e9fbf4;color:#0f8f68}
.summary-tag.reschedule{background:#fff4db;color:#b77710}
.summary-tag.cancel{background:#fde8e8;color:#cc4b4b}
.summary-tag.inquiry{background:#e8f7fb;color:#117aa0}
.summary-time{font-size:12px;color:var(--text-light);white-space:nowrap}

/* ─── PRICING ─── */
.pricing{padding:88px 48px 72px;background:var(--bg-gray)}
.pricing-inner{max-width:1100px;margin:0 auto}
.home-pricing-trial-note{max-width:760px;margin:28px auto 0;padding:14px 18px;border-radius:var(--r-lg);background:rgba(245,243,255,.65);border:1px solid rgba(196,181,253,.45);font-size:13px;line-height:1.65;color:#475569;text-align:center}
.price-toggle{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:40px}
.pt-btn{padding:10px 22px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:inherit}
.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 4px 14px rgba(124,58,237,.25)}
.pt-btn:not(.on){background:transparent;color:var(--text-desc)}
.save-tag{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#ecfdf5,#d1fae5);color:#047857;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:var(--r-pill);border:1px solid rgba(16,185,129,.4);box-shadow:0 2px 10px rgba(16,185,129,.14)}
.price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:24px 20px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;transition:transform .2s,box-shadow .2s,border-color .2s;box-shadow:0 10px 24px -18px rgba(17,24,39,.16)}
.plan:hover{transform:translateY(-1px);box-shadow:0 14px 30px -20px rgba(17,24,39,.18);border-color:rgba(196,181,253,.55)}
.plan.star{background:linear-gradient(180deg,#faf9ff 0%,#fff 85%);border-color:rgba(167,139,250,.55);box-shadow:0 10px 24px -18px rgba(124,58,237,.2),0 0 0 1px rgba(139,92,246,.06)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:var(--mk-badge);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 16px;border-radius:var(--r-pill);white-space:nowrap;box-shadow:0 4px 12px rgba(124,58,237,.2)}
.plan-name{font-size:var(--mk-card-title);font-weight:600;margin-bottom:5px;color:var(--text-dark)}
.plan-desc{font-size:var(--mk-caption);color:var(--text-desc);margin-bottom:16px;line-height:1.55;font-weight:400}
.plan-price{font-size:38px;font-weight:700;letter-spacing:-1.5px;margin-bottom:5px;color:var(--text-dark)}
.plan-price-custom{font-size:var(--mk-card-title);font-weight:600;letter-spacing:0;line-height:1.35}
.plan-price .plan-price-period{font-size:var(--mk-body);font-weight:500;color:var(--text-gray);letter-spacing:0}
.plan-price .plan-price-billed{display:block;font-size:13px;font-weight:500;color:var(--mk-text-desc,#64748B);letter-spacing:0;line-height:1.45;margin-top:4px}
.plan-cta-subnote{font-size:12px;color:var(--mk-text-desc,#64748B);text-align:center;margin:8px 0 0;font-weight:400;line-height:1.45}
.plan-div{height:1px;background:var(--border);margin:16px 0}
.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px;flex:1}
.plan-feats li{display:flex;align-items:flex-start;gap:10px;font-size:var(--mk-caption);color:#475569;line-height:1.45;font-weight:400}
.price-grid .plan-feats li::before{content:"";width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#C4B5FD,#A78BFA);margin-top:6px;flex-shrink:0;box-shadow:0 0 0 1px rgba(139,92,246,.2)}
.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto}
.pb-outline{background:transparent;border:1px solid var(--border);color:var(--text-dark)}
.pb-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.4)}
.pb-dark{background:var(--text-dark);color:#fff}
.pb-dark:hover{background:#1f2937;transform:translateY(-1px)}
/* ─── HOW IT WORKS ─── */
.industries{padding:88px 48px 88px;background:#fff}
.industries-inner{max-width:1180px;margin:0 auto}
.industries .sec-sub{max-width:760px}
.industries-track{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:16px;
  align-items:stretch;
  margin-top:18px;
}
.industry-card{
  position:relative;
  display:block;
  min-height:305px;
  border-radius:22px;
  overflow:hidden;
  text-decoration:none;
  color:inherit;
  background:#e9e2e8;
  box-shadow:var(--home-shadow-soft);
  transition:transform .24s ease,box-shadow .24s ease;
}
.industry-card:hover{transform:translateY(-2px);box-shadow:var(--home-shadow-hover)}
.industry-thumb{position:absolute;inset:0;background:linear-gradient(145deg,#faf9ff,#f1f0ff)}
.industry-thumb img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .32s ease}
.industry-card:hover .industry-thumb img{transform:scale(1.04)}
.industry-overlay{
  position:absolute;
  inset:0;
  background:linear-gradient(180deg,rgba(24,16,26,.06) 0%,rgba(34,22,34,.18) 42%,rgba(57,35,59,.58) 100%);
}
.industry-body{
  position:absolute;
  left:18px;
  right:18px;
  bottom:18px;
  z-index:2;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.industry-title{
  font-size:var(--mk-card-title);
  font-weight:600;
  line-height:1.3;
  color:#fff;
  letter-spacing:-.2px;
}
.industry-sub{
  font-size:var(--mk-body);
  line-height:var(--mk-body-lh);
  color:rgba(255,255,255,.86);
  font-weight:400;
  max-width:180px;
}
.home-carousel{position:relative}
.home-carousel-controls{display:none;align-items:center;justify-content:center;gap:12px;margin-top:18px}
.home-carousel-nav-btn{
  width:36px;height:36px;border-radius:999px;border:1px solid #ddd6fe;background:#fff;color:#6d28d9;
  display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.10);
}
.home-carousel-nav-btn:hover{background:#f5f3ff}
.home-carousel-nav-btn[hidden]{display:none}
.home-carousel-dots{display:flex;justify-content:center;gap:8px}
.home-carousel-dot{width:10px;height:10px;border-radius:999px;background:#d1d5db;border:none;cursor:pointer;transition:all .2s ease}
.home-carousel-dot.active{width:26px;background:#8b5cf6}
.steps-section{padding:88px 48px;background:linear-gradient(180deg,#fff 0%,#fcfbff 100%)}
.steps-inner{max-width:1100px;margin:0 auto}
.steps-intro{max-width:760px;margin:0 auto 56px;text-align:center}
.steps-title{font-size:var(--mk-section-h2);font-weight:700;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);color:var(--text-dark);margin-bottom:14px;max-width:22ch;text-wrap:balance;margin-left:auto;margin-right:auto}
.steps-copy{font-size:var(--mk-section-lead);color:var(--text-desc);line-height:var(--mk-section-lead-lh);max-width:720px;margin:0 auto;font-weight:400}
.steps-shell{position:relative;padding-top:42px}
.steps-rail{position:absolute;left:10%;right:10%;top:68px;height:1px;background:#e5e7eb}
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:34px;position:relative}
.step-card{position:relative;background:transparent;border:none;border-radius:0;padding:0;text-align:center;box-shadow:none}
.step-marker{width:52px;height:52px;border-radius:999px;border:2px solid #10B981;background:#fff;color:#10B981;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;margin:0 auto 28px;position:relative;z-index:2}
.step-card h3{font-size:var(--mk-card-title);font-weight:600;letter-spacing:-.2px;line-height:1.35;margin-bottom:10px;color:var(--text-dark);max-width:300px;margin-left:auto;margin-right:auto}
.step-card p{font-size:var(--mk-body);color:var(--text-desc);line-height:var(--mk-body-lh);max-width:310px;margin:0 auto;font-weight:400}

/* ─── REAL CALL FLOW ─── */
.flow-section{padding:20px 48px 72px;background:#fff}
.flow-inner{max-width:1100px;margin:0 auto;background:linear-gradient(135deg,#fdfcff,#fff);border:1px solid var(--border);border-radius:28px;padding:32px 28px;box-shadow:var(--home-shadow-soft)}
.flow-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;align-items:stretch}
.flow-list{display:flex;flex-direction:column;gap:14px}
.flow-row{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:18px;background:#fff;border:1px solid var(--border);box-shadow:0 1px 3px rgba(17,24,39,.04)}
.flow-dot{width:34px;height:34px;min-width:34px;border-radius:12px;background:var(--purple-ultra);color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:1px solid rgba(196,181,253,.35)}
.flow-row h4{font-size:15px;margin-bottom:4px;font-weight:600;color:var(--text-dark)}
.flow-row p{font-size:14px;color:var(--text-desc);line-height:1.62;font-weight:400}
.demo-shot{border-radius:24px;border:1px dashed rgba(196,181,253,.55);background:linear-gradient(135deg,#faf9ff,#fff);min-height:420px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.demo-shot::before{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(139,92,246,.08)}
.demo-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(196,181,253,.4);border-radius:999px;padding:7px 12px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--purple-dark);width:fit-content;position:relative;z-index:1}
.demo-window{background:#fff;border-radius:22px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft);padding:18px;position:relative;z-index:1}
.demo-window h4{font-size:16px;margin-bottom:10px}
.demo-window p{font-size:14px;color:var(--text-gray);line-height:1.65}
.demo-lines{display:flex;flex-direction:column;gap:10px;margin-top:18px}
.demo-line{height:12px;border-radius:999px;background:linear-gradient(90deg,#ede9fe,#f5f3ff)}
.demo-line.sm{width:42%}.demo-line.md{width:68%}.demo-line.lg{width:88%}
.demo-note{font-size:14px;color:var(--text-light);font-weight:600;letter-spacing:.03em;position:relative;z-index:1}

/* ─── MVP SCOPE ─── */
.scope-section{padding:0 48px 72px;background:#fff}
.scope-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.scope-card{border-radius:24px;padding:26px 24px;border:1px solid var(--border);box-shadow:var(--home-shadow-soft)}
.scope-card h3{font-size:20px;font-weight:600;letter-spacing:-.45px;margin-bottom:8px;color:var(--text-dark)}
.scope-card p{font-size:var(--mk-body);color:var(--text-desc);line-height:1.68;margin-bottom:18px;font-weight:400}
.scope-card.ok{background:linear-gradient(180deg,#f7f2ff 0%,#fff 100%)}
.scope-card.later{background:linear-gradient(180deg,#fff9ef 0%,#fff 100%)}
.scope-list{list-style:none;display:flex;flex-direction:column;gap:10px}
.scope-list li{display:flex;gap:10px;align-items:flex-start;font-size:var(--mk-body);line-height:1.6}
.scope-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;margin-top:1px}
.scope-icon.ok{background:#ede9fe;color:var(--purple-dark)}
.scope-icon.later{background:#fff7ed;color:#c2410c}

/* ─── USER PREVIEW ─── */
.user-preview{padding:72px 48px;background:var(--bg-gray)}
.user-preview-inner{max-width:1100px;margin:0 auto}
.user-grid{display:grid;grid-template-columns:.95fr 1.05fr;gap:24px;align-items:center}
.user-copy .sec-label{text-align:left;margin-bottom:16px}
.user-copy h2{text-align:left;font-size:clamp(28px,3.6vw,44px);font-weight:700;line-height:1.12;letter-spacing:-1.1px;margin-bottom:14px;color:var(--text-dark)}
.user-copy p{font-size:var(--mk-body-md);color:var(--text-desc);line-height:1.72;margin-bottom:24px;text-align:left;font-weight:400}
.user-shot{border-radius:28px;background:linear-gradient(180deg,#ffffff,#f8fafc);padding:14px;box-shadow:var(--home-shadow-hover);border:1px solid var(--border)}
.user-shell{position:relative;background:linear-gradient(135deg,#f7f2ff 0%,#ffffff 55%,#f5f3ff 100%);border-radius:22px;overflow:hidden;aspect-ratio:16/9;min-height:auto;border:1px solid #E5E7EB;display:block}



.user-brand .mini-logo{position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.user-brand .mini-logo:before,.user-brand .mini-logo:after{content:"";position:absolute;border-radius:50%;background:#8B5CF6}
.user-brand .mini-logo:before{width:30px;height:30px;opacity:.12}
.user-brand .mini-logo:after{width:22px;height:22px;opacity:.2}
.user-brand .mini-core{width:16px;height:16px;border-radius:50%;background:#8B5CF6;position:relative;z-index:1}

.user-nav div{padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #E5E7EB;font-size:12.5px;font-weight:600;color:#6B7280}
.user-nav div.active{background:#ede9fe;color:#7C3AED;border-color:#ddd6fe}





.user-stat strong{display:block;font-size:22px;letter-spacing:-.8px;margin-bottom:4px}
.user-stat span{font-size:14px;color:#6B7280}
.user-preview-img{
  width:100%;
  height:100%;
  display:block;
  object-fit:cover;
  border-radius:22px;
}



.user-table-row:last-child{border-bottom:none}


@media(max-width:960px){
  .steps-grid,.flow-grid,.scope-inner,.user-grid,.current-number-grid{grid-template-columns:1fr}
  .steps-section{padding-top:72px;padding-bottom:72px}
  .steps-intro{margin-bottom:34px}
  .steps-title{font-size:34px;letter-spacing:var(--mk-section-h2-track)}
  .steps-copy{font-size:var(--mk-section-lead)}
  .steps-shell{padding-top:0}
  .steps-rail{display:none}
  .step-marker{margin-bottom:18px}
  .step-card h3{font-size:var(--mk-card-title)}
  .step-card p{max-width:100%}
  .current-number-setup{padding-top:72px;padding-bottom:72px}
  .current-number-intro{margin-bottom:34px}
  .current-number-actions{gap:10px}
  .current-btn-primary,.current-btn-secondary{min-width:0;width:100%}
  .current-number-flow{padding-top:0}
  .current-flow-line,.current-flow-pulse{display:none}
  .current-step-icon{margin-bottom:18px}
  .current-step h3{font-size:var(--mk-card-title);max-width:100%}
  .current-step p{font-size:var(--mk-body);max-width:100%}
  .summary-board{margin-top:34px;padding:0}
  .summary-board-head{align-items:flex-start;flex-direction:column}
  .summary-board-title{font-size:22px}
  .summary-row{grid-template-columns:auto 1fr;gap:10px}
  .summary-tag,.summary-time{grid-column:2}
  .summary-tag{justify-self:start}
  .summary-time{margin-top:-4px}
  .user-shell{aspect-ratio:16/10}
  .steps-section,.flow-section,.scope-section,.user-preview,.industries,.current-number-setup{padding-left:22px;padding-right:22px}
  .industries-track{
    display:flex;
    gap:14px;
    overflow-x:auto;
    scroll-snap-type:x mandatory;
    scrollbar-width:none;
    -ms-overflow-style:none;
    padding:8px 2px 6px;
  }
  .industries-track::-webkit-scrollbar{display:none}
  .industry-card{flex:0 0 calc((100% - 14px) / 2);min-height:280px;scroll-snap-align:start}
  .home-carousel-track{
    display:flex;
    gap:16px;
    overflow-x:auto;
    scroll-snap-type:x mandatory;
    scrollbar-width:none;
    -ms-overflow-style:none;
    scroll-behavior:smooth;
    padding:6px 2px 10px;
  }
  .home-carousel-track::-webkit-scrollbar{display:none}
  .home-carousel-slide{scroll-snap-align:start}
  .home-carousel-controls{display:flex}
  .home-carousel-track .plan{
    margin:0;
    box-sizing:border-box;
    transform:none;
    flex:0 0 calc((100% - 16px) / 2);
    height:auto;
  }
  .home-carousel-track .plan:hover{transform:none}
}

@media(max-width:640px){
  .industry-card{flex-basis:84%;min-height:292px}
  .industry-sub{max-width:190px}
  .current-number-actions{margin-top:22px}
  .summary-row{padding:14px 12px}
  .home-carousel-track .plan{flex-basis:100%}
  .home-carousel-controls{justify-content:center}
}


.user-image-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center}
.user-image-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(139,92,246,.20);border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--purple-dark);margin-bottom:16px;box-shadow:0 10px 24px rgba(17,24,39,.06)}
.user-image-icon{width:74px;height:74px;border-radius:22px;background:linear-gradient(135deg,#ede9fe,#f5f3ff);border:1px solid #ddd6fe;display:flex;align-items:center;justify-content:center;color:var(--purple-dark);font-size:30px;font-weight:800;margin-bottom:16px}
.user-image-title{font-size:20px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px}
.user-image-copy{max-width:420px;font-size:var(--mk-body);color:var(--text-gray);line-height:1.7}
.user-image-corners::before,.user-image-corners::after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(139,92,246,.08);filter:blur(4px)}
.user-image-corners::before{top:-36px;right:-36px}
.user-image-corners::after{bottom:-42px;left:-42px}

/* ─── CTA BANNER ─── */
.cta-outer{padding:0 48px 72px;display:flex;justify-content:center}
.cta-inner{width:100%;max-width:1100px}
.cta-banner{border-radius:var(--r-lg);background:linear-gradient(125deg,#6D28D9 0%,#8B5CF6 55%,#A78BFA 100%);padding:52px 56px;display:grid;grid-template-columns:1fr auto auto;gap:32px 40px;overflow:visible;position:relative;align-items:center;min-height:420px}
.cta-banner::before{content:"";position:absolute;right:-30px;top:-40px;width:280px;height:280px;background:rgba(255,255,255,.07);border-radius:50%}
.cta-text{position:relative;z-index:2}
.cta-text h2{font-size:clamp(22px,2.4vw,32px);font-weight:700;color:#fff;letter-spacing:-.65px;margin-bottom:8px;line-height:1.2}
.cta-text p{font-size:14px;color:rgba(255,255,255,.82);line-height:1.65;max-width:380px;font-weight:400}
.cta-actions{display:flex;flex-direction:column;gap:10px;position:relative;z-index:2;min-width:210px}
.btn-white{background:#fff;color:var(--purple-dark);padding:12px 24px;border-radius:var(--r-pill);font-size:14.5px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:transform .15s,box-shadow .2s;justify-content:center;box-shadow:0 4px 16px rgba(17,24,39,.08)}
.btn-white .btn-white-arrow{width:16px;height:16px;color:var(--purple-dark);flex-shrink:0;transition:transform .2s ease}
.btn-white .demo-cta-phone path{fill:#FACC15}
.btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(17,24,39,.1)}
.btn-white:hover .btn-white-arrow{transform:translateX(3px)}
.btn-ghost-w{background:rgba(255,255,255,.12);color:#fff;padding:12px 24px;border-radius:var(--r-pill);font-size:14px;font-weight:600;text-decoration:none;text-align:center;border:1px solid rgba(255,255,255,.32);transition:background .2s,border-color .2s;display:block}
.btn-ghost-w:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.45)}
/* cta phone — taller + overflow visible */
.cta-phone-wrap{position:relative;z-index:3;overflow:visible;height:320px;width:190px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.cta-phone{width:190px;height:370px;background:#0d0d0d;border-radius:34px;padding:9px;box-shadow:0 16px 40px rgba(0,0,0,.35);position:relative;left:auto;bottom:auto}
.cta-phone-screen{background:#1a1a2e;border-radius:26px;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative}
.cta-vc-bg{position:absolute;inset:0;background:linear-gradient(160deg,#1a0533,#2d1b69 40%,#1a0d3a)}
.cta-vc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 14px 14px}
.cta-vc-status{display:flex;justify-content:space-between;width:100%;margin-bottom:10px}
.cta-vc-status span{font-size:10px;color:rgba(255,255,255,.6);font-weight:600}
.cta-vc-label{font-size:9px;color:rgba(255,255,255,.45);letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
.cta-vc-name{font-size:14px;font-weight:700;color:#fff;margin-bottom:2px}
.cta-vc-timer{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px}
.cta-vc-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#A855F7);display:flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 0 0 3px rgba(139,92,246,.35)}
.cta-vc-avatar svg{width:22px;height:22px;fill:#fff}
.cta-vc-wave{display:flex;align-items:center;justify-content:center;gap:2px;height:20px;margin-bottom:12px}
.cta-vc-wave span{width:2.5px;background:rgba(167,139,250,.7);border-radius:2px;animation:vc-wv .8s ease-in-out infinite}
.cta-vc-wave span:nth-child(1){height:6px}.cta-vc-wave span:nth-child(2){height:14px;animation-delay:.08s}.cta-vc-wave span:nth-child(3){height:18px;animation-delay:.16s}.cta-vc-wave span:nth-child(4){height:10px;animation-delay:.24s}.cta-vc-wave span:nth-child(5){height:16px;animation-delay:.32s}.cta-vc-wave span:nth-child(6){height:8px;animation-delay:.4s}.cta-vc-wave span:nth-child(7){height:12px;animation-delay:.48s}
.cta-sub-wrap{background:rgba(255,255,255,.08);border-radius:10px;padding:8px 10px;width:100%;margin-bottom:12px;border:1px solid rgba(255,255,255,.1)}
.cta-sub-txt{font-size:9.5px;color:#fff;font-weight:500;line-height:1.4}
.cta-vc-ctrl{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:auto}
.cta-ctrl{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12)}
.cta-ctrl svg{width:14px;height:14px;fill:rgba(255,255,255,.7)}
.cta-ctrl-end{width:44px;height:44px;background:#EF4444;box-shadow:0 3px 12px rgba(239,68,68,.4)}
.cta-ctrl-end svg{width:18px;height:18px;fill:#fff}

/* ─── FOOTER ─── */
footer{background:var(--bg-gray);border-top:1px solid var(--border);padding:60px 48px 32px}
.footer-inner{max-width:1100px;margin:0 auto}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:50px}
.footer-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;margin-bottom:14px}
.footer-desc{font-size:13.5px;color:var(--text-gray);line-height:1.65;margin-bottom:20px}
.footer-social{display:flex;gap:10px}
.soc-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;text-decoration:none}
.soc-btn:hover{border-color:var(--purple);background:var(--purple-ultra)}
.soc-btn svg{width:14px;height:14px;fill:var(--text-gray)}
.soc-btn:hover svg{fill:var(--purple)}
.footer-col h4{font-size:11.5px;font-weight:700;color:var(--text-dark);text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px}
.footer-col a{display:block;font-size:13.5px;color:var(--text-gray);text-decoration:none;margin-bottom:10px;transition:color .2s}
.footer-col a:hover{color:var(--text-dark)}
.footer-bottom{border-top:1px solid var(--border);padding-top:22px;display:flex;justify-content:space-between;align-items:center}
.footer-bottom p{font-size:14px;color:var(--text-light)}

/* ─── REVEAL ─── */
.reveal{opacity:1;transform:none}
.reveal.vis{opacity:1;transform:none}

/* ─── RESPONSIVE ─── */
@media(max-width:960px){
  .leak-grid,.compare-row,.feat-grid,.deep-s1,.deep-s2-outer,.price-grid,.footer-grid{grid-template-columns:1fr}
  .cta-banner{grid-template-columns:1fr;padding:32px 26px}
  .cta-phone-wrap{display:none}
  footer,.hero,.leak-section,.compare-section,.features,.trusted,.home-metrics,.pricing,.mfaq-section,.cta-outer,.deep-section,.deep-section-confirmation{padding-left:22px;padding-right:22px}
  .industry-tag{backdrop-filter:none}
  .hero-blob,.vc-glow,.user-image-corners::before,.user-image-corners::after{display:none}
  .pulse-dot,.wv span,.vc-wave span,.cta-vc-wave span{animation:none}
  .hero-visual{height:480px}
  .phone-frame{width:230px;height:460px}
  .fc{display:none}
  .deep-s2-outer{padding:36px 22px 40px;gap:32px}
  .deep-s2-outer .d-text h2{font-size:clamp(19px,4.8vw,24px);line-height:1.2;margin-bottom:14px}
  .deep-s2-outer .d-text p{font-size:15px;line-height:1.72}
  .deep-s2-outer .checklist li{font-size:14px}
  .deep-s2-outer .convo-card{padding:22px 20px 26px}
  .deep-s2-outer .convo-quote{font-size:clamp(18px,4.5vw,21px)}
  /* Align 24/7 copy with chart card inner padding and other body columns */
  .deep-s1 .d-text{padding-left:28px;padding-right:28px}
}

@media(max-width:640px){
  .hero{min-height:auto;padding-top:96px;padding-bottom:36px}
  .hero-visual{height:420px;margin-top:34px}
  .phone-frame{width:216px;height:432px;box-shadow:0 26px 48px rgba(0,0,0,.2)}
  .pricing .plan{box-shadow:0 1px 2px rgba(17,24,39,.04)}
  .pricing .plan:hover{transform:none;box-shadow:0 1px 2px rgba(17,24,39,.04)}
  .pricing .plan.star,.pricing .plan.star:hover{box-shadow:0 0 0 1px rgba(139,92,246,.08)}
  h1.hero-h{font-size:clamp(26px,7.2vw,40px);letter-spacing:-1.5px;line-height:1.18}
  h1.hero-h .hl{padding:0.1em 0.42em;margin:0.06em 0.08em;letter-spacing:-0.02em}
  .hero-sub{margin-bottom:26px}
  .hero-btns{flex-direction:column;align-items:stretch;gap:10px}
  .hero-btns .btn-hero-live,
  .hero-btns .btn-hero-trial,
  .current-btn-primary,
  .current-btn-secondary,
  .btn-white,
  .btn-ghost-w{width:100%;justify-content:center}
  .features,.compare-section,.home-metrics,.pricing{padding-top:var(--mk-space-section-y-mobile);padding-bottom:64px}
  .steps-section,.industries,.current-number-setup{padding-top:var(--mk-space-section-y-mobile);padding-bottom:64px}
  .sec-sub{margin-bottom:32px}
  .steps-intro,.current-number-intro{margin-bottom:28px}
  .steps-grid,.current-number-grid{gap:24px}
  .cta-banner{padding:28px 20px;gap:20px}
  .deep-s2-outer{padding:28px 18px 32px;gap:26px}
}
.legacy-marketing > nav,
.legacy-marketing > footer,
.legacy-marketing > .topbar{display:none !important}

/* Font floor: raise all small text under 14px */
.legacy-marketing .fc-sm,
.legacy-marketing .fc-tag,
.legacy-marketing .trusted-label,
.legacy-marketing .sec-label,
.legacy-marketing .feat-card p,
.legacy-marketing .checklist li,
.legacy-marketing .metrics-sublabel,
.legacy-marketing .plan-desc,
.legacy-marketing .plan-feats li,
.legacy-marketing .save-tag,
.legacy-marketing .industry-tag,
.legacy-marketing .industry-sub,
.legacy-marketing .industry-link,
.legacy-marketing .step-num,
.legacy-marketing .step-card p,
.legacy-marketing .demo-badge,
.legacy-marketing .scope-card p,
.legacy-marketing .scope-list li,
.legacy-marketing .user-nav div,
.legacy-marketing .user-image-badge,
.legacy-marketing .user-image-copy,
.legacy-marketing .footer-col h4,
.legacy-marketing .footer-desc,
.legacy-marketing .footer-col a{
  font-size:14px !important;
}
`,
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
  starterPrice.innerHTML = mo
    ? '$79<span class="plan-price-period">/ month</span>'
    : '$63<span class="plan-price-period">/mo</span><span class="plan-price-billed">Billed $758/year</span>'
  proPrice.innerHTML = mo
    ? '$149<span class="plan-price-period">/ month</span>'
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
      rootId: 'industriesCarousel',
      trackSelector: '.industries-track',
      cardSelector: '.industry-card',
      prevId: 'industriesPrev',
      nextId: 'industriesNext',
      dotsId: 'industriesDots',
      dotClassName: 'industry-dot',
    })

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
];

export const templateTitle =
  'AI Phone Answering for Salons, Spas & Clinics | Recover Missed Bookings & Revenue';

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
            <h1 className="hero-h">
              Stop Losing <span className="hl">Bookings & Revenue</span>
              <br />
              on Your Current Number
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
            {/* HERO VISUAL */}
            <div className="hero-visual">
              {/* Floating cards */}
              <div className="fc fc-1">
                <div className="fc-big">24/7</div>
                <div className="fc-sm">Call coverage</div>
                <div className="fc-tag">After-hours answered</div>
	              </div>
              <div className="fc fc-2">
                <div className="fc-big green">15 min</div>
                <div className="fc-sm">Setup time</div>
                <div className="fc-tag g">Guided onboarding</div>
              </div>
              <div className="fc fc-3">
                <div className="fc-mini fc-mini-top">Current-number setup</div>
                <div className="fc-big">100%</div>
                <div className="fc-sm">Keep your number</div>
                <div className="wv"><span /><span /><span /><span /><span /><span /><span /></div>
                <div className="fc-mini fc-mini-bottom">No listing churn</div>
              </div>
              <div className="fc fc-4">
                <div className="fc-big">14 days</div>
                <div className="fc-sm">Free trial</div>
                <div className="fc-tag">Start risk-free</div>
              </div>
              {/* PHONE with voice call UI */}
              <div className="phone-wrap">
                <div className="phone-frame">
                  <div className="phone-screen">
                    <div className="vc-bg" />
                    <div className="vc-glow" />
                    <div className="vc-content">
                      {/* Status bar */}
                      <div className="vc-mini-status">
                        <span className="vc-mini-time">9:41</span>
                        <span className="vc-mini-icons">▲⬛</span>
                      </div>
                      <div className="vc-label">Incoming Call</div>
                      <div className="vc-name">Luxe Hair Studio</div>
                      <div className="vc-timer" id="vc-timer">00:24</div>
                      {/* Waveform */}
                      <div className="vc-wave">
                        <span /><span /><span /><span /><span /><span /><span /><span /><span />
                      </div>
                      {/* Controls */}
                      <div className="vc-controls">
                        <div className="vc-ctrl vc-ctrl-mute">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                        <div className="vc-ctrl vc-ctrl-end">
                          <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" /></svg>
                        </div>
                        <div className="vc-ctrl vc-ctrl-spk">
                          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
        <section className="leak-section" id="missed-calls">
          <div className="leak-inner">
            <div className="sec-label">Where calls get lost</div>
            <h2 className="sec-title reveal">Your phone is leaking<br />bookings every day.</h2>
            <p className="sec-sub reveal">
              Most missed opportunities happen when staff are with clients, the business is closed, or two callers need help at once.
            </p>
            <div className="leak-grid">
              {[
                {
                  title: 'Staff are busy with clients',
                  body: 'Calls arrive while staff are doing nails, hair, treatments, or checkout.',
                  footer: 'RingBooker answers without interrupting your team',
                  tone: 'tone-purple',
                  icon: (
                    <HomeLineIcon>
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </HomeLineIcon>
                  ),
                },
                {
                  title: 'After-hours callers move on',
                  body: 'Evening and weekend callers still ask about availability, pricing, and booking options.',
                  footer: 'Capture booking intent even when closed',
                  tone: 'tone-green',
                  icon: (
                    <HomeLineIcon>
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </HomeLineIcon>
                  ),
                },
                {
                  title: 'One line cannot handle overflow',
                  body: 'When the front desk is already on a call, the next booking caller may hang up.',
                  footer: 'Keep overflow callers in the loop',
                  tone: 'tone-yellow',
                  icon: (
                    <HomeLineIcon>
                      <path d="M17 3h4v4M3 21h4v-4M21 3l-6 6M3 21l6-6" />
                    </HomeLineIcon>
                  ),
                },
              ].map(({ title, body, footer, tone, icon }) => (
                <article className="leak-card reveal" key={title}>
                  <div className={`leak-icon ${tone}`}>{icon}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <div className="leak-divider" aria-hidden="true" />
                  <div className="leak-point">
                    <span className="leak-point-dot" aria-hidden="true" />
                    <span>{footer}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        {/* FEATURES GRID */}
        <section className="features" id="features">
          <div className="sec-label">Core coverage</div>
          <h2 className="sec-title reveal">The phone moments<br />RingBooker covers.</h2>
          <p className="sec-sub reveal">RingBooker is built around the phone moments where beauty businesses lose bookings.</p>
            <div className="feat-grid">
            <div className="feat-card reveal">
              <div className="feat-ico fi-y" aria-hidden>
                <HomeLineIcon>
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </HomeLineIcon>
              </div>
              <h3>After-Hours &amp; Overflow Call Answering.</h3>
              <p>Answers calls when your team is busy, closed, already on another line, or serving a client.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-g" aria-hidden>
                <HomeLineIcon>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </HomeLineIcon>
              </div>
              <h3>Reschedule, Cancel &amp; Confirm Call Handling.</h3>
              <p>Handles common booking changes based on your rules and sends the caller a clear confirmation.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-p" aria-hidden>
                <HomeLineIcon>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </HomeLineIcon>
              </div>
              <h3>Missed-Call Text Back &amp; Callback Follow-Up.</h3>
              <p>Texts callers who hang up or reach you after hours, then captures callback details so your team can follow up.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-y" aria-hidden>
                <HomeLineIcon>
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </HomeLineIcon>
              </div>
              <h3>Works With Your Current Number &amp; Booking Tools.</h3>
              <p>Forward your front-desk line and keep using the booking workflow you already know, with Square live today and more integrations expanding.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-g" aria-hidden>
                <HomeLineIcon>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </HomeLineIcon>
              </div>
              <h3>Call Summary &amp; Intent Dashboard for You.</h3>
              <p>Every call becomes a transcript, summary, and outcome so you can see what happened without replaying voicemail.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-p" aria-hidden>
                <HomeLineIcon>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </HomeLineIcon>
              </div>
              <h3>Human Follow-Up When the Caller Needs It.</h3>
              <p>RingBooker can collect the caller’s request, mark it for follow-up, and on supported plans transfer the call to the owner when needed.</p>
            </div>
          </div>
        </section>
        {/* HOW IT WORKS */}
        <section className="steps-section" id="how-it-works">
          <div className="steps-inner">
            <div className="steps-intro">
              <div className="sec-label">How it works</div>
              <h2 className="steps-title reveal">Live in 15 minutes.<br />No migration needed.</h2>
              <p className="steps-copy reveal">Keep your current phone number. Keep your booking tools. Just forward your line and RingBooker handles the rest.</p>
            </div>
            <div className="steps-shell reveal">
              <div className="steps-rail" aria-hidden="true" />
              <div className="steps-grid">
                <article className="step-card">
                  <div className="step-marker">1</div>
                  <h3>01 — Forward your number</h3>
                  <p>Keep the number your clients know. RingBooker sits behind your line and catches every missed, busy, or after-hours call.</p>
                </article>
                <article className="step-card">
                  <div className="step-marker">2</div>
                  <h3>02 — Set your rules</h3>
                  <p>Add your hours, services, and booking workflow. Connect your tools and RingBooker follows your flow.</p>
                </article>
                <article className="step-card">
                  <div className="step-marker">3</div>
                  <h3>03 — Start recovering bookings</h3>
                  <p>Callers get help instantly. Your team gets the summary, booking details, and next action.</p>
                </article>
              </div>
            </div>
          </div>
        </section>
        <section className="industries" id="industries">
          <div className="industries-inner">
            <div className="sec-label">Industries</div>
            <h2 className="sec-title reveal">Built for beauty<br />appointment workflows.</h2>
            <p className="sec-sub reveal">Each vertical has different call patterns, from walk-ins to consultation-driven bookings.</p>
            <div className="industries-carousel" id="industriesCarousel">
              <div className="industries-track">
                <a href="/industries/nail-salon" className="industry-card" data-index={0}>
                  <div className="industry-thumb">
                    <Image src="/images/nail.webp" alt="Nail salon technician performing gel manicure — AI phone answering service for nail salons handles pricing calls and walk-in bookings" width={1024} height={1024} sizes="(max-width: 640px) 84vw, (max-width: 960px) 50vw, 20vw" quality={70} />
                    <div className="industry-overlay" aria-hidden="true" />
                  </div>
                  <div className="industry-body">
                    <div className="industry-title">Nail Salon</div>
                    <div className="industry-sub">Walk-ins, gel, peak-hour calls</div>
                  </div>
                </a>
                <a href="/industries/hair-salon" className="industry-card" data-index={1}>
                  <div className="industry-thumb">
                    <Image src="/images/hair_shop.webp" alt="Hair salon stylist performing color treatment — AI phone answering captures overflow and in-service calls for bookings and reschedules" width={1024} height={1024} sizes="(max-width: 640px) 84vw, (max-width: 960px) 50vw, 20vw" quality={70} />
                    <div className="industry-overlay" aria-hidden="true" />
                  </div>
                  <div className="industry-body">
                    <div className="industry-title">Hair Salon</div>
                    <div className="industry-sub">Cuts, color, busy chair time</div>
                  </div>
                </a>
                <a href="/industries/spa" className="industry-card" data-index={2}>
                  <div className="industry-thumb">
                    <Image src="/images/spa.webp" alt="Day spa massage and wellness treatment room — AI phone answering captures spa booking calls and couples massage requests 24/7" width={1024} height={1024} sizes="(max-width: 640px) 84vw, (max-width: 960px) 50vw, 20vw" quality={70} />
                    <div className="industry-overlay" aria-hidden="true" />
                  </div>
                  <div className="industry-body">
                    <div className="industry-title">Spa / Day Spa</div>
                    <div className="industry-sub">Treatment bookings and availability</div>
                  </div>
                </a>
                <a href="/industries/med-spa" className="industry-card" data-index={3}>
                  <div className="industry-thumb">
                    <Image src="/images/med_spa.webp" alt="Med spa aesthetic treatment consultation room — AI phone answering for Botox, filler, and laser inquiry calls after hours" width={1024} height={1024} sizes="(max-width: 640px) 84vw, (max-width: 960px) 50vw, 20vw" quality={70} />
                    <div className="industry-overlay" aria-hidden="true" />
                  </div>
                  <div className="industry-body">
                    <div className="industry-title">Med Spa</div>
                    <div className="industry-sub">Consult-led, high-ticket calls</div>
                  </div>
                </a>
                <a href="/industries/beauty-clinic" className="industry-card" data-index={4}>
                  <div className="industry-thumb">
                    <Image src="/images/beauty_clinic.webp" alt="Beauty and aesthetic clinic reception area — AI answering service for beauty clinic consultation bookings and provider continuity calls" width={1024} height={1024} sizes="(max-width: 640px) 84vw, (max-width: 960px) 50vw, 20vw" quality={70} />
                    <div className="industry-overlay" aria-hidden="true" />
                  </div>
                  <div className="industry-body">
                    <div className="industry-title">Beauty Clinic</div>
                    <div className="industry-sub">Consults &amp; follow-ups</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>
        <section className="current-number-setup" id="current-number-setup">
          <div className="current-number-inner">
            <div className="current-number-intro">
              <div className="sec-label">Current number setup</div>
              <h2 className="current-number-title reveal">Keep the number your<br />clients already call.</h2>
              <p className="current-number-copy reveal">Use call forwarding to cover missed, busy, or after-hours calls without changing your Google Business Profile, website, social profiles, or printed phone number.</p>
              <div className="current-number-actions reveal">
                <a className="current-btn-primary" href="/current-number/call-forwarding">View call forwarding setup guides</a>
                <a className="current-btn-secondary" href="/current-number">Learn about keeping your number</a>
              </div>
            </div>
            <div className="current-number-flow reveal">
              <div className="current-flow-line" aria-hidden="true" />
              <div className="current-flow-pulse" aria-hidden="true" />
              <div className="current-number-grid">
                <article className="current-step">
                  <div className="current-step-icon">
                    <svg className="current-step-glyph" viewBox="0 0 32 32" aria-hidden="true">
                      <circle cx="16" cy="10" r="5" />
                      <path d="M8.5 24a7.5 7.5 0 0 1 15 0" />
                    </svg>
                  </div>
                  <h3>Client calls your number</h3>
                  <p>Same number on Google, cards, and signs</p>
                </article>
                <article className="current-step">
                  <div className="current-step-icon center">
                    <svg className="current-step-glyph" viewBox="0 0 32 32" aria-hidden="true">
                      <line x1="9" y1="11" x2="23" y2="11" />
                      <polyline points="18 6 23 11 18 16" />
                      <line x1="23" y1="21" x2="9" y2="21" />
                      <polyline points="14 16 9 21 14 26" />
                    </svg>
                  </div>
                  <h3>RingBooker handles the call</h3>
                  <p>Books, reschedules, or captures the request</p>
                </article>
                <article className="current-step">
                  <div className="current-step-icon">
                    <svg className="current-step-glyph" viewBox="0 0 32 32" aria-hidden="true">
                      <rect x="10" y="6" width="12" height="20" rx="2.5" />
                      <path d="M13.5 12h5M13.5 16h5M13.5 20h3.5" />
                      <path d="M8 11h.01M8 16h.01M8 21h.01" />
                    </svg>
                  </div>
                  <h3>Team sees the result</h3>
                  <p>Confirmation, summary, and next step — ready to go</p>
                </article>
              </div>
            </div>
          </div>
        </section>
        <section className="compare-section" id="ai-phone-agent-differences">
          <div className="compare-inner">
            <div className="sec-label">Why RingBooker</div>
            <h2 className="sec-title reveal">Not another generic AI agent.</h2>
            <p className="sec-sub reveal">Salon calls are fast, messy, and impatient. RingBooker is built around that — not call-center logic.</p>
              <div className="compare-grid">
              {[
                ['Loops on unexpected questions, then dumps to voicemail.', 'Two-strike fallback with callback offer and clean handoff.'],
                ['Asks too many questions before doing anything useful.', "Asks only what's needed to book, reschedule, or summarize."],
                ['No context — your team starts from scratch.', 'Call summaries and intent notes so nobody repeats themselves.'],
              ].map(([bad, good]) => (
                <div className="compare-row" key={bad}>
                  <div className="compare-cell bad">
                    <div className="compare-eyebrow">
                      <span className="cmp-icon"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 2l6 6M8 2l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
                      Generic AI phone agent
                    </div>
                    <p>{bad}</p>
                  </div>
                  <div className="compare-cell good">
                    <div className="compare-eyebrow">
                      <span className="cmp-icon"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 5.2l2.2 2.3L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                      RingBooker
                    </div>
                    <p>{good}</p>
                  </div>
                </div>
              ))}
              </div>
            </div>
        </section>
        {/* BY THE NUMBERS — metrics (replaces testimonials) */}
        <section className="home-metrics" id="by-the-numbers">
          <div className="metrics-inner">
            <div className="sec-label sec-label-center">By the numbers</div>
            <h2 className="sec-title reveal">Built for real salon workflows.</h2>
            <p className="sec-sub reveal">
              Tested across nail salons, hair salons, spas, med spas, and beauty clinics.
            </p>
            <div className="metrics-grid reveal">
              <article className="metrics-cell">
                <div className="feat-ico fi-p" aria-hidden>
                  <HomeLineIcon>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </HomeLineIcon>
                </div>
                <div className="metrics-value">500+</div>
                <div className="metrics-label">Demo calls completed</div>
                <p className="metrics-sublabel">Across all salon verticals</p>
              </article>
              <article className="metrics-cell">
                <div className="feat-ico fi-p" aria-hidden>
                  <HomeLineIcon>
                    <path d="M3 21h18" />
                    <path d="M5 21V8l7-4 7 4v13" />
                    <path d="M9 21v-6h6v6" />
                  </HomeLineIcon>
                </div>
                <div className="metrics-value">200+</div>
                <div className="metrics-label">Salon profiles built</div>
                <p className="metrics-sublabel">From real salon websites</p>
              </article>
              <article className="metrics-cell">
                <div className="feat-ico fi-p" aria-hidden>
                  <HomeLineIcon>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </HomeLineIcon>
                </div>
                <div className="metrics-value">5</div>
                <div className="metrics-label">Languages supported</div>
                <div className="metrics-lang-row" aria-label="Supported languages">
                  {['English', 'Spanish', 'Korean', 'Chinese', 'Vietnamese'].map((lang) => (
                    <span key={lang} className="metric-pill">{lang}</span>
                  ))}
                </div>
              </article>
              <article className="metrics-cell">
                <div className="feat-ico fi-p" aria-hidden>
                  <HomeLineIcon>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </HomeLineIcon>
                </div>
                <div className="metrics-value">{'<1s'}</div>
                <div className="metrics-label">AI response time</div>
                <p className="metrics-sublabel">Average across all calls</p>
              </article>
            </div>
            <div className="metrics-trust reveal">
              <span className="metrics-trust-line" aria-hidden="true" />
              <p className="metrics-trust-text">
                No contract · Keep your current number · Cancel before day 15, pay nothing
              </p>
              <span className="metrics-trust-line" aria-hidden="true" />
            </div>
            <ul className="metrics-checks reveal">
              <li>
                <span className="ck-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                </span>
                No booking software migration
              </li>
              <li>
                <span className="ck-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                </span>
                Works with your current number
              </li>
              <li>
                <span className="ck-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                </span>
                Setup in under 15 minutes
              </li>
            </ul>
          </div>
        </section>
        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="pricing-inner">
            <div className="sec-label sec-label-center">Pricing</div>
            <h2 className="sec-title reveal">Start with the coverage<br />you need.</h2>
            <p className="sec-sub reveal">No contracts. Pick monthly or annual billing when you subscribe.</p>
            <div className="price-toggle">
              <button className="pt-btn on" id="tog-m" type="button">Monthly</button>
              <button className="pt-btn" id="tog-a" type="button">Annual</button>
              <span className="save-tag">Save up to $358/year</span>
            </div>
            <div className="home-carousel" id="pricingCarousel">
            <div className="price-grid home-carousel-track reveal">
              <div className="plan home-carousel-slide">
                <div className="plan-name">Starter</div>
                <div className="plan-desc">For smaller salons, spas, and clinics that need reliable after-hours and overflow call coverage.</div>
                <div className="plan-price" id="ps">$79<span className="plan-price-period">/ month</span></div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Up to 100 captured callers/month</li>
                  <li>Works with your current business number</li>
                  <li>After-hours and overflow call answering</li>
                  <li>Booking request capture and confirmation</li>
                  <li>Missed-call text back</li>
                  <li>Callback request capture for calls that need a human</li>
                  <li>Call summaries with next steps</li>
                  <li>Guided setup and test call</li>
                </ul>
                <a className="plan-btn pb-outline" href="/user/signup?plan=starter">Start 14-Day Free Trial →</a>
              </div>
              <div className="plan star home-carousel-slide">
                <div className="plan-badge">Most popular</div>
                <div className="plan-name">Professional</div>
                <div className="plan-desc">For busier teams that need stronger follow-up, caller context, and provider preference capture.</div>
                <div className="plan-price" id="pp">$149<span className="plan-price-period">/ month</span></div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Up to 300 captured callers/month</li>
                  <li>Everything in Starter</li>
                  <li>Reminder SMS and stronger follow-up</li>
                  <li>Returning caller notes and preferences</li>
                  <li>Preferred stylist or provider context</li>
                  <li>Owner call transfer with caller context</li>
                  <li>Bilingual workflows where configured</li>
                  <li>Call recovery insights</li>
                  <li>Advanced call insights</li>
                  <li>Priority support</li>
                </ul>
                <a className="plan-btn pb-dark" href="/user/signup?plan=professional">Start 14-Day Free Trial →</a>
              </div>
              <div className="plan home-carousel-slide">
                <div className="plan-name">Custom</div>
                <div className="plan-desc">Multi-location setup, custom routing, and higher call volume — built around your operation.</div>
                <div className="plan-price plan-price-custom">For multiple locations or high volume</div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Multi-location setup</li>
                  <li>Custom call flows, routing, and escalation rules</li>
                  <li>Custom multilingual routing and workflows</li>
                  <li>Custom integration planning</li>
                  <li>Custom captured caller volume</li>
                  <li>Concierge onboarding</li>
                  <li>Priority implementation support</li>
                </ul>
                <a className="plan-btn pb-outline" href="/contact?intent=enterprise&source=homepage_custom">Book a 15-min call →</a>
                <p className="plan-cta-subnote">Usually responds within 1 business day</p>
              </div>
            </div>
              <div className="home-carousel-controls" aria-label="Pricing carousel controls">
                <button type="button" id="pricingPrev" className="home-carousel-nav-btn" aria-label="Previous pricing plan">‹</button>
                <div className="home-carousel-dots" id="pricingDots" aria-label="Pricing carousel indicators" />
                <button type="button" id="pricingNext" className="home-carousel-nav-btn" aria-label="Next pricing plan">›</button>
              </div>
            </div>
            <p className="home-pricing-trial-note reveal">
              <strong>14-day free trial.</strong> No card needed for setup and test calls. A payment method is required before RingBooker answers real callers on your business number.
              {homeTrialNoChargeVerified ? <> You won&apos;t be charged until your trial ends.</> : null}
            </p>
          </div>
        </section>
        <MarketingFaqAccordion items={HOME_FAQS} />
        {/* CTA BANNER */}
        <div className="cta-outer">
          <div className="cta-inner">
            <div className="cta-banner reveal">
              <div className="cta-text">
                <h2>Keep your number.<br />Cover the calls your team can’t.</h2>
                <p>Configure the essentials in about 15 minutes, then start recovering booking intent from after-hours calls, overflow, missed rings, and moments when a caller needs a person.</p>
              </div>
              <div className="cta-actions">
                <a href="/demo" className="btn-white" data-demo-picker>
                  <DemoCtaPhoneIcon width={16} height={16} />
                  Try a Live Demo Call
                  <svg className="btn-white-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </a>
                <a href="/user/signup?plan=starter" className="btn-ghost-w">
                  Start 14-Day Free Trial
                </a>
              </div>
              {/* CTA Phone — voice call UI */}
              <div className="cta-phone-wrap">
                <div className="cta-phone">
                  <div className="cta-phone-screen">
                    <div className="cta-vc-bg" />
                    <div className="cta-vc-content">
                      <div className="cta-vc-status">
                        <span>9:41</span>
                        <span>▲⬛</span>
                      </div>
                      <div className="cta-vc-label">Active Call</div>
                      <div className="cta-vc-name">Luxe Hair Studio</div>
                      <div className="cta-vc-timer">00:47</div>
                      <div className="cta-vc-avatar">
                        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                      </div>
                      <div className="cta-vc-wave">
                        <span /><span /><span /><span /><span /><span /><span />
                      </div>
                      <div className="cta-sub-wrap">
                        <div className="cta-sub-txt">I can help with that. What day would you like us to call you back?</div>
                      </div>
                      <div className="cta-vc-ctrl">
                        <div className="cta-ctrl">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                        <div className="cta-ctrl cta-ctrl-end">
                          <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" /></svg>
                        </div>
                        <div className="cta-ctrl">
                          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
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
