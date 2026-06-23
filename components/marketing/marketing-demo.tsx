import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

const styles: string[] = [
  String.raw`:root{--purple:var(--mk-brand-purple,#8B5CF6);--purple-dark:var(--mk-brand-purple-dark,#7C3AED);--text-dark:var(--mk-text-strong,#111827);--text-gray:var(--mk-text-muted,#64748B);--text-light:var(--mk-text-soft,#94A3B8);--bg-gray:var(--mk-bg-section,#F9FAFB);--border:var(--mk-border-soft,#E8ECF1);--r-pill:999px;--r-lg:22px;--shadow:var(--mk-shadow-soft,0 20px 40px -8px rgba(17,24,39,.06),0 8px 16px -6px rgba(17,24,39,.04))}*{box-sizing:border-box;margin:0;padding:0}a{text-decoration:none;color:inherit}nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(229,231,235,.7);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}.nav-inner{width:100%;max-width:1160px;display:flex;align-items:center;justify-content:space-between;gap:20px}.nav-logo{display:flex;align-items:center;gap:11px;font-weight:500;font-size:19px;color:var(--text-dark)}.nav-links{display:flex;align-items:center;gap:28px;flex-wrap:wrap}.nav-links a{font-size:14.5px;font-weight:500;color:var(--text-gray);transition:color .2s}.nav-links a:hover,.nav-links a.active{color:var(--text-dark)}.nav-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.nav-signin{padding:9px 16px;border-radius:var(--r-pill);border:1px solid var(--border);font-size:14px;font-weight:600;color:#374151;background:#fff}.nav-demo-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:10px 22px;border-radius:var(--r-pill);font-size:14px;font-weight:500;white-space:nowrap}.nav-trial-outline{background:transparent;color:#374151;padding:10px 20px;border-radius:var(--r-pill);font-size:14px;font-weight:600;border:1.5px solid var(--border)}.hero{padding:84px 48px 28px;text-align:center;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%)}.hero-inner{max-width:960px;margin:0 auto}.hero h1{font-size:var(--mk-hero-title);font-weight:600;line-height:var(--mk-hero-title-lh);margin-bottom:14px}.hero p{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);max-width:700px;margin:0 auto 22px;line-height:var(--mk-hero-lead-lh)}.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.btn-dark,.btn-outline{padding:14px 22px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;cursor:pointer}.btn-dark{background:var(--text-dark);color:#fff}.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}.section{padding:28px 48px 84px}.section.gray{background:var(--bg-gray)}.container{max-width:1160px;margin:0 auto}.demo-layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}.panel,.preview-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:24px}.form-title{font-size:var(--mk-article-h2);font-weight:500;margin-bottom:8px}.form-sub{font-size:var(--mk-body);color:var(--text-gray);margin-bottom:18px;line-height:1.6}.stack-actions{display:flex;flex-direction:column;gap:10px;margin-top:8px}.helper{font-size:14px;color:var(--text-light);margin-top:14px;line-height:1.55}.preview-card{background:linear-gradient(160deg,#1a0533 0%,#2d1b69 40%,#1a0d3a 100%);color:#fff;border:none}.preview-card h3{font-size:17px;margin-bottom:8px}.preview-card p{font-size:14px;opacity:.88;line-height:1.6;margin-bottom:12px}.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;text-transform:uppercase;text-align:left;margin-bottom:12px}.sec-title{font-size:var(--mk-section-h2);font-weight:500;text-align:left;margin-bottom:14px;max-width:44ch}.sec-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);text-align:left;margin:0 0 44px;max-width:760px;line-height:1.6}.grid-3{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.info-card{background:#fff;border:1px solid var(--border);border-radius:24px;padding:24px;display:block;cursor:pointer;transition:.2s}.info-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}.info-card.active{border-color:#C4B5FD;background:#FAF5FF}.info-icon{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#F5F3FF;font-size:22px;margin-bottom:8px}.info-card h3{font-size:15px;margin:10px 0 6px}.info-card p{font-size:13px;color:var(--text-gray);line-height:1.58}.arrow{font-size:13px;color:var(--purple);font-weight:600;margin-top:10px;display:block}.legacy-marketing>nav,.legacy-marketing>.topbar{display:none !important}@media(max-width:960px){nav{padding:0 22px}.nav-links{display:none}.hero,.section{padding-left:22px;padding-right:22px}.demo-layout{grid-template-columns:1fr}}`,
];

const scripts: string[] = [
  `
    const howCards = Array.from(document.querySelectorAll('[data-demo-step-card]'));
    function activateHowCard(target){
      howCards.forEach((card) => card.classList.remove('active'));
      if (target) target.classList.add('active');
    }
    howCards.forEach((card, idx) => {
      if (idx === 0) card.classList.add('active');
      card.addEventListener('click', () => activateHowCard(card));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateHowCard(card);
        }
      });
    });
  `,
];

export const templateTitle = 'RingBooker Demo — Web voice preview';

/** Static marketing demo page: links to interactive browser demos (no outbound visitor calls). */
export function MarketingDemoTemplate() {
  return (
    <MarketingLayout styles={styles} scripts={scripts} scriptPrefix="marketing-demo">
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />
        <div className="legacy-marketing">
          <nav>
            <div className="nav-inner">
              <Link href="/" className="nav-logo">
                <span>RingBooker</span>
              </Link>
              <div className="nav-links">
                <Link href="/#features">Features</Link>
                <Link href="/demo" className="active">
                  Live Demo
                </Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/how-it-works">How It Works</Link>
                <Link href="/contact">Contact</Link>
              </div>
              <div className="nav-actions">
                <Link href="/user/login" className="nav-signin">
                  Sign In
                </Link>
                <Link href="/demo" className="nav-demo-live" data-demo-picker>
                  Try web demo →
                </Link>
                <Link href="/pricing" className="nav-trial-outline">
                  Start 14-Day Free Trial →
                </Link>
              </div>
            </div>
          </nav>
          <section className="hero">
            <div className="hero-inner">
              <nav aria-label="Breadcrumb" style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.35, color: 'var(--mk-text-soft,#94a3b8)', textAlign: 'left' }}>
                <Link href="/" style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>
                  Home
                </Link>
                <span style={{ margin: '0 6px' }}>›</span>
                <span style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>Demo</span>
              </nav>
              <p className="hero-eyebrow">Browser web voice demo</p>
              <h1>Hear RingBooker in your browser.</h1>
              <p>
                Pick an industry demo, enter your salon or clinic context, allow the microphone, and talk to the AI receptionist live. Optional: call the public demo line to hear a fixed sample profile for that vertical.
              </p>
              <div className="hero-actions">
                <Link href="/demo" className="btn-dark">
                  Start Demo Call →
                </Link>
                <Link href="/demo/nail-salon" className="btn-outline">
                  Nail salon demo
                </Link>
              </div>
            </div>
          </section>
          <section className="section" id="demo">
            <div className="container">
              <div className="demo-layout">
                <div className="panel">
                  <div className="form-title">Interactive demos live on /demo</div>
                  <div className="form-sub">
                    This marketing template does not start a voice session inline. Use the hub or a vertical page for the full web demo with LiveKit, captcha where configured, and the status panel.
                  </div>
                  <div className="stack-actions">
                    <Link href="/demo" className="btn-dark">
                      Open demo hub →
                    </Link>
                    <Link href="/demo/hair-salon" className="btn-outline">
                      Hair salon demo
                    </Link>
                    <Link href="/demo/day-spa" className="btn-outline">
                      Day spa demo
                    </Link>
                  </div>
                  <p className="helper">
                    Prefer phone only? Open a vertical demo page — each vertical lists its own demo line and sample profile.
                  </p>
                </div>
                <div className="preview-card">
                  <h3>Web preview</h3>
                  <p>Microphone in the browser · Custom business context on vertical pages · AI listens and responds in real time.</p>
                  <p style={{ fontSize: 13, opacity: 0.75 }}>No app install. No RingBooker outbound call to your phone from these demos.</p>
                </div>
              </div>
            </div>
          </section>
          <section className="section gray" id="how">
            <div className="container">
              <div className="sec-label">How the web demo works</div>
              <h2 className="sec-title">Three short steps in the browser.</h2>
              <p className="sec-sub">Visitors choose a vertical, customize sample business details, start the web session, and speak naturally while the page shows connection status.</p>
              <div className="grid-3">
                <div className="info-card" data-demo-step-card role="button" tabIndex={0}>
                  <div className="info-icon" aria-hidden>
                    📝
                  </div>
                  <h3>1. Pick a vertical</h3>
                  <p>Nail, hair, spa, med spa, or beauty clinic — each page ships tailored sample services and tone.</p>
                  <span className="arrow">View step →</span>
                </div>
                <div className="info-card" data-demo-step-card role="button" tabIndex={0}>
                  <div className="info-icon" aria-hidden>
                    🎙️
                  </div>
                  <h3>2. Allow the microphone</h3>
                  <p>The browser asks for audio permission, then opens a secure realtime session in the demo room.</p>
                  <span className="arrow">View step →</span>
                </div>
                <div className="info-card" data-demo-step-card role="button" tabIndex={0}>
                  <div className="info-icon" aria-hidden>
                    ✨
                  </div>
                  <h3>3. Talk and explore</h3>
                  <p>Try bookings, pricing, or reschedules. The page shows live states while the AI responds in your browser.</p>
                  <span className="arrow">View step →</span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
