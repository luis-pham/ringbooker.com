import { Fragment } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

const PRICING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Start a 14-day trial, complete setup, and run test calls without a card. Add a payment method before RingBooker answers real callers on your business number.',
  },
  {
    q: 'Do I need a new number?',
    a: 'No. Current-number setup is the primary path. A dedicated RingBooker line is optional where supported.',
  },
  {
    q: 'Do I need to change booking software?',
    a: 'No. RingBooker works alongside your booking tools and captures call context for routine scheduling requests.',
  },
  {
    q: 'Which plan is right for me?',
    a: 'Starter for after-hours, overflow, and missed-call recovery. Professional when you need reminder SMS, returning caller context, provider preferences, and owner transfer. Custom for multi-location, higher volume, or custom routing and integrations.',
  },
  {
    q: 'What happens when a caller needs a real person?',
    a: 'RingBooker captures the request and sends your team a clear summary. Starter emphasizes callback capture; Professional and Custom can also transfer to the owner when configured.',
  },
  {
    q: 'Does RingBooker replace my booking software or staff?',
    a: 'No. RingBooker is a phone answering and call recovery layer. It does not replace your booking software, your team’s judgment, or human follow-up for special cases.',
  },
];

const styles: string[] = [
  String.raw`
:root{
  --purple:var(--mk-brand-purple,#8B5CF6);
  --purple-dark:var(--mk-brand-purple-dark,#7C3AED);
  --purple-light:var(--mk-brand-purple-soft,#EDE9FE);
  --purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);
  --text-dark:var(--mk-text-strong,#111827);
  --text-gray:var(--mk-text-muted,#64748B);
  --text-light:var(--mk-text-soft,#94A3B8);
  --bg:var(--mk-bg-page,#fff);
  --bg-gray:var(--mk-bg-section,#F9FAFB);
  --border:var(--mk-border-soft,#E8ECF1);
  --green:var(--mk-brand-green,#10B981);
  --r-pill:var(--mk-radius-pill,999px);
  --r-lg:var(--mk-radius-card,22px);
  --shadow:var(--mk-shadow-soft,0 20px 40px -8px rgba(17,24,39,.06),0 8px 16px -6px rgba(17,24,39,.04));
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}
a{text-decoration:none;color:inherit}
.pricing-page{background:#fff}
/* Hero + plans: vertical rhythm matches how-it-works hero (72px bottom) then section (86px top) before first label */
.pricing-hero-plans{padding:112px 48px 72px;background:radial-gradient(ellipse 100% 65% at 50% -8%,#EDE9FE 0%,#FDF4FF 38%,#fff 72%,#fafbfc 100%)}
.pricing-plans-inner{margin-top:0;padding-top:174px}
.container{max-width:var(--mk-container-tight,1100px);margin:0 auto}
.hero-copy{max-width:980px;margin:0 auto;text-align:center}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:var(--mk-eyebrow);font-weight:700;line-height:1.2;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-copy h1{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:18px}
.hero-copy p{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);max-width:780px;margin:0 auto 28px;line-height:var(--mk-hero-lead-lh);font-weight:400}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.btn-demo-live{background:linear-gradient(135deg,var(--mk-brand-purple-deep,#5B21B6) 0%,var(--purple-dark) 48%,var(--purple) 100%);color:#fff;padding:15px 28px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:filter .2s,transform .15s,box-shadow .2s;border:none;box-shadow:var(--mk-shadow-brand)}
.btn-demo-live:hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:var(--mk-shadow-brand-hover)}
.btn-trial-soft{padding:12px 22px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;border:1.5px solid var(--border);color:var(--text-dark);background:transparent}
.btn-trial-soft:hover{border-color:var(--purple);color:var(--purple)}
.trust-row{margin:32px auto 0;display:flex;justify-content:center;gap:24px;flex-wrap:wrap;max-width:980px}
.trust-pill{display:flex;align-items:center;gap:6px;padding:0;border:none;background:transparent;border-radius:0;box-shadow:none;font-size:13px;font-weight:500;color:#6B7280}
.trust-pill::before{content:'✓';color:#10B981;font-weight:700}
.trust-pill span{display:none}
.section{padding:var(--mk-space-section-y,88px) 48px}
.section.gray{background:var(--bg-gray)}
.section.tight{padding-top:64px}
.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px;text-align:center}
.sec-title{font-size:var(--mk-section-h2);font-weight:700;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);text-align:center;margin-bottom:14px;max-width:22ch;margin-left:auto;margin-right:auto;text-wrap:balance}
.sec-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);text-align:center;margin:0 auto 44px;line-height:var(--mk-section-lead-lh);max-width:740px;font-weight:400}
.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 30px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}
.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:var(--mk-btn-sm);font-weight:600;color:var(--text-gray);cursor:pointer;transition:all .2s}
.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 6px 18px rgba(124,58,237,.28)}
.pt-save{display:inline-flex;align-items:center;gap:6px;margin-left:6px;font-size:13px;font-weight:700;color:var(--green)}
.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:24px 20px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.plan:hover{transform:translateY(-2px);box-shadow:var(--mk-shadow-hover,0 22px 44px -8px rgba(17,24,39,.09),0 10px 20px -6px rgba(17,24,39,.05));border-color:rgba(196,181,253,.55)}
.plan.star{background:linear-gradient(180deg,#faf9ff 0%,#fff 85%);border-color:rgba(167,139,250,.55);box-shadow:var(--shadow),0 0 0 1px rgba(139,92,246,.06)}
.plan.star:hover{border-color:rgba(167,139,250,.55);box-shadow:var(--mk-shadow-hover,0 22px 44px -8px rgba(17,24,39,.09),0 10px 20px -6px rgba(17,24,39,.05)),0 0 0 1px rgba(139,92,246,.08)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 16px;border-radius:var(--r-pill);white-space:nowrap;box-shadow:0 4px 12px rgba(124,58,237,.2)}
.feature-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;background:transparent;box-shadow:none;border:none}
.plan-name{font-size:var(--mk-card-title);font-weight:600;margin-bottom:5px;color:var(--text-dark)}
.plan-desc{font-size:14px;color:var(--mk-text-desc,#64748B);margin-bottom:16px;line-height:1.55;font-weight:400}
.plan-price{font-size:38px;font-weight:700;letter-spacing:-1.5px;margin-bottom:5px;color:var(--text-dark)}
.plan-price-custom{font-size:30px;letter-spacing:-1px}
.plan-price span{font-size:var(--mk-body);font-weight:500;color:var(--text-gray);letter-spacing:0}
.plan-div{height:1px;background:var(--border);margin:16px 0}
.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;flex:1;margin-bottom:22px}
.plan-feats li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#475569;line-height:1.45;font-weight:400}
.plan-grid .plan-feats li::before{content:"";width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#C4B5FD,#A78BFA);margin-top:6px;flex-shrink:0;box-shadow:0 0 0 1px rgba(139,92,246,.2)}
.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto}
.pb-outline{background:transparent;border:1px solid var(--border);color:var(--text-dark)}
.pb-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.4)}
.pb-dark{background:var(--text-dark);color:#fff}
.pb-dark:hover{background:#1f2937;transform:translateY(-1px)}
.self-grid,.feature-grid,.upgrade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.self-card,.feature-card,.upgrade-card{background:#fff;border:1px solid var(--border);border-radius:var(--mk-radius-card,22px);padding:var(--mk-space-card,22px);box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.self-card:hover,.feature-card:hover,.upgrade-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.self-card{text-align:center}
.self-card .feature-icon,.feature-card .feature-icon{margin:0 auto 13px}
.self-card h3,.feature-card h3,.upgrade-card h3{font-size:var(--mk-card-title,16px);font-weight:700;line-height:1.3;letter-spacing:-.25px;margin-bottom:8px}
.self-card p,.feature-card p,.upgrade-card p{font-size:14px;color:var(--text-gray);line-height:1.65}
.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
.feature-card{text-align:center}
.upgrade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.upgrade-card{display:flex;gap:14px;align-items:flex-start}
.line-choice{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}
.line-card{border-radius:28px;padding:28px;border:1px solid var(--border);background:#fff;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.line-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.line-card.recommended{background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--shadow)}
.line-card.recommended:hover{border-color:#a78bfa;box-shadow:0 20px 48px -8px rgba(124,58,237,.16),0 0 0 4px rgba(139,92,246,.08)}
.line-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}
.plan-icon{display:inline-flex;align-items:center;justify-content:center;font-size:21px;line-height:1}
.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700}
.pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}
.line-card h3{
  font-size:var(--mk-card-title,16px);
  font-weight:700;
  line-height:1.38;
  letter-spacing:-.2px;
  margin-bottom:9px;
}
.line-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}
.expect-band{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.note-box{padding:24px;border-radius:var(--mk-radius-card,22px);background:#fff;border:1px solid var(--border);box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.note-box:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.note-box h3{font-size:18px;font-weight:700;margin-bottom:12px}
.note-box ul{list-style:none;display:grid;gap:10px}
.note-box li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text-gray);line-height:1.6}
.note-box li::before{content:"✓";color:var(--purple);font-weight:900}
.cta-box{border-radius:34px;padding:42px;background:linear-gradient(135deg,#111827 0%,#24133f 52%,#4c1d95 100%);color:#fff;display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:center;box-shadow:0 24px 70px rgba(17,24,39,.24)}
.cta-box h2{font-size:clamp(30px,4vw,46px);font-weight:700;line-height:1.1;letter-spacing:-1.3px;margin-bottom:12px}
.cta-box p{color:rgba(255,255,255,.78);line-height:1.75}
.cta-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.cta-box .btn-outline{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22);color:#fff}
.cta-box .btn-outline:hover{border-color:rgba(255,255,255,.45);color:#fff}
.cta-box .btn-dark{background:#fff;color:#111827}
.cta-box .btn-trial-soft{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.28);color:#fff}
.cta-box .btn-trial-soft:hover{border-color:rgba(255,255,255,.45);color:#fff}
.pricing-trial-note{max-width:760px;margin:28px auto 0;padding:16px 20px;border-radius:var(--r-lg);background:rgba(245,243,255,.65);border:1px solid rgba(196,181,253,.45);font-size:14px;line-height:1.65;color:#475569;text-align:center}
.compare-section{margin-top:0}
.pricing-faq-cta .cta-box{margin-top:48px}
.pricing-faq-cta .mfaq-section{padding-top:0}
.compare-wrap{margin:0 -8px;padding:0 8px;overflow-x:auto;-webkit-overflow-scrolling:touch}
/* Compare plans — same shell as trust hub “How it works in practice” (.principles): 1px frame, radius-lg, no card shadow; row dividers only */
.pricing-compare-panel{border-radius:var(--r-lg);border:1px solid var(--border);background:#fff;box-shadow:none;overflow:hidden}
.compare-table{width:100%;min-width:720px;border-collapse:separate;border-spacing:0;border:none;border-radius:0;background:#fff;box-shadow:none;font-size:14px}
.compare-table th,.compare-table td{padding:22px 26px;border-bottom:1px solid var(--border);vertical-align:middle}
.compare-table tr:last-child td{border-bottom:none}
.compare-table thead th{background:#fff;font-weight:700;color:var(--text-dark);text-align:left}
.compare-table thead th:not(:first-child){text-align:center}
.compare-table td:first-child{font-weight:500;color:#334155;text-align:left}
.compare-table tbody tr:not(.compare-group):hover td{background:var(--bg-gray)}
.compare-table .compare-group td{background:var(--bg-gray);font-weight:700;color:#5B21B6;font-size:13px;letter-spacing:.02em;text-transform:uppercase}
.compare-yes{text-align:center;font-weight:700;color:var(--green)}
.compare-dash{text-align:center;color:var(--text-light);font-weight:600}
.compare-val{font-size:14px;line-height:1.45}
@media(max-width:960px){
  .pricing-hero-plans,.section{padding-left:22px;padding-right:22px}
  .trust-row,.plan-grid,.self-grid,.feature-grid,.upgrade-grid,.line-choice,.expect-band,.cta-box{grid-template-columns:1fr}
  /* Clear fixed .mk-nav (68px + 1px border) + breathing room — matches topic hub mobile rhythm */
  .pricing-hero-plans{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:64px}
  .hero-copy{text-align:left}
  .hero-copy h1{font-size:40px}
  .hero-copy p{margin-left:0;margin-right:0}
  .hero-actions{justify-content:flex-start}
  .trust-pill{justify-content:flex-start}
  .pt-toggle{width:100%;max-width:380px}
  .pt-btn{flex:1}
  .pt-save{display:none}
  .cta-actions{justify-content:flex-start}
}
@media(max-width:640px){
  .pricing-plans-inner{padding-top:56px}
  .hero-actions{flex-direction:column;align-items:stretch}
  .btn-demo-live,.btn-trial-soft,.btn-dark,.btn-outline{width:100%}
  .section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}
  .sec-sub{margin-bottom:32px}
  .plan{padding:22px 18px}
  .pt-toggle{max-width:none}
  .cta-box{padding:28px 22px;border-radius:var(--mk-radius-panel,28px)}
}
`,
];

const scripts: string[] = [
  String.raw`
(() => {
  const monthlyButton = document.getElementById('pricing-tog-m');
  const annualButton = document.getElementById('pricing-tog-a');
  const starterPrice = document.getElementById('pricing-starter-price');
  const proPrice = document.getElementById('pricing-pro-price');
  if (!monthlyButton || !annualButton || !starterPrice || !proPrice) return;

  const setMode = (mode) => {
    const monthly = mode === 'monthly';
    monthlyButton.classList.toggle('on', monthly);
    annualButton.classList.toggle('on', !monthly);
    starterPrice.innerHTML = monthly ? '$79 <span>/ month</span>' : '$63 <span>/ month</span>';
    proPrice.innerHTML = monthly ? '$149 <span>/ month</span>' : '$119 <span>/ month</span>';
  };

  monthlyButton.addEventListener('click', () => setMode('monthly'));
  annualButton.addEventListener('click', () => setMode('annual'));
})();
`,
];

export const templateTitle =
  'Pricing — AI Receptionist for Salons & Spas | RingBooker';

const plans = [
  {
    name: 'Starter',
    kicker: 'Small team',
    icon: '📞',
    description: 'For smaller salons, spas, and clinics that need reliable after-hours and overflow call coverage.',
    priceId: 'pricing-starter-price',
    price: '$79',
    note: 'Best when you want core after-hours, overflow, and missed-call recovery live quickly.',
    cta: 'Start free trial',
    href: '/user/signup?plan=starter',
    featured: false,
    benefits: [
      'Works with your current business number',
      'After-hours and overflow call answering',
      'Booking request capture and confirmation',
      'Basic reschedule and cancellation handling',
      'Missed-call text back',
      'Callback request capture for calls that need a human',
      'Call summaries with next steps',
      'Guided setup and test call',
    ],
  },
  {
    name: 'Professional',
    kicker: 'Busy location',
    icon: '⚡',
    description: 'For busier teams that need stronger follow-up, caller context, and provider preference capture.',
    priceId: 'pricing-pro-price',
    price: '$149',
    note: 'Best for multi-provider teams with higher call volume and repeat clients.',
    cta: 'Start free trial',
    href: '/user/signup?plan=professional',
    featured: true,
    benefits: [
      'Everything in Starter',
      'Reminder SMS and stronger follow-up',
      'Returning caller notes and preferences',
      'Preferred stylist or provider context',
      'Owner call transfer with caller context',
      'Language preferences captured during setup',
      'Advanced call recovery insights',
      'Priority support',
    ],
  },
  {
    name: 'Custom',
    kicker: 'Advanced setup',
    icon: '🏬',
    description: 'For multi-location groups, higher-volume call flows, or businesses with custom routing needs.',
    priceId: undefined,
    price: 'Let’s talk',
    note: 'Best when you need implementation planning before rollout.',
    cta: 'Talk to us',
    href: '/contact',
    featured: false,
    benefits: [
      'Multi-location setup',
      'Custom call flows, routing, and escalation rules',
      'Custom integration planning',
      'Higher call volume planning',
      'Concierge onboarding',
      'Priority implementation support',
    ],
  },
];

type CompareRow = { feature: string; starter: string; pro: string; custom: string };
type CompareGroup = { title: string; rows: CompareRow[] };

const PRICING_COMPARE_GROUPS: CompareGroup[] = [
  {
    title: 'Call answering',
    rows: [
      { feature: 'Works with current business number', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'After-hours answering', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'Overflow / missed-call coverage', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'Booking request capture', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'Basic reschedule/cancel handling', starter: 'Yes', pro: 'Yes', custom: 'Custom rules' },
    ],
  },
  {
    title: 'Follow-up',
    rows: [
      { feature: 'Missed-call text back', starter: 'Yes', pro: 'Yes', custom: 'Custom rules' },
      { feature: 'Call summaries with next steps', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'Callback request capture', starter: 'Yes', pro: 'Yes', custom: 'Yes' },
      { feature: 'Reminder SMS', starter: '—', pro: 'Yes', custom: 'Custom' },
      { feature: 'Returning caller notes', starter: '—', pro: 'Yes', custom: 'Yes' },
      { feature: 'Preferred stylist/provider context', starter: '—', pro: 'Yes', custom: 'Yes' },
    ],
  },
  {
    title: 'Handoff and routing',
    rows: [
      { feature: 'Owner call transfer', starter: '—', pro: 'Yes', custom: 'Yes' },
      { feature: 'Language preferences', starter: '—', pro: 'Yes', custom: 'Custom' },
      { feature: 'Custom routing and escalation', starter: '—', pro: '—', custom: 'Yes' },
      { feature: 'Multi-location setup', starter: '—', pro: '—', custom: 'Yes' },
    ],
  },
  {
    title: 'Insights and support',
    rows: [
      { feature: 'Call recovery insights', starter: '—', pro: 'Advanced', custom: 'Custom reporting' },
      { feature: 'Guided setup and test call', starter: 'Yes', pro: 'Yes', custom: 'Concierge onboarding' },
      { feature: 'Priority support', starter: '—', pro: 'Yes', custom: 'Priority implementation support' },
      { feature: 'Custom integration planning', starter: '—', pro: '—', custom: 'Yes' },
    ],
  },
];

const trialNoChargeCopyVerified = process.env.NEXT_PUBLIC_PADDLE_TRIAL_CONFIG_VERIFIED === 'true';

function ComparePlanCell({ value }: { value: string }) {
  if (value === 'Yes') {
    return <td className="compare-yes">✓</td>;
  }
  if (value === '—') {
    return <td className="compare-dash">—</td>;
  }
  return (
    <td className="compare-val" style={{ textAlign: 'center', fontWeight: 500, color: '#475569' }}>
      {value}
    </td>
  );
}

const pricingFaqJsonLd = buildFaqPageJsonLd(PRICING_FAQ_ITEMS);
const pricingBreadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
    { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://ringbooker.com/pricing' },
  ],
};

export function MarketingPricingTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-pricing"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="pricing" />
        <main className="pricing-page">
          <section className="pricing-hero-plans">
            <div className="container">
              <div className="hero-copy">
                <nav aria-label="Breadcrumb" style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.35, color: 'var(--mk-text-soft,#94a3b8)', textAlign: 'left' }}>
                  <a href="/" style={{ color: 'var(--mk-text-soft,#94a3b8)', textDecoration: 'none', fontWeight: 400 }}>Home</a>
                  <span style={{ margin: '0 6px' }}>›</span>
                  <span style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>Pricing</span>
                </nav>
                <div className="badge">Pricing for booking call recovery</div>
                <h1>Pricing for Missed-Call Recovery and Revenue Protection</h1>
                <p>
                  Choose the right plan to answer after-hours calls, busy-time overflow, and missed-call follow-up — without changing your current number or booking tools.
                </p>
                <div className="trust-row">
                  <div className="trust-pill"><span>🏪</span> Current number first</div>
                  <div className="trust-pill"><span>🌙</span> After-hours + overflow</div>
                  <div className="trust-pill"><span>📅</span> No booking migration</div>
                  <div className="trust-pill"><span>📋</span> Summaries &amp; callback capture</div>
                </div>
              </div>

              <div className="pricing-plans-inner">
                <div className="sec-label">Plans</div>
                <h2 className="sec-title">Choose the right level of call recovery.</h2>
                <p className="sec-sub">
                  Starter covers after-hours, overflow, and missed-call recovery. Professional adds follow-up, caller context, and owner transfer where configured. Custom is for multi-location teams, higher volume, and custom routing.
                </p>
                <div className="pt-toggle">
                  <button className="pt-btn on" id="pricing-tog-m" type="button">Monthly</button>
                  <button className="pt-btn" id="pricing-tog-a" type="button">Annual</button>
                  <span className="pt-save">Save 20%</span>
                </div>

                <div className="plan-grid">
                  {plans.map((plan) => (
                    <div className={`plan ${plan.featured ? 'star' : ''}`} key={plan.name}>
                      {plan.featured ? <div className="plan-badge">Most popular</div> : null}
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-desc">{plan.description}</div>
                      <div className={`plan-price ${plan.priceId ? '' : 'plan-price-custom'}`} id={plan.priceId}>{plan.price} {plan.priceId ? <span>/ month</span> : <span>/ contact us</span>}</div>
                      <div className="plan-div" />
                      <ul className="plan-feats">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                      <a className={`plan-btn ${plan.featured ? 'pb-dark' : 'pb-outline'}`} href={plan.href}>{plan.cta}</a>
                    </div>
                  ))}
                </div>

                <p className="pricing-trial-note">
                  <strong>14-day free trial.</strong> No card needed for setup and test calls. A payment method is required before RingBooker answers real callers on your business number.
                  {trialNoChargeCopyVerified ? <> You won&apos;t be charged until your trial ends.</> : null}
                </p>
              </div>
            </div>
          </section>

          <section className="section gray pricing-compare-lower">
            <div className="container">
              <div className="compare-section">
                <div className="sec-label">Compare plans</div>
                <h2 className="sec-title" style={{ maxWidth: '36ch' }}>
                  Compare RingBooker plans
                </h2>
                <p className="sec-sub" style={{ marginBottom: 28 }}>
                  See what is included in Starter, Professional, and Custom.
                </p>
                <div className="compare-wrap">
                  <div className="pricing-compare-panel">
                    <table className="compare-table">
                    <thead>
                      <tr>
                        <th scope="col">Feature</th>
                        <th scope="col">Starter</th>
                        <th scope="col">Professional</th>
                        <th scope="col">Custom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PRICING_COMPARE_GROUPS.map((group) => (
                        <Fragment key={group.title}>
                          <tr className="compare-group">
                            <td colSpan={4}>{group.title}</td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={`${group.title}-${row.feature}`}>
                              <td>{row.feature}</td>
                              <ComparePlanCell value={row.starter} />
                              <ComparePlanCell value={row.pro} />
                              <ComparePlanCell value={row.custom} />
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section pricing-faq-cta">
            <div className="container">
              <MarketingFaqAccordion
                items={PRICING_FAQ_ITEMS}
                title="Pricing questions, answered plainly."
                subtitle={null}
              />
              <div className="cta-box">
                <div>
                  <h2>Stop letting booking calls leak after hours or during busy windows.</h2>
                  <p>Keep your current number, keep your booking tools, and add RingBooker as the phone layer that helps recover missed booking intent.</p>
                </div>
                <div className="cta-actions">
                  <a className="btn-demo-live" href="/demo" data-demo-picker>
                    <DemoCtaPhoneIcon width={18} height={18} />
                    Try a live demo call
                  </a>
                  <a className="btn-trial-soft" href="/user/signup?plan=starter">Start free trial →</a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <MarketingFooter />
        {pricingFaqJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqJsonLd) }} />
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingBreadcrumbJsonLd) }} />
      </>
    </MarketingLayout>
  );
}
