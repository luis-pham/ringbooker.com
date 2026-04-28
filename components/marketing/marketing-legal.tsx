import type { ReactNode } from 'react';

import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

type LegalSection = {
  title: string;
  content: ReactNode;
};

type MarketingLegalPageProps = {
  breadcrumbLabel?: string;
  badge?: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: LegalSection[];
  /** Optional FAQ block + matching FAQPage JSON-LD (must mirror visible Q/A). */
  faqs?: readonly MarketingFaqItem[];
};

export function MarketingLegalPage({
  breadcrumbLabel,
  title,
  subtitle,
  updatedAt,
  sections,
  faqs = [],
}: MarketingLegalPageProps) {
  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main className="legal-shell">
        <section className="legal-hero">
          {breadcrumbLabel ? (
            <nav aria-label="Breadcrumb" className="legal-breadcrumb">
              <a href="/">Home</a>
              <span aria-hidden>›</span>
              <span>{breadcrumbLabel}</span>
            </nav>
          ) : null}
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
.legal-faq-wrap{max-width:900px;margin:0 auto;padding:0 22px 48px}
.legal-faq-wrap .mfaq-title{display:none}
.legal-faq-wrap .mfaq-title + .mfaq-list{margin-top:0}
.legal-hero{max-width:900px;margin:0 auto 28px;text-align:left}
.legal-breadcrumb{margin:0 0 12px;display:flex;align-items:center;gap:6px;font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8)}
.legal-breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}
.legal-breadcrumb a:hover{color:var(--mk-brand-purple-deep,#5b21b6)}
.legal-badge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid rgba(124,58,237,.28);background:rgba(255,255,255,0.88);color:#6d28d9;font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px}
.legal-hero h1{font-size:var(--mk-legal-h1);line-height:1.06;letter-spacing:var(--mk-legal-h1-track);color:#111827;margin:0 0 10px}
.legal-hero p{font-size:var(--mk-article-body);color:#4b5563;line-height:1.65;max-width:760px;margin:0 0 14px}
.legal-updated{display:inline-flex;align-items:center;padding:7px 12px;border-radius:10px;background:#ffffff;border:1px solid #e5e7eb;font-size:var(--mk-meta);font-weight:600;color:#374151}
.legal-content{max-width:900px;margin:0 auto;display:grid;gap:14px}
.legal-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px 20px;box-shadow:0 8px 24px rgba(17,24,39,.05)}
.legal-card h2{font-size:var(--mk-legal-h2);font-weight:900;line-height:1.2;color:#111827;margin:0 0 10px}
.legal-copy{display:grid;gap:10px;color:#4b5563}
.legal-copy p{margin:0;font-size:var(--mk-btn);line-height:1.72}
.legal-copy ul{margin:0;padding-left:18px;display:grid;gap:7px}
.legal-copy li{font-size:var(--mk-btn);line-height:1.66}
@media (max-width: 768px){
  .legal-shell{padding-top:96px}
  .legal-card{padding:18px 16px}
  .legal-copy p,.legal-copy li{font-size:var(--mk-body)}
}
`,
        }}
      />
    </>
  );
}
