import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { buildMetadata } from '@/lib/site';

const thankYouStyles = [
  String.raw`
.thank-you-page{background:#fff;min-height:50vh}
.thank-you-main{max-width:640px;margin:0 auto;padding:160px 24px 60px;text-align:center}
.thank-you-check{width:56px;height:56px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:26px;line-height:1;color:#16a34a}
.thank-you-h1{font-size:24px;font-weight:500;margin:20px 0 0;color:#111827}
.thank-you-lead{font-size:15px;color:#64748b;margin:12px auto 48px;max-width:420px;line-height:1.55}
.thank-you-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:40px;text-align:left}
@media(max-width:960px){.thank-you-cards{grid-template-columns:1fr}}
.thank-you-card{background:#fff;border:0.5px solid #e5e7eb;border-radius:12px;padding:20px;transition:box-shadow .2s ease}
.thank-you-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}
.thank-you-card-icon{font-size:22px;line-height:1;margin-bottom:12px}
.thank-you-card-title{font-size:15px;font-weight:700;margin:0 0 8px;color:#111827}
.thank-you-card-desc{font-size:14px;color:#64748b;line-height:1.5;margin:0 0 14px}
.thank-you-card-link{font-size:14px;font-weight:600;color:#7c3aed;text-decoration:none}
.thank-you-card-link:hover{text-decoration:underline}
.thank-you-back{display:inline-block;font-size:13px;color:#64748b;text-decoration:none}
.thank-you-back:hover{text-decoration:underline}
`,
];

const baseMetadata = buildMetadata({
  title: 'Request Received | RingBooker',
  description: "We've received your demo request and will be in touch within 24 hours.",
  path: '/thank-you',
});

export const metadata = {
  ...baseMetadata,
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouPage() {
  return (
    <MarketingLayout styles={thankYouStyles} scripts={[]} scriptPrefix="marketing-thank-you">
      <>
        <MarketingChromeStyles />
        <MarketingHeader />
        <main className="thank-you-page">
          <div className="thank-you-main">
            <div className="thank-you-check" aria-hidden>
              ✓
            </div>
            <h1 className="thank-you-h1">We&apos;ll be in touch soon!</h1>
            <p className="thank-you-lead">
              Thanks for reaching out. We&apos;ve sent a confirmation to your email. We&apos;ll be in touch within 24
              hours.
            </p>
            <div className="thank-you-cards">
              <div className="thank-you-card">
                <div className="thank-you-card-icon" aria-hidden>
                  📞
                </div>
                <h2 className="thank-you-card-title">Try a live demo</h2>
                <p className="thank-you-card-desc">Hear how RingBooker sounds answering your calls</p>
                <Link href="/demo" className="thank-you-card-link">
                  Call the demo →
                </Link>
              </div>
              <div className="thank-you-card">
                <div className="thank-you-card-icon" aria-hidden>
                  ⚡
                </div>
                <h2 className="thank-you-card-title">See how it works</h2>
                <p className="thank-you-card-desc">Learn how RingBooker captures missed calls on your number</p>
                <Link href="/how-it-works" className="thank-you-card-link">
                  How it works →
                </Link>
              </div>
              <div className="thank-you-card">
                <div className="thank-you-card-icon" aria-hidden>
                  🚀
                </div>
                <h2 className="thank-you-card-title">Start free trial</h2>
                <p className="thank-you-card-desc">Set up in 15 minutes. No number change required.</p>
                <Link href="/pricing" className="thank-you-card-link">
                  Try free →
                </Link>
              </div>
            </div>
            <Link href="/" className="thank-you-back">
              ← Back to RingBooker.com
            </Link>
          </div>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
