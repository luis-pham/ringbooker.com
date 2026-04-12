import type { ReactNode } from 'react';
import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICAL_ORDER, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

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

function IndustryGlyph({ slug }: { slug: DemoVerticalSlug }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (slug) {
    case 'nail-salon':
      return (
        <svg {...common}>
          <path d="M12 3v4M9 8l3-2 3 2" />
          <path d="M8 14c1.5 2.5 4 4 8 4M7 21h10" />
        </svg>
      );
    case 'hair-salon':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
        </svg>
      );
    case 'day-spa':
      return (
        <svg {...common}>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      );
    case 'med-spa':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'beauty-clinic':
      return (
        <svg {...common}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    default:
      return null;
  }
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
      position:relative;background:#fff;border:1px solid var(--demo-hub-border);border-radius:var(--r-xl);
      padding:22px 20px 20px;box-shadow:var(--demo-hub-shadow);text-decoration:none;color:inherit;
      display:flex;flex-direction:column;min-height:300px;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
      overflow:hidden;
    }
    .demo-hub-card::before{
      content:"";position:absolute;inset:0 0 auto 0;height:3px;border-radius:var(--r-xl) var(--r-xl) 0 0;opacity:.9;
    }
    .demo-hub-card-nail-salon::before{background:#7C3AED}
    .demo-hub-card-hair-salon::before{background:#B45309}
    .demo-hub-card-day-spa::before{background:#0D9488}
    .demo-hub-card-med-spa::before{background:#4F46E5}
    .demo-hub-card-beauty-clinic::before{background:#A21CAF}
    .demo-hub-card:hover{
      transform:translateY(-5px);
      border-color:#DDD6FE;
      box-shadow:var(--demo-hub-shadow-hover);
    }
    .demo-hub-card-mark{
      width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;
      margin-bottom:16px;color:#fff;flex-shrink:0;
    }
    .demo-hub-card-mark-nail-salon{background:linear-gradient(145deg,#8B5CF6,#6D28D9)}
    .demo-hub-card-mark-hair-salon{background:linear-gradient(145deg,#D97706,#B45309)}
    .demo-hub-card-mark-day-spa{background:linear-gradient(145deg,#14B8A6,#0D9488)}
    .demo-hub-card-mark-med-spa{background:linear-gradient(145deg,#6366F1,#4338CA)}
    .demo-hub-card-mark-beauty-clinic{background:linear-gradient(145deg,#C026D3,#86198F)}
    .demo-hub-card h3{margin:0;font-size:20px;font-weight:800;letter-spacing:-.03em;color:var(--demo-hub-text);line-height:1.2}
    .demo-hub-card-line{margin:10px 0 0;font-size:13.5px;line-height:1.55;color:var(--demo-hub-muted)}
    .demo-hub-card-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto;padding-top:18px}
    .demo-hub-card-chips span{
      font-size:11px;font-weight:700;color:#4B5563;background:var(--demo-hub-soft);
      border:1px solid var(--demo-hub-border);border-radius:999px;padding:6px 10px;line-height:1;
    }
    .demo-hub-card-cta{
      margin-top:16px;display:inline-flex;align-items:center;justify-content:center;gap:6px;
      padding:11px 16px;border-radius:999px;background:var(--demo-hub-text);color:#fff;font-size:13px;font-weight:700;
      width:100%;transition:background .15s ease,transform .15s ease;
    }
    .demo-hub-card:hover .demo-hub-card-cta{background:#1f2937}
    .demo-hub-card-cta svg{width:15px;height:15px;flex-shrink:0}

    /* STEPS */
    .demo-hub-steps{padding:48px 0 88px;border-top:1px solid rgba(229,231,235,.85);background:linear-gradient(180deg,rgba(249,250,251,.65) 0%,#fff 100%)}
    .demo-hub-steps h2{text-align:center;margin:0 auto 8px;font-size:clamp(22px,3vw,28px);font-weight:800;letter-spacing:-.03em;color:var(--demo-hub-text)}
    .demo-hub-steps > .demo-hub-inner > p{margin:0 auto 32px;text-align:center;max-width:520px;font-size:15px;color:var(--demo-hub-muted)}
    .demo-hub-step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .demo-hub-step{
      background:#fff;border:1px solid var(--demo-hub-border);border-radius:var(--r-lg);padding:22px 20px;
      box-shadow:0 4px 20px rgba(17,24,39,.04);
    }
    .demo-hub-step-num{
      width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#EDE9FE,#F5F3FF);
      color:var(--demo-hub-purple-dark);font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-bottom:14px;
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
                      <div className="demo-hub-card-chips">
                        {hub.chips.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                      </div>
                      <span className="demo-hub-card-cta">
                        Try demo
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
