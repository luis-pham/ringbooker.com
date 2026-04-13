import Link from 'next/link';

import {
  type BlogFooterCtaRow,
  getBlogFooterArticlePreset,
  getBlogFooterButton,
} from '@/lib/blog/footer-cta-templates';

type PostFooterCtasProps = {
  rows: BlogFooterCtaRow[];
};

const VARIANT_CLASS: Record<string, string> = {
  gradient:
    'inline-flex min-h-[44px] min-w-[min(100%,160px)] flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-violet-800 via-violet-600 to-violet-500 px-4 py-3 text-center text-[13px] font-extrabold leading-snug text-white shadow-[0_10px_32px_rgba(91,33,182,0.28)] transition hover:brightness-[1.06] hover:shadow-[0_12px_36px_rgba(91,33,182,0.35)] sm:flex-none sm:px-6 sm:text-sm',
  solid:
    'inline-flex min-h-[44px] min-w-[min(100%,160px)] flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-center text-[13px] font-extrabold leading-snug text-white shadow-md transition hover:bg-slate-800 hover:shadow-lg sm:flex-none sm:px-6 sm:text-sm',
  soft:
    'inline-flex min-h-[44px] min-w-[min(100%,160px)] flex-1 items-center justify-center gap-2 rounded-full border-2 border-violet-200/90 bg-white px-4 py-3 text-center text-[12.5px] font-semibold leading-snug text-violet-950 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80 sm:flex-none sm:px-5 sm:text-[13px]',
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function CtaButtonLink(props: {
  href: string;
  label: string;
  variant: string;
  demoPicker?: boolean;
}) {
  const className = VARIANT_CLASS[props.variant] ?? VARIANT_CLASS.soft;
  const demo = props.demoPicker ? { 'data-demo-picker': true as const } : {};

  if (isExternal(props.href)) {
    return (
      <a href={props.href} className={className} rel="noopener noreferrer" target="_blank" {...demo}>
        {props.label}
      </a>
    );
  }
  return (
    <Link href={props.href} className={className} {...demo}>
      {props.label}
    </Link>
  );
}

export function PostFooterCtas({ rows }: PostFooterCtasProps) {
  if (!rows.length) return null;

  return (
    <section
      className="not-prose mt-12 rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/90 via-white to-white px-5 py-8 shadow-[0_20px_50px_rgba(91,33,182,0.06)] sm:px-8"
      aria-label="Suggested next steps"
    >
      <p className="mb-6 text-center font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600/90">Next steps</p>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {rows.map((row, index) => {
          const preset = getBlogFooterArticlePreset(row.kind);
          const primaryBtn = getBlogFooterButton(preset.primaryButtonId);
          const secondaryBtn = getBlogFooterButton(preset.secondaryButtonId);
          const key = `${row.kind}-${row.primaryHref}-${row.secondaryHref}-${index}`;

          const secondaryDemo =
            preset.secondaryButtonId === 'try_live_demo' &&
            (row.secondaryHref === '/demo' || row.secondaryHref.startsWith('/demo'));

          return (
            <div
              key={key}
              className="flex flex-col items-center gap-4 rounded-xl border border-violet-100/80 bg-white/90 px-5 py-6 text-center shadow-sm sm:px-8"
            >
              <p className="max-w-xl font-sans text-[15px] leading-relaxed text-slate-600">{preset.ctaBody}</p>
              <div className="flex w-full max-w-lg flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <CtaButtonLink
                  href={row.primaryHref}
                  label={primaryBtn.label}
                  variant={primaryBtn.variant}
                />
                <CtaButtonLink
                  href={row.secondaryHref}
                  label={secondaryBtn.label}
                  variant={secondaryBtn.variant}
                  demoPicker={secondaryDemo}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
