/**
 * Blog end-of-article CTAs: admin picks button label, supporting CTA line, and link.
 * Stored as JSON: [{ "buttonId", "ctaCopyId", "href" }, ...]
 */

export type BlogFooterCtaVariant = 'gradient' | 'solid' | 'soft';

// ─── Button presets ───────────────────────────────────────────────────────────

export const BLOG_FOOTER_BUTTON_IDS = [
  'start_free_trial',
  'try_live_demo',
  'see_how_it_works',
  'reduce_missed_calls',
  'keep_your_number',
  'compare_options',
  'for_nail_salons',
  'for_hair_salons',
  'for_spas',
  'for_med_spas',
  'for_beauty_clinics',
  'see_human_handoff',
] as const;

export type BlogFooterButtonId = (typeof BLOG_FOOTER_BUTTON_IDS)[number];

export type BlogFooterButtonDefinition = {
  id: BlogFooterButtonId;
  label: string;
  variant: BlogFooterCtaVariant;
  suggestedHref: string;
};

export const BLOG_FOOTER_BUTTONS: readonly BlogFooterButtonDefinition[] = [
  { id: 'start_free_trial', label: 'Start Free Trial', variant: 'solid', suggestedHref: '/user/signup' },
  { id: 'try_live_demo', label: 'Try a Live Demo', variant: 'gradient', suggestedHref: '/demo' },
  { id: 'see_how_it_works', label: 'See How It Works', variant: 'soft', suggestedHref: '/how-it-works' },
  { id: 'reduce_missed_calls', label: 'Reduce Missed Calls', variant: 'soft', suggestedHref: '/missed-call-recovery' },
  { id: 'keep_your_number', label: 'Keep Your Number', variant: 'soft', suggestedHref: '/pricing' },
  { id: 'compare_options', label: 'Compare Options', variant: 'soft', suggestedHref: '/compare' },
  { id: 'for_nail_salons', label: 'For Nail Salons', variant: 'soft', suggestedHref: '/nail-salon' },
  { id: 'for_hair_salons', label: 'For Hair Salons', variant: 'soft', suggestedHref: '/hair-salon' },
  { id: 'for_spas', label: 'For Spas', variant: 'soft', suggestedHref: '/spa' },
  { id: 'for_med_spas', label: 'For Med Spas', variant: 'soft', suggestedHref: '/med-spa' },
  { id: 'for_beauty_clinics', label: 'For Beauty Clinics', variant: 'soft', suggestedHref: '/beauty-clinic' },
  { id: 'see_human_handoff', label: 'See Human Handoff', variant: 'soft', suggestedHref: '/how-it-works' },
] as const;

// ─── CTA body copy presets ───────────────────────────────────────────────────

export const BLOG_FOOTER_CTA_COPY_IDS = [
  'stop_missed_bookings',
  'keep_number_improve',
  'nail_salons_context',
  'hair_salons_context',
  'spas_context',
  'med_spas_context',
  'beauty_clinics_context',
  'compare_options_context',
  'human_handoff_context',
] as const;

export type BlogFooterCtaCopyId = (typeof BLOG_FOOTER_CTA_COPY_IDS)[number];

export type BlogFooterCtaCopyDefinition = {
  id: BlogFooterCtaCopyId;
  /** Supporting sentence shown above the button */
  body: string;
};

export const BLOG_FOOTER_CTA_COPIES: readonly BlogFooterCtaCopyDefinition[] = [
  {
    id: 'stop_missed_bookings',
    body: 'Stop letting missed calls turn into lost bookings.',
  },
  {
    id: 'keep_number_improve',
    body: 'Keep your current number and improve how calls are handled.',
  },
  {
    id: 'nail_salons_context',
    body: 'Built for busy nail salons with walk-ins and same-day calls.',
  },
  {
    id: 'hair_salons_context',
    body: 'Built for hair salons with stylist-specific requests and longer appointments.',
  },
  {
    id: 'spas_context',
    body: 'Built for spas handling after-hours demand and booking friction.',
  },
  {
    id: 'med_spas_context',
    body: 'Built for med spas where consultation calls and trust matter.',
  },
  {
    id: 'beauty_clinics_context',
    body: 'Built for beauty clinics that need a lower-friction booking path.',
  },
  {
    id: 'compare_options_context',
    body: 'Compare your options before choosing a salon AI phone solution.',
  },
  {
    id: 'human_handoff_context',
    body: 'Want a clearer path when callers need a real person?',
  },
] as const;

const BUTTON_BY_ID = Object.fromEntries(BLOG_FOOTER_BUTTONS.map((b) => [b.id, b])) as Record<
  BlogFooterButtonId,
  BlogFooterButtonDefinition
>;

const CTA_COPY_BY_ID = Object.fromEntries(BLOG_FOOTER_CTA_COPIES.map((c) => [c.id, c])) as Record<
  BlogFooterCtaCopyId,
  BlogFooterCtaCopyDefinition
>;

export function isBlogFooterButtonId(value: string): value is BlogFooterButtonId {
  return (BLOG_FOOTER_BUTTON_IDS as readonly string[]).includes(value);
}

export function isBlogFooterCtaCopyId(value: string): value is BlogFooterCtaCopyId {
  return (BLOG_FOOTER_CTA_COPY_IDS as readonly string[]).includes(value);
}

export function getBlogFooterButton(id: BlogFooterButtonId): BlogFooterButtonDefinition {
  return BUTTON_BY_ID[id];
}

export function getBlogFooterCtaCopy(id: BlogFooterCtaCopyId): BlogFooterCtaCopyDefinition {
  return CTA_COPY_BY_ID[id];
}

export type BlogFooterCtaRow = {
  buttonId: BlogFooterButtonId;
  ctaCopyId: BlogFooterCtaCopyId;
  href: string;
};

/** Legacy rows from first CMS iteration (templateId only). */
const LEGACY_TEMPLATE_TO_ROW: Record<
  string,
  { buttonId: BlogFooterButtonId; ctaCopyId: BlogFooterCtaCopyId }
> = {
  start_free_trial: { buttonId: 'start_free_trial', ctaCopyId: 'stop_missed_bookings' },
  try_live_demo: { buttonId: 'try_live_demo', ctaCopyId: 'stop_missed_bookings' },
  see_how_it_works: { buttonId: 'see_how_it_works', ctaCopyId: 'keep_number_improve' },
  reduce_missed_calls: { buttonId: 'reduce_missed_calls', ctaCopyId: 'stop_missed_bookings' },
  see_after_hours_call_handling: { buttonId: 'reduce_missed_calls', ctaCopyId: 'stop_missed_bookings' },
  keep_your_current_number: { buttonId: 'keep_your_number', ctaCopyId: 'keep_number_improve' },
  works_with_your_current_setup: { buttonId: 'keep_your_number', ctaCopyId: 'keep_number_improve' },
  see_ringbooker_nail_salons: { buttonId: 'for_nail_salons', ctaCopyId: 'nail_salons_context' },
  see_ringbooker_hair_salons: { buttonId: 'for_hair_salons', ctaCopyId: 'hair_salons_context' },
  see_ringbooker_spas: { buttonId: 'for_spas', ctaCopyId: 'spas_context' },
  compare_your_options: { buttonId: 'compare_options', ctaCopyId: 'compare_options_context' },
  see_human_handoff: { buttonId: 'see_human_handoff', ctaCopyId: 'human_handoff_context' },
};

/** Safe parse from DB JSON (supports legacy { templateId, href }). */
export function parseStoredFooterCtas(raw: unknown): BlogFooterCtaRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BlogFooterCtaRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const hrefRaw = o.href;
    if (typeof hrefRaw !== 'string') continue;
    const href = hrefRaw.trim();
    if (!href || href.length > 2000) continue;
    if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) continue;

    let buttonId: BlogFooterButtonId | null = null;
    let ctaCopyId: BlogFooterCtaCopyId | null = null;

    if (typeof o.buttonId === 'string' && isBlogFooterButtonId(o.buttonId)) {
      buttonId = o.buttonId;
    }
    if (typeof o.ctaCopyId === 'string' && isBlogFooterCtaCopyId(o.ctaCopyId)) {
      ctaCopyId = o.ctaCopyId;
    }

    if (!buttonId && typeof o.templateId === 'string') {
      const mapped = LEGACY_TEMPLATE_TO_ROW[o.templateId];
      if (mapped) {
        buttonId = mapped.buttonId;
        ctaCopyId = mapped.ctaCopyId;
      }
    }

    if (!buttonId || !ctaCopyId) continue;
    out.push({ buttonId, ctaCopyId, href });
  }
  return out.slice(0, 6);
}
