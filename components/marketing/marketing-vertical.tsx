import Link from 'next/link';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { CallPreviewPlayer, type CallLine } from '@/components/marketing/call-preview-player';

export type MarketingVerticalKey = 'nail-salon' | 'hair-salon' | 'spa' | 'med-spa' | 'beauty-clinic';

const SERVICE_BY_VERTICAL: Record<
  MarketingVerticalKey,
  { name: string; serviceType: string; description: string }
> = {
  'nail-salon': {
    name: 'AI Phone Answering Service for Nail Salons',
    serviceType: 'Nail salon answering service',
    description:
      'After-hours and overflow AI call answering for nail salons, including current-number forwarding, missed-call text back, bilingual English and Vietnamese support, booking intent capture, walk-in handling, pricing questions, and reschedule management.',
  },
  'hair-salon': {
    name: 'AI Phone Answering Service for Hair Salons',
    serviceType: 'Hair salon answering service',
    description:
      'AI call answering for hair salons that handles overflow calls, stylist-match requests, color and extension booking slots, reschedules, cancellation recovery, and appointment confirmations.',
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
      'AI phone answering for med spas that captures consultation calls, routes high-value inquiries after hours, reduces no-show loss, collects deposit intent, and supports Botox, filler, and laser booking workflows.',
  },
  'beauty-clinic': {
    name: 'AI Phone Answering Service for Beauty and Aesthetic Clinics',
    serviceType: 'Beauty clinic answering service',
    description:
      'AI call answering for beauty and aesthetic clinics with consultation-first intake, premium call scripts, treatment continuity context, provider routing, pre-care and post-care question handling, and call outcome summaries.',
  },
};

type BookingToolIntegration = {
  id: string;
  name: string;
  logoSrc: string;
  status: 'live' | 'soon';
};

/** Logos under /public/images — same assets as user portal calendar integrations. */
const BOOKING_TOOL_INTEGRATIONS: BookingToolIntegration[] = [
  { id: 'square', name: 'Square', logoSrc: '/images/square.png', status: 'live' },
  { id: 'vagaro', name: 'Vagaro', logoSrc: '/images/vagaro.png', status: 'soon' },
  { id: 'mindbody', name: 'Mindbody', logoSrc: '/images/mindbody.webp', status: 'soon' },
  { id: 'booksy', name: 'Booksy', logoSrc: '/images/booksy.png', status: 'soon' },
];

const TRIAL_CTA_BASE =
  'inline-flex items-center justify-center rounded-full border border-slate-200 bg-transparent px-6 py-3 text-[14px] font-semibold text-slate-900 transition';

const DEMO_CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-extrabold text-white transition hover:scale-[1.03] hover:brightness-[1.06]';

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
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-violet-800 via-violet-600 to-violet-500 shadow-[0_10px_36px_rgba(91,33,182,0.32)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-violet-500 hover:text-violet-600`,
    accentClass: 'text-violet-600',
  },
  'hair-salon': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ffedd5_0%,#fffbeb_42%,#ffffff_68%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#9a3412_0%,#d97706_48%,#f59e0b_100%)]',
    finalCtaPrimaryBtnText: 'text-amber-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-amber-800 via-amber-600 to-amber-500 shadow-[0_10px_36px_rgba(180,83,9,0.35)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-amber-500 hover:text-amber-800`,
    accentClass: 'text-amber-600',
  },
  spa: {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ccfbf1_0%,#f0fdfa_44%,#ffffff_70%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#115e59_0%,#0d9488_50%,#14b8a6_100%)]',
    finalCtaPrimaryBtnText: 'text-teal-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-teal-800 via-teal-600 to-emerald-500 shadow-[0_10px_36px_rgba(13,148,136,0.35)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-teal-500 hover:text-teal-800`,
    accentClass: 'text-teal-600',
  },
  'med-spa': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#e0e7ff_0%,#eef2ff_46%,#ffffff_72%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#312e81_0%,#4f46e5_52%,#818cf8_100%)]',
    finalCtaPrimaryBtnText: 'text-indigo-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-indigo-900 via-indigo-600 to-indigo-500 shadow-[0_10px_36px_rgba(67,56,202,0.38)]`,
    trialCtaClass: `${TRIAL_CTA_BASE} hover:border-indigo-500 hover:text-indigo-800`,
    accentClass: 'text-indigo-600',
  },
  'beauty-clinic': {
    pageShellBg:
      'bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#fae8ff_0%,#fdf4ff_46%,#ffffff_72%)]',
    finalCtaGradient: 'bg-[linear-gradient(125deg,#86198f_0%,#c026d3_50%,#e879f9_100%)]',
    finalCtaPrimaryBtnText: 'text-fuchsia-950',
    demoCtaClass: `${DEMO_CTA_BASE} bg-gradient-to-br from-fuchsia-900 via-fuchsia-600 to-pink-500 shadow-[0_10px_36px_rgba(192,38,211,0.35)]`,
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

function IntegrationRow() {
  return (
    <div className="mt-6">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Works with your booking tools</p>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 sm:gap-x-10">
        {BOOKING_TOOL_INTEGRATIONS.map((item) => {
          const isLive = item.status === 'live';
          return (
            <div key={item.id} className="flex items-start gap-2.5">
              <img
                src={item.logoSrc}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 object-contain"
                loading="lazy"
                decoding="async"
              />
              <div className="flex min-w-0 flex-col justify-center pt-0.5">
                <span className="text-[13px] font-extrabold leading-tight tracking-tight text-slate-900">{item.name}</span>
                {isLive ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    Live
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] font-semibold tracking-wide text-slate-400">Coming soon</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="mx-auto mt-20 max-w-6xl px-6">
      <MarketingFaqAccordion
        items={items}
        embedded
        eyebrow="Common Questions"
        title="Frequently Asked Questions"
        subtitle={null}
      />
    </div>
  );
}

type HowItWorksStep = { n: string; title: string; body: string };
function HowItWorks({ steps, accentBg }: { steps: HowItWorksStep[]; accentBg: string }) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Setup</div>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">How RingBooker Works</h2>
      <p className="mt-2 max-w-xl text-[15px] text-slate-500">No new phone number needed. Works with your existing line in minutes.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="relative rounded-3xl border border-slate-200 bg-white p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`mb-4 mx-auto flex h-9 w-9 items-center justify-center rounded-full ${accentBg} text-sm font-extrabold text-white`}>{s.n}</div>
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
    <section className="mx-auto mt-14 max-w-6xl px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <article
            key={s.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className={`text-5xl font-extrabold tracking-tight ${accent}`}>{s.value}</p>
            <p className="mt-2 text-base font-bold text-slate-900">{s.label}</p>
            <p className="mt-1 text-[13.5px] leading-6 text-slate-500">{s.sub}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type PainPoint = { icon?: string; title: string; body: string };
function PainPoints({ points, heading }: { points: PainPoint[]; heading: string }) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Why Calls Get Missed</div>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{heading}</h2>
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
function FeatureGrid({ features, accent }: { features: FeatureItem[]; accent: string }) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">What RingBooker Does</div>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Every feature you need, built in</h2>
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

function VsTable({ rows, accentClass }: { rows: Array<{ scenario: string; without: string; with: string }>; accentClass: string }) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Before vs. After</div>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Stop relying on voicemail</h2>
      <div className="mt-6 overflow-x-auto overscroll-x-contain rounded-3xl border border-slate-200 bg-white [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-slate-100 bg-slate-50 px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <span>Scenario</span>
            <span>Without RingBooker</span>
            <span className={accentClass}>With RingBooker</span>
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
    <section className="mx-auto mt-20 max-w-6xl px-6 pb-10">
      <div className={`relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white md:px-14 ${shellGradientClass}`}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-72 w-72 rounded-full bg-white/10" />
        <p className="relative text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">{label}</p>
        <h2 className="relative mt-3 text-[clamp(28px,5vw,48px)] font-extrabold leading-[1.1] tracking-tight">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/75">{subtitle}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={demoPath}
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-extrabold shadow-md shadow-black/10 transition hover:scale-[1.04] ${primaryBtnTextClass}`}
          >
            <DemoCtaPhoneIcon width={18} height={18} />
            Try a Live Demo Call
          </a>
          <Link
            href="/user/signup"
            className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/20"
          >
            Start Free 14-Day Trial →
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
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-[12px] font-bold text-violet-700">
            AI phone answering &amp; call recovery for nail salons
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Nail Salon Calls Get Missed Most During Busy Service Hours
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            Your techs are with clients — and callers asking for prices, walk-ins, or same-day bookings won&apos;t wait. RingBooker answers overflow and after-hours calls on your current number, supports English and Vietnamese, and captures booking intent so missed rings don&apos;t become lost revenue.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/nail-salon" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free 14-Day Trial →
            </Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden lg:block">
          <CallPreviewPlayer {...CALL_PREVIEWS['nail-salon']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-violet-600"
        stats={[
          { value: '62%', label: 'Calls go unanswered', sub: 'Nail techs are with clients and physically cannot pick up the phone.' },
          { value: '85%', label: 'Don\'t call back', sub: 'One missed call and most callers move on to the next salon in seconds.' },
          { value: '$8,400+', label: 'Per year in missed revenue', sub: 'Missed bookings across peak weekends compound fast over 12 months.' },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why nail salons lose calls — and clients"
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
        features={[
          { icon: '📞', title: 'Works on your current number', body: 'No new phone number needed — just forward overflow or after-hours calls.' },
          { icon: '🇻🇳', title: 'English + Vietnamese support', body: 'Handles callers in both languages naturally, right from the start of the call.' },
          { icon: '💅', title: 'Pricing questions answered instantly', body: 'Full set, gel, acrylic, dip, pedicure — all answered with your shop\'s actual prices.' },
          { icon: '📅', title: 'Same-day and walk-in booking', body: 'Captures high-intent callers who want a slot today or this weekend.' },
          { icon: '🔄', title: 'Reschedule and cancel handling', body: 'Handles reschedule calls without tying up staff time.' },
          { icon: '💬', title: 'SMS confirmation and follow-up', body: 'Sends booking confirmation texts so clients don\'t slip through the cracks.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-violet-600"
        steps={[
          { n: '1', title: 'Forward calls to RingBooker', body: 'Set up call forwarding on your current salon number — for overflow, after-hours, or full-time. Takes under 5 minutes.' },
          { n: '2', title: 'RingBooker answers with your shop info', body: 'Your services, pricing, hours, and staff are loaded in. The AI handles real callers immediately.' },
          { n: '3', title: 'Bookings captured, SMS sent, you review', body: 'Every captured booking and call summary lands in your dashboard. Confirmations go to the client automatically.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        rows={[
          { scenario: 'After-hours pricing call', without: 'Voicemail — caller hangs up', with: 'Answered, price given, booking captured' },
          { scenario: 'Weekend overflow', without: 'Call drops, client calls next salon', with: 'Every call answered in queue' },
          { scenario: 'Vietnamese-speaking caller', without: 'Language barrier, lost booking', with: 'Fluent Vietnamese response' },
          { scenario: 'Same-day walk-in request', without: 'Missed — tech can\'t pick up', with: 'Slot confirmed, SMS sent to client' },
        ]}
      />
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
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[12px] font-bold text-amber-700">
            Built for Hair Salons
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Recover Hair Salon Revenue Lost During Services and Peak Hours
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            While stylists are cutting or coloring, callers asking for preferred stylists, color slots, extensions, or reschedules cannot always get through. RingBooker handles overflow and after-hours hair salon calls on your current number — no booking migration — so high-value openings are less likely to waste on missed rings.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/hair-salon" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial →
            </Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden lg:block">
          <CallPreviewPlayer {...CALL_PREVIEWS['hair-salon']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-amber-600"
        stats={[
          { value: '58%', label: 'Calls go to voicemail', sub: 'Stylists can\'t pick up mid-color service. Most callers won\'t leave a message.' },
          { value: '3x', label: 'Higher cancellation risk', sub: 'Long appointment slots are more damaging when callers can\'t reach someone to reschedule.' },
          { value: '72%', label: 'Prefer phone for rescheduling', sub: 'Hair clients want to talk through reschedule options — especially for color and extension services.' },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="The hair salon phone problem"
        points={[
          {
            icon: '✂️',
            title: 'Stylists can\'t answer while in-service',
            body: 'A colorist mid-application can\'t stop for a 5-minute call. Neither can a stylist during a cut. But callers don\'t know that — they just hear the phone ring and ring, then hang up.',
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
        features={[
          { icon: '👩‍🎨', title: 'Stylist-match routing', body: 'Asks for preferred stylist and routes to alternatives when they\'re unavailable.' },
          { icon: '🎨', title: 'Color appointment handling', body: 'Books the right slot length for balayage, keratin, extensions, and other timed services.' },
          { icon: '🔄', title: 'Reschedule and cancel flows', body: 'Handles reschedule calls gracefully and preserves stylist preference.' },
          { icon: '📞', title: 'Works on your current number', body: 'Forward overflow and after-hours — no new number, no disruption to existing clients.' },
          { icon: '💬', title: 'SMS confirmations', body: 'Clients receive instant booking confirmations by text so nothing falls through.' },
          { icon: '📅', title: '24/7 booking coverage', body: 'Captures after-hours calls when clients browse social media and decide to book late.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-amber-600"
        steps={[
          { n: '1', title: 'Connect your salon number', body: 'Forward overflow or after-hours calls. Your existing number stays the same for all clients.' },
          { n: '2', title: 'Load your services and stylists', body: 'Add your team, service list, and booking rules. RingBooker handles calls with that context immediately.' },
          { n: '3', title: 'Every call captured and confirmed', body: 'Booking summaries go to your dashboard. SMS confirmations go to the client.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        rows={[
          { scenario: 'Caller wants their usual stylist', without: 'Voicemail — caller books elsewhere', with: 'Stylist offered, alternative suggested, booking held' },
          { scenario: 'Balayage slot inquiry', without: 'Phone rings, no answer', with: 'Duration clarified, correct slot booked' },
          { scenario: 'Same-day reschedule', without: 'No one picks up, slot lost', with: 'Reschedule handled, slot preserved' },
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
          <div className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-[12px] font-bold text-teal-700">
            For Day Spas & Wellness Studios
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            After-Hours Spa Calls Should Not Turn Into Lost Revenue
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            Your therapists are in treatment rooms — and callers asking about massage packages, couples bookings, or availability can&apos;t interrupt that. RingBooker captures peak-hour overflow and after-hours spa calls on your current number so booking revenue does not leak to voicemail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/day-spa" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial →
            </Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden lg:block">
          <CallPreviewPlayer {...CALL_PREVIEWS['spa']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-teal-600"
        stats={[
          { value: '54%', label: 'Spa calls go unanswered', sub: 'Therapists are in treatment sessions — they can\'t leave clients to answer the phone.' },
          { value: '78%', label: 'Book on first contact', sub: 'Spa clients who reach a real response book in the same interaction. Those who don\'t often don\'t call back.' },
          { value: '40%', label: 'After-hours call volume', sub: 'A significant share of spa booking intent happens outside business hours, especially weekends.' },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why spas miss bookings when it matters most"
        points={[
          {
            icon: '🧖',
            title: 'Therapists can\'t leave treatment rooms for calls',
            body: 'When every treatment room is occupied, no one is available to answer the front desk. Callers asking about services, availability, or packages get voicemail — and spa clients rarely leave messages.',
          },
          {
            icon: '💑',
            title: 'Couples and group bookings require real conversation',
            body: 'Booking two or more people at the same time, with matching therapist availability and room availability, is complex. Voicemail can\'t handle that — but an AI with your schedule context can.',
          },
          {
            icon: '🌙',
            title: 'After-hours inquiry is high intent',
            body: 'Spa clients often research and decide to book during evenings and weekends — right when your team is off or winding down. Those callers have strong intent and no patience for voicemail.',
          },
          {
            icon: '🔁',
            title: 'Package and pricing questions repeat constantly',
            body: 'Your front desk fields the same calls dozens of times a week: "What\'s the difference between 60 and 90 minutes?" or "Do you offer prenatal massage?" RingBooker handles these instantly, every time.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-teal-50 text-teal-600"
        features={[
          { icon: '🧖', title: 'Treatment-aware call scripts', body: 'Knows your service menu, durations, and room types so answers feel natural and accurate.' },
          { icon: '💑', title: 'Couples and group booking', body: 'Handles multi-person bookings with room and therapist availability in mind.' },
          { icon: '🌙', title: '24/7 call coverage', body: 'Captures evening, weekend, and after-hours calls when booking intent is highest.' },
          { icon: '📞', title: 'Current-number forwarding', body: 'Clients call the number they already know. No change from their perspective.' },
          { icon: '💬', title: 'SMS booking confirmations', body: 'Confirmation texts go out instantly after booking so clients don\'t forget.' },
          { icon: '🔔', title: 'Reminder workflows', body: 'Reduces no-shows with automated appointment reminders via text.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-teal-600"
        steps={[
          { n: '1', title: 'Set your services and availability windows', body: 'Load your treatment menu, room types, and hours. RingBooker learns your spa\'s context.' },
          { n: '2', title: 'Forward calls during busy or off hours', body: 'Route overflow while sessions are running, or go full-time for always-on coverage.' },
          { n: '3', title: 'Bookings confirmed, summaries in your dashboard', body: 'Every captured booking gets logged. SMS confirmation goes to the client automatically.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        rows={[
          { scenario: 'Couples massage inquiry Saturday', without: 'Voicemail — couple books elsewhere', with: 'Suite booked, confirmation sent' },
          { scenario: 'After-hours package question', without: 'No answer, caller doesn\'t call back', with: 'Question answered, booking intent captured' },
          { scenario: 'Therapist-specific request', without: 'Staff unavailable to check', with: 'Availability checked, alternative offered' },
          { scenario: 'No-show risk reminder', without: 'No system in place', with: 'Automated reminder sent day before' },
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
          <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[12px] font-bold text-indigo-700">
            For Med Spas & Aesthetic Practices
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Every Missed Med Spa Consultation Call Can Mean Lost Revenue
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            Consultation-first med spa journeys mean after-hours and peak-hour calls compare providers fast — missed first contact is lost revenue. RingBooker captures overflow and after-hours consult intent on your current number, with no booking migration, and hands off context when a human should close the consult.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/med-spa" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial →
            </Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden lg:block">
          <CallPreviewPlayer {...CALL_PREVIEWS['med-spa']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-indigo-600"
        stats={[
          { value: '$42K+', label: 'Annual no-show exposure', sub: 'Every unfilled high-ticket slot is direct revenue lost. No-show rates average 15–20% without reminders.' },
          { value: '37%', label: 'Consultation calls missed', sub: 'Front desk handles too many tasks to catch every inbound consult inquiry, especially at peak hours.' },
          { value: '35×', label: 'Estimated ROI potential', sub: 'A single captured Botox consult converts to hundreds in treatment. Capturing 5 extra per month adds up fast.' },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why med spas lose high-value leads on the phone"
        points={[
          {
            icon: '💸',
            title: 'Missed consultation calls = real dollar losses',
            body: 'At a med spa, a missed call isn\'t just a missed booking — it\'s a potential $800+ Botox or filler patient walking to a competitor. After-hours research calls have especially high intent and zero patience for voicemail.',
          },
          {
            icon: '😰',
            title: 'Front desk overload crushes inbound conversion',
            body: 'Your front desk juggles check-ins, checkout, upsells, and phones simultaneously. During treatment hours, high-intent consultation calls get delayed, rushed, or dropped entirely — destroying conversion before it starts.',
          },
          {
            icon: '🌙',
            title: 'After-hours research intent is your biggest opportunity',
            body: 'Med spa clients often research at night and call first thing in the morning — or late in the evening after work. A 24/7 answering layer captures that intent before it cools off and moves to a competitor.',
          },
          {
            icon: '⚠️',
            title: 'No-shows and late cancels destroy high-ticket schedule economics',
            body: 'A 90-minute laser or filler slot that cancels same-day is almost impossible to fill. Reminder workflows and deposit-capture conversations during the booking call are the best prevention.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-indigo-50 text-indigo-600"
        features={[
          { icon: '💉', title: 'Consultation call capture', body: 'Answers Botox, filler, laser, and consultation inquiry calls with professional, brand-safe scripting.' },
          { icon: '🌙', title: 'After-hours lead capture', body: 'Captures high-intent after-hours callers who research at night and need to reach someone.' },
          { icon: '📞', title: 'Current-number answering', body: 'No new number — forward overflow or after-hours on your existing line.' },
          { icon: '🔔', title: 'No-show reduction reminders', body: 'Automated reminders before high-ticket appointments reduce cancellation and no-show rates.' },
          { icon: '👥', title: 'Multi-provider routing', body: 'Routes callers to specific providers or their preferred injector when available.' },
          { icon: '📊', title: 'Call transcripts and analytics', body: 'Every call logged with outcome, intent, and action so your team has full context on follow-up.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-indigo-600"
        steps={[
          { n: '1', title: 'Configure your services and providers', body: 'Add your treatment list, providers, and consultation flow. RingBooker handles calls with that context.' },
          { n: '2', title: 'Forward overflow and after-hours calls', body: 'During treatments, busy windows, or full-time — calls are answered professionally every time.' },
          { n: '3', title: 'Leads captured, transcripts in your CRM', body: 'Every consultation intent is logged. Your team follows up with warm context, not cold leads.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        rows={[
          { scenario: 'After-hours Botox inquiry', without: 'Voicemail — lead cools, books competitor', with: 'Consultation booked, intent captured' },
          { scenario: 'Front desk busy during treatments', without: 'Phone rings out, caller hangs up', with: 'Answered immediately, consult scheduled' },
          { scenario: 'High-ticket appointment no-show risk', without: 'No reminder system, slot wasted', with: 'Reminder sent, cancellation recovered' },
          { scenario: 'Caller wants specific injector', without: 'No one to check availability', with: 'Injector availability checked, booking confirmed' },
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
          <div className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3.5 py-1.5 text-[12px] font-bold text-fuchsia-700">
            For Beauty & Aesthetic Clinics
          </div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-900">
            Beauty Clinic Calls Need More Than Voicemail
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-slate-600">
            Consultation-first journeys, provider continuity, and privacy-conscious phone handling still have to compete with busy desks and after-hours inquiries. RingBooker is an AI phone answering and booking recovery layer on your current number — capturing missed consultation calls and follow-ups so revenue is less likely to leak when no one can pick up.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo/beauty-clinic" className={theme.demoCtaClass}>
              <DemoCtaPhoneIcon width={18} height={18} />
              Try a Live Demo Call
            </a>
            <Link href="/user/signup" className={theme.trialCtaClass}>
              Start Free Trial →
            </Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden lg:block">
          <CallPreviewPlayer {...CALL_PREVIEWS['beauty-clinic']} />
        </div>
      </section>

      {/* Stats */}
      <StatStrip
        accent="text-fuchsia-600"
        stats={[
          { value: '77%', label: 'Prefer calling for booking changes', sub: 'Beauty clinic clients choose the phone when rescheduling or asking about treatment continuity.' },
          { value: '62%', label: 'Don\'t call back after one miss', sub: 'First impression matters. If no one answers the first call, most clinic callers move on.' },
          { value: '55%', label: 'Comfortable with AI assistance', sub: 'Over half of beauty clinic clients are comfortable with AI-assisted booking when the experience is professional.' },
        ]}
      />

      {/* Pain Points */}
      <PainPoints
        heading="Why beauty clinics need a smarter phone layer"
        points={[
          {
            icon: '👑',
            title: 'Clients expect a "patient" experience, not a booking hotline',
            body: 'Beauty and aesthetic clinic callers are often asking about privacy, treatment continuity, pre-care, post-care, or the number of sessions. They expect considered answers, not rushed scripts or voicemail.',
          },
          {
            icon: '🤝',
            title: 'Consultation-first calls require handling with care',
            body: 'A caller asking about laser, skin treatment, or aesthetic procedures is often in a discovery phase. How the call is handled — tone, clarity, and follow-through — directly shapes whether they book a consultation.',
          },
          {
            icon: '🔁',
            title: 'Provider continuity is a real retention lever',
            body: 'Returning clients often want to see the same provider. If no one can confirm availability and book continuity in-call, those returning clients start shopping again.',
          },
          {
            icon: '📋',
            title: 'Pre-care and post-care questions repeat and consume front-desk time',
            body: 'Staff spend significant time answering the same questions about what to do before and after treatments. An AI answering layer handles this consistently and instantly, freeing your team for in-clinic work.',
          },
        ]}
      />

      {/* Features */}
      <FeatureGrid
        accent="bg-fuchsia-50 text-fuchsia-600"
        features={[
          { icon: '✨', title: 'Premium, clinic-appropriate tone', body: 'Scripts are built for beauty clinic standards — professional, warm, and never salesy.' },
          { icon: '🔁', title: 'Treatment continuity booking', body: 'Handles returning patient calls and routes to their provider or fills in context for the next session.' },
          { icon: '📋', title: 'Consultation intake capture', body: 'Captures caller intent, treatment interest, and preferred timing before the consultation is booked.' },
          { icon: '📞', title: 'Works on your current number', body: 'No new number needed — just forward overflow or off-hours calls to RingBooker.' },
          { icon: '👥', title: 'Multi-provider routing', body: 'Routes callers to preferred providers and handles alternatives when they\'re unavailable.' },
          { icon: '📊', title: 'Call analytics and transcripts', body: 'Full call logs and summaries so your team has context on every inbound inquiry.' },
        ]}
      />

      {/* How It Works */}
      <HowItWorks
        accentBg="bg-fuchsia-600"
        steps={[
          { n: '1', title: 'Configure clinic services and providers', body: 'Load your treatment list, providers, and consultation flow. RingBooker reflects your clinic\'s standards.' },
          { n: '2', title: 'Forward calls during treatments or after hours', body: 'Cover overflow during busy clinic hours or go full-time. Clients experience a seamless, professional response.' },
          { n: '3', title: 'Every inquiry logged for your team', body: 'Call summaries, intake details, and provider preferences are recorded for clinical follow-up.' },
        ]}
      />

      {/* VS Table */}
      <VsTable
        accentClass={theme.accentClass}
        rows={[
          { scenario: 'Returning patient books next laser session', without: 'Front desk unavailable — patient calls elsewhere', with: 'Session booked with same provider, confirmed' },
          { scenario: 'After-hours pre-care question', without: 'No answer — patient anxious before treatment', with: 'Pre-care guidance given, patient reassured' },
          { scenario: 'Consultation inquiry call', without: 'Rushed or missed, intent lost', with: 'Intent captured, consultation booked with context' },
          { scenario: 'Multi-session treatment follow-up', without: 'No continuity, patient drifts', with: 'Provider matched, continuity maintained' },
        ]}
      />
    </>
  );
}

// ─── FAQ DATA ─────────────────────────────────────────────────────────────────

const FAQ_BY_VERTICAL: Record<MarketingVerticalKey, Array<{ q: string; a: string }>> = {
  'nail-salon': [
    {
      q: 'Does RingBooker work with my current nail salon phone number?',
      a: 'Yes. You keep your existing number and forward calls to RingBooker — for overflow, after-hours, or full-time. Clients call the number they already know.',
    },
    {
      q: 'Can it handle bilingual English and Vietnamese callers?',
      a: 'Yes. RingBooker supports English and Vietnamese call handling natively, which is especially valuable for nail salons with Vietnamese-speaking staff or clients.',
    },
    {
      q: 'Can it answer pricing questions for my services?',
      a: 'Yes. You load your service menu and prices during setup. RingBooker answers "how much for a full set?" or "what\'s the price for dip powder?" instantly, with your actual prices.',
    },
    {
      q: 'Can it handle same-day and walk-in booking requests?',
      a: 'Yes. High-intent same-day callers are captured and booking intent is logged. If connected to Square Appointments, slots can be booked in real time.',
    },
    {
      q: 'Does it sync with Square Appointments?',
      a: 'Yes. Square Appointments integration is live now. Vagaro, Mindbody, and Booksy integrations are coming soon.',
    },
    {
      q: 'What happens to calls after hours?',
      a: 'After-hours calls are answered, pricing and availability questions are handled, and booking intent is captured with a confirmation message or SMS. Nothing goes to voicemail unless you want it to.',
    },
  ],
  'hair-salon': [
    {
      q: 'Can RingBooker route callers to a specific stylist?',
      a: 'Yes. RingBooker asks about stylist preference and routes the caller accordingly. If the preferred stylist is unavailable, it offers qualified alternatives so the booking isn\'t lost.',
    },
    {
      q: 'Can it handle color appointment bookings correctly?',
      a: 'Yes. Service duration and type are configurable, so balayage, keratin, extensions, and other timed services get the right slot length. Callers won\'t get the wrong appointment.',
    },
    {
      q: 'Does it support reschedule and cancellation calls?',
      a: 'Yes. RingBooker handles reschedule flows and cancellation calls, preserving stylist preference and offering alternative slots where possible.',
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
      a: 'Yes. You configure your stylist list, their specialties, and availability rules. RingBooker routes callers based on that context.',
    },
  ],
  spa: [
    {
      q: 'Can RingBooker book couples massages and multi-person appointments?',
      a: 'Yes. Couples and group bookings are supported. RingBooker asks about the number of guests, preferred time, and room availability to confirm the right slot.',
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
      a: 'Yes. Automated SMS reminders are sent before appointments to reduce last-minute cancellations and no-shows.',
    },
    {
      q: 'Does it work on our existing spa phone number?',
      a: 'Yes. Just forward overflow or after-hours calls — no new number required.',
    },
    {
      q: 'Can it escalate complex requests to a real person?',
      a: 'Yes. Callback and escalation workflows can be configured for requests that need a human follow-up.',
    },
  ],
  'med-spa': [
    {
      q: 'Can RingBooker handle consultation inquiry calls professionally?',
      a: 'Yes. RingBooker answers Botox, filler, laser, and general consultation calls with professional, clinic-appropriate scripting. It captures intent and books consultations based on your configuration.',
    },
    {
      q: 'Does it support after-hours consultation call capture?',
      a: 'Yes. After-hours calls — which are often the highest-intent med spa inquiries — are answered and captured 24/7. Your team sees the lead summary in the morning.',
    },
    {
      q: 'Can it help reduce no-shows for high-ticket appointments?',
      a: 'Yes. Automated reminder workflows are sent before treatment appointments, significantly reducing no-show rates for Botox, filler, and laser sessions.',
    },
    {
      q: 'Can it route callers to a specific injector or provider?',
      a: 'Yes. Multi-provider routing is supported. Callers can be directed to their preferred provider or offered alternatives based on availability.',
    },
    {
      q: 'Does it work on the existing med spa phone number?',
      a: 'Yes. Calls are forwarded from your existing number — your clients never need to call a new one.',
    },
    {
      q: 'Is the scripting safe for a medical aesthetic environment?',
      a: 'Yes. RingBooker is configured with med-spa-appropriate guardrails. It captures intent and routes consultation calls without offering clinical advice or making medical claims.',
    },
  ],
  'beauty-clinic': [
    {
      q: 'Can RingBooker handle consultation-first booking flows?',
      a: 'Yes. Consultation intake, treatment interest capture, and consultation booking are all configurable for beauty clinic workflows.',
    },
    {
      q: 'Can it maintain provider continuity for returning clients?',
      a: 'Yes. RingBooker can ask about provider preference and route returning clients to their existing provider or note the preference for your team.',
    },
    {
      q: 'Does it handle pre-care and post-care questions?',
      a: 'Yes. Common pre-care and post-care questions can be configured into the response scripts so callers get accurate, consistent answers every time.',
    },
    {
      q: 'Can it handle multi-session treatment booking?',
      a: 'Yes. Returning clients booking their next session in a treatment course are handled with context, including provider preference and session continuity.',
    },
    {
      q: 'Does it work on our existing clinic phone number?',
      a: 'Yes. Just forward overflow or after-hours calls — your number stays the same.',
    },
    {
      q: 'Can we customize the tone and brand voice?',
      a: 'Yes. Voice settings, script tone, and greeting style are configurable so RingBooker sounds like an extension of your clinic, not a generic answering service.',
    },
  ],
};

// ─── PAGE ASSEMBLY ─────────────────────────────────────────────────────────────

function VerticalRelatedPlaybooks() {
  const linkClass =
    'font-semibold text-violet-700 no-underline decoration-transparent hover:text-violet-900 hover:no-underline';
  return (
    <section
      aria-label="Related call recovery guides"
      className="mx-auto mt-14 max-w-3xl rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-6 text-center shadow-sm backdrop-blur-sm sm:px-8"
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Playbooks</p>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        <Link className={linkClass} href="/after-hours-calls">
          After-hours call answering
        </Link>
        {' · '}
        <Link className={linkClass} href="/peak-hour-overflow-calls">
          Peak-hour overflow coverage
        </Link>
        {' · '}
        <Link className={linkClass} href="/missed-call-recovery">
          Missed-call recovery
        </Link>
        {' · '}
        <Link className={linkClass} href="/how-it-works">
          How it works
        </Link>
        {' · '}
        <Link className={linkClass} href="/pricing">
          Pricing
        </Link>
        {' · '}
        <Link className={linkClass} href="/faq">
          FAQ
        </Link>
        {' · '}
        <Link className={linkClass} href="/contact">
          Book a demo
        </Link>
      </p>
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

export function MarketingVerticalTemplate({ vertical }: { vertical: MarketingVerticalKey }) {
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

  const ctaMap: Record<MarketingVerticalKey, { label: string; title: string; subtitle: string }> = {
    'nail-salon': {
      label: 'For Nail Salons',
      title: 'Stop losing bookings to missed calls.',
      subtitle: 'Answer after-hours and overflow calls on your current number with bilingual AI support built for nail salons.',
    },
    'hair-salon': {
      label: 'For Hair Salons',
      title: 'Keep chairs full and stylists focused.',
      subtitle: 'Convert color, stylist-match, and reschedule calls into confirmed bookings while your team stays in-service.',
    },
    spa: {
      label: 'For Spas & Day Spas',
      title: 'Protect your guest experience — and your bookings.',
      subtitle: 'Capture every treatment call, couples booking, and after-hours inquiry without interrupting in-room sessions.',
    },
    'med-spa': {
      label: 'For Med Spas',
      title: 'Capture high-value consultation demand.',
      subtitle: 'Answer after-hours and overflow consult calls before competitors do, and reduce no-show loss on high-ticket slots.',
    },
    'beauty-clinic': {
      label: 'For Beauty & Aesthetic Clinics',
      title: 'Deliver the premium experience your clinic demands.',
      subtitle: 'Handle consultation calls, provider continuity requests, and treatment questions with clinic-appropriate AI scripting.',
    },
  };

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader active="industry" />
      <main className={`${theme.pageShellBg} pb-16 pt-28`}>
        <PageBody vertical={vertical} />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <VerticalRelatedPlaybooks />
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
      <MarketingFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
    </>
  );
}
