import { Fragment } from 'react';

import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

const trialNoChargeCopyVerified = process.env.NEXT_PUBLIC_PADDLE_TRIAL_CONFIG_VERIFIED === 'true';

const PRICING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Do I need a credit card to start?',
    a:
      'No. You can start a 14-day trial, complete setup, and run test calls without a card. A payment method is required before RingBooker answers real callers on your business number.' +
      (trialNoChargeCopyVerified ? ' You won\'t be charged until your trial ends.' : ''),
  },
  {
    q: 'Do I need a new number?',
    a: 'No. RingBooker is designed to work with your current business number. You can set up and test first, then add a payment method before live answering is enabled. A dedicated RingBooker number may be available as an optional setup path, but most businesses can keep the number customers already know.',
  },
  {
    q: 'Do I need to change booking software?',
    a: 'No. RingBooker works alongside your current booking setup. It can capture booking requests, reschedules, cancellations, and caller details so your team can confirm them in the tools you already use. Direct booking integrations may depend on your booking software and plan.',
  },
  {
    q: 'Which plan is right for me?',
    a: (
      <>
        <p>
          Starter is best if you need RingBooker to answer missed, busy, overflow, and after-hours calls, capture booking requests, and send call summaries with next steps.
        </p>
        <p>
          Professional is best if you also need stronger follow-up, returning caller context, provider preferences, bilingual workflows where configured, and owner call transfer.
        </p>
        <p>
          Custom is best for multi-location businesses, higher call volume, custom routing, escalation rules, or integration planning.
        </p>
      </>
    ),
  },
  {
    q: 'What is a captured call?',
    a: 'A captured call is a call where RingBooker captures useful information for your business, such as the caller name, phone number, service request, preferred time, or callback request. Demo calls and test calls do not count.',
  },
  {
    q: 'What happens when a caller needs a real person?',
    a: 'On Starter, RingBooker captures the callback request and sends your team a clear summary with next steps. On Professional and Custom plans, RingBooker can also transfer the call to the owner when configured, including caller context so the owner knows why the caller needs help.',
  },
  {
    q: 'Does RingBooker replace my booking software or staff?',
    a: 'No. RingBooker is designed to support your team, not replace it. It answers calls your team misses, captures booking intent, handles common requests, and sends summaries so your staff can confirm details in your existing booking workflow.',
  },
  {
    q: 'What does “Bilingual workflows where configured” mean?',
    a: 'On Professional and Custom plans, RingBooker can be configured to handle callers in more than one language, such as English and Vietnamese. It can collect booking details in the caller’s language and provide your team with a clear summary for follow-up.',
  },
];

const styles: string[] = [
  String.raw`:root{--purple:var(--mk-brand-purple,#8B5CF6);--purple-dark:var(--mk-brand-purple-dark,#7C3AED);--purple-light:var(--mk-brand-purple-soft,#EDE9FE);--purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);--text-dark:var(--mk-text-strong,#111827);--text-gray:var(--mk-text-muted,#64748B);--text-light:var(--mk-text-soft,#94A3B8);--bg:var(--mk-bg-page,#fff);--bg-gray:var(--mk-bg-section,#F9FAFB);--border:var(--mk-border-soft,#E8ECF1);--green:var(--mk-brand-green,#10B981);--r-pill:var(--mk-radius-pill,999px);--r-lg:var(--mk-radius-card,22px);--shadow:var(--mk-card-shadow,var(--mk-shadow-soft,0 1px 2px rgba(17,24,39,.04)))}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}a{text-decoration:none;color:inherit}.pricing-page{background:#fff}.pricing-hero-plans{padding:calc(112px + env(safe-area-inset-top,0px)) 48px 72px;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.08) 28%,rgba(255,255,255,0.42) 46%,rgba(255,255,255,0.82) 62%,rgba(255,255,255,0.98) 76%,#ffffff 88%,#ffffff 100%),radial-gradient(ellipse 96% 78% at 50% -22%,#EDE9FE 0%,#EDE9FE 14%,#F5F0FF 34%,#FDF4FF 52%,rgba(253,244,255,0.65) 72%,rgba(255,255,255,0.99) 94%,#ffffff 100%)}.pricing-plans-inner{margin-top:0;padding-top:0}.container{max-width:var(--mk-container-tight,1100px);margin:0 auto}.hero-copy{max-width:var(--mk-container-tight,1100px);margin:0 auto 28px;text-align:left}.pricing-plans-inner .sec-label{margin-bottom:12px}.pricing-plans-inner .sec-title{margin-bottom:14px}.pricing-plans-inner .sec-sub{margin:0 auto 28px;max-width:min(740px,100%)}.pricing-plans-inner .pt-toggle{margin:0 auto 36px}.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}.btn-dark{background:var(--text-dark);color:#fff}.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}.btn-outline:hover{border-color:var(--purple);color:var(--purple)}.btn-demo-live{color:#fff;padding:15px 28px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg,16px);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:transform .15s,background .2s,box-shadow .2s;border:none}.btn-trial-soft{display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,background .2s,border-color .2s,color .2s}.section{padding:var(--mk-space-section-y,88px) 48px}.section.gray{background:var(--bg-gray)}.section.tight{padding-top:64px}.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px}.sec-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);margin-bottom:14px;text-wrap:balance}.sec-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);margin:0 0 40px;line-height:var(--mk-section-lead-lh);max-width:740px;font-weight:400}.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:var(--mk-btn-sm);font-weight:600;color:var(--text-gray);cursor:pointer;transition:all .2s}.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 6px 18px rgba(124,58,237,.28)}.save-badge{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#16a34a;background:none;border:none;padding:0;white-space:nowrap;max-width:0;opacity:0;transform:translateX(-8px);overflow:hidden;margin-left:0;pointer-events:none;transition:opacity .22s ease,transform .22s ease,max-width .28s ease,margin-left .22s ease}.save-badge.is-visible{max-width:200px;opacity:1;transform:translateX(0);margin-left:6px;pointer-events:auto}.save-dot{width:6px;height:6px;border-radius:50%;background:#16a34a;flex-shrink:0}@media(prefers-reduced-motion:reduce){.save-badge{transition:none}.save-badge:not(.is-visible){display:none}.save-badge.is-visible{display:inline-flex}}.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}.plan{background:#fff;border-radius:var(--r-lg);padding:24px 20px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.plan:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.plan.star{background:linear-gradient(180deg,#faf9ff 0%,#fff 85%);border-color:rgba(167,139,250,.55);box-shadow:var(--mk-card-shadow,var(--shadow))}.plan.star:hover{border-color:rgba(167,139,250,.65);box-shadow:var(--mk-card-shadow-hover,var(--shadow))}.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 16px;border-radius:var(--r-pill);white-space:nowrap;box-shadow:0 4px 12px rgba(124,58,237,.2)}.feature-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;background:transparent;box-shadow:none;border:none}.plan-name{font-size:var(--mk-card-title);font-weight:600;margin-bottom:5px;color:var(--text-dark)}.plan-desc{font-size:14px;color:var(--mk-text-desc,#64748B);margin-bottom:16px;line-height:1.55;font-weight:400}.plan-price{font-size:38px;font-weight:500;letter-spacing:-1.5px;margin-bottom:5px;color:var(--text-dark)}.plan-price-custom{font-size:var(--mk-card-title);font-weight:600;letter-spacing:0;line-height:1.35}.plan-price .plan-price-period{font-size:var(--mk-body);font-weight:500;color:var(--text-gray);letter-spacing:0}.plan-price .plan-price-billed{display:block;font-size:13px;font-weight:500;color:var(--mk-text-desc,#64748B);letter-spacing:0;line-height:1.45;margin-top:4px}.plan-cta-subnote{font-size:12px;color:var(--mk-text-desc,#64748B);text-align:center;margin:8px 0 0;font-weight:400;line-height:1.45}.plan-div{height:1px;background:var(--border);margin:16px 0}.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;flex:1;margin-bottom:22px}.plan-feats li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#475569;line-height:1.45;font-weight:400}.plan-grid .plan-feats li::before{content:"";width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#C4B5FD,#A78BFA);margin-top:6px;flex-shrink:0;box-shadow:0 0 0 1px rgba(139,92,246,.2)}.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto}.pb-outline{background:transparent;border:1px solid var(--border);color:var(--text-dark)}.pb-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.4)}.pb-dark{background:var(--text-dark);color:#fff}.pb-dark:hover{background:#1f2937;transform:translateY(-1px)}.self-grid,.feature-grid,.upgrade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.self-card,.feature-card,.upgrade-card{background:#fff;border:1px solid var(--border);border-radius:var(--mk-radius-card,22px);padding:var(--mk-space-card,22px);box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.self-card:hover,.feature-card:hover,.upgrade-card:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.self-card{text-align:center}.self-card .feature-icon,.feature-card .feature-icon{margin:0 auto 13px}.self-card h3,.feature-card h3,.upgrade-card h3{font-size:var(--mk-card-title,16px);font-weight:500;line-height:1.3;letter-spacing:-.25px;margin-bottom:8px}.self-card p,.feature-card p,.upgrade-card p{font-size:14px;color:var(--text-gray);line-height:1.65}.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.feature-card{text-align:center}.upgrade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.upgrade-card{display:flex;gap:14px;align-items:flex-start}.line-choice{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}.line-card{border-radius:28px;padding:28px;border:1px solid var(--border);background:#fff;box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.line-card:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.line-card.recommended{background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--mk-card-shadow,var(--shadow))}.line-card.recommended:hover{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--mk-card-shadow-hover,var(--shadow))}.line-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.plan-icon{display:inline-flex;align-items:center;justify-content:center;font-size:21px;line-height:1}.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:500}.pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.line-card h3{font-size:var(--mk-card-title,16px);font-weight:500;line-height:1.38;letter-spacing:-.2px;margin-bottom:9px}.line-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}.expect-band{display:grid;grid-template-columns:1fr 1fr;gap:18px}.note-box{padding:24px;border-radius:var(--mk-radius-card,22px);background:#fff;border:1px solid var(--border);box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.note-box:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.note-box h3{font-size:18px;font-weight:500;margin-bottom:12px}.note-box ul{list-style:none;display:grid;gap:10px}.note-box li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text-gray);line-height:1.6}.note-box li::before{content:"✓";color:var(--purple);font-weight:900}.pricing-foot{margin-top:28px;font-size:13px;line-height:1.6;color:var(--mk-text-desc,#64748B);text-align:center;font-weight:400;max-width:760px;margin-left:auto;margin-right:auto}.compare-section{margin-top:0}.compare-wrap{margin:0 -8px;padding:0 8px}.pricing-compare-frame{border-radius:var(--r-lg);border:1px solid var(--border);background:#fff;box-shadow:none;overflow:hidden}.pricing-compare-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.compare-table{width:100%;min-width:720px;border-collapse:separate;border-spacing:0;border:none;border-radius:0;background:#fff;box-shadow:none;font-size:14px}.compare-table th,.compare-table td{padding:22px 26px;border-bottom:1px solid var(--border);vertical-align:middle}.compare-table tr:last-child td{border-bottom:none}.compare-table thead th{background:#fff;font-weight:500;color:var(--text-dark);text-align:left}.compare-table thead th:not(:first-child){text-align:center}.compare-table td:first-child{font-weight:500;color:#334155;text-align:left}.compare-table tbody tr:not(.compare-group):hover td{background:var(--bg-gray)}.compare-table .compare-group td{background:var(--bg-gray);font-weight:500;color:#5B21B6;font-size:13px;letter-spacing:.02em;text-transform:uppercase}.compare-yes{text-align:center;font-weight:500;color:var(--green)}.compare-dash{text-align:center;color:var(--text-light);font-weight:600}.compare-val{font-size:14px;line-height:1.45}@media(max-width:960px){.pricing-hero-plans,.section{padding-left:22px;padding-right:22px}.plan-grid,.self-grid,.feature-grid,.upgrade-grid,.line-choice,.expect-band{grid-template-columns:1fr}.pricing-hero-plans{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:64px}.hero-copy{margin-bottom:22px}.pricing-plans-inner .sec-sub{margin-bottom:24px}.pricing-plans-inner .pt-toggle{margin-bottom:28px}.hero-actions{justify-content:flex-start}.pt-toggle{width:100%;max-width:380px}.pt-btn{flex:1}}@media(max-width:640px){.hero-copy{margin-bottom:18px}.pricing-plans-inner .sec-sub{margin-bottom:20px}.pricing-plans-inner .pt-toggle{margin-bottom:24px}.hero-actions{flex-direction:column;align-items:stretch}.btn-dark,.btn-outline{width:100%}.section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}.sec-sub{margin-bottom:0}.plan{padding:22px 18px;box-shadow:0 1px 2px rgba(17,24,39,.04)}.plan:hover{transform:none;box-shadow:0 1px 2px rgba(17,24,39,.04)}.plan.star,.plan.star:hover{box-shadow:0 0 0 1px rgba(139,92,246,.08)}.pt-toggle{max-width:none}}`,
];

const scripts: string[] = [
  String.raw`
function setPricingPageMode(mode) {
  const monthly = mode === 'monthly';
  const monthlyButton = document.getElementById('pricing-tog-m');
  const annualButton = document.getElementById('pricing-tog-a');
  const starterPrice = document.getElementById('pricing-starter-price');
  const proPrice = document.getElementById('pricing-pro-price');
  if (!monthlyButton || !annualButton || !starterPrice || !proPrice) return false;
  monthlyButton.classList.toggle('on', monthly);
  annualButton.classList.toggle('on', !monthly);
  const saveBadge = document.getElementById('pricing-pt-save-badge');
  if (saveBadge) saveBadge.classList.toggle('is-visible', !monthly);
  starterPrice.innerHTML = monthly
    ? '$79<span class="plan-price-period">/ month</span>'
    : '$63<span class="plan-price-period">/mo</span><span class="plan-price-billed">Billed $758/year</span>';
  proPrice.innerHTML = monthly
    ? '$149<span class="plan-price-period">/ month</span>'
    : '$119<span class="plan-price-period">/mo</span><span class="plan-price-billed">Billed $1,428/year</span>';
  return true;
}
window.__ringbookerPricingSetMode = setPricingPageMode;

document.addEventListener('click', (event) => {
  const target = event.target && event.target.closest
    ? event.target.closest('#pricing-tog-m,#pricing-tog-a')
    : null;
  if (!target) return;
  event.preventDefault();
  setPricingPageMode(target.id === 'pricing-tog-a' ? 'annual' : 'monthly');
});

function initPricingPageToggle() {
  if (setPricingPageMode('monthly')) return;
  requestAnimationFrame(initPricingPageToggle);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPricingPageToggle);
} else {
  initPricingPageToggle();
}
`,
];

export const templateTitle =
  'Pricing — AI Receptionist for Salons & Spas | RingBooker';

const plans = [
  {
    name: 'Starter',
    kicker: 'Small team',
    icon: '📞',
    description: 'Starter covers after-hours, overflow, and missed-call recovery.',
    priceId: 'pricing-starter-price',
    price: '$79',
    note: 'Best when you want core after-hours, overflow, and missed-call recovery live quickly.',
    cta: 'Start 14-Day Free Trial',
    href: '/user/signup?plan=starter',
    featured: false,
    benefits: [
      'Up to 100 captured calls/month',
      'Works with your current business number',
      'After-hours and overflow call answering',
      'Booking request capture — via your booking link',
      'Basic reschedule and cancellation handling',
      'Missed-call text back',
      'Callback request capture for calls that need a human',
      'Call summaries with next steps',
      'Call transcripts',
      'Guided setup and test call',
    ],
  },
  {
    name: 'Professional',
    kicker: 'Busy location',
    icon: '⚡',
    description: 'Professional adds follow-up, caller context, and owner transfer where configured.',
    priceId: 'pricing-pro-price',
    price: '$149',
    note: 'Best for multi-provider teams with higher call volume and repeat clients.',
    cta: 'Start 14-Day Free Trial',
    href: '/user/signup?plan=professional',
    featured: true,
    benefits: [
      'Up to 200 captured calls/month',
      'Everything in Starter',
      'Reminder SMS and stronger follow-up',
      'Booking platform sync — Square, Mindbody, and more coming soon',
      'Returning caller notes and preferences',
      'Preferred stylist or provider context',
      'Owner call transfer with caller context',
      'Bilingual workflows where configured',
      'Call recovery insights',
      'Call transcripts and audio recordings',
      'Priority support',
    ],
  },
  {
    name: 'Custom',
    kicker: 'Advanced setup',
    icon: '🏬',
    description: 'Multi-location setup, custom routing, and higher call volume — built around your operation.',
    priceId: undefined,
    price: 'For multiple locations or high volume',
    note: 'Best when you need implementation planning before rollout.',
    cta: 'Get in touch →',
    ctaSubnote: 'Usually responds within 1 business day',
    href: '/contact?intent=enterprise&source=pricing_custom',
    featured: false,
    benefits: [
      'Multi-location setup',
      'Custom call flows, routing, and escalation rules',
      'Custom multilingual routing and workflows',
      'Custom integration planning',
      'Custom captured call volume',
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
      { feature: 'Bilingual / multilingual workflows', starter: '—', pro: 'Configured languages', custom: 'Custom routing + workflows' },
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
                <h1 style={{ fontSize: 13, fontWeight: 500, color: '#534AB7', letterSpacing: '0.01em', margin: 0 }}>
                  AI receptionist pricing for salons &amp; spas
                </h1>
                <p style={{ fontSize: 12, color: '#7F77DD', fontWeight: 400, margin: '2px 0 0' }}>
                  Simple plans. No contracts. Cancel anytime.
                </p>
                <div aria-hidden="true" style={{ width: 32, height: 2, background: '#AFA9EC', borderRadius: 2, margin: '14px 0 16px' }} />
              </div>

              <div className="pricing-plans-inner">
                <div className="sec-label">Plans</div>
                <h2 className="sec-title">
                  Choose the <em>right</em>
                  <br />
                  <em>level</em> of call recovery.
                </h2>
                <p className="sec-sub">
                  From after-hours coverage to follow-up and multi-location routing — each plan adds more control.
                </p>
                <div className="pt-toggle">
                  <button className="pt-btn on" id="pricing-tog-m" type="button">Monthly</button>
                  <button className="pt-btn" id="pricing-tog-a" type="button">Annual</button>
                  <span className="save-badge" id="pricing-pt-save-badge">
                    <span className="save-dot" aria-hidden />
                    Save up to $358/yr
                  </span>
                </div>

                <div className="plan-grid">
                  {plans.map((plan) => (
                    <div className={`plan ${plan.featured ? 'star' : ''}`} key={plan.name}>
                      {plan.featured ? <div className="plan-badge">Most popular</div> : null}
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-desc">{plan.description}</div>
                      <div className={`plan-price ${plan.priceId ? '' : 'plan-price-custom'}`} id={plan.priceId}>
                        {plan.priceId ? (
                          <>
                            {plan.price}
                            <span className="plan-price-period">/ month</span>
                          </>
                        ) : (
                          plan.price
                        )}
                      </div>
                      {plan.priceId ? <p className="plan-cta-subnote">+ tax where applicable</p> : null}
                      <div className="plan-div" />
                      <ul className="plan-feats">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                      <a className={`plan-btn ${plan.featured ? 'pb-dark' : 'pb-outline'}`} href={plan.href}>{plan.cta}</a>
                      {'ctaSubnote' in plan && plan.ctaSubnote ? (
                        <p className="plan-cta-subnote">{plan.ctaSubnote}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <p className="pricing-foot">
                  14-day free trial. No card to start — only required when you go live. No contracts · Cancel anytime. Prices exclude applicable taxes. Final total shown at checkout.
                </p>
              </div>
            </div>
          </section>

          <section className="section gray pricing-compare-lower">
            <div className="container">
              <div className="compare-section">
                <div className="sec-label">Compare plans</div>
                <h2 className="sec-title">
                  Compare
                  <br />
                  <em>RingBooker</em> plans
                </h2>
                <p className="sec-sub" style={{ marginBottom: 28 }}>
                  See what is included in Starter, Professional, and Custom.
                </p>
                <div className="compare-wrap">
                  <div className="pricing-compare-frame">
                    <div className="pricing-compare-scroll">
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
            </div>
          </section>

          <section className="section pricing-faq-cta">
            <div className="container">
              <MarketingFaqAccordion
                items={PRICING_FAQ_ITEMS}
                wide
                title="Pricing questions, answered plainly."
                subtitle={null}
              />
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
