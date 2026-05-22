import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { MarketingLayout } from '@/components/marketing/marketing-layout';

const styles: string[] = [
  String.raw`
    :root{
      --purple:var(--mk-brand-purple,#8B5CF6);
      --purple-dark:var(--mk-brand-purple-dark,#7C3AED);
      --text-dark:var(--mk-text-strong,#111827);
      --text-gray:var(--mk-text-muted,#64748B);
      --border:var(--mk-border-soft,#E8ECF1);
      --r-lg:var(--mk-radius-card,22px);
      --shadow:var(--mk-shadow-soft,0 16px 48px rgba(17,24,39,.08));
    }
    *{box-sizing:border-box}
    .nsd-page{padding-top:68px;background:linear-gradient(180deg,#FDF4FF 0%,#fff 40%)}
    .nsd-inner{max-width:640px;margin:0 auto;padding:48px 22px 80px;text-align:center}
    .nsd-badge{display:inline-flex;padding:8px 16px;border-radius:999px;border:1px solid rgba(139,92,246,.3);background:#fff;color:var(--purple-dark);font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px}
    .nsd-inner h1{margin:0 0 14px;font-size:clamp(28px,4.5vw,40px);line-height:1.1;letter-spacing:-.03em;color:var(--text-dark);font-weight:600}
    .nsd-lead{margin:0 auto 28px;max-width:520px;font-size:16px;line-height:1.65;color:var(--text-gray)}
    .nsd-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:28px 24px;text-align:left}
    .nsd-card p{margin:0 0 14px;font-size:15px;line-height:1.65;color:var(--text-gray)}
    .nsd-actions{display:flex;flex-direction:column;gap:12px;margin-top:22px}
    .nsd-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:14px 22px;font-size:15px;font-weight:600;text-decoration:none;transition:.18s}
    .nsd-btn-primary{background:var(--purple-dark);color:#fff;border:none;cursor:pointer}
    .nsd-btn-primary:hover{filter:brightness(1.06)}
    .nsd-btn-ghost{background:#fff;color:#374151;border:1.5px solid var(--border)}
    .nsd-btn-ghost:hover{border-color:var(--purple-dark);color:var(--purple-dark)}
    .nsd-note{margin-top:20px;padding-top:18px;border-top:1px solid #F1F5F9;font-size:13px;color:var(--text-gray);line-height:1.55}
    .nsd-num{font-weight:900;color:var(--purple-dark);font-variant-numeric:tabular-nums}
  `,
];

/** Legacy nail marketing shell — outbound visitor demo removed. Use `/demo/nail-salon` for the live web demo. */
export function MarketingNailSalonDemoTemplate() {
  return (
    <MarketingLayout styles={styles} scriptPrefix="marketing-demo-nail-salon">
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />
        <main className="nsd-page">
          <div className="nsd-inner">
            <div className="nsd-badge">Nail salon demo</div>
            <h1>Try RingBooker in your browser</h1>
            <p className="nsd-lead">
              The live nail-salon preview runs on the main demo page: add your salon context, allow the microphone, and talk to the AI receptionist. No phone number is required.
            </p>
            <div className="nsd-card">
              <p>
                <strong style={{ color: '#111827' }}>Start Demo Call</strong> — opens the full nail salon vertical demo with services, hours, and staff you can customize.
              </p>
              <div className="nsd-actions">
                <Link href="/demo/nail-salon" className="nsd-btn nsd-btn-primary">
                  Start Demo Call →
                </Link>
                <Link href="/demo" className="nsd-btn nsd-btn-ghost">
                  Browse all industry demos
                </Link>
                <a className="nsd-btn nsd-btn-ghost" href="tel:+16265013960">
                  Call demo line +1 626 501 3960
                </a>
              </div>
              <p className="nsd-note">
                <span className="nsd-num">+1 626 501 3960</span> uses a fixed sample profile for this vertical — not the fields from the web demo form.
              </p>
            </div>
          </div>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
