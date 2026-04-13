import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Centers a max-w-6xl band in the viewport so the CTA matches the former bottom strip width
 * (not constrained to the article column when the layout is two-column).
 */
export function BlogPostCtaViewportBand(props: { children: ReactNode }) {
  return (
    <div className="not-prose mt-12 w-screen max-w-[100vw] -translate-x-1/2 relative left-1/2 px-6 md:px-12">
      <div className="mx-auto max-w-6xl">{props.children}</div>
    </div>
  );
}

/** Matches the full-width marketing CTA at the bottom of blog detail (before removal). */
const stripShellClass =
  'relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-brand-purple to-violet-400 px-6 py-14 text-center md:px-12';

const decoOrbClass =
  'pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/5';

const primaryBtnClass =
  'inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-extrabold text-violet-800 shadow-lg shadow-black/15 transition hover:scale-[1.04]';

const secondaryBtnClass =
  'inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/95 backdrop-blur-sm transition hover:bg-white/20';

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function withDemoEmoji(label: string, isDemo: boolean): string {
  if (!isDemo) return label;
  const t = label.trim();
  if (t.startsWith('📞')) return t;
  return `📞 ${t}`;
}

export type PageCtaButtonProps = {
  href: string;
  label: string;
  /** Set when this is the live demo entry point */
  demoPicker?: boolean;
};

/** Primary = white pill, secondary = glass outline (same as blog page footer CTA). */
export function PageCtaButtonPair(props: { primary: PageCtaButtonProps; secondary: PageCtaButtonProps }) {
  const p = props.primary;
  const s = props.secondary;
  const pExtra = p.demoPicker ? { 'data-demo-picker': true as const } : {};
  const sExtra = s.demoPicker ? { 'data-demo-picker': true as const } : {};

  const primaryLabel = withDemoEmoji(p.label, Boolean(p.demoPicker));
  const secondaryLabel = withDemoEmoji(s.label, Boolean(s.demoPicker));

  const renderPrimary = () => {
    if (isExternal(p.href)) {
      return (
        <a href={p.href} className={primaryBtnClass} rel="noopener noreferrer" target="_blank" {...pExtra}>
          {primaryLabel}
        </a>
      );
    }
    return (
      <Link href={p.href} className={primaryBtnClass} {...pExtra}>
        {primaryLabel}
      </Link>
    );
  };

  const renderSecondary = () => {
    if (isExternal(s.href)) {
      return (
        <a href={s.href} className={secondaryBtnClass} rel="noopener noreferrer" target="_blank" {...sExtra}>
          {secondaryLabel}
        </a>
      );
    }
    return (
      <Link href={s.href} className={secondaryBtnClass} {...sExtra}>
        {secondaryLabel}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {renderPrimary()}
      {renderSecondary()}
    </div>
  );
}

export type BlogPostMarketingCtaStripProps = {
  /** Main heading (optional — default page CTA uses this) */
  headline?: string;
  /** Supporting line or full CTA sentence from CMS */
  body: ReactNode;
  primary: PageCtaButtonProps;
  secondary: PageCtaButtonProps;
};

/**
 * Single gradient strip: same shell + typography scale as the site-wide blog detail CTA.
 */
export function BlogPostMarketingCtaStrip({ headline, body, primary, secondary }: BlogPostMarketingCtaStripProps) {
  return (
    <div className={stripShellClass}>
      <span className={decoOrbClass} aria-hidden />
      {headline ? (
        <h2 className="relative z-10 mb-2 text-[clamp(24px,3vw,36px)] font-sans font-extrabold tracking-tight text-white">
          {headline}
        </h2>
      ) : null}
      <div className="relative z-10 mx-auto mb-7 max-w-2xl font-sans text-[15px] leading-relaxed text-white/75 md:text-[16px]">
        {body}
      </div>
      <div className="relative z-10">
        <PageCtaButtonPair primary={primary} secondary={secondary} />
      </div>
    </div>
  );
}

/** Fixed fallback when the post has no CMS footer CTAs — same copy as the former bottom bar. */
export function BlogPostDefaultPageCta() {
  return (
    <section aria-label="Try RingBooker">
      <BlogPostCtaViewportBand>
        <BlogPostMarketingCtaStrip
          headline="Ready to stop missing bookings?"
          body={
            <>
              RingBooker answers every call 24/7 — books appointments, sends confirmations, and fills your calendar while you
              focus on your clients.
            </>
          }
          primary={{ href: '/demo', label: 'Try a Live Demo', demoPicker: true }}
          secondary={{ href: '/user/signup', label: 'Start 14-Day Free Trial →' }}
        />
      </BlogPostCtaViewportBand>
    </section>
  );
}
