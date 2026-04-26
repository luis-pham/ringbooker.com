import type { ReactNode } from 'react';

export type MarketingFaqItem = { q: string; a: string };

export type MarketingFaqAccordionProps = {
  items: MarketingFaqItem[];
  /**
   * Pill label above the title (hub-style). Default `Common Questions`.
   * Pass `null` to hide.
   */
  eyebrow?: string | null;
  /** Main heading; default single line: "Frequently Asked Questions" (hub-aligned). */
  title?: ReactNode;
  /** Subtitle under heading; set `null` to hide */
  subtitle?: string | null;
  id?: string;
  className?: string;
  /**
   * Tighter vertical padding when FAQ sits inside another padded shell (article, hiw-section)
   * so spacing matches the home standalone FAQ block without double padding.
   */
  embedded?: boolean;
  /** Open the first FAQ item on initial render. */
  openFirstItem?: boolean;
};

const defaultTitle: ReactNode = 'Frequently Asked Questions';

/**
 * FAQ accordion aligned with topic hubs (`HtmlHubFaq` / `faq-list`): one bordered list,
 * row dividers, purple "+" that rotates when open.
 */
export function MarketingFaqAccordion({
  items,
  eyebrow,
  title = defaultTitle,
  subtitle = 'Everything you need to know before getting started.',
  id = 'faq',
  className = '',
  embedded = false,
  openFirstItem = false,
}: MarketingFaqAccordionProps) {
  if (items.length === 0) return null;

  const showEyebrow = eyebrow !== null && eyebrow !== '';
  const eyebrowText = eyebrow === undefined || eyebrow === '' ? 'Common Questions' : eyebrow;

  return (
    <>
      <section className={`mfaq-section${embedded ? ' mfaq-section--embedded' : ''} ${className}`.trim()} id={id}>
        {showEyebrow ? <div className="mfaq-eyebrow">{eyebrowText}</div> : null}
        <h2 className="mfaq-title">{title}</h2>
        {subtitle != null && subtitle !== '' ? <p className="mfaq-sub">{subtitle}</p> : null}
        <div className="mfaq-list">
          {items.map((faq, i) => (
            <details className="mfaq-item" key={faq.q} open={openFirstItem && i === 0}>
              <summary className="mfaq-q">
                {faq.q}
                <span className="mfaq-icon" aria-hidden>
                  +
                </span>
              </summary>
              <div className="mfaq-a">
                <p>{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.mfaq-section{
  --mfaq-border:var(--mk-border-soft,#E8ECF1);
  --mfaq-bg-hover:#F9FAFB;
  --mfaq-text:#111827;
  --mfaq-muted:var(--mk-text-desc,#64748B);
  --mfaq-purple:#7C3AED;
  padding:72px 24px 72px;
  max-width:760px;
  margin:0 auto;
  text-align:center;
  box-sizing:border-box;
}
.mfaq-section *{box-sizing:border-box}
.mfaq-eyebrow{
  display:inline-flex;
  align-items:center;
  padding:5px 12px;
  border-radius:9999px;
  font-size:var(--mk-eyebrow);
  font-weight:600;
  letter-spacing:var(--mk-eyebrow-ls);
  text-transform:uppercase;
  color:#5B21B6;
  background:#F5F3FF;
  border:1px solid rgba(196,181,253,.45);
  margin:0 auto 14px;
  text-align:center;
}
.mfaq-title{
  font-size:var(--mk-section-h2);
  font-weight:700;
  letter-spacing:var(--mk-section-h2-track);
  margin:0 0 14px;
  text-align:center;
  color:var(--mfaq-text);
  line-height:var(--mk-section-h2-lh);
}
.mfaq-sub{
  font-size:var(--mk-section-lead);
  color:var(--mk-text-desc,#64748B);
  margin:0 auto 36px;
  line-height:var(--mk-section-lead-lh);
  max-width:min(560px,100%);
  text-align:center;
  font-weight:400;
}
.mfaq-list{
  display:flex;
  flex-direction:column;
  border:1px solid var(--mfaq-border);
  border-radius:20px;
  overflow:hidden;
  text-align:left;
  box-shadow:var(--mk-shadow-soft,0 1px 3px rgba(0,0,0,.04));
}
/* Keep a comfortable gap when subtitle is intentionally hidden. */
.mfaq-title + .mfaq-list{margin-top:28px}
.mfaq-item{
  border-bottom:1px solid var(--mfaq-border);
  background:#fff;
}
.mfaq-item:last-child{border-bottom:none}
.mfaq-q{
  width:100%;
  background:none;
  border:none;
  padding:20px 24px;
  font-size:var(--mk-btn);
  font-weight:600;
  color:var(--mfaq-text);
  text-align:left;
  cursor:pointer;
  display:flex;
  justify-content:space-between;
  align-items:center;
  font-family:inherit;
  gap:12px;
  list-style:none;
  transition:background .2s;
}
.mfaq-q:focus-visible{
  outline:2px solid var(--mfaq-purple);
  outline-offset:-2px;
}
.mfaq-q::-webkit-details-marker{display:none}
.mfaq-q:hover{background:var(--mfaq-bg-hover)}
.mfaq-icon{
  font-size:20px;
  font-weight:600;
  line-height:1;
  color:var(--mfaq-purple);
  transition:transform .25s;
  flex-shrink:0;
}
.mfaq-item[open] .mfaq-icon{transform:rotate(45deg)}
.mfaq-a{
  max-height:0;
  overflow:hidden;
  transition:max-height .35s ease;
}
.mfaq-a p{
  margin:0;
  padding:0 24px 20px;
  font-size:var(--mk-body);
  color:var(--mfaq-muted);
  line-height:var(--mk-body-lh);
  text-align:left;
}
.mfaq-item[open] .mfaq-a{max-height:2000px}
.mfaq-section--embedded{padding-top:28px;padding-bottom:36px;padding-left:0;padding-right:0}
.mfaq-section--embedded .mfaq-sub{margin-bottom:28px}
@media(max-width:960px){
  .mfaq-section:not(.mfaq-section--embedded){
    padding-left:22px;
    padding-right:22px;
    padding-top:56px;
    padding-bottom:64px;
  }
  .mfaq-section--embedded{padding-left:0;padding-right:0}
}
`,
        }}
      />
    </>
  );
}
