import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

export type MarketingVerticalKey = 'nail-salon' | 'hair-salon' | 'spa' | 'med-spa' | 'beauty-clinic';

type Integration = { name: string; status: 'Live now' | 'Soon' };

const SERVICE_BY_VERTICAL: Record<
  MarketingVerticalKey,
  { name: string; serviceType: string; description: string }
> = {
  'nail-salon': {
    name: 'AI Phone Answering Service for Nail Salons',
    serviceType: 'Nail salon answering service',
    description:
      'After-hours and overflow AI call answering for nail salons, including current-number forwarding, missed-call text back, bilingual support, booking intent capture, and reschedule handling.',
  },
  'hair-salon': {
    name: 'AI Phone Answering Service for Hair Salons',
    serviceType: 'Hair salon answering service',
    description:
      'AI call answering for hair salons that handles overflow calls, stylist requests, service questions, reschedules, and appointment confirmations.',
  },
  spa: {
    name: 'AI Phone Answering Service for Spas',
    serviceType: 'Spa answering service',
    description:
      'After-hours and overflow AI receptionist service for spas and day spas, with treatment-aware scripts, missed-call recovery, and SMS follow-up.',
  },
  'med-spa': {
    name: 'AI Phone Answering Service for Med Spas',
    serviceType: 'Med spa answering service',
    description:
      'AI phone answering for med spas that captures consultation calls, routes high-value inquiries, reduces missed calls, and supports reminder workflows.',
  },
  'beauty-clinic': {
    name: 'AI Phone Answering Service for Beauty Clinics',
    serviceType: 'Beauty clinic answering service',
    description:
      'AI call answering for beauty and aesthetic clinics with client intake, premium call scripts, smart routing, and call outcome summaries.',
  },
};

const INTEGRATIONS: Integration[] = [
  { name: 'Square Appointments', status: 'Live now' },
  { name: 'Vagaro', status: 'Soon' },
  { name: 'Mindbody', status: 'Soon' },
  { name: 'Booksy', status: 'Soon' },
];

function IntegrationRow() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {INTEGRATIONS.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
          {item.name}
          <span className={`rounded-full px-2 py-0.5 text-sm ${item.status === 'Live now' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {item.status}
          </span>
        </span>
      ))}
    </div>
  );
}

function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-6">
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">FAQ</h2>
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {items.map((item, index) => (
          <details key={item.q} className="group border-b border-slate-100 p-5 last:border-b-0" open={index === 0}>
            <summary className="cursor-pointer list-none pr-8 text-base font-bold text-slate-900">
              {item.q}
              <span className="float-right text-violet-600 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-[14px] leading-7 text-slate-600">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ label, title, subtitle }: { label: string; title: string; subtitle: string }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-6 pb-10">
      <div className="rounded-3xl bg-slate-900 px-8 py-12 text-center text-white">
        <p className="text-[14px] font-bold uppercase tracking-[0.18em] text-violet-300">{label}</p>
        <h2 className="mt-2 text-[clamp(30px,5vw,50px)] font-extrabold leading-[1.1] tracking-tight">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-300">{subtitle}</p>
        <div className="mt-6">
          <Link href="/user/signup" className="inline-flex rounded-full bg-white px-6 py-3 text-[14px] font-bold text-slate-900 transition hover:-translate-y-0.5">
            Start Free Trial →
          </Link>
        </div>
      </div>
    </section>
  );
}

function NailPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">🔥 #1 AI Receptionist for Vietnamese Nail Salons</div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.06] tracking-[-0.04em] text-slate-900">AI Phone Answering Service for Nail Salons</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-8 text-slate-600">Answer after-hours and overflow calls on your current number, support English + Vietnamese callers, capture booking intent, and recover missed appointments automatically.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/user/signup" className="rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white">Start Free 14-Day Trial →</Link>
            <Link href="/demo" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700">Hear a Live Demo</Link>
          </div>
          <IntegrationRow />
        </div>
        <div className="hidden rounded-3xl border border-slate-200 bg-white p-6 lg:block">
          <p className="text-[14px] font-semibold text-slate-900">Live call sample</p>
          <div className="mt-3 space-y-2 text-[14px]">
            <p className="rounded-xl bg-violet-100 px-3 py-2 text-violet-900">“Thank you for calling Lux Nails. How can I help?”</p>
            <p className="rounded-xl bg-slate-100 px-3 py-2">“I want to book a full set for Saturday.”</p>
            <p className="rounded-xl bg-violet-100 px-3 py-2 text-violet-900">“Great. I have 10am, 1pm, or 3pm.”</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Built for nail-shop call patterns</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['62%', 'calls go unanswered', 'Teams are with clients and cannot pick up in time.'],
            ['85%', 'won’t call back', 'Most callers choose another salon after one missed call.'],
            ['$6,864', 'annual revenue leak', 'Missed bookings compound across peak months.'],
          ].map((item) => (
            <article key={item[1]} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-5xl font-extrabold tracking-tight text-violet-600">{item[0]}</p>
              <p className="mt-2 text-base font-bold text-slate-900">{item[1]}</p>
              <p className="mt-1 text-[14px] leading-6 text-slate-600">{item[2]}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function HairPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8">
          <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">✂️ Built for Hair Salons</div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.08] tracking-tight text-slate-900">AI Phone Agent for Hair Salon Booking</h1>
          <p className="mt-3 max-w-3xl text-[17px] leading-8 text-slate-600">Convert color, extensions, and stylist requests faster while your team stays focused on services in-chair.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/user/signup" className="rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white">Start Hair Trial →</Link>
            <Link href="/demo" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700">Try Live Demo</Link>
          </div>
          <IntegrationRow />
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['👩‍🎨', 'Stylist matching', 'Route callers to preferred stylists and alternatives.'],
            ['🎨', 'Service-aware duration', 'Book the right slot length by service type.'],
            ['🔄', 'Reschedule handling', 'Move bookings and send instant confirmations.'],
          ].map((feature) => (
            <article key={feature[1]} className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-3 text-2xl">{feature[0]}</div>
              <p className="text-lg font-bold text-slate-900">{feature[1]}</p>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">{feature[2]}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SpaPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">🧖 For Day Spa Teams</div>
            <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.08] tracking-tight text-slate-900">AI Receptionist for Spa and Day Spa Teams</h1>
            <p className="mt-3 text-[17px] leading-8 text-slate-600">Capture treatment calls, book faster, and protect premium guest experience while therapists are in session.</p>
            <div className="mt-6">
              <Link href="/user/signup" className="rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white">Start Spa Trial →</Link>
            </div>
            <IntegrationRow />
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-5">
            <p className="text-[14px] font-bold text-slate-900">How it works</p>
            <ol className="mt-3 space-y-3 text-[14px] text-slate-700">
              <li>1. Connect booking rules and service durations.</li>
              <li>2. Forward calls during busy windows or full-time.</li>
              <li>3. Confirm bookings + reminders automatically.</li>
            </ol>
          </div>
        </div>
      </section>
      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ['🧘', 'Treatment-aware scripts'],
            ['📅', 'Real-time slot booking'],
            ['🌙', '24/7 call capture'],
            ['💬', 'SMS reminders'],
            ['📞', 'Callback workflows'],
            ['📊', 'Call insights'],
          ].map((item) => (
            <div key={item[1]} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[14px] font-semibold text-slate-700">
              <span className="mr-2">{item[0]}</span>
              {item[1]}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MedSpaPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-8">
          <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">💉 For Med Spas</div>
          <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.08] tracking-tight text-slate-900">AI Phone Receptionist for Med Spa Growth</h1>
          <p className="mt-3 max-w-3xl text-[17px] leading-8 text-slate-600">Capture consultation calls instantly, reduce no-show loss, and convert high-ticket inquiries before competitors do.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/user/signup" className="rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white">Start Med Spa Trial →</Link>
            <Link href="/demo" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700">Try Live Demo</Link>
          </div>
          <IntegrationRow />
        </div>
      </section>
      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['$42,640', 'yearly no-show exposure'],
            ['37%', 'calls unanswered'],
            ['35×', 'ROI potential'],
          ].map((metric) => (
            <article key={metric[1]} className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-5xl font-extrabold tracking-tight text-blue-600">{metric[0]}</p>
              <p className="mt-2 text-[14px] font-semibold text-slate-700">{metric[1]}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function BeautyClinicPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-bold text-fuchsia-700">✨ For Beauty Clinics</div>
            <h1 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.08] tracking-tight text-slate-900">AI Phone Agent for Beauty and Aesthetic Clinics</h1>
            <p className="mt-3 text-[17px] leading-8 text-slate-600">Deliver a premium call experience with fast booking and professional intake handling.</p>
            <div className="mt-6">
              <Link href="/user/signup" className="rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white">Start Beauty Clinic Trial →</Link>
            </div>
            <IntegrationRow />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[14px] font-bold text-slate-900">Clinic benchmarks</p>
            <ul className="mt-3 space-y-2 text-[14px] text-slate-700">
              <li>77% of clients prefer calling for booking changes.</li>
              <li>62% don’t call back after a missed call.</li>
              <li>55% are comfortable with AI receptionist support.</li>
            </ul>
          </div>
        </div>
      </section>
      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['📞', '24/7 answering'],
            ['📅', 'Real-time booking'],
            ['🎙️', 'Custom brand voice'],
            ['📋', 'Client intake'],
            ['💬', 'SMS confirmations'],
            ['🔔', 'Smart reminders'],
            ['👥', 'Multi-provider routing'],
            ['📊', 'Call analytics'],
          ].map((item) => (
            <article key={item[1]} className="rounded-2xl border border-slate-200 bg-white p-5 text-[14px] font-semibold text-slate-700">
              <div className="mb-2 text-2xl">{item[0]}</div>
              {item[1]}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const FAQ_BY_VERTICAL: Record<MarketingVerticalKey, Array<{ q: string; a: string }>> = {
  'nail-salon': [
    { q: 'Can it handle bilingual callers?', a: 'Yes. RingBooker supports English + Vietnamese call handling for nail shops.' },
    { q: 'Does it sync with Square?', a: 'Yes, Square Appointments is live now.' },
    { q: 'Can RingBooker work with our current nail salon phone number?', a: 'Yes. You can forward your existing salon number so clients keep calling the number they already know.' },
    { q: 'Can it capture after-hours bookings?', a: 'Yes. It can answer and capture booking intent outside business hours, then send confirmations or summaries based on your setup.' },
  ],
  'hair-salon': [
    { q: 'Can it match caller to a stylist?', a: 'Yes, based on availability and configured rules.' },
    { q: 'Can it handle color/extension timing?', a: 'Yes, using service duration and booking constraints.' },
    { q: 'Does it support rescheduling?', a: 'Yes, reschedule flows are supported.' },
  ],
  spa: [
    { q: 'Can it book treatment packages?', a: 'Yes, based on configured services and durations.' },
    { q: 'Can it send reminders?', a: 'Yes, with automated reminder workflows.' },
    { q: 'Can it escalate complex requests?', a: 'Yes, via callback and routing logic.' },
  ],
  'med-spa': [
    { q: 'Can it handle consultation-first booking?', a: 'Yes, consultation flows can be configured per shop.' },
    { q: 'Can it help reduce no-shows?', a: 'Yes, with policy communication and reminders.' },
    { q: 'Can it route to the right provider?', a: 'Yes, multi-provider routing is supported.' },
  ],
  'beauty-clinic': [
    { q: 'Can we customize brand voice?', a: 'Yes, voice and script settings are configurable.' },
    { q: 'Can it handle premium client intake?', a: 'Yes, intake and booking context can be captured in-call.' },
    { q: 'Can we track call outcomes?', a: 'Yes, call analytics and transcripts are available.' },
  ],
};

function PageBody({ vertical }: { vertical: MarketingVerticalKey }) {
  if (vertical === 'nail-salon') return <NailPage />;
  if (vertical === 'hair-salon') return <HairPage />;
  if (vertical === 'spa') return <SpaPage />;
  if (vertical === 'med-spa') return <MedSpaPage />;
  return <BeautyClinicPage />;
}

export function MarketingVerticalTemplate({ vertical }: { vertical: MarketingVerticalKey }) {
  const faq = FAQ_BY_VERTICAL[vertical];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
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
    'nail-salon': { label: 'For Nail Salons', title: 'Stop losing bookings to missed calls.', subtitle: 'Capture every high-intent caller with AI receptionist coverage.' },
    'hair-salon': { label: 'For Hair Salons', title: 'Keep chairs full and stylists focused.', subtitle: 'Convert service inquiries into confirmed bookings faster.' },
    spa: { label: 'For Spas', title: 'Protect your premium guest experience.', subtitle: 'Handle calls without interrupting in-room service delivery.' },
    'med-spa': { label: 'For Med Spas', title: 'Capture high-value consult demand.', subtitle: 'Reduce leakage from missed calls and no-show risk.' },
    'beauty-clinic': { label: 'For Beauty Clinics', title: 'Deliver premium call experience at scale.', subtitle: 'Book faster, route smarter, and keep your front desk clear.' },
  };

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main className="bg-[radial-gradient(ellipse_76%_54%_at_50%_0%,#ede9fe_0%,#fff_60%)] pb-14 pt-28">
        <PageBody vertical={vertical} />
        <Faq items={faq} />
        <FinalCta label={ctaMap[vertical].label} title={ctaMap[vertical].title} subtitle={ctaMap[vertical].subtitle} />
      </main>
      <MarketingFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
    </>
  );
}
