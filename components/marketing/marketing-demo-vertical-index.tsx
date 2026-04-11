import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICAL_ORDER, DEMO_VERTICALS } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

const styles = [
  String.raw`
    :root{--purple:#8B5CF6;--purple-dark:#7C3AED;--text-dark:#111827;--text-gray:#6B7280;--border:#E5E7EB;--shadow:0 16px 48px rgba(17,24,39,.08);--r-pill:999px}
    *{box-sizing:border-box}
    .demo-index{padding-top:68px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 42%,#fff 72%)}
    .demo-index-hero{padding:76px 22px 34px;text-align:center}
    .demo-index-inner{max-width:1040px;margin:0 auto}
    .demo-index-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(139,92,246,.25);background:#fff;border-radius:999px;padding:8px 16px;color:#6D28D9;font-size:13px;font-weight:900}
    .demo-index h1{margin:18px auto 14px;max-width:850px;font-size:clamp(36px,5.8vw,64px);line-height:1.04;letter-spacing:-2px}
    .demo-index p{margin:0 auto;color:var(--text-gray);font-size:16px;line-height:1.7;max-width:760px}
    .demo-grid-section{padding:18px 22px 90px}
    .demo-grid{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
    .demo-card{background:#fff;border:1px solid var(--border);border-radius:26px;padding:22px;box-shadow:var(--shadow);display:flex;flex-direction:column;min-height:270px;transition:.22s;text-decoration:none;color:inherit}
    .demo-card:hover{transform:translateY(-4px);border-color:#DDD6FE;box-shadow:0 22px 54px rgba(124,58,237,.14)}
    .demo-card-mark{width:44px;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;margin-bottom:16px}
    .demo-card h2{font-size:20px;line-height:1.18;margin:0 0 9px;letter-spacing:-.45px}
    .demo-card p{font-size:13px;line-height:1.6;margin:0 0 16px;text-align:left}
    .prompt-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto}
    .prompt-pill{font-size:11px;font-weight:900;color:#4B5563;border:1px solid #E5E7EB;background:#F9FAFB;border-radius:999px;padding:6px 8px}
    .demo-safety{max-width:900px;margin:22px auto 0;border:1px solid #FDE68A;background:#FFFBEB;border-radius:22px;padding:16px;color:#92400E;font-size:14px;line-height:1.65;text-align:center}
    @media (max-width:1100px){.demo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:640px){.demo-index-hero{padding-top:52px}.demo-grid{grid-template-columns:1fr}.demo-card{min-height:0}.demo-index h1{letter-spacing:-1.3px}}
  `,
];

export function MarketingDemoVerticalIndexTemplate() {
  return (
    <MarketingLayout styles={styles} scriptPrefix="marketing-demo-vertical-index">
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />
        <main className="demo-index">
          <section className="demo-index-hero">
            <div className="demo-index-inner">
              <div className="demo-index-badge">Live outbound demo system</div>
              <h1>Choose the demo that sounds like your business.</h1>
              <p>
                Each RingBooker demo is web-only, outbound, and isolated from production. Pick a vertical, enter the number we should call,
                and test booking, reschedule, pricing, hours, and handoff scenarios in 2-3 minutes.
              </p>
            </div>
          </section>
          <section className="demo-grid-section">
            <div className="demo-grid">
              {DEMO_VERTICAL_ORDER.map((slug) => {
                const vertical = DEMO_VERTICALS[slug];
                return (
                  <Link key={slug} href={`/demo/${slug}`} className="demo-card">
                    <div className="demo-card-mark" style={{ background: vertical.accent }}>
                      {vertical.icon}
                    </div>
                    <h2>{vertical.businessType.replace('-', ' ')}</h2>
                    <p>{vertical.subtitle}</p>
                    <div className="prompt-list">
                      {vertical.quickStartPrompts.map((prompt) => (
                        <span key={prompt} className="prompt-pill">
                          {prompt}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="demo-safety">
              Demo calls use a separate outbound flow. Production RingBooker is inbound, works on the current business number, and is
              configured separately from these web demos.
            </div>
          </section>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
