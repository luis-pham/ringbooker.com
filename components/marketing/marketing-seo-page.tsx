import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
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
            <MarketingFaqAccordion items={faqs} embedded eyebrow={null} title="FAQ" subtitle={null} />
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
.seo-badge{display:inline-flex;padding:6px 12px;border-radius:999px;border:1px solid rgba(124,58,237,.26);background:#f5f3ff;color:#6d28d9;font-size:var(--mk-eyebrow);font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px}
.seo-article h1{font-size:var(--mk-article-h1);line-height:var(--mk-article-h1-lh);letter-spacing:var(--mk-article-h1-track);color:#111827;margin:0 0 12px}
.seo-intro{font-size:var(--mk-article-intro);line-height:var(--mk-article-intro-lh);color:#4b5563;margin:0 0 22px}
.seo-section{padding-top:18px}
.seo-section h2{font-size:var(--mk-article-h2);line-height:var(--mk-article-h2-lh);letter-spacing:var(--mk-article-h2-track);color:#111827;margin:0 0 10px}
.seo-section p{font-size:var(--mk-article-body);line-height:var(--mk-article-body-lh);color:#4b5563;margin:0 0 10px}
.seo-internal-links{font-size:var(--mk-btn);line-height:1.68;color:#4b5563}
.seo-internal-links p{margin:0}
.seo-internal-links a{color:#5b21b6;font-weight:600;text-decoration:underline;text-underline-offset:3px}
.seo-internal-links a:hover{color:#4c1d95}
@media (max-width: 860px){
  .seo-shell{padding-top:96px}
  .seo-article{padding:20px 16px}
  .seo-intro{font-size:var(--mk-section-lead)}
  .seo-section h2{font-size:24px}
  .seo-section p{font-size:var(--mk-body)}
}
`,
        }}
      />
    </>
  );
}
