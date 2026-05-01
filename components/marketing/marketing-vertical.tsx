import Link from 'next/link';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { CallPreviewPlayer, type CallLine } from '@/components/marketing/call-preview-player';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';

export type MarketingVerticalKey = 'nail-salon' | 'hair-salon' | 'spa' | 'med-spa' | 'beauty-clinic';

const SERVICE_BY_VERTICAL: Record<
  MarketingVerticalKey,
  { name: string; serviceType: string; description: string }
> = {
  'nail-salon': {
    name: 'AI Phone Answering Service for Nail Salons',
    serviceType: 'Nail salon answering service',
    description:
      'After-hours and overflow AI call answering for nail salons, including current-number forwarding, missed-call text back, configurable English and Vietnamese workflows, booking intent capture, walk-in handling, pricing questions, and reschedule support.',
  },
  'hair-salon': {
    name: 'AI Phone Answering Service for Hair Salons',
    serviceType: 'Hair salon answering service',
    description:
      'AI call answering for hair salons that handles overflow calls, stylist preference capture, color and extension booking questions, reschedules, cancellation intent, and appointment confirmations.',
  },
  spa: {
    name: 'AI Phone Answering for Day Spas and Wellness Studios',
    serviceType: 'Spa answering service',
    description:
      'After-hours and overflow AI phone answering for day spas and wellness studios — treatment-aware booking scripts, couples massage scheduling, package questions, missed-call recovery, and SMS follow-up on your current number.',
  },
  'med-spa': {
    name: 'AI Phone Answering Service for Med Spas',
    serviceType: 'Med spa answering service',
    description:
      'AI phone answering for med spas that captures consultation calls, routes high-value inquiries after hours, supports reminder workflows, and handles Botox, filler, and laser booking questions with consultation-first guardrails.',
  },
  'beauty-clinic': {
    name: 'AI Phone Answering Service for Beauty and Aesthetic Clinics',
    serviceType: 'Beauty clinic answering service',
    description:
      'AI call answering for beauty and aesthetic clinics with consultation-first intake, premium call scripts, treatment continuity context, provider preference capture, approved pre-care and post-care guidance, and call outcome summaries.',
  },
};

type BookingToolIntegration = {
  id: string;
  name: string;
  logoSrc: string;
  status: 'live' | 'compatible' | 'soon';
};

/** Logos under /public/images — same assets as user portal calendar integrations. */
const BOOKING_TOOL_INTEGRATIONS: BookingToolIntegration[] = [
  { id: 'square', name: 'Square', logoSrc: '/images/square.png', status: 'live' },
  { id: 'vagaro', name: 'Vagaro', logoSrc: '/images/vagaro.png', status: 'compatible' },
  { id: 'mindbody', name: 'Mindbody', logoSrc: '/images/mindbody.webp', status: 'soon' },
  { id: 'booksy', name: 'Booksy', logoSrc: '/images/booksy.png', status: 'compatible' },
];

const TRIAL_CTA_BASE =
  'inline-flex items-center justify-center rounded-full border border-slate-200 bg-transparent px-6 py-3 text-[14px] font-semibold text-slate-900 transition';

const DEMO_CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-bold text-white transition hover:-translate-y-px hover:brightness-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600';

export type IndustryLandingTheme = {
  /** Page background wash behind hero + sections */
  pageShellBg: string;
  /** Bottom “Try demo” banner gradient */
  finalCtaGradient: string;
  /** Text color on white primary button inside final CTA */
  finalCtaPrimaryBtnText: string;
  /** Hero primary demo button */
  demoCtaClass: string;
  /** Hero secondary trial link */
  trialCtaClass: string;
  /** FAQ “+” and VsTable “With RingBooker” column accent */
  accentClass: string;
};

const INDUSTRY_THEME: Record<MarketingVerticalKey, IndustryLandingTheme> = {
  'nail-salon': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ede9fe_0%,#fdf4ff_38%,#ffffff_62%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#5b21b6_0%,#7c3aed_50%,#a78bfa_100%)]',
    finalCtaPrimaryBtnText: 'text-violet-900',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-violet-800 via-violet-600 to-violet-500 shadow-[0_6px_18px_rgba(91,33,182,0.16),0_1px_4px_rgba(91,33,182,0.08)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-violet-500 hover:text-violet-600`,
    accentClass: 'text-violet-600',
  },
  'hair-salon': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ffedd5_0%,#fffbeb_42%,#ffffff_68%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#9a3412_0%,#d97706_48%,#f59e0b_100%)]',
    finalCtaPrimaryBtnText: 'text-amber-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-amber-800 via-amber-600 to-amber-500 shadow-[0_6px_18px_rgba(180,83,9,0.15),0_1px_4px_rgba(180,83,9,0.08)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-amber-500 hover:text-amber-800`,
    accentClass: 'text-amber-600',
  },
  spa: {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ccfbf1_0%,#f0fdfa_44%,#ffffff_70%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#115e59_0%,#0d9488_50%,#14b8a6_100%)]',
    finalCtaPrimaryBtnText: 'text-teal-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-teal-800 via-teal-600 to-emerald-500 shadow-[0_6px_18px_rgba(13,148,136,0.15),0_1px_4px_rgba(13,148,136,0.08)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-teal-500 hover:text-teal-800`,
    accentClass: 'text-teal-600',
  },
  'med-spa': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#e0e7ff_0%,#eef2ff_46%,#ffffff_72%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#312e81_0%,#4f46e5_52%,#818cf8_100%)]',
    finalCtaPrimaryBtnText: 'text-indigo-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-indigo-900 via-indigo-600 to-indigo-500 shadow-[0_6px_18px_rgba(67,56,202,0.16),0_1px_4px_rgba(67,56,202,0.08)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-indigo-500 hover:text-indigo-800`,
    accentClass: 'text-indigo-600',
  },
  'beauty-clinic': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#fae8ff_0%,#fdf4ff_46%,#ffffff_72%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#86198f_0%,#c026d3_50%,#e879f9_100%)]',
    finalCtaPrimaryBtnText: 'text-fuchsia-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-fuchsia-900 via-fuchsia-600 to-pink-500 shadow-[0_6px_18px_rgba(192,38,211,0.16),0_1px_4px_rgba(192,38,211,0.08)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-fuchsia-500 hover:text-fuchsia-800`,
    accentClass: 'text-fuchsia-600',
  },
};

const CALL_PREVIEWS: Record<MarketingVerticalKey, { lines: CallLine[]; businessName: string; accent: string }> = {
  'nail-salon': {
    businessName: 'Luxe Nail Studio',
    accent: '#7C3AED',
    lines: [
      { role: 'caller', text: 'I saw your Instagram — how much for a full set with gel?' },
      { role: 'ai', text: 'Full set with gel is $45. I can book you in today — do you have a preference for morning or afternoon?' },
      { role: 'caller', text: 'Morning, like around 10?' },
      { role: 'ai', text: '10am works. Can I get your name to hold the spot?' },
    ],
  },
  'hair-salon': {
    businessName: 'Studio Luxe Hair',
    accent: '#B45309',
    lines: [
      { role: 'caller', text: 'Can I get a balayage with Sarah on Saturday?' },
      { role: 'ai', text: 'Sarah is fully booked Saturday. I have a 2pm with Jessica who also specializes in balayage — would that work?' },
      { role: 'caller', text: 'Sure, 2pm is fine.' },
      { role: 'ai', text: 'Booked. You\'ll get a confirmation text shortly.' },
    ],
  },
  spa: {
    businessName: 'Serenity Day Spa',
    accent: '#0D9488',
    lines: [
      { role: 'caller', text: 'Do you have a couples massage this Saturday afternoon?' },
      { role: 'ai', text: 'Yes — we have a couples suite at 2pm and 4pm Saturday, each 60 minutes. Which would you prefer?' },
      { role: 'caller', text: '4pm sounds great.' },
      { role: 'ai', text: 'Perfect. I\'ll hold that for you — name and number for confirmation?' },
    ],
  },
  'med-spa': {
    businessName: 'Revive Med Spa',
    accent: '#4F46E5',
    lines: [
      { role: 'caller', text: 'I\'m interested in Botox and filler — what does a consultation look like?' },
      { role: 'ai', text: 'Our consultations are complimentary and take about 30 minutes. A provider reviews your goals and creates a personalized plan. Can I schedule one for you?' },
      { role: 'caller', text: 'Yes, next week if possible.' },
      { role: 'ai', text: 'I have Tuesday at 11am or Thursday at 2pm — which works?' },
    ],
  },
  'beauty-clinic': {
    businessName: 'Aura Beauty Clinic',
    accent: '#A21CAF',
    lines: [
      { role: 'caller', text: 'I had laser done last month and want to book my next session — do I need another consultation?' },
      { role: 'ai', text: 'If your last session was within 90 days and there are no new concerns, we can book directly. Would you like to schedule with the same provider?' },
      { role: 'caller', text: 'Yes, please.' },
      { role: 'ai', text: 'Let me find the next available slot with your provider.' },
    ],
  },
};

type IntegrationRowLabels = {
  eyebrow: string;
  live: string;
  compatible: string;
  soon: string;
  logoAlt: (name: string) => string;
};

const DEFAULT_INTEGRATION_ROW_LABELS: IntegrationRowLabels = {
  eyebrow: 'Works with your booking tools',
  live: 'Live',
  compatible: 'Workflow compatible',
  soon: 'Coming soon',
  logoAlt: (name) => `${name} logo`,
};

function IntegrationRow({
  eyebrowClass = 'text-slate-400',
  labels = DEFAULT_INTEGRATION_ROW_LABELS,
}: {
  eyebrowClass?: string;
  labels?: IntegrationRowLabels;
}) {
  return (
    <div className="mt-6">
      <p className={`mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{labels.eyebrow}</p>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 sm:gap-x-10">
        {BOOKING_TOOL_INTEGRATIONS.map((item) => {
          const isLive = item.status === 'live';
          const isCompatible = item.status === 'compatible';
          return (
            <div key={item.id} className="flex items-start gap-2.5">
              <img
                src={item.logoSrc}
                alt={labels.logoAlt(item.name)}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 object-contain"
                loading="lazy"
                decoding="async"
              />
              <div className="flex min-w-0 flex-col justify-center pt-0.5">
                <span className="text-[13px] font-bold leading-tight tracking-tight text-slate-900">{item.name}</span>
                {isLive ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    {labels.live}
                  </div>
                ) : isCompatible ? (
                  <div className="mt-1 text-[10px] font-semibold tracking-wide text-slate-500">{labels.compatible}</div>
                ) : (
                  <div className="mt-1 text-[10px] font-semibold tracking-wide text-slate-400">{labels.soon}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Faq({
  items,
  eyebrow = 'Common Questions',
  title = 'Frequently Asked Questions',
}: {
  items: Array<{ q: string; a: string }>;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <div className="mx-auto mt-24 max-w-6xl px-6">
      <MarketingFaqAccordion
        items={items}
        embedded
        eyebrow={eyebrow}
        title={title}
        subtitle={null}
        openFirstItem
      />
    </div>
  );
}

const verticalStepCarouselScript = `
(() => {
  const tracks = document.querySelectorAll('[data-vertical-step-track]');
  tracks.forEach((track) => {
    const nav = track.querySelector('[data-vertical-step-nav]');
    const scroller = track.querySelector('[data-vertical-step-scroller]');
    if (!nav || !scroller) return;
    const buttons = Array.from(nav.querySelectorAll('[data-vertical-step-btn]'));
    const cards = Array.from(scroller.querySelectorAll('[data-vertical-step-card]'));
    if (!buttons.length || !cards.length) return;

    const setActive = (idx) => {
      buttons.forEach((btn, i) => {
        btn.dataset.active = i === idx ? 'true' : 'false';
      });
    };

    const updateActiveByScroll = () => {
      const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const dist = Math.abs(cardCenter - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActive(bestIdx);
    };

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        cards[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setActive(i);
      });
    });

    let raf = 0;
    scroller.addEventListener('scroll', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActiveByScroll);
    }, { passive: true });
    setActive(0);
    updateActiveByScroll();
  });
})();
`;

type HowItWorksStep = { n: string; title: string; body: string };
function HowItWorks({
  steps,
  accentBg,
  eyebrowClass = 'text-slate-400',
  heading = 'How RingBooker Works',
  eyebrow = 'Setup',
  subtitle = 'No new phone number needed. Configure the essentials in about 15 minutes, then forward your existing line for recovery coverage.',
  stepLabel = 'Step',
}: {
  steps: HowItWorksStep[];
  accentBg: string;
  eyebrowClass?: string;
  heading?: string;
  eyebrow?: string;
  subtitle?: string;
  stepLabel?: string;
}) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 md:pb-16" data-vertical-step-track>
      <div className={`mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl max-w-[22ch] mx-auto">{heading}</h2>
      <p className="mx-auto max-w-xl text-center text-[15px] text-slate-500">{subtitle}</p>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 md:hidden justify-center" data-vertical-step-nav>
        {steps.map((s) => (
          <a
            key={`vertical-step-nav-${s.n}`}
            href={`#vertical-step-${s.n}`}
            data-vertical-step-btn
            data-active={s.n === '1' ? 'true' : 'false'}
            className="inline-flex min-w-[84px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
          >
            {stepLabel} {s.n}
          </a>
        ))}
      </div>
      <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0" data-vertical-step-scroller>
        {steps.map((s) => (
          <div
            key={s.n}
            id={`vertical-step-${s.n}`}
            data-vertical-step-card
            className="relative w-[84%] shrink-0 snap-center rounded-3xl border border-slate-200 bg-white p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg md:w-auto md:shrink md:snap-none"
          >
            <div className={`mb-4 mx-auto flex h-9 w-9 items-center justify-center rounded-full ${accentBg} text-sm font-bold text-white`}>{s.n}</div>
            <p className="text-[15px] font-bold text-slate-900">{s.title}</p>
            <p className="mt-2 text-[13.5px] leading-6 text-slate-500">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type StatItem = { value: string; label: string; sub: string };
function StatStrip({ stats, accent }: { stats: StatItem[]; accent: string }) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 md:pb-16">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <article
            key={s.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className={`text-5xl font-bold tracking-tight ${accent}`}>{s.value}</p>
            <p className="mt-2 text-base font-bold text-slate-900">{s.label}</p>
            <p className="mt-1 text-[13.5px] leading-6 text-slate-500">{s.sub}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type PainPoint = { icon?: string; title: string; body: string };
function PainPoints({
  points,
  heading,
  eyebrowClass = 'text-slate-400',
  eyebrow = 'Why Calls Get Missed',
}: {
  points: PainPoint[];
  heading: string;
  eyebrowClass?: string;
  eyebrow?: string;
}) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 md:pb-16">
      <div className={`mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl max-w-[22ch] mx-auto">{heading}</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {points.map((p) => (
          <article
            key={p.title}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-6 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
          >
            {p.icon && <div className="mb-3 text-2xl">{p.icon}</div>}
            <p className="text-[15px] font-bold text-slate-900">{p.title}</p>
            <p className="mt-2 text-[13.5px] leading-6 text-slate-600">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type FeatureItem = { icon: string; title: string; body: string };
function FeatureGrid({
  features,
  accent,
  eyebrowClass = 'text-slate-400',
  heading = 'Every feature you need, built in',
  eyebrow = 'What RingBooker Does',
}: {
  features: FeatureItem[];
  accent: string;
  eyebrowClass?: string;
  heading?: string;
  eyebrow?: string;
}) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 md:pb-16">
      <div className={`mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl max-w-[22ch] mx-auto">{heading}</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <article
            key={f.title}
            className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-xl ${accent}`}>{f.icon}</div>
            <p className="text-[15px] font-bold text-slate-900">{f.title}</p>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-500">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VsTable({
  rows,
  accentClass,
  eyebrowClass = 'text-slate-400',
  heading = 'Stop relying on voicemail',
  labels = { eyebrow: 'Before vs. After', scenario: 'Scenario', without: 'Without RingBooker', with: 'With RingBooker' },
}: {
  rows: Array<{ scenario: string; without: string; with: string }>;
  accentClass: string;
  eyebrowClass?: string;
  heading?: string;
  labels?: { eyebrow: string; scenario: string; without: string; with: string };
}) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 md:pb-16">
      <div className={`mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{labels.eyebrow}</div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl max-w-[22ch] mx-auto">{heading}</h2>
      <div className="mt-6 overflow-x-auto overscroll-x-contain rounded-3xl border border-slate-200 bg-white [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-slate-100 bg-slate-50 px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <span>{labels.scenario}</span>
            <span>{labels.without}</span>
            <span className={accentClass}>{labels.with}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.scenario}
              className="grid grid-cols-[1fr_1fr_1fr] border-b border-slate-100 px-5 py-4 text-[13.5px] last:border-b-0"
            >
              <span className="font-semibold text-slate-700">{row.scenario}</span>
              <span className="flex items-start gap-2 text-slate-500">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg viewBox="0 0 10 10" width="8" height="8"><path d="M2 2l6 6M8 2l-6 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </span>
                {row.without}
              </span>
              <span className="flex items-start gap-2 font-semibold text-slate-800">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <svg viewBox="0 0 10 10" width="8" height="8"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                {row.with}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({
  label,
  title,
  subtitle,
  demoPath,
  shellGradientClass,
  primaryBtnTextClass,
}: {
  label: string;
  title: string;
  subtitle: string;
  demoPath: string;
  shellGradientClass: string;
  primaryBtnTextClass: string;
}) {
  return (
    <section className="mx-auto mt-[88px] max-w-6xl px-6 pb-12 md:pb-16">
      <div className={`relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white md:px-14 ${shellGradientClass}`}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-72 w-72 rounded-full bg-white/10" />
        <p className="relative text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">{label}</p>
        <h2 className="relative mt-3 text-[clamp(28px,5vw,48px)] font-bold leading-[1.1] tracking-tight">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/75">{subtitle}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={demoPath}
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-bold shadow-[var(--mk-shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--mk-shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${primaryBtnTextClass}`}
          >
            <DemoCtaPhoneIcon width={18} height={18} />
            Try a Live Demo Call
          </a>
          <Link
            href="/user/signup"
            className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/20"
          >
            Start Free 14-Day Trial
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── NAIL SALON ────────────────────────────────────────────────────────────────

function NailPage({ theme }: { theme: IndustryLandingTheme }) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex rounded-full border border-violet-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-violet-700">
            AI receptionist &amp; call recovery for nail salons
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Nail Salon Calls Get Missed Most During Busy Service Hours
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            RingBooker is the AI receptionist for nail salons — after hours, peak-hour overflow, and weekend rushes. Works
            on your current number, supports English and Vietnamese call flows, and captures booking intent before missed
            calls become lost revenue. 37% of nail salon calls are missed, 82% during business hours, and 80% of callers
            never leave voicemail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/nail-salon" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free 14-Day Trial
            </Link>
            <Link href="/industries/nail-salon/vi" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">
              🇻🇳 Tiếng Việt
            </Link>
          </div>
          <IntegrationRow eyebrowClass={theme.accentClass} />
        </div>
        <div className="hidden lg:block lg:pt-8">
          <CallPreviewPlayer {...CALL_PREVIEWS['nail-salon']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-violet-600"
        stats={[
          {
            value: '37%',
            label: 'of nail salon calls are missed',
            sub: 'Zenoti 2025: missed-call volume is already high before you factor in overflow spikes.',
          },
          {
            value: '82%',
            label: 'happen during business hours',
            sub: 'Zenoti 2025: most loss happens while you are open, when staff are busy with clients.',
          },
          {
            value: '80%',
            label: "of callers don't leave voicemail",
            sub: 'Ambs Call Center 2025: silent hang-ups are common, so callbacks alone rarely recover demand.',
          },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why nail salons lose calls — and clients"
        eyebrowClass={theme.accentClass}
        points={[
          {
            icon: '💅',
            title: 'Techs are with clients when the phone rings',
            body: 'During busy hours, every technician has hands full. No one can stop mid-service to answer pricing questions or take a same-day walk-in call. The phone goes to voicemail — and voicemail doesn\'t convert.',
          },
          {
            icon: '💰',
            title: 'Callers want prices, not a callback',
            body: 'The most common nail salon calls are "how much for a full set?" or "do you have availability today?" These are high-intent callers who will book — if someone answers. If not, they call the next salon.',
          },
          {
            icon: '📅',
            title: 'Walk-ins and same-day calls flood in on weekends',
            body: 'Weekend and lunch-hour call volume spikes exactly when your team is most occupied. After-hours calls from clients checking hours or pricing also go unanswered. You can\'t grow if you\'re invisible outside open hours.',
          },
          {
            icon: '📵',
            title: 'Voicemail is a dead end for nail clients',
            body: 'Almost no one leaves a voicemail for a nail salon. They just call the next place. Even customers who left messages before rarely do it again. The only way to capture these bookings is to answer live.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-violet-50 text-violet-600"
        eyebrowClass={theme.accentClass}
        heading="What RingBooker handles for nail salon calls"
        features={[
          { icon: '📞', title: 'Works on your current number', body: 'No new phone number needed — just forward overflow or after-hours calls.' },
          { icon: '🇻🇳', title: 'English + Vietnamese workflows', body: 'Can be configured for bilingual call flows, summaries, and salon-specific scripts.' },
          { icon: '💅', title: 'Pricing questions answered clearly', body: 'Full set, gel, acrylic, dip, pedicure — answered from your configured service menu and prices.' },
          { icon: '📅', title: 'Same-day and walk-in booking', body: 'Captures high-intent callers who want a slot today or this weekend.' },
          { icon: '🔄', title: 'Reschedule and cancel support', body: 'Captures routine change requests and routes anything uncertain with context for your team.' },
          { icon: '💬', title: 'SMS confirmation and follow-up', body: 'Sends booking confirmation texts so clients don\'t slip through the cracks.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-violet-600"
        eyebrowClass={theme.accentClass}
        heading="How RingBooker works on your current salon number"
        steps={[
          { n: '1', title: 'Forward calls to RingBooker', body: 'Set up call forwarding on your current salon number — for overflow, after-hours, or full-time. Setup time depends on your phone provider.' },
          { n: '2', title: 'RingBooker answers with your business info', body: 'Your services, pricing, hours, and staff are loaded in. The AI handles real callers immediately.' },
          { n: '3', title: 'Intent captured, SMS sent, you review', body: 'Captured booking intent and call summaries land in your dashboard. Confirmations can go to the client when the flow is configured.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        eyebrowClass={theme.accentClass}
        heading="How missed nail salon calls get recovered"
        rows={[
          { scenario: 'After-hours pricing call', without: 'Voicemail — caller hangs up', with: 'Answered, price given, booking captured' },
          { scenario: 'Weekend overflow', without: 'Call drops, client calls next salon', with: 'Overflow intent captured instead of disappearing' },
          { scenario: 'Vietnamese-speaking caller', without: 'Language barrier, lost booking', with: 'Bilingual workflow or summary support when configured' },
          { scenario: 'Same-day walk-in request', without: 'Missed — tech can\'t pick up', with: 'Availability captured or booked when connected' },
        ]}
      />
    </>
  );
}

const VI_NAIL_CALL_PREVIEW = {
  businessName: 'Tiệm Nail Việt',
  accent: '#7C3AED',
  lines: [
    { role: 'caller', text: 'Dạ tiệm còn chỗ làm full set chiều nay không?' },
    { role: 'ai', text: 'Dạ còn. Chị muốn khoảng mấy giờ và làm full set gel hay acrylic ạ?' },
    { role: 'caller', text: 'Khoảng 5 giờ, gel nhé.' },
    { role: 'ai', text: 'Dạ em ghi nhận 5 giờ chiều full set gel. Cho em xin tên để tiệm giữ lịch ạ?' },
  ] satisfies CallLine[],
};

const VI_NAIL_FAQ_ITEMS = [
  {
    q: 'RingBooker có nói tiếng Việt không?',
    a: 'Có — RingBooker nghe máy bằng cả tiếng Việt và tiếng Anh. Đây là tính năng được thiết kế riêng cho tiệm nail người Việt tại Mỹ.',
  },
  {
    q: 'Tôi có phải đổi số điện thoại không?',
    a: 'Không. RingBooker hoạt động qua chuyển tiếp cuộc gọi từ số hiện tại của tiệm. Khách vẫn gọi vào số quen thuộc — không có gì thay đổi với họ.',
  },
  {
    q: 'Setup có khó không?',
    a: 'Không. Setup mất khoảng 15 phút. Bạn nhập thông tin dịch vụ, cài chuyển tiếp cuộc gọi, và bắt đầu ngay.',
  },
  {
    q: 'Có thay thế lễ tân người thật không?',
    a: 'Không — RingBooker là lớp phụ trợ, không phải thay thế. Lễ tân và thợ của bạn vẫn làm việc bình thường. RingBooker chỉ bắt kịp những cuộc gọi mà tiệm không kịp nghe máy.',
  },
  {
    q: 'Giá bao nhiêu?',
    a: 'Bắt đầu từ $79/tháng. Dùng thử miễn phí 14 ngày — không cần thẻ tín dụng.',
  },
  {
    q: 'RingBooker có phải là lễ tân AI cho tiệm nail không?',
    a: 'Có — RingBooker hoạt động như một lễ tân AI cho tiệm nail, trả lời câu hỏi về giá, lịch hẹn, và dịch vụ bằng tiếng Việt và tiếng Anh trên số điện thoại hiện tại của tiệm.',
  },
  {
    q: 'Có phải nhập thông tin dịch vụ và giá từng cái không?',
    a: 'Không. RingBooker tự đọc website tiệm của bạn và học toàn bộ thông tin — dịch vụ, giá, giờ mở cửa, thợ. Chỉ cần dán link website, kiểm tra lại, và bắt đầu. Mất khoảng 15 phút.',
  },
  {
    q: 'RingBooker có tích hợp với phần mềm quản lý tiệm đang dùng không?',
    a: 'Có — RingBooker hoạt động cùng Square Appointments, Vagaro, Mindbody, Booksy và các phần mềm phổ biến khác. Tiệm không cần đổi phần mềm hay thay đổi quy trình hiện tại.',
  },
];

export async function MarketingNailSalonVietnameseTemplate() {
  const theme = INDUSTRY_THEME['nail-salon'];
  const hubPosts = await getPublishedPostsByPathPrefix('industries/nail-salon', { limit: 24 }).catch(() => []);
  const hubArticleLinks = hubPosts.map((p) => ({ href: postPublicPath(p.pathPrefix, p.slug), label: p.title }));
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: VI_NAIL_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
      { '@type': 'ListItem', position: 2, name: 'Nail Salon', item: 'https://ringbooker.com/industries/nail-salon' },
      { '@type': 'ListItem', position: 3, name: 'Tiếng Việt', item: 'https://ringbooker.com/industries/nail-salon/vi' },
    ],
  };

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader active="industry" />
      <main className={`${theme.pageShellBg} pb-16 pt-28`} lang="vi">
        <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-[14px] leading-[1.35] text-[color:var(--mk-text-soft,#94a3b8)]">
            <Link href="/" className="font-normal text-[color:var(--mk-text-soft,#94a3b8)] no-underline hover:text-violet-600">Home</Link>
            <span className="mx-1.5">›</span>
            <Link href="/industries/nail-salon" className="font-normal text-[color:var(--mk-text-soft,#94a3b8)] no-underline hover:text-violet-600">Nail Salon</Link>
            <span className="mx-1.5">›</span>
            <span className="font-normal text-[color:var(--mk-text-soft,#94a3b8)]">Tiếng Việt</span>
          </nav>
        </div>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="inline-flex rounded-full border border-violet-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-violet-700">
              Dành cho tiệm nail người Việt tại Mỹ
            </div>
            <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
              Tiệm Nail Của Bạn Đang Bỏ Lỡ Bao Nhiêu Cuộc Gọi Mỗi Ngày?
            </h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
              RingBooker là lễ tân AI cho tiệm nail — tự động nghe máy bằng tiếng Việt và tiếng Anh khi bạn đang làm dịch vụ cho khách. 37% cuộc gọi tiệm nail bị bỏ lỡ trong giờ làm việc (Zenoti 2025). RingBooker giúp bắt kịp những cuộc gọi đó trên số điện thoại hiện tại của tiệm — không cần đổi số, không cần thay đổi quy trình.
            </p>
            <p className="mt-3 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
              Hoạt động cùng Square Appointments và các phần mềm quản lý tiệm nail khác — không cần thay đổi quy trình hiện tại.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/user/signup" className={theme.demoCtaClass}>
                Thử miễn phí →
              </Link>
              <a href="/demo/nail-salon" className={theme.trialCtaClass}>
                Xem demo trực tiếp
              </a>
              <Link href="/industries/nail-salon" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">
                🇺🇸 English
              </Link>
            </div>
            <IntegrationRow
              eyebrowClass={theme.accentClass}
              labels={{
                eyebrow: 'Hoạt động cùng phần mềm tiệm đang dùng',
                live: 'Đang hoạt động',
                compatible: 'Tương thích quy trình',
                soon: 'Sắp có',
                logoAlt: (name) => `Logo ${name}`,
              }}
            />
          </div>
          <div className="hidden lg:block lg:pt-8">
            <CallPreviewPlayer {...VI_NAIL_CALL_PREVIEW} />
          </div>
        </section>

        <StatStrip
          accent="text-violet-600"
          stats={[
            {
              value: '37%',
              label: 'cuộc gọi tiệm nail bị bỏ lỡ',
              sub: 'Zenoti 2025: 82% trong số đó xảy ra trong giờ làm việc — khi thợ đang làm dịch vụ và không thể nghe máy.',
            },
            {
              value: '80%',
              label: 'khách không để lại tin nhắn thoại',
              sub: 'Khi gặp hộp thư thoại, 80% khách cúp máy và gọi cho tiệm khác (Moneypenny).',
            },
            {
              value: '$38,000+',
              label: 'doanh thu bị mất mỗi năm',
              sub: 'Phân tích RingBooker: một tiệm nail trung bình mất hơn $38,000 mỗi năm vì bỏ lỡ cuộc gọi trong giờ cao điểm và ngoài giờ.',
            },
          ]}
        />

        <PainPoints
          heading="Vì sao tiệm nail bỏ lỡ cuộc gọi?"
          eyebrow="Vì sao cuộc gọi bị bỏ lỡ"
          eyebrowClass={theme.accentClass}
          points={[
            {
              icon: '💸',
              title: 'Bỏ lỡ cuộc gọi = mất khách',
              body: 'Mỗi cuộc gọi nhỡ là một khách tiềm năng có thể đang so sánh 2-3 tiệm cùng lúc. Tiệm nào bắt máy trước thường giữ được khách đó.',
            },
            {
              icon: '😰',
              title: 'Lễ tân bận — điện thoại không ai nghe',
              body: 'Trong giờ cao điểm, lễ tân phải cùng lúc check-in khách, tính tiền, và trả lời câu hỏi. Điện thoại thường bị bỏ qua.',
            },
            {
              icon: '🌙',
              title: 'Khách gọi ngoài giờ — tiệm đã đóng cửa',
              body: '30% lịch hẹn được đặt khi tiệm đã đóng cửa (Phorest). Khách gọi lúc 8 giờ tối không thể chờ đến sáng hôm sau.',
            },
            {
              icon: '⚠️',
              title: 'Khách Việt muốn nói tiếng Việt',
              body: 'Nhiều khách người Việt thoải mái hơn khi giao tiếp bằng tiếng mẹ đẻ. Một lễ tân AI song ngữ giúp phục vụ tốt hơn cả hai nhóm khách.',
            },
          ]}
        />

        <FeatureGrid
          accent="bg-violet-50 text-violet-600"
          eyebrow="RingBooker làm được gì"
          eyebrowClass={theme.accentClass}
          heading="Lễ tân AI cho tiệm nail, chạy trên số hiện tại"
          features={[
            { icon: '💅', title: 'Trả lời tiếng Việt và tiếng Anh', body: 'RingBooker nghe máy bằng cả hai ngôn ngữ — không cần thêm nhân viên.' },
            { icon: '🌙', title: 'Tự động trả lời ngoài giờ', body: 'Bắt kịp mọi cuộc gọi sau khi tiệm đóng cửa — khách đặt lịch, hỏi giá, hoặc đổi hẹn lúc 9 giờ tối đều được phục vụ.' },
            { icon: '📞', title: 'Giữ nguyên số điện thoại hiện tại', body: 'Không cần đổi số. Chuyển tiếp cuộc gọi từ số tiệm hiện tại — khách vẫn gọi vào số quen thuộc.' },
            { icon: '🔔', title: 'Nhắc lịch hẹn tự động', body: 'Giảm tình trạng khách quên lịch, bỏ hẹn — đặc biệt hữu ích cho tiệm đông khách cuối tuần.' },
            { icon: '👥', title: 'Ghi nhận yêu cầu của khách', body: 'Khách muốn đặt với thợ cụ thể? RingBooker ghi lại và chuyển thông tin cho đội ngũ của bạn.' },
            { icon: '📊', title: 'Tóm tắt cuộc gọi đầy đủ', body: 'Mỗi cuộc gọi đều được ghi lại — ai gọi, hỏi gì, cần làm gì tiếp theo.' },
            { icon: '🌐', title: 'Đọc website tiệm tự động — không cần nhập tay', body: 'Chỉ cần dán link website tiệm. RingBooker tự đọc và học thông tin — dịch vụ, giá, giờ mở cửa, thợ — không cần nhập từng thứ một.' },
            { icon: '🔗', title: 'Tích hợp với phần mềm tiệm đang dùng', body: 'RingBooker hoạt động cùng Square Appointments, Vagaro, Mindbody, Booksy và các phần mềm quản lý tiệm nail phổ biến khác.' },
            { icon: '📅', title: 'Tự động đặt lịch và chọn thợ', body: 'Khách gọi đặt lịch và yêu cầu thợ cụ thể? RingBooker ghi nhận tên thợ, dịch vụ, giờ mong muốn, và đồng bộ vào lịch của tiệm.' },
          ]}
        />

        <FeatureGrid
          accent="bg-violet-50 text-violet-600"
          eyebrow="Vì sao chọn RingBooker"
          eyebrowClass={theme.accentClass}
          heading="Tại sao chủ tiệm nail người Việt chọn RingBooker?"
          features={[
            { icon: '⚡', title: 'Setup 15 phút', body: 'Dán link website. RingBooker tự học thông tin tiệm. Cài chuyển tiếp cuộc gọi. Xong.' },
            { icon: '🔗', title: 'Dùng được với phần mềm tiệm đang có', body: 'Không cần đổi Square, Vagaro, hay Booksy. RingBooker chạy song song — không ảnh hưởng gì đến quy trình hiện tại.' },
            { icon: '📞', title: 'Giữ nguyên số tiệm', body: 'Khách vẫn gọi số cũ. Không cần báo lại cho khách. Không mất khách quen.' },
          ]}
        />

        <HowItWorks
          accentBg="bg-violet-600"
          eyebrow="Setup"
          eyebrowClass={theme.accentClass}
          heading="Setup nhanh trên số điện thoại hiện tại"
          subtitle="Không cần đổi số. Không cần đổi phần mềm đặt lịch. Chỉ cần dán link website, kiểm tra lại thông tin, rồi bật chuyển tiếp cuộc gọi."
          stepLabel="Bước"
          steps={[
            {
              n: '1',
              title: 'Dán link website — xong ngay',
              body: 'RingBooker tự đọc website tiệm của bạn và học tất cả thông tin dịch vụ, giá cả, và giờ làm việc. Không cần nhập tay. Không cần kỹ thuật.',
            },
            {
              n: '2',
              title: 'Chuyển tiếp cuộc gọi',
              body: 'Trong giờ bận hoặc sau giờ đóng cửa — cuộc gọi được trả lời ngay thay vì đổ vào hộp thư thoại.',
            },
            {
              n: '3',
              title: 'Khách được phục vụ, bạn nhận tóm tắt',
              body: 'Mọi thông tin cuộc gọi được tổng hợp và gửi cho bạn — đủ ngữ cảnh để follow up hiệu quả.',
            },
          ]}
        />

        <VsTable
          accentClass={theme.accentClass}
          eyebrowClass={theme.accentClass}
          heading="Khác biệt khi tiệm không còn phụ thuộc vào hộp thư thoại"
          labels={{ eyebrow: 'Trước và sau', scenario: 'Tình huống', without: 'Không có RingBooker', with: 'Có RingBooker' }}
          rows={[
            { scenario: 'Khách gọi lúc 8 tối', without: 'Hộp thư thoại — khách cúp máy', with: 'Được trả lời ngay, ghi nhận lịch hẹn' },
            { scenario: 'Thợ đang làm dịch vụ, điện thoại reo', without: 'Không ai nghe — khách gọi tiệm khác', with: 'AI nghe máy và xử lý thông tin' },
            { scenario: 'Khách hỏi giá bằng tiếng Việt', without: 'Lễ tân không trả lời được hoặc bị nhầm lẫn', with: 'Trả lời chính xác bằng tiếng Việt' },
            { scenario: 'Khách muốn đặt với thợ quen', without: 'Không ai ghi lại, dễ bị quên', with: 'Ghi nhận yêu cầu và chuyển cho đội ngũ' },
            { scenario: 'Khách muốn đặt lịch lúc 9 giờ tối', without: 'Tiệm đóng cửa, khách không đặt được', with: 'RingBooker nhận lịch và đồng bộ vào hệ thống ngay' },
            { scenario: 'Khách mới hỏi dịch vụ và giá', without: 'Phải gọi lại hoặc nhắn tin giải thích', with: 'AI đọc từ website tiệm, trả lời chính xác ngay lập tức' },
          ]}
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <VerticalHubArticles
            vertical="nail-salon"
            links={hubArticleLinks}
            eyebrowClass={theme.accentClass}
            copyOverride={{
              eyebrow: 'Bài viết liên quan',
              heading: 'Hướng dẫn cho tiệm nail muốn giảm cuộc gọi nhỡ',
              sub: 'Tìm hiểu thêm về cuộc gọi ngoài giờ, giờ cao điểm, chuyển tiếp cuộc gọi, và cách giữ nguyên số điện thoại hiện tại của tiệm.',
            }}
          />
        </div>

        <Faq items={VI_NAIL_FAQ_ITEMS} eyebrow="Câu hỏi thường gặp" title="Câu hỏi thường gặp về lễ tân AI cho tiệm nail" />

        <section className="mx-auto mt-[88px] max-w-6xl px-6 pb-12 md:pb-16">
          <div className={`relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white md:px-14 ${theme.finalCtaGradient}`}>
            <div className="pointer-events-none absolute -right-8 -top-10 h-72 w-72 rounded-full bg-white/10" />
            <p className="relative text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">Dành cho tiệm nail người Việt tại Mỹ</p>
            <h2 className="relative mt-3 text-[clamp(28px,5vw,48px)] font-bold leading-[1.1] tracking-tight">Thử miễn phí 14 ngày</h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/75">
              Không cần đổi số. Không cần thay đổi phần mềm đặt lịch. Setup 15 phút.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/user/signup"
                className={`inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-[14px] font-bold shadow-[var(--mk-shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--mk-shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${theme.finalCtaPrimaryBtnText}`}
              >
                Thử miễn phí →
              </Link>
              <a
                href="/demo/nail-salon"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/20"
              >
                Xem demo trực tiếp
              </a>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter descriptionOverride="Lễ tân AI cho tiệm nail người Việt tại Mỹ — nghe máy tiếng Việt và tiếng Anh, giữ nguyên số tiệm, đọc website tự động, và hỗ trợ giảm cuộc gọi nhỡ trong giờ cao điểm." />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script dangerouslySetInnerHTML={{ __html: verticalStepCarouselScript }} />
    </>
  );
}

// ─── HAIR SALON ────────────────────────────────────────────────────────────────

function HairPage({ theme }: { theme: IndustryLandingTheme }) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex rounded-full border border-amber-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-amber-700">
            AI receptionist for hair salons
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Recover Hair Salon Revenue Lost During Services and Peak Hours
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            RingBooker is the AI receptionist for hair salons — covering preferred stylist requests, color slot inquiries,
            and reschedule calls on your current number. 37% of hair salon calls are missed, 77% of clients still prefer
            calling over the app. Revenue-bearing calls don&apos;t have to disappear into voicemail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/hair-salon" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial
            </Link>
          </div>
          <IntegrationRow eyebrowClass={theme.accentClass} />
        </div>
        <div className="hidden lg:block lg:pt-8">
          <CallPreviewPlayer {...CALL_PREVIEWS['hair-salon']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-amber-600"
        stats={[
          {
            value: '37%',
            label: 'of hair salon calls are missed — 82% during business hours',
            sub: 'Zenoti 2025: most missed calls happen while stylists are mid-service, not after closing.',
          },
          {
            value: '77%',
            label: 'of clients prefer calling to reschedule',
            sub: 'Zenoti 2025: not the app, not a form — the phone is still the primary reschedule channel.',
          },
          {
            value: '41%',
            label: 'of US salon service revenue comes from color appointments',
            sub: 'Kline via MUSE Data 2020: these longer services create the exact phone gaps where calls are missed.',
          },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="The hair salon phone problem"
        eyebrowClass={theme.accentClass}
        points={[
          {
            icon: '✂️',
            title: 'Stylists can\'t answer while in-service',
            body: 'Most missed calls happen Saturday mornings and weekday lunch rushes when every stylist is mid-service and the desk is managing walk-ins simultaneously. A colorist mid-application can\'t stop for a 5-minute call, and callers who hear ringing usually move on fast.',
          },
          {
            icon: '👩‍🎨',
            title: 'Preferred stylist requests need careful handling',
            body: 'Hair clients are loyal to their stylist. When their usual person is unavailable, the booking is lost unless someone can quickly offer an alternative. That nuance is impossible to put in a voicemail.',
          },
          {
            icon: '🎨',
            title: 'Color and extension slots are high-value and complex',
            body: 'Balayage, keratin, and extensions need long slots. Getting the right length, the right stylist, and the right prep info requires a real conversation — which gets dropped if no one picks up.',
          },
          {
            icon: '🔄',
            title: 'Cancellations go unrecovered',
            body: 'When a color appointment cancels with short notice, that slot is hard to fill unless someone can immediately reach the next caller. RingBooker can capture and route those recovery calls in real time.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-amber-50 text-amber-600"
        eyebrowClass={theme.accentClass}
        features={[
          { icon: '👩‍🎨', title: 'Stylist preference capture', body: 'Asks for preferred stylist and flags alternatives based on your rules when needed.' },
          { icon: '🎨', title: 'Color appointment context', body: 'Captures service type and timing needs for balayage, keratin, extensions, and other longer services.' },
          { icon: '🔄', title: 'Reschedule and cancel support', body: 'Captures change requests gracefully and preserves stylist preference in the call context.' },
          { icon: '📞', title: 'Works on your current number', body: 'Forward overflow and after-hours — no new number, no disruption to existing clients.' },
          { icon: '💬', title: 'SMS confirmations', body: 'Clients can receive booking confirmations by text when the booking flow is configured.' },
          { icon: '📅', title: '24/7 booking coverage', body: 'Captures after-hours calls when clients browse social media and decide to book late.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-amber-600"
        eyebrowClass={theme.accentClass}
        steps={[
          { n: '1', title: 'Connect your salon number', body: 'Forward overflow or after-hours calls. Your existing number stays the same for all clients.' },
          { n: '2', title: 'Load your services and stylists', body: 'Add your team, service list, and booking rules. RingBooker handles calls with that context immediately.' },
          { n: '3', title: 'Every call captured for follow-up', body: 'Booking summaries go to your dashboard. SMS confirmations can go to the client when the flow is configured.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        eyebrowClass={theme.accentClass}
        rows={[
          { scenario: 'Caller wants their usual stylist', without: 'Voicemail — caller books elsewhere', with: 'Stylist preference captured and routed with context' },
          { scenario: 'Balayage slot inquiry', without: 'Phone rings, no answer', with: 'Duration and service details captured clearly' },
          { scenario: 'Same-day reschedule', without: 'No one picks up, slot lost', with: 'Change request captured with stylist preference' },
          { scenario: 'After-hours booking inquiry', without: 'Voicemail — no conversion', with: 'Booking intent captured, confirmed next morning' },
        ]}
      />
    </>
  );
}

// ─── SPA ───────────────────────────────────────────────────────────────────────

function SpaPage({ theme }: { theme: IndustryLandingTheme }) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex rounded-full border border-teal-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-teal-700">
            AI receptionist for day spas
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            After-Hours Spa Calls Should Not Turn Into Lost Revenue
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            RingBooker is the AI receptionist for day spas — capturing couples massage inquiries, package questions, and
            after-hours calls on your current number. 52% of spa callers hang up after 3 minutes on hold. Your therapists
            stay in treatment rooms. Booking revenue stops disappearing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/day-spa" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial
            </Link>
          </div>
          <IntegrationRow eyebrowClass={theme.accentClass} />
        </div>
        <div className="hidden lg:block lg:pt-8">
          <CallPreviewPlayer {...CALL_PREVIEWS['spa']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-teal-600"
        stats={[
          {
            value: '82%',
            label: 'of missed spa calls happen during business hours',
            sub: "Therapists can't leave treatment rooms for calls, so demand is lost while your team is actively in service.",
          },
          {
            value: '52%',
            label: 'of spa callers hang up after 3 minutes on hold',
            sub: 'Spa callers asking about packages or availability want resolution in one conversation — not a long hold or voicemail.',
          },
          {
            value: '30%',
            label: "of spa bookings happen when you're closed",
            sub: 'Many people browse and call outside 9–5 — especially weekends — when your desk may be closed.',
          },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why spas miss bookings when it matters most"
        eyebrowClass={theme.accentClass}
        points={[
          {
            icon: '🧖',
            title: 'Therapists can\'t leave treatment rooms for calls',
            body: 'When every treatment room is occupied, no one is available to answer the front desk. Callers asking about services, availability, or packages get voicemail — and spa clients rarely leave messages.',
          },
          {
            icon: '💑',
            title: 'Couples and group bookings require real conversation',
            body: 'Booking two or more people at the same time, with matching therapist availability and room availability, is complex. RingBooker can capture the details and check availability when connected to your scheduling workflow.',
          },
          {
            icon: '🌙',
            title: 'After-hours inquiry is high intent',
            body: 'Spa clients often research and decide to book during evenings and weekends — right when your team is off or winding down. Those callers have strong intent and no patience for voicemail.',
          },
          {
            icon: '🔁',
            title: 'Package and pricing questions repeat constantly',
            body: 'Your front desk fields the same calls dozens of times a week: "What\'s the difference between 60 and 90 minutes?" or "Do you offer prenatal massage?" RingBooker can answer from your approved service menu or route anything uncertain to your team.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-teal-50 text-teal-600"
        eyebrowClass={theme.accentClass}
        features={[
          {
            icon: '🧖',
            title: 'Treatment-aware call scripts',
            body: 'Knows your service menu, durations, room types, and prenatal massage policies so answers feel natural and accurate.',
          },
          { icon: '💑', title: 'Couples and group booking details', body: 'Captures guest count, preferred times, and room needs; checks availability when connected.' },
          { icon: '🌙', title: '24/7 call coverage', body: 'Captures evening, weekend, and after-hours calls when booking intent is highest.' },
          {
            icon: '📦',
            title: 'Package and pricing call handling',
            body: 'Your front desk answers the same questions dozens of times a week. RingBooker handles them from your approved service menu — instantly, every time.',
          },
          { icon: '📞', title: 'Current-number forwarding', body: 'Clients call the number they already know. No change from their perspective.' },
          { icon: '💬', title: 'SMS booking confirmations', body: 'Confirmation texts can go out after booking so clients have a clear next step.' },
          { icon: '🔔', title: 'Reminder workflows', body: 'Automated appointment reminders can help reduce last-minute confusion and no-shows.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-teal-600"
        eyebrowClass={theme.accentClass}
        steps={[
          { n: '1', title: 'Set your services and availability windows', body: 'Load your treatment menu, room types, and hours. RingBooker learns your spa\'s context.' },
          { n: '2', title: 'Forward calls during busy or off hours', body: 'Route overflow while sessions are running, or go full-time for always-on coverage.' },
          { n: '3', title: 'Bookings and summaries in your dashboard', body: 'Captured bookings and booking intent are logged. SMS confirmation can go to the client when configured.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        eyebrowClass={theme.accentClass}
        rows={[
          { scenario: 'Couples massage inquiry Saturday', without: 'Voicemail — couple books elsewhere', with: 'Guest count and preferred time captured' },
          { scenario: 'After-hours package question', without: 'No answer, caller doesn\'t call back', with: 'Question answered, booking intent captured' },
          { scenario: 'Therapist-specific request', without: 'Staff unavailable to check', with: 'Preference captured and availability checked when connected' },
          { scenario: 'No-show risk reminder', without: 'No system in place', with: 'Reminder workflow available when configured' },
          {
            scenario: 'Reschedule call during session → potential no-show',
            without: 'Missed — appointment stays confirmed, therapist prepares, client no-shows',
            with: 'Reschedule captured in real time — slot recovered before appointment date',
          },
          {
            scenario: 'Gift certificate inquiry after hours',
            without: 'No answer, caller books elsewhere',
            with: 'Pricing confirmed, intent captured for morning follow-up',
          },
        ]}
      />
    </>
  );
}

// ─── MED SPA ──────────────────────────────────────────────────────────────────

function MedSpaPage({ theme }: { theme: IndustryLandingTheme }) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex rounded-full border border-indigo-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-indigo-700">
            AI receptionist for med spas
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Med Spa Consultation Calls Should Not Go to Voicemail
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            RingBooker is the AI receptionist for med spas — covering after-hours Botox, filler, and consultation calls and
            front-desk overflow during treatment hours. 3 missed consultation calls per day costs $130,000+ in annual
            revenue (Lani AI, 2026). Capture that demand on your current number before it cools off or moves to a
            competitor.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/med-spa" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial
            </Link>
          </div>
          <IntegrationRow eyebrowClass={theme.accentClass} />
        </div>
        <div className="hidden lg:block lg:pt-8">
          <CallPreviewPlayer {...CALL_PREVIEWS['med-spa']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-indigo-600"
        stats={[
          {
            value: '$130,000+',
            label: 'annual revenue at risk',
            sub: '3 missed consultation calls per day costs $130,000+ annually at med spa ticket values. (Lani AI, March 2026)',
          },
          {
            value: '10–15/month',
            label: 'high-value consult requests missed',
            sub: 'Med spas miss 10–15 consultation requests monthly — during treatment hours and after closing, when the desk cannot answer. (NoLo Automation, 2025)',
          },
          {
            value: '71%',
            label: 'with AI call handling',
            sub: '71% of med spa clients are comfortable with AI answering their calls — the highest of any beauty vertical. (Zenoti, 2025)',
          },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why med spas lose high-value leads on the phone"
        eyebrowClass={theme.accentClass}
        points={[
          {
            icon: '💸',
            title: 'Missed consultation calls can become lost demand',
            body: 'At $600 average consultation value, 3 missed calls per day represents $130,000+ in annual lost revenue. (Lani AI, March 2026). If that first contact goes to voicemail, the caller may contact another provider.',
          },
          {
            icon: '😰',
            title: 'Front desk overload weakens inbound conversion',
            body: 'Your front desk juggles check-ins, checkout, patient questions, and phones simultaneously. During treatment hours, high-intent consultation calls can be delayed, rushed, or missed.',
          },
          {
            icon: '🌙',
            title: 'After-hours research intent is your biggest opportunity',
            body: '53% of med spas say paid social is their #1 discovery channel (AmSpa, 2025) — and those leads call after hours. An answering layer captures that intent before it cools off.',
          },
          {
            icon: '⚠️',
            title: 'No-shows and late cancels hurt high-ticket schedules',
            body: 'A longer treatment slot that cancels same-day is hard to fill. Reminder workflows and clear handoff notes can help your team protect the schedule.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-indigo-50 text-indigo-600"
        eyebrowClass={theme.accentClass}
        heading="What RingBooker handles for med spa calls"
        features={[
          {
            icon: '💉',
            title: 'Consultation call capture',
            body: 'Captures Botox consultation calls ($600–$1,200), filler inquiries ($800–$2,500), laser bookings, and body contouring consultations ($1,500–$5,000) with professional, brand-safe scripting.',
          },
          { icon: '🌙', title: 'After-hours lead capture', body: 'Captures high-intent after-hours callers who research at night and need to reach someone.' },
          { icon: '📞', title: 'Current-number answering', body: 'No new number — forward overflow or after-hours on your existing line.' },
          { icon: '🔔', title: 'Reminder workflows', body: 'Automated reminders before high-ticket appointments can help reduce missed appointments.' },
          { icon: '👥', title: 'Provider preference capture', body: 'Captures preferred injector or provider requests and routes them based on your configured workflow.' },
          { icon: '📊', title: 'Call transcripts and analytics', body: 'Every call logged with outcome, intent, and action so your team has full context on follow-up.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-indigo-600"
        eyebrowClass={theme.accentClass}
        heading="How RingBooker handles consultation calls on your current number"
        steps={[
          { n: '1', title: 'Configure your services and providers', body: 'Add your treatment list, providers, and consultation flow. RingBooker handles calls with that context.' },
          { n: '2', title: 'Forward overflow and after-hours calls', body: 'During treatments, busy windows, or full-time — calls get a professional response instead of a dead end.' },
          { n: '3', title: 'Leads captured with follow-up context', body: 'Every consultation intent is logged with call context so your team can follow up from a warmer starting point.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        eyebrowClass={theme.accentClass}
        heading="How med spa consultation calls get recovered"
        rows={[
          { scenario: 'After-hours Botox inquiry', without: 'Voicemail — lead cools', with: 'Consultation intent captured for follow-up or booking' },
          { scenario: 'Front desk busy during treatments', without: 'Phone rings out, caller hangs up', with: 'Answered and routed with consult context' },
          { scenario: 'High-ticket appointment no-show risk', without: 'No reminder system, slot wasted', with: 'Reminder workflow available when configured' },
          { scenario: 'Caller wants specific injector', without: 'No one to check availability', with: 'Provider preference captured and routed' },
          {
            scenario: 'Filler consultation missed call after hours',
            without: 'Caller books competitor within 15 min',
            with: 'Filler interest, timing, and provider preference captured',
          },
          {
            scenario: 'Body contouring inquiry ($1,500–$5,000)',
            without: 'High-value lead goes to voicemail',
            with: 'Consultation intent and treatment area captured with context',
          },
          {
            scenario: 'Med spa after hours consultation AI',
            without: '69% hang up without leaving a message',
            with: 'Captured immediately — clinical coordinator follows up with full context',
          },
        ]}
      />
    </>
  );
}

// ─── BEAUTY CLINIC ────────────────────────────────────────────────────────────

function BeautyClinicPage({ theme }: { theme: IndustryLandingTheme }) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex rounded-full border border-fuchsia-200 bg-white/90 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-fuchsia-700">
            AI receptionist for beauty clinics, wax studios &amp; lash studios
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Beauty Clinic Calls Need More Than Voicemail
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            RingBooker is the AI receptionist for beauty clinics, aesthetic clinics, wax studios, and lash studios —
            covering consultation calls, after-hours inquiries, and missed-call follow-up on your current number. 46% of
            beauty bookings happen outside operating hours. Consultation intent shouldn&apos;t disappear because no one answered.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/beauty-clinic" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial
            </Link>
          </div>
          <IntegrationRow eyebrowClass={theme.accentClass} />
        </div>
        <div className="hidden lg:block lg:pt-8">
          <CallPreviewPlayer {...CALL_PREVIEWS['beauty-clinic']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-fuchsia-600"
        stats={[
          {
            value: '35–40%',
            label: 'of clinic calls missed during service hours',
            sub: 'Estheticians, lash techs, and wax specialists cannot answer while with clients. Those callers rarely wait.',
          },
          {
            value: '46%',
            label: 'of beauty bookings happen after hours',
            sub: 'Consultation calls, lash fill inquiries, and wax requests arrive when your desk is closed (Boulevard, 2025).',
          },
          {
            value: '52%',
            label: 'hang up after 3 minutes on hold',
            sub: 'A clinic-appropriate AI tone keeps callers engaged and converts inquiries into booked appointments (Zenoti, 2025).',
          },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why beauty clinics need a smarter phone layer"
        eyebrowClass={theme.accentClass}
        points={[
          {
            icon: '👑',
            title: 'Clients expect a "patient" experience, not a booking hotline',
            body: 'Beauty and aesthetic clinic callers ask about treatment continuity, pre-care, post-care, and session counts. The global aesthetic medicine market reached $89.64B in 2024 (Grand View Research) — callers expect considered answers, not voicemail.',
          },
          {
            icon: '🤝',
            title: 'Consultation-first calls require handling with care',
            body: 'A caller asking about laser, skin treatment, or waxing is often in discovery. How the call is handled — tone, clarity, follow-through — directly shapes whether they book a consultation.',
          },
          {
            icon: '🔁',
            title: 'Provider continuity is a real retention lever',
            body: 'Returning clients — for lash fills, wax series, or skin treatments — want the same provider. If no one can confirm and book continuity in-call, those clients start shopping again.',
          },
          {
            icon: '📋',
            title: 'Pre-care and post-care questions consume front-desk time',
            body: '"How long before a facial should I stop retinol?" "What to avoid after a wax?" An AI answering layer handles approved instructions or routes clinical questions to your team.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-fuchsia-50 text-fuchsia-600"
        eyebrowClass={theme.accentClass}
        heading="What RingBooker handles for beauty clinic calls"
        features={[
          { icon: '✨', title: 'Premium, clinic-appropriate tone', body: 'Scripts are built for beauty clinic standards — professional, warm, and never salesy.' },
          { icon: '🔁', title: 'Treatment continuity context', body: 'Captures returning patient calls, provider preference, and session context for follow-up or booking.' },
          {
            icon: '💆',
            title: 'Wax, lash, and facial service coverage',
            body: 'Estheticians and lash techs cannot answer mid-service. RingBooker covers pricing questions, booking requests, and pre-care questions while they work — on the current clinic number.',
          },
          { icon: '📋', title: 'Consultation intake capture', body: 'Captures caller intent, treatment interest, and preferred timing before the consultation is booked.' },
          { icon: '📞', title: 'Works on your current number', body: 'No new number needed — just forward overflow or off-hours calls to RingBooker.' },
          { icon: '👥', title: 'Provider preference capture', body: 'Captures preferred provider requests and handles alternatives based on your configured workflow.' },
          { icon: '📊', title: 'Call analytics and transcripts', body: 'Full call logs and summaries so your team has context on every inbound inquiry.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-fuchsia-600"
        eyebrowClass={theme.accentClass}
        heading="How RingBooker works on your current clinic number"
        steps={[
          { n: '1', title: 'Configure clinic services and providers', body: 'Load your treatment list, providers, and consultation flow. RingBooker reflects your clinic\'s standards.' },
          { n: '2', title: 'Forward calls during treatments or after hours', body: 'Cover overflow during busy clinic hours or go full-time. Clients experience a seamless, professional response.' },
          { n: '3', title: 'Every inquiry logged for your team', body: 'Call summaries, intake details, and provider preferences are recorded for clinical follow-up.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        eyebrowClass={theme.accentClass}
        heading="How missed beauty clinic calls get handled"
        rows={[
          { scenario: 'Returning patient books next laser session', without: 'Front desk unavailable — patient calls elsewhere', with: 'Provider preference and session context captured' },
          { scenario: 'After-hours pre-care question', without: 'No answer — patient anxious before treatment', with: 'Approved instructions shared or routed to your team' },
          { scenario: 'Consultation inquiry call', without: 'Rushed or missed, intent lost', with: 'Intent captured, consultation booked with context' },
          { scenario: 'Multi-session treatment follow-up', without: 'No continuity, patient drifts', with: 'Provider preference and continuity notes preserved' },
          {
            scenario: 'Wax studio booking call mid-service',
            without: 'Rings out — caller books elsewhere',
            with: 'Pricing, availability, and pre-care captured immediately',
          },
          {
            scenario: 'Lash fill inquiry after closing',
            without: 'Voicemail — 46% of bookings happen after hours',
            with: 'Fill request captured with timing preference for morning follow-up',
          },
        ]}
      />
    </>
  );
}

// ─── FAQ DATA ─────────────────────────────────────────────────────────────────

const FAQ_BY_VERTICAL: Record<MarketingVerticalKey, Array<{ q: string; a: string }>> = {
  'nail-salon': [
    {
      q: 'Can RingBooker answer English and Vietnamese nail salon calls?',
      a: 'Yes. RingBooker can support bilingual nail salon call flows in English and Vietnamese when configured.',
    },
    {
      q: 'Can it handle nail salon overflow during peak hours?',
      a: 'Yes. RingBooker is built for busy service windows when techs are with clients and the desk cannot answer every call.',
    },
    {
      q: 'Does RingBooker support missed-call text back for nail salons?',
      a: 'Yes. Missed-call text back can help recover callers who hang up during busy periods or after hours.',
    },
    {
      q: 'Does RingBooker work with my current nail salon phone number?',
      a: 'Yes. You keep your existing number and forward calls to RingBooker — for overflow, after-hours, or full-time. Clients call the number they already know.',
    },
    {
      q: 'Can it answer pricing questions for my services?',
      a: 'Yes. You load your service menu and prices during setup. RingBooker can answer "how much for a full set?" or "what\'s the price for dip powder?" from your configured prices.',
    },
    {
      q: 'Is RingBooker an AI receptionist for nail salons?',
      a: 'Yes — RingBooker functions as an AI receptionist for nail salons, handling pricing questions, walk-in availability, and English and Vietnamese call flows on the current number during service hours and after closing.',
    },
    {
      q: 'Is RingBooker an AI answering service for nail salons?',
      a: 'Yes — RingBooker functions as an AI answering service and AI receptionist for nail salons, handling pricing questions, walk-in availability, and Vietnamese call flows on the current number.',
    },
  ],
  'hair-salon': [
    {
      q: 'Can RingBooker route callers to a specific stylist?',
      a: 'Yes. RingBooker asks about stylist preference and can route, flag, or summarize that preference based on your configured workflow. If the preferred stylist is unavailable, it can capture whether the caller is open to alternatives.',
    },
    {
      q: 'Can it handle color appointment bookings correctly?',
      a: 'Yes. Service duration and type are configurable, so balayage, keratin, extensions, and other timed services can be captured with the right context before booking or handoff.',
    },
    {
      q: 'Does it support reschedule and cancellation calls?',
      a: 'Yes. RingBooker captures reschedule and cancellation intent, preserves stylist preference in the call context, and can offer alternative slots when connected to the right scheduling workflow.',
    },
    {
      q: 'Will it work on my existing salon number?',
      a: 'Yes. Forward overflow or after-hours from your current number. Clients never need to call a different number.',
    },
    {
      q: 'What happens during after-hours booking attempts?',
      a: 'After-hours calls are answered, booking intent is captured, and confirmation is sent to the caller. Your dashboard shows every captured booking in the morning.',
    },
    {
      q: 'Can RingBooker handle multiple stylists?',
      a: 'Yes. You configure your stylist list, specialties, and availability rules. RingBooker uses that context to capture preferences, route requests, or summarize next steps.',
    },
    {
      q: 'Does RingBooker work for solo stylists and booth renters?',
      a: 'Yes. Solo stylists and booth renters face the same phone gap as salons — every call arrives when their hands are on a client. RingBooker covers those calls on the current personal number without requiring a new line or booking platform change.',
    },
    {
      q: 'Can it handle bridal party booking calls?',
      a: 'Yes. Bridal inquiries involving multiple people, stylists, and occasion-specific details are captured with party size, preferred date, service mix, and contact information for the team to confirm.',
    },
    {
      q: 'Is RingBooker an AI receptionist for hair salons?',
      a: 'Yes — RingBooker functions as an AI receptionist for hair salons, handling preferred stylist requests, color slot inquiries, and reschedule calls on the current number.',
    },
    {
      q: 'Is RingBooker an AI answering service for hair salons?',
      a: 'Yes — RingBooker functions as an AI answering service and AI receptionist for hair salons, handling preferred stylist requests, color inquiries, and reschedule calls on the current number.',
    },
  ],
  spa: [
    {
      q: 'Can RingBooker book couples massages and multi-person appointments?',
      a: 'Yes. Couples and group booking flows are supported. RingBooker asks about the number of guests, preferred time, and room needs, then checks availability when connected or routes a clear summary to your team.',
    },
    {
      q: 'Can it handle treatment package questions?',
      a: 'Yes. Load your service menu — 60-minute vs. 90-minute options, package names, and pricing — and RingBooker answers those questions accurately on every call.',
    },
    {
      q: 'Can it answer after-hours calls for weekend bookings?',
      a: 'Yes. After-hours spa calls are captured 24/7. Clients who decide to book on Friday night or Sunday morning reach a real response instead of voicemail.',
    },
    {
      q: 'Does it send reminders to reduce no-shows?',
      a: 'Yes. Automated SMS reminders can be configured before appointments to help reduce last-minute confusion and no-shows.',
    },
    {
      q: 'Does it work on our existing spa phone number?',
      a: 'Yes. Just forward overflow or after-hours calls — no new number required.',
    },
    {
      q: 'Can it escalate complex requests to a real person?',
      a: 'Yes. Callback and escalation workflows can be configured for requests that need a human follow-up.',
    },
    {
      q: 'Can RingBooker capture gift certificate inquiries after hours?',
      a: 'Yes. Gift certificate callers are among the highest-conversion after-hours contacts a spa receives — they have already decided to spend and just need pricing and delivery confirmation. RingBooker captures gift certificate interest, package preference, and contact details on the current spa number for morning follow-up.',
    },
    {
      q: 'Can it handle prenatal massage booking calls?',
      a: 'Yes — for standard intake and FAQ (certification, trimester policy, session structure). Any clinical question is escalated immediately to a qualified staff member with full call context.',
    },
    {
      q: 'Is RingBooker an AI receptionist for day spas?',
      a: 'Yes — RingBooker functions as an AI receptionist for day spas, handling couples massage inquiries, package questions, and after-hours calls on the current number.',
    },
    {
      q: 'Is RingBooker an AI answering service for day spas?',
      a: 'Yes — RingBooker functions as an AI answering service and AI receptionist for day spas, handling couples massage inquiries, package questions, and after-hours calls on the current number.',
    },
  ],
  'med-spa': [
    {
      q: 'Can RingBooker handle med spa consultation calls after hours?',
      a: 'Yes. RingBooker is a strong fit for after-hours consultation calls when a busy desk or voicemail would otherwise lose the inquiry.',
    },
    {
      q: 'Can RingBooker handle med spa front-desk overflow during treatment hours?',
      a: 'Yes. RingBooker is a strong fit when the front desk is juggling check-in, checkout, and phone calls during active treatment windows.',
    },
    {
      q: 'Can it capture Botox, filler, or laser consultation interest?',
      a: 'Yes. RingBooker can capture treatment interest and consultation intent, then hand off context for the next step.',
    },
    {
      q: 'Does it work on the existing med spa phone number?',
      a: 'Yes. Calls are forwarded from your existing number — your clients never need to call a new one.',
    },
    {
      q: 'Is the scripting safe for a medical aesthetic environment?',
      a: 'Yes. RingBooker is configured with med-spa-appropriate guardrails. It captures intent and routes consultation calls without offering clinical advice or making medical claims.',
    },
    {
      q: 'Does RingBooker capture Botox consultation calls after hours?',
      a: 'Yes. Botox calls ($600–$1,200 per treatment) are the most common high-value after-hours inquiry a med spa receives. RingBooker captures treatment area interest, timing preference, and provider preference on the current number for same-day clinical coordinator follow-up.',
    },
    {
      q: 'Can it capture filler consultation calls that come in when the desk is busy?',
      a: 'Yes. Filler consultation calls ($800–$2,500 per visit) arrive during peak treatment hours when the front desk cannot answer. RingBooker captures treatment interest, preferred area, and timing — delivering a structured follow-up summary rather than voicemail.',
    },
    {
      q: 'Does it capture injector preference requests?',
      a: 'Yes. Preferred injector name, treatment interest, and timing preference are captured and routed based on your configured workflow — so the callback reaches the caller with the context they expect.',
    },
    {
      q: 'Does it work for laser and body contouring consultation calls?',
      a: 'Yes. High-value procedure calls — laser bookings ($300–$600/session) and body contouring consultations ($1,500–$5,000) — are captured with treatment interest and timing preference logged for clinical follow-up.',
    },
    {
      q: 'Is RingBooker an AI receptionist for med spas?',
      a: 'Yes — RingBooker functions as an AI receptionist for med spas, capturing Botox, filler, and aesthetic consultation calls on the current number. Pre-clinical intake only.',
    },
    {
      q: 'Is RingBooker an AI answering service for med spas?',
      a: 'Yes — RingBooker functions as an AI answering service and AI receptionist for med spas, capturing Botox, filler, and aesthetic consultation calls on the current number. Pre-clinical intake only.',
    },
  ],
  'beauty-clinic': [
    {
      q: 'Is RingBooker for beauty clinics or aesthetic clinics?',
      a: 'Both. The page can naturally include both terms without changing the main intent.',
    },
    {
      q: 'Can RingBooker help with beauty clinic missed calls?',
      a: 'Yes. It works well for missed consultation and follow-up calls, not just basic reception.',
    },
    {
      q: 'Can it capture consultation calls on our current number?',
      a: 'Yes. RingBooker works through the current business number, which keeps continuity for callers and staff.',
    },
    {
      q: 'Can it help with aesthetic clinic post-treatment calls?',
      a: 'Yes. It can help capture post-treatment questions and route approved follow-up information or handoff context to your team.',
    },
    {
      q: 'Does RingBooker work for wax studios?',
      a: 'Yes. Waxing services run 30–90 minutes — the same structural phone gap as salons. RingBooker answers pricing questions, books appointments, and captures pre-care questions on the current wax studio number while the esthetician is with a client.',
    },
    {
      q: 'Does RingBooker work for lash studios?',
      a: 'Yes. Lash fill and lash set appointments run 45–90 minutes without natural break windows. RingBooker covers lash pricing inquiries, fill booking requests, and aftercare questions on the current studio number — during service hours and after closing.',
    },
    {
      q: 'What is the beauty clinic missed call solution RingBooker provides?',
      a: 'RingBooker covers the two windows where beauty clinic calls most commonly go unanswered: during active treatment sessions and after closing hours. It works through call forwarding on the current clinic number — no new number, no workflow change.',
    },
    {
      q: 'Does RingBooker work for beauticians and beauty therapists?',
      a: 'Yes — RingBooker works for estheticians, beauticians, beauty therapists, and any hands-on beauty professional who cannot answer the phone during service sessions.',
    },
    {
      q: 'Is RingBooker an AI receptionist for beauty clinics?',
      a: 'Yes — RingBooker functions as an AI receptionist for beauty clinics, wax studios, lash studios, and aesthetic clinics — handling consultation calls, pricing questions, and after-hours inquiries on the current number.',
    },
    {
      q: 'Is RingBooker an AI answering service for beauty clinics?',
      a: 'Yes — RingBooker functions as an AI answering service and AI receptionist for beauty clinics, wax studios, lash studios, and aesthetic clinics — handling consultation calls and after-hours inquiries on the current number.',
    },
  ],
};

// ─── PAGE ASSEMBLY ─────────────────────────────────────────────────────────────

const VERTICAL_HUB_COPY: Record<MarketingVerticalKey, { heading: string; sub: string }> = {
  'nail-salon': {
    heading: 'Nail salon guides and playbooks',
    sub: 'Explore in-depth guides for missed calls, overflow windows, bilingual handling, and revenue recovery workflows built specifically for nail salons.',
  },
  'hair-salon': {
    heading: 'Hair salon guides and playbooks',
    sub: 'Explore practical guides for stylist-schedule calls, peak-hour overflow, color-service questions, and booking recovery workflows for hair salons.',
  },
  spa: {
    heading: 'Spa and day spa guides',
    sub: 'Explore treatment-aware phone coverage guides for couples bookings, package questions, after-hours demand, and missed-call recovery at spas.',
  },
  'med-spa': {
    heading: 'Med spa call-handling guides',
    sub: 'Explore consultation-first call handling, after-hours inquiry capture, overflow workflows, and trust-focused rollout guides for med spas.',
  },
  'beauty-clinic': {
    heading: 'Beauty clinic call workflow guides',
    sub: 'Explore call workflow guides for beauty clinics, wax studios, and lash studios — covering consultation calls, missed call solutions, after-hours demand, and provider continuity.',
  },
};

function VerticalHubArticles({
  vertical,
  links,
  eyebrowClass = 'text-slate-500',
  copyOverride,
}: {
  vertical: MarketingVerticalKey;
  links: Array<{ href: string; label: string }>;
  eyebrowClass?: string;
  copyOverride?: { eyebrow: string; heading: string; sub: string };
}) {
  if (links.length === 0) return null;
  const copy = copyOverride ?? { eyebrow: 'In this hub', ...VERTICAL_HUB_COPY[vertical] };
  return (
    <section className="mt-[88px] rounded-3xl bg-slate-50 px-5 py-12 sm:px-8 md:pb-16" aria-label="In this hub">
      <div className="mx-auto max-w-5xl">
        <p className={`mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] ${eyebrowClass}`}>{copy.eyebrow}</p>
        <h2 className="mb-4 text-[clamp(24px,3.2vw,34px)] font-bold tracking-tight text-slate-900">{copy.heading}</h2>
        <p className="max-w-3xl text-[15px] leading-7 text-slate-600">{copy.sub}</p>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-800 no-underline transition hover:border-violet-300 hover:text-violet-700"
            >
              <span className="text-violet-600" aria-hidden>
                <svg viewBox="0 0 16 16" width={12} height={12}>
                  <path
                    d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PageBody({ vertical }: { vertical: MarketingVerticalKey }) {
  const theme = INDUSTRY_THEME[vertical];
  if (vertical === 'nail-salon') return <NailPage theme={theme} />;
  if (vertical === 'hair-salon') return <HairPage theme={theme} />;
  if (vertical === 'spa') return <SpaPage theme={theme} />;
  if (vertical === 'med-spa') return <MedSpaPage theme={theme} />;
  return <BeautyClinicPage theme={theme} />;
}

const DEMO_PATH: Record<MarketingVerticalKey, string> = {
  'nail-salon': '/demo/nail-salon',
  'hair-salon': '/demo/hair-salon',
  spa: '/demo/day-spa',
  'med-spa': '/demo/med-spa',
  'beauty-clinic': '/demo/beauty-clinic',
};

const VERTICAL_LABEL: Record<MarketingVerticalKey, string> = {
  'nail-salon': 'Nail Salon',
  'hair-salon': 'Hair Salon',
  spa: 'Spa',
  'med-spa': 'Med Spa',
  'beauty-clinic': 'Beauty Clinic',
};

const FOOTER_DESCRIPTION_BY_VERTICAL: Record<MarketingVerticalKey, string> = {
  'nail-salon':
    'AI receptionist for nail salons — English and Vietnamese call coverage, walk-in availability, pricing questions, and missed-call follow-up on your current number.',
  'hair-salon':
    'AI receptionist for hair salons — preferred stylist requests, color slot inquiries, reschedule calls, and after-hours coverage on your current number.',
  spa:
    'AI receptionist for day spas — couples massage bookings, package inquiries, gift certificate calls, and after-hours coverage on your current number.',
  'med-spa':
    'AI receptionist for med spas — Botox, filler, and aesthetic consultation call capture after hours and during treatments, on your current number.',
  'beauty-clinic':
    'AI receptionist for beauty clinics, wax studios, and lash studios — consultation calls, after-hours inquiries, and missed-call follow-up on your current number.',
};

export async function MarketingVerticalTemplate({ vertical }: { vertical: MarketingVerticalKey }) {
  const theme = INDUSTRY_THEME[vertical];
  const faq = FAQ_BY_VERTICAL[vertical];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const serviceConfig = SERVICE_BY_VERTICAL[vertical];
  const pathPrefix = `industries/${vertical}`;
  const hubPosts = await getPublishedPostsByPathPrefix(pathPrefix, { limit: 24 }).catch(() => []);
  const hubArticleLinks = hubPosts.map((p) => ({ href: postPublicPath(p.pathPrefix, p.slug), label: p.title }));
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: serviceConfig.name,
    serviceType: serviceConfig.serviceType,
    provider: {
      '@type': 'Organization',
      name: 'RingBooker',
      url: 'https://ringbooker.com',
    },
    areaServed: 'United States',
    audience: {
      '@type': 'BusinessAudience',
      audienceType: serviceConfig.serviceType,
    },
    description: serviceConfig.description,
  };
  const verticalPath = `/industries/${vertical}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
      { '@type': 'ListItem', position: 2, name: VERTICAL_LABEL[vertical], item: `https://ringbooker.com${verticalPath}` },
    ],
  };

  const ctaMap: Record<MarketingVerticalKey, { label: string; title: string; subtitle: string }> = {
    'nail-salon': {
      label: 'For Nail Salons',
      title: 'Stop losing bookings to missed calls.',
      subtitle: 'Answer after-hours and overflow calls on your current number with configurable bilingual workflows built for nail salons.',
    },
    'hair-salon': {
      label: 'For Hair Salons',
      title: 'Keep chairs full and stylists focused.',
      subtitle: 'Capture color, stylist preference, and reschedule calls while your team stays in-service.',
    },
    spa: {
      label: 'For Spas & Day Spas',
      title: 'Protect your guest experience — and your bookings.',
      subtitle: 'Capture treatment calls, couples booking details, and after-hours inquiries without interrupting in-room sessions.',
    },
    'med-spa': {
      label: 'For Med Spas',
      title: 'Capture high-value consultation demand.',
      subtitle:
        'Botox, filler, laser, and body contouring consultation calls — covered on your current number. After-hours, peak-hour overflow, and injector preference requests captured with follow-up context.',
    },
    'beauty-clinic': {
      label: 'For Beauty Clinics, Wax Studios & Lash Studios',
      title: 'Beauty clinics, wax studios, and lash studios — covered on your current number.',
      subtitle: 'Consultation calls, lash fill inquiries, wax booking requests, and after-hours demand captured without voicemail.',
    },
  };

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader active="industry" />
      <main className={`${theme.pageShellBg} pb-16 pt-28`}>
        <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-[14px] leading-[1.35] text-[color:var(--mk-text-soft,#94a3b8)]">
            <Link href="/" className="font-normal text-[color:var(--mk-text-soft,#94a3b8)] no-underline hover:text-violet-600">Home</Link>
            <span className="mx-1.5">›</span>
            <span className="font-normal text-[color:var(--mk-text-soft,#94a3b8)]">{VERTICAL_LABEL[vertical]}</span>
          </nav>
        </div>
        <PageBody vertical={vertical} />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <VerticalHubArticles vertical={vertical} links={hubArticleLinks} eyebrowClass={theme.accentClass} />
        </div>
        <Faq items={faq} />
        <FinalCta
          demoPath={DEMO_PATH[vertical]}
          label={ctaMap[vertical].label}
          primaryBtnTextClass={theme.finalCtaPrimaryBtnText}
          shellGradientClass={theme.finalCtaGradient}
          subtitle={ctaMap[vertical].subtitle}
          title={ctaMap[vertical].title}
        />
      </main>
      <MarketingFooter descriptionOverride={FOOTER_DESCRIPTION_BY_VERTICAL[vertical]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script dangerouslySetInnerHTML={{ __html: verticalStepCarouselScript }} />
    </>
  );
}
