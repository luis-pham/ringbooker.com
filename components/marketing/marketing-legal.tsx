import type { ReactNode } from 'react';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

type LegalSection = {
  title: string;
  content: ReactNode;
};

type MarketingLegalPageProps = {
  badge: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function MarketingLegalPage({
  badge,
  title,
  subtitle,
  updatedAt,
  sections,
}: MarketingLegalPageProps) {
  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main className="legal-shell">
        <section className="legal-hero">
          <div className="legal-badge">{badge}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="legal-updated">Last updated: {updatedAt}</div>
        </section>
        <section className="legal-content">
          {sections.map((section) => (
            <article key={section.title} className="legal-card">
              <h2>{section.title}</h2>
              <div className="legal-copy">{section.content}</div>
            </article>
          ))}
        </section>
      </main>
      <MarketingFooter />
      <style
        dangerouslySetInnerHTML={{
          __html: `
.legal-shell{padding:112px 22px 72px;background:radial-gradient(ellipse 95% 58% at 50% 0%,#f3e8ff 0%,#ffffff 62%);}
.legal-hero{max-width:900px;margin:0 auto 28px;text-align:left}
.legal-badge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid rgba(124,58,237,.28);background:#f5f3ff;color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;margin-bottom:14px}
.legal-hero h1{font-size:clamp(34px,5vw,52px);line-height:1.06;letter-spacing:-1.4px;color:#111827;margin:0 0 10px}
.legal-hero p{font-size:16px;color:#4b5563;line-height:1.65;max-width:760px;margin:0 0 14px}
.legal-updated{display:inline-flex;align-items:center;padding:7px 12px;border-radius:10px;background:#ffffff;border:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#374151}
.legal-content{max-width:900px;margin:0 auto;display:grid;gap:14px}
.legal-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px 20px;box-shadow:0 8px 24px rgba(17,24,39,.05)}
.legal-card h2{font-size:20px;line-height:1.2;color:#111827;margin:0 0 10px}
.legal-copy{display:grid;gap:10px;color:#4b5563}
.legal-copy p{margin:0;font-size:15px;line-height:1.72}
.legal-copy ul{margin:0;padding-left:18px;display:grid;gap:7px}
.legal-copy li{font-size:15px;line-height:1.66}
@media (max-width: 768px){
  .legal-shell{padding-top:96px}
  .legal-card{padding:18px 16px}
  .legal-copy p,.legal-copy li{font-size:14px}
}
`,
        }}
      />
    </>
  );
}
