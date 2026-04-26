import type { ReactNode } from 'react';
import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICAL_ORDER, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

/** Hub-only copy: titles, one line, scenario chips (preview, not full prompt lists). */
const DEMO_HUB: Record<
  DemoVerticalSlug,
  { title: string; line: string; chips: [string, string, string, string] }
> = {
  'nail-salon': {
    title: 'Nail Salon',
    line: 'Booking, walk-ins, pricing, and reschedules—the way a busy studio actually sounds.',
    chips: ['Gel manicure', 'Walk-in check', 'Dip & acrylic', 'Reschedule'],
  },
  'hair-salon': {
    title: 'Hair Salon',
    line: 'Stylist preference, color timing, and consult-style questions without the rush.',
    chips: ['Balayage consult', 'Stylist booking', 'Keratin timing', 'Reschedule'],
  },
  'day-spa': {
    title: 'Day Spa',
    line: 'Calm pacing for massage, packages, and changes—premium front desk energy.',
    chips: ['Couples massage', 'Package options', 'Cancel + rebook', 'After hours'],
  },
  'med-spa': {
    title: 'Med Spa',
    line: 'Consult-first tone for injectables, pricing boundaries, and provider handoff.',
    chips: ['Botox consult', 'Pricing scope', 'Provider request', 'Reschedule'],
  },
  'beauty-clinic': {
    title: 'Beauty Clinic',
    line: 'Clear appointment intent, session follow-ups, and careful human handoff.',
    chips: ['Treatment consult', 'Session plan', 'Pre-care', 'Reschedule'],
  },
};

const DEMO_HUB_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'What is a RingBooker live web demo?',
    a: 'It is a short outbound call to your phone using sample salon or clinic context so you can hear booking-style flows, tone, and pacing before you change anything on your live line.',
  },
  {
    q: 'Does the demo change my business phone setup?',
    a: 'No. Demos are web-only previews. Production setup uses call forwarding when you are ready, but nothing on your public number changes during the demo itself.',
  },
  {
    q: 'How long does each demo take?',
    a: 'Most demos take about two to three minutes. Pick the industry that matches your business and answer naturally, like a real caller would.',
  },
  {
    q: 'Which industries have tailored demos?',
    a: 'Nail salon, hair salon, day spa, med spa, and beauty clinic demos are available from this hub. Each uses different sample services and scenarios.',
  },
  {
    q: 'What should I do after the demo?',
    a: 'If it is a fit, you can start a free trial, review pricing, or book a walkthrough from the contact page for a deeper setup discussion.',
  },
];

const demoHubFaqJsonLd = buildFaqPageJsonLd(DEMO_HUB_FAQ_ITEMS);

function IndustryGlyph({ slug }: { slug: DemoVerticalSlug }) {
  const icon =
    slug === 'nail-salon'
      ? '💅'
      : slug === 'hair-salon'
        ? '✂️'
        : slug === 'day-spa'
          ? '🧖'
          : slug === 'med-spa'
            ? '💉'
            : '✨';

  return (
    <span aria-hidden className="demo-hub-emoji-icon">
      {icon}
    </span>
  );
}

const styles = [
  String.raw`
    :root{
      --demo-hub-purple:#8B5CF6;
      --demo-hub-purple-dark:#7C3AED;
      --demo-hub-text:#111827;
      --demo-hub-muted:#6B7280;
      --demo-hub-border:#E5E7EB;
      --demo-hub-soft:#F9FAFB;
      --demo-hub-shadow:0 16px 48px rgba(17,24,39,.08);
      --demo-hub-shadow-hover:0 24px 60px rgba(124,58,237,.16);
      --r-lg:24px;
      --r-xl:28px;
    }
    *{box-sizing:border-box}
    .demo-hub{padding-top:68px;background:radial-gradient(ellipse 82% 58% at 50% -8%,#EDE9FE 0%,#FDF4FF 38%,#fff 78%)}
    .demo-hub-inner{max-width:1120px;margin:0 auto;padding-left:22px;padding-right:22px}

    /* HERO */
    .demo-hub-hero{padding:72px 0 28px;text-align:center}
    .demo-hub-eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(139,92,246,.22);background:rgba(255,255,255,.88);backdrop-filter:blur(8px);border-radius:999px;padding:8px 16px;color:var(--demo-hub-purple-dark);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .demo-hub-hero h1{margin:22px auto 0;max-width:820px;font-size:clamp(34px,5.2vw,56px);line-height:1.06;letter-spacing:-.04em;color:var(--demo-hub-text);font-weight:800}
    .demo-hub-lead{margin:16px auto 0;max-width:640px;font-size:17px;line-height:1.6;color:var(--demo-hub-muted)}
    .demo-hub-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:26px auto 0;max-width:720px}
    .demo-hub-chip{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;border:1px solid var(--demo-hub-border);background:#fff;font-size:13px;font-weight:600;color:#374151;box-shadow:0 1px 2px rgba(0,0,0,.04)}
    .demo-hub-chip svg{flex-shrink:0;opacity:.75}
    .demo-hub-scroll{margin-top:22px}
    .demo-hub-scroll a{font-size:14px;font-weight:700;color:var(--demo-hub-purple-dark);text-decoration:none;border-bottom:1px solid rgba(124,58,237,.35);padding-bottom:2px}
    .demo-hub-scroll a:hover{color:#5B21B6;border-color:#5B21B6}

    /* GRID */
    .demo-hub-picks{padding:36px 0 56px}
    .demo-hub-picks h2{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--demo-hub-muted);text-align:center;margin:0 0 20px}
    .demo-hub-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
    .demo-hub-card{
      background:#fff;border:1px solid var(--demo-hub-border);border-radius:24px;
      padding:22px 20px;text-decoration:none;color:inherit;
      display:block;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease,background .2s ease;
      text-align:center;
    }
    .demo-hub-card:hover{
      transform:translateY(-2px);
      border-color:#d1d5db;
      box-shadow:0 20px 40px -8px rgba(17,24,39,.12),0 8px 16px -6px rgba(17,24,39,.08);
      background:#fff;
    }
    .demo-hub-card:focus-visible{outline:2px solid #8B5CF6;outline-offset:2px}
    .demo-hub-card-mark{
      width:auto;height:auto;border-radius:0;display:flex;align-items:center;justify-content:center;
      margin:0 auto 12px;flex-shrink:0;background:transparent;border:0;
    }
    .demo-hub-emoji-icon{font-size:32px;line-height:1}
    .demo-hub-card h3{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em;color:var(--demo-hub-text);line-height:1.3}
    .demo-hub-card-line{margin:7px 0 0;font-size:12px;line-height:1.5;color:var(--demo-hub-muted)}
    .demo-hub-card-cta{
      margin-top:10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;
      color:#6D28D9;font-size:13px;font-weight:700;
    }
    .demo-hub-card-cta svg{width:14px;height:14px;flex-shrink:0}

    /* STEPS */
    .demo-hub-steps{padding:48px 0 88px;background:linear-gradient(180deg,rgba(249,250,251,.65) 0%,#fff 100%)}
    .demo-hub-steps h2{text-align:center;margin:0 auto 14px;font-size:clamp(22px,3vw,28px);font-weight:800;letter-spacing:-.03em;color:var(--demo-hub-text)}
    .demo-hub-steps > .demo-hub-inner > p{margin:0 auto 32px;text-align:center;max-width:520px;font-size:15px;color:var(--demo-hub-muted)}
    .demo-hub-step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .demo-hub-step{
      background:#fff;border:1px solid var(--demo-hub-border);border-radius:var(--r-lg);padding:22px 20px;
      box-shadow:var(--demo-hub-shadow);
      text-align:center;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease,background .2s ease;
    }
    .demo-hub-step:hover{
      transform:translateY(-2px);
      border-color:#d1d5db;
      box-shadow:0 20px 40px -8px rgba(17,24,39,.12),0 8px 16px -6px rgba(17,24,39,.08);
      background:#fff;
    }
    /* Match how-it-works .hiw-step::before — purple circle, white number, centered */
    .demo-hub-step-num{
      width:36px;height:36px;border-radius:50%;
      background:var(--demo-hub-purple);
      color:#fff;font-size:14px;font-weight:900;
      display:flex;align-items:center;justify-content:center;
      margin:0 auto 18px;
      box-shadow:0 12px 24px rgba(139,92,246,.24);
    }
    .demo-hub-step h3{margin:0 0 8px;font-size:16px;font-weight:800;color:var(--demo-hub-text)}
    .demo-hub-step p{margin:0;font-size:14px;line-height:1.55;color:var(--demo-hub-muted)}

    @media (max-width:1100px){
      .demo-hub-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .demo-hub-step-grid{grid-template-columns:1fr}
    }
    @media (max-width:640px){
      .demo-hub-hero{padding-top:56px}
      .demo-hub-grid{grid-template-columns:1fr}
      .demo-hub-card{min-height:0}
      .demo-hub-trust{flex-direction:column;align-items:stretch}
      .demo-hub-chip{justify-content:center}
    }
    .demo-hub-faq{background:#fff;padding:8px 0 24px}
  `,
];

function TrustChip({ children }: { children: ReactNode }) {
  return <div className="demo-hub-chip">{children}</div>;
}

export function MarketingDemoVerticalIndexTemplate() {
  return (
    <MarketingLayout styles={styles} scriptPrefix="marketing-demo-vertical-index">
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />
        <main className="demo-hub">
          <section className="demo-hub-hero">
            <div className="demo-hub-inner">
              <p className="demo-hub-eyebrow">Live demo hub</p>
              <h1>Hear how RingBooker handles real booking calls.</h1>
              <p className="demo-hub-lead">
                Choose a live web demo for your business type. Each call uses sample salon or clinic context—booking,
                reschedules, pricing, and after-hours scenarios—so you can judge tone and pacing in a few minutes.
              </p>
              <div className="demo-hub-trust">
                <TrustChip>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Web-only demo
                </TrustChip>
                <TrustChip>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  No impact on your number
                </TrustChip>
                <TrustChip>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  About 2–3 minutes
                </TrustChip>
              </div>
              <p className="demo-hub-scroll">
                <a href="#pick-demo">Pick an industry below →</a>
              </p>
            </div>
          </section>

          <section className="demo-hub-picks" id="pick-demo">
            <div className="demo-hub-inner">
              <h2>Industry demos</h2>
              <div className="demo-hub-grid">
                {DEMO_VERTICAL_ORDER.map((slug) => {
                  const hub = DEMO_HUB[slug];
                  return (
                    <Link key={slug} href={`/demo/${slug}`} className={`demo-hub-card demo-hub-card-${slug}`}>
                      <div className={`demo-hub-card-mark demo-hub-card-mark-${slug}`}>
                        <IndustryGlyph slug={slug} />
                      </div>
                      <h3>{hub.title}</h3>
                      <p className="demo-hub-card-line">{hub.line}</p>
                      <span className="demo-hub-card-cta">
                        Try demo
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="demo-hub-steps">
            <div className="demo-hub-inner">
              <h2>How the demo works</h2>
              <p>Three quick steps—then talk naturally, like a real caller would.</p>
              <div className="demo-hub-step-grid">
                <div className="demo-hub-step">
                  <div className="demo-hub-step-num">1</div>
                  <h3>Pick your industry</h3>
                  <p>Select the demo that matches your salon, spa, or clinic. Each uses tailored scripts and sample services.</p>
                </div>
                <div className="demo-hub-step">
                  <div className="demo-hub-step-num">2</div>
                  <h3>Enter your number</h3>
                  <p>We place a one-time outbound call to the number you provide—so you hear the experience on your own phone.</p>
                </div>
                <div className="demo-hub-step">
                  <div className="demo-hub-step-num">3</div>
                  <h3>Answer and ask naturally</h3>
                  <p>Try bookings, reschedules, pricing, or after-hours questions. There is no setup on your live business line.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="demo-hub-faq">
            <MarketingFaqAccordion
              items={DEMO_HUB_FAQ_ITEMS}
              eyebrow="Common Questions"
              title="Live demo hub — quick answers"
              subtitle={null}
              embedded
            />
          </div>
        </main>
        <MarketingFooter />
        {demoHubFaqJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(demoHubFaqJsonLd) }} />
        ) : null}
      </>
    </MarketingLayout>
  );
}
