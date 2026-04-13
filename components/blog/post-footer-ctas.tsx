import {
  type BlogFooterCtaRow,
  getBlogFooterArticlePreset,
  getBlogFooterButton,
} from '@/lib/blog/footer-cta-templates';

import { BlogPostMarketingCtaStrip, type PageCtaButtonProps } from '@/components/blog/blog-post-page-cta-strip';

type PostFooterCtasProps = {
  rows: BlogFooterCtaRow[];
};

function isDemoHref(href: string): boolean {
  return href === '/demo' || href.startsWith('/demo');
}

function demoPickerFor(buttonId: string, href: string): boolean {
  return buttonId === 'try_live_demo' && isDemoHref(href);
}

export function PostFooterCtas({ rows }: PostFooterCtasProps) {
  if (!rows.length) return null;

  return (
    <div className="not-prose w-full min-w-0 space-y-6" aria-label="Suggested next steps">
      {rows.map((row, index) => {
        const preset = getBlogFooterArticlePreset(row.kind);
        const primaryBtn = getBlogFooterButton(preset.primaryButtonId);
        const secondaryBtn = getBlogFooterButton(preset.secondaryButtonId);
        const key = `${row.kind}-${row.primaryHref}-${row.secondaryHref}-${index}`;

        const primary: PageCtaButtonProps = {
          href: row.primaryHref,
          label: primaryBtn.label,
          demoPicker: demoPickerFor(preset.primaryButtonId, row.primaryHref) || undefined,
        };
        const secondary: PageCtaButtonProps = {
          href: row.secondaryHref,
          label: secondaryBtn.label,
          demoPicker: demoPickerFor(preset.secondaryButtonId, row.secondaryHref) || undefined,
        };

        return (
          <section key={key}>
            <BlogPostMarketingCtaStrip body={preset.ctaBody} primary={primary} secondary={secondary} />
          </section>
        );
      })}
    </div>
  );
}
