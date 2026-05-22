import Link from 'next/link';
import type { ReactNode } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';

/** Same scale as the former “Ready to stop missing bookings?” line on blog detail. */
const ctaHeadlineClass =
  'relative z-10 mx-auto max-w-3xl px-1 font-sans text-[clamp(24px,3vw,36px)] font-semibold leading-[1.2] tracking-tight text-white';

const ctaSubLineClass =
  'relative z-10 mx-auto mb-7 max-w-2xl font-sans text-[15px] leading-relaxed text-white/75 md:text-[16px]';

/** Matches the full-width marketing CTA at the bottom of blog detail (before removal). */
const stripShellClass =
  'relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-brand-purple to-violet-400 px-6 py-14 text-center md:px-12';

const decoOrbClass =
  'pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/5';

/** Align with marketing-home `.btn-white` (padding, type scale, shadow, hover). */
const primaryBtnClass =
  'group inline-flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-[14.5px] font-semibold text-[color:var(--mk-brand-purple-dark,#7C3AED)] shadow-[0_4px_16px_rgba(17,24,39,.08)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(17,24,39,.1)] sm:w-auto';

/** Align with marketing-home `.btn-ghost-w`. */
const secondaryBtnClass =
  'inline-flex w-full min-w-0 items-center justify-center rounded-full border border-white/[0.32] bg-white/[0.12] px-6 py-3 text-[14px] font-semibold text-white transition-[background-color,border-color] hover:bg-white/20 hover:border-white/[0.45] sm:w-auto';

const ctaWhiteArrowClass =
  'h-4 w-4 shrink-0 text-[color:var(--mk-brand-purple-dark,#7C3AED)] transition-transform duration-200 ease-out group-hover:translate-x-[3px]';

function CtaWhiteArrow() {
  return (
    <svg className={ctaWhiteArrowClass} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  );
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function stripLeadingPhoneEmoji(label: string): string {
  return label.replace(/^📞\s*/, '').trim();
}

export type PageCtaButtonProps = {
  href: string;
  label: string;
  /** Set when this is the live demo entry point */
  demoPicker?: boolean;
};

/** Primary = white pill, secondary = glass outline — matches marketing-home CTA banner buttons. */
export function PageCtaButtonPair(props: { primary: PageCtaButtonProps; secondary: PageCtaButtonProps }) {
  const p = props.primary;
  const s = props.secondary;
  const pExtra = p.demoPicker ? { 'data-demo-picker': true as const } : {};
  const sExtra = s.demoPicker ? { 'data-demo-picker': true as const } : {};

  const primaryContent =
    p.demoPicker === true ? (
      <>
        <DemoCtaPhoneIcon width={16} height={16} />
        {stripLeadingPhoneEmoji(p.label)}
        <CtaWhiteArrow />
      </>
    ) : (
      <>
        <CtaWhiteArrow />
        {p.label}
      </>
    );

  const renderPrimary = () => {
    if (isExternal(p.href)) {
      return (
        <a href={p.href} className={primaryBtnClass} rel="noopener noreferrer" target="_blank" {...pExtra}>
          {primaryContent}
        </a>
      );
    }
    return (
      <Link href={p.href} className={primaryBtnClass} {...pExtra}>
        {primaryContent}
      </Link>
    );
  };

  const renderSecondary = () => {
    if (isExternal(s.href)) {
      return (
        <a href={s.href} className={secondaryBtnClass} rel="noopener noreferrer" target="_blank" {...sExtra}>
          {s.label}
        </a>
      );
    }
    return (
      <Link href={s.href} className={secondaryBtnClass} {...sExtra}>
        {s.label}
      </Link>
    );
  };

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-[10px] sm:w-fit sm:min-w-[210px]">
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
        <>
          <h2 className={`${ctaHeadlineClass} mb-2`}>{headline}</h2>
          <div className={ctaSubLineClass}>{body}</div>
        </>
      ) : (
        <div className={`${ctaHeadlineClass} mb-7`}>{body}</div>
      )}
      <div className="relative z-10">
        <PageCtaButtonPair primary={primary} secondary={secondary} />
      </div>
    </div>
  );
}

/** Fixed fallback when the post has no CMS footer CTAs — same copy as the former bottom bar. */
export function BlogPostDefaultPageCta() {
  return (
    <section className="not-prose w-full min-w-0" aria-label="Try RingBooker">
      <BlogPostMarketingCtaStrip
        headline="Ready to stop missing bookings?"
        body={
          <>
            RingBooker answers every call 24/7 — books appointments, sends confirmations, and fills your calendar while you
            focus on your clients.
          </>
        }
        primary={{ href: '/demo', label: 'Try a Live Demo', demoPicker: true }}
        secondary={{ href: '/pricing', label: 'Start 14-Day Free Trial →' }}
      />
    </section>
  );
}
