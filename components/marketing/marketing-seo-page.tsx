import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import type { ReactNode } from 'react';

type SeoSection = {
  heading: string;
  content: string[];
};

type SeoFaq = {
  q: string;
  a: string;
};

type MarketingSeoPageProps = {
  badge: string;
  title: string;
  intro: string;
  sections: SeoSection[];
  faqs?: SeoFaq[];
  articleJsonLd?: Record<string, unknown>;
  customContent?: ReactNode;
};

export function MarketingSeoPage({
  badge,
  title,
  intro,
  sections,
  faqs = [],
  articleJsonLd,
  customContent,
}: MarketingSeoPageProps) {
  const faqJsonLd =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
        }
      : null;

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main className="seo-shell">
        <article className="seo-article">
          <div className="seo-badge">{badge}</div>
          <h1>{title}</h1>
          <p className="seo-intro">{intro}</p>

          {sections.map((section) => (
            <section className="seo-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          {faqs.length > 0 ? (
            <section className="seo-section" id="faq">
              <h2>FAQ</h2>
              <div className="seo-faq-grid">
                {faqs.map((faq) => (
                  <div className="seo-faq-card" key={faq.q}>
                    <h3>{faq.q}</h3>
                    <p>{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {customContent ? <section className="seo-section">{customContent}</section> : null}
        </article>
      </main>
      <MarketingFooter />
      {articleJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      ) : null}
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      ) : null}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.seo-shell{padding:110px 22px 70px;background:radial-gradient(ellipse 88% 58% at 50% 0%,#ede9fe 0%,#ffffff 64%)}
.seo-article{max-width:940px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px 24px;box-shadow:0 12px 34px rgba(17,24,39,.06)}
.seo-badge{display:inline-flex;padding:6px 12px;border-radius:999px;border:1px solid rgba(124,58,237,.26);background:#f5f3ff;color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px}
.seo-article h1{font-size:clamp(32px,4.8vw,50px);line-height:1.06;letter-spacing:-1.3px;color:#111827;margin:0 0 12px}
.seo-intro{font-size:17px;line-height:1.68;color:#4b5563;margin:0 0 22px}
.seo-section{padding-top:18px}
.seo-section h2{font-size:28px;line-height:1.15;letter-spacing:-.6px;color:#111827;margin:0 0 10px}
.seo-section p{font-size:16px;line-height:1.74;color:#4b5563;margin:0 0 10px}
.seo-faq-grid{display:grid;grid-template-columns:1fr;gap:10px}
.seo-faq-card{border:1px solid #ece7ff;background:#faf9ff;border-radius:14px;padding:14px}
.seo-faq-card h3{font-size:16px;font-weight:900;line-height:1.4;color:#111827;margin:0 0 6px;letter-spacing:-.2px}
.seo-faq-card p{font-size:15px;line-height:1.65;color:#4b5563;margin:0}
.seo-internal-links{font-size:15px;line-height:1.68;color:#4b5563}
.seo-internal-links p{margin:0}
.seo-internal-links a{color:#5b21b6;font-weight:600;text-decoration:underline;text-underline-offset:3px}
.seo-internal-links a:hover{color:#4c1d95}
@media (max-width: 860px){
  .seo-shell{padding-top:96px}
  .seo-article{padding:20px 16px}
  .seo-intro{font-size:15px}
  .seo-section h2{font-size:24px}
  .seo-section p,.seo-faq-card p{font-size:14px}
}
`,
        }}
      />
    </>
  );
}
