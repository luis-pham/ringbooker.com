import { Fragment, type ReactNode } from 'react';

import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

export type SeoSubsection = {
  title: string;
  paragraphs: ReactNode[];
};

export type SeoCompareRow = { left: ReactNode; right: ReactNode };

export type SeoSection = {
  heading: string;
  paragraphs?: ReactNode[];
  /** Rendered after optional lists (e.g. closing paragraph after a numbered list). */
  trailParagraphs?: ReactNode[];
  subsections?: SeoSubsection[];
  bulletList?: ReactNode[];
  orderedList?: ReactNode[];
  compareTable?: { leftHead: string; rightHead: string; rows: SeoCompareRow[] };
};

type SeoFaq = {
  q: string;
  a: string;
};

type MarketingSeoPageProps = {
  breadcrumb?: ReactNode;
  badge?: string | null;
  shellVariant?: 'card' | 'plain';
  title: string;
  intro: string;
  sections: SeoSection[];
  faqs?: SeoFaq[];
  articleJsonLd?: Record<string, unknown>;
  customContent?: ReactNode;
};

function renderParagraphs(nodes: ReactNode[] | undefined) {
  if (!nodes?.length) return null;
  return nodes.map((node, i) => (
    <p key={i} className="seo-p">
      {node}
    </p>
  ));
}

export function MarketingSeoPage({
  breadcrumb,
  badge,
  shellVariant = 'card',
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
        <article className={`seo-article${shellVariant === 'plain' ? ' seo-article--plain' : ''}`}>
          {breadcrumb ? <div className="seo-breadcrumb">{breadcrumb}</div> : null}
          {badge ? <div className="seo-badge">{badge}</div> : null}
          <h1>{title}</h1>
          <p className="seo-intro">{intro}</p>

          {sections.map((section) => (
            <section className="seo-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {renderParagraphs(section.paragraphs)}
              {section.compareTable ? (
                <div className="seo-table-wrap">
                  <table className="seo-table">
                    <thead>
                      <tr>
                        <th>{section.compareTable.leftHead}</th>
                        <th>{section.compareTable.rightHead}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.compareTable.rows.map((row, i) => (
                        <tr key={i}>
                          <td>{row.left}</td>
                          <td>{row.right}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {section.subsections?.map((sub) => (
                <Fragment key={sub.title}>
                  <h3 className="seo-h3">{sub.title}</h3>
                  {renderParagraphs(sub.paragraphs)}
                </Fragment>
              ))}
              {section.bulletList?.length ? (
                <ul className="seo-ul">
                  {section.bulletList.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.orderedList?.length ? (
                <ol className="seo-ol">
                  {section.orderedList.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              ) : null}
              {renderParagraphs(section.trailParagraphs)}
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
.seo-article{max-width:var(--mk-reading-width,940px);margin:0 auto;background:#fff;border:1px solid var(--mk-border-soft,#e8ecf1);border-radius:var(--mk-radius-card,22px);padding:32px 28px;box-shadow:var(--mk-shadow-soft)}
.seo-article--plain{background:transparent;border:none;border-radius:0;box-shadow:none;padding:0}
.seo-breadcrumb{margin:0 0 10px;font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8)}
.seo-breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}
.seo-breadcrumb a:hover{color:var(--mk-brand-purple-deep,#5b21b6)}
.seo-badge{display:inline-flex;padding:6px 12px;border-radius:var(--mk-radius-pill,999px);border:1px solid var(--mk-border-brand,rgba(124,58,237,.26));background:rgba(255,255,255,0.88);color:var(--mk-brand-purple-deep,#6d28d9);font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px}
.seo-article h1{font-size:var(--mk-article-h1);line-height:var(--mk-article-h1-lh);letter-spacing:var(--mk-article-h1-track);color:var(--mk-text-strong,#111827);margin:0 0 12px}
.seo-intro{font-size:var(--mk-article-intro);line-height:var(--mk-article-intro-lh);color:var(--mk-text-body,#334155);margin:0 0 22px}
.seo-section{padding-top:18px}
.seo-section h2{font-size:var(--mk-article-h2);line-height:var(--mk-article-h2-lh);letter-spacing:var(--mk-article-h2-track);color:var(--mk-text-strong,#111827);margin:0 0 14px}
.seo-h3{font-size:clamp(17px,2.1vw,20px);line-height:1.35;font-weight:700;color:var(--mk-text-body,#334155);margin:16px 0 8px}
.seo-p,.seo-section li{font-size:var(--mk-article-body);line-height:var(--mk-article-body-lh);color:var(--mk-text-body,#334155)}
.seo-p a,.seo-section li a,.seo-table td a{color:var(--mk-brand-purple-deep,#5b21b6);font-weight:inherit;text-decoration:none}
.seo-p a:hover,.seo-section li a:hover,.seo-table td a:hover{color:#4c1d95;text-decoration:none}
.seo-p{margin:0 0 10px}
.seo-ul,.seo-ol{margin:0 0 14px;padding-left:1.35rem}
.seo-ul li,.seo-ol li{margin-bottom:8px}
.seo-table-wrap{margin:12px 0 18px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.seo-table{width:100%;border-collapse:collapse;font-size:var(--mk-article-body);line-height:1.5}
.seo-table th,.seo-table td{border:1px solid var(--mk-border-soft,#e8ecf1);padding:10px 12px;text-align:left;vertical-align:top;color:var(--mk-text-body,#334155)}
.seo-table th{background:var(--mk-bg-soft,#f8fafc);font-weight:700;color:var(--mk-text-strong,#111827)}
.seo-internal-links{font-size:var(--mk-btn);line-height:1.68;color:var(--mk-text-body,#334155)}
.seo-internal-links p{margin:0}
.seo-internal-links a{color:var(--mk-brand-purple-deep,#5b21b6);font-weight:inherit;text-decoration:none}
.seo-internal-links a:hover{color:#4c1d95;text-decoration:none}
@media (max-width: 860px){
  .seo-shell{padding-top:96px}
  .seo-article{padding:22px 18px}
  .seo-intro{font-size:var(--mk-section-lead)}
  .seo-section h2{font-size:24px}
  .seo-p,.seo-section li,.seo-table{font-size:var(--mk-body)}
}
`,
        }}
      />
    </>
  );
}
