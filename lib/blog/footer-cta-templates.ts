/** Fixed marketing-style CTA buttons for blog posts (admin picks template + URL). */

export const BLOG_FOOTER_CTA_IDS = [
  'start_free_trial',
  'try_live_demo',
  'see_how_it_works',
  'reduce_missed_calls',
  'see_after_hours_call_handling',
  'keep_your_current_number',
  'works_with_your_current_setup',
  'see_ringbooker_nail_salons',
  'see_ringbooker_hair_salons',
  'see_ringbooker_spas',
  'compare_your_options',
  'see_human_handoff',
] as const;

export type BlogFooterCtaTemplateId = (typeof BLOG_FOOTER_CTA_IDS)[number];

export type BlogFooterCtaVariant = 'gradient' | 'solid' | 'soft';

export type BlogFooterCtaDefinition = {
  id: BlogFooterCtaTemplateId;
  label: string;
  variant: BlogFooterCtaVariant;
  /** Shown as placeholder / filled when picking template in admin */
  suggestedHref: string;
};

export const BLOG_FOOTER_CTA_TEMPLATES: readonly BlogFooterCtaDefinition[] = [
  { id: 'start_free_trial', label: 'Start Free Trial', variant: 'solid', suggestedHref: '/user/signup' },
  { id: 'try_live_demo', label: 'Try a Live Demo', variant: 'gradient', suggestedHref: '/demo' },
  { id: 'see_how_it_works', label: 'See How It Works', variant: 'soft', suggestedHref: '/how-it-works' },
  { id: 'reduce_missed_calls', label: 'Reduce Missed Calls', variant: 'soft', suggestedHref: '/missed-call-recovery' },
  {
    id: 'see_after_hours_call_handling',
    label: 'See After-Hours Call Handling',
    variant: 'soft',
    suggestedHref: '/after-hours-calls',
  },
  { id: 'keep_your_current_number', label: 'Keep Your Current Number', variant: 'soft', suggestedHref: '/pricing' },
  {
    id: 'works_with_your_current_setup',
    label: 'Works With Your Current Setup',
    variant: 'soft',
    suggestedHref: '/how-it-works',
  },
  { id: 'see_ringbooker_nail_salons', label: 'See RingBooker for Nail Salons', variant: 'soft', suggestedHref: '/nail-salon' },
  { id: 'see_ringbooker_hair_salons', label: 'See RingBooker for Hair Salons', variant: 'soft', suggestedHref: '/hair-salon' },
  { id: 'see_ringbooker_spas', label: 'See RingBooker for Spas', variant: 'soft', suggestedHref: '/spa' },
  { id: 'compare_your_options', label: 'Compare Your Options', variant: 'soft', suggestedHref: '/pricing' },
  { id: 'see_human_handoff', label: 'See How Human Handoff Works', variant: 'soft', suggestedHref: '/how-it-works' },
] as const;

const TEMPLATE_BY_ID = Object.fromEntries(BLOG_FOOTER_CTA_TEMPLATES.map((t) => [t.id, t])) as Record<
  BlogFooterCtaTemplateId,
  BlogFooterCtaDefinition
>;

export function isBlogFooterCtaTemplateId(value: string): value is BlogFooterCtaTemplateId {
  return (BLOG_FOOTER_CTA_IDS as readonly string[]).includes(value);
}

export function getBlogFooterCtaTemplate(id: BlogFooterCtaTemplateId): BlogFooterCtaDefinition {
  return TEMPLATE_BY_ID[id];
}

export type BlogFooterCtaRow = { templateId: BlogFooterCtaTemplateId; href: string };

/** Safe parse from DB JSON (legacy / partial rows ignored). */
export function parseStoredFooterCtas(raw: unknown): BlogFooterCtaRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BlogFooterCtaRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const templateId = (row as { templateId?: unknown }).templateId;
    const hrefRaw = (row as { href?: unknown }).href;
    if (typeof templateId !== 'string' || !isBlogFooterCtaTemplateId(templateId)) continue;
    if (typeof hrefRaw !== 'string') continue;
    const href = hrefRaw.trim();
    if (!href || href.length > 2000) continue;
    if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) continue;
    out.push({ templateId, href });
  }
  return out.slice(0, 6);
}
