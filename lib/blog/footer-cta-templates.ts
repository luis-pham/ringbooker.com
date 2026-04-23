/**
 * Blog end-of-article CTAs: admin picks an article type ("kind"); copy + primary/secondary
 * buttons are fixed per kind. Stored JSON: [{ "kind", "primaryHref", "secondaryHref" }, ...]
 */

export type BlogFooterCtaVariant = 'gradient' | 'solid' | 'soft';

// ─── Button presets (labels + default URLs + visual variant) ───────────────

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
  {
    id: 'reduce_missed_calls',
    label: 'Reduce Missed Calls',
    variant: 'soft',
    suggestedHref: '/missed-booking-protection/missed-call-recovery',
  },
  { id: 'keep_your_number', label: 'Keep Your Number', variant: 'soft', suggestedHref: '/pricing' },
  { id: 'compare_options', label: 'Compare Options', variant: 'soft', suggestedHref: '/compare' },
  { id: 'for_nail_salons', label: 'For Nail Salons', variant: 'soft', suggestedHref: '/industries/nail-salon' },
  { id: 'for_hair_salons', label: 'For Hair Salons', variant: 'soft', suggestedHref: '/industries/hair-salon' },
  { id: 'for_spas', label: 'For Spas', variant: 'soft', suggestedHref: '/industries/spa' },
  { id: 'for_med_spas', label: 'For Med Spas', variant: 'soft', suggestedHref: '/industries/med-spa' },
  { id: 'for_beauty_clinics', label: 'For Beauty Clinics', variant: 'soft', suggestedHref: '/industries/beauty-clinic' },
  { id: 'see_human_handoff', label: 'See Human Handoff', variant: 'soft', suggestedHref: '/how-it-works' },
] as const;

// ─── Article-type matrix (CTA + primary + secondary) ───────────────────────

export const BLOG_FOOTER_ARTICLE_KIND_IDS = [
  'pain_point',
  'current_number',
  'nail',
  'hair',
  'spa',
  'med_spa',
  'beauty_clinic',
  'comparison',
  'trust_faq',
] as const;

export type BlogFooterArticleKind = (typeof BLOG_FOOTER_ARTICLE_KIND_IDS)[number];

export type BlogFooterArticlePreset = {
  id: BlogFooterArticleKind;
  /** Admin dropdown label */
  label: string;
  ctaBody: string;
  primaryButtonId: BlogFooterButtonId;
  secondaryButtonId: BlogFooterButtonId;
};

export const BLOG_FOOTER_ARTICLE_PRESETS: readonly BlogFooterArticlePreset[] = [
  {
    id: 'pain_point',
    label: 'Pain-point',
    ctaBody: 'Stop letting missed calls turn into lost bookings.',
    primaryButtonId: 'reduce_missed_calls',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'current_number',
    label: 'Current number',
    ctaBody: 'Keep your current number and improve how calls are handled.',
    primaryButtonId: 'keep_your_number',
    secondaryButtonId: 'see_how_it_works',
  },
  {
    id: 'nail',
    label: 'Nail',
    ctaBody: 'Built for busy nail salons with walk-ins and same-day calls.',
    primaryButtonId: 'for_nail_salons',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'hair',
    label: 'Hair',
    ctaBody: 'Built for hair salons with stylist-specific requests and longer appointments.',
    primaryButtonId: 'for_hair_salons',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'spa',
    label: 'Spa',
    ctaBody: 'Built for spas handling after-hours demand and guest booking friction.',
    primaryButtonId: 'for_spas',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'med_spa',
    label: 'Med spa',
    ctaBody: 'Built for med spas where consultation calls and trust matter.',
    primaryButtonId: 'for_med_spas',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'beauty_clinic',
    label: 'Beauty clinic',
    ctaBody: 'Built for beauty clinics that need a lower-friction booking path.',
    primaryButtonId: 'for_beauty_clinics',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'comparison',
    label: 'Comparison',
    ctaBody: 'Compare your options before choosing a salon phone solution.',
    primaryButtonId: 'compare_options',
    secondaryButtonId: 'try_live_demo',
  },
  {
    id: 'trust_faq',
    label: 'Trust / FAQ',
    ctaBody: 'Honest call handling builds more trust than fake-human scripts.',
    primaryButtonId: 'see_human_handoff',
    secondaryButtonId: 'try_live_demo',
  },
] as const;

const BUTTON_BY_ID = Object.fromEntries(BLOG_FOOTER_BUTTONS.map((b) => [b.id, b])) as Record<
  BlogFooterButtonId,
  BlogFooterButtonDefinition
>;

const PRESET_BY_KIND = Object.fromEntries(BLOG_FOOTER_ARTICLE_PRESETS.map((p) => [p.id, p])) as Record<
  BlogFooterArticleKind,
  BlogFooterArticlePreset
>;

export function isBlogFooterButtonId(value: string): value is BlogFooterButtonId {
  return (BLOG_FOOTER_BUTTON_IDS as readonly string[]).includes(value);
}

export function isBlogFooterArticleKind(value: string): value is BlogFooterArticleKind {
  return (BLOG_FOOTER_ARTICLE_KIND_IDS as readonly string[]).includes(value);
}

export function getBlogFooterButton(id: BlogFooterButtonId): BlogFooterButtonDefinition {
  return BUTTON_BY_ID[id];
}

export function getBlogFooterArticlePreset(kind: BlogFooterArticleKind): BlogFooterArticlePreset {
  return PRESET_BY_KIND[kind];
}

export type BlogFooterCtaRow = {
  kind: BlogFooterArticleKind;
  primaryHref: string;
  secondaryHref: string;
};

function parseHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const href = raw.trim();
  if (!href || href.length > 2000) return null;
  if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) return null;
  return href;
}

/** Legacy v1: single templateId + href */
const LEGACY_TEMPLATE_TO_PAIR: Record<string, { buttonId: BlogFooterButtonId; ctaCopyId: string }> = {
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

/** Map legacy ctaCopyId + which button was used → article kind (for v2 single-button rows). */
function inferKindFromLegacyPair(
  ctaCopyId: string,
  buttonId: BlogFooterButtonId,
): BlogFooterArticleKind | null {
  const p = (cta: string, btn: BlogFooterButtonId, kind: BlogFooterArticleKind) =>
    ctaCopyId === cta && buttonId === btn ? kind : null;

  return (
    p('stop_missed_bookings', 'reduce_missed_calls', 'pain_point') ??
    p('stop_missed_bookings', 'try_live_demo', 'pain_point') ??
    p('keep_number_improve', 'keep_your_number', 'current_number') ??
    p('keep_number_improve', 'see_how_it_works', 'current_number') ??
    p('nail_salons_context', 'for_nail_salons', 'nail') ??
    p('hair_salons_context', 'for_hair_salons', 'hair') ??
    p('spas_context', 'for_spas', 'spa') ??
    p('med_spas_context', 'for_med_spas', 'med_spa') ??
    p('beauty_clinics_context', 'for_beauty_clinics', 'beauty_clinic') ??
    p('compare_options_context', 'compare_options', 'comparison') ??
    p('human_handoff_context', 'see_human_handoff', 'trust_faq') ??
    null
  );
}

function defaultHrefsForKind(kind: BlogFooterArticleKind): { primaryHref: string; secondaryHref: string } {
  const preset = getBlogFooterArticlePreset(kind);
  return {
    primaryHref: getBlogFooterButton(preset.primaryButtonId).suggestedHref,
    secondaryHref: getBlogFooterButton(preset.secondaryButtonId).suggestedHref,
  };
}

/**
 * One legacy row (single button + href) → matrix row with two links.
 */
function migrateLegacyTripleToRow(
  buttonId: BlogFooterButtonId,
  ctaCopyId: string,
  href: string,
): BlogFooterCtaRow | null {
  const kind = inferKindFromLegacyPair(ctaCopyId, buttonId);
  if (!kind) return null;
  const defaults = defaultHrefsForKind(kind);
  const preset = getBlogFooterArticlePreset(kind);

  if (buttonId === preset.primaryButtonId) {
    return { kind, primaryHref: href, secondaryHref: defaults.secondaryHref };
  }
  if (buttonId === preset.secondaryButtonId) {
    return { kind, primaryHref: defaults.primaryHref, secondaryHref: href };
  }
  return { kind, primaryHref: href, secondaryHref: defaults.secondaryHref };
}

/** Safe parse from DB JSON (current shape + legacy v2 + legacy v1). */
export function parseStoredFooterCtas(raw: unknown): BlogFooterCtaRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BlogFooterCtaRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;

    const primaryHref = parseHref(o.primaryHref);
    const secondaryHref = parseHref(o.secondaryHref);
    if (typeof o.kind === 'string' && isBlogFooterArticleKind(o.kind) && primaryHref && secondaryHref) {
      out.push({ kind: o.kind, primaryHref, secondaryHref });
      continue;
    }

    const hrefSingle = parseHref(o.href);
    if (!hrefSingle) continue;

    if (typeof o.buttonId === 'string' && isBlogFooterButtonId(o.buttonId) && typeof o.ctaCopyId === 'string') {
      const migrated = migrateLegacyTripleToRow(o.buttonId, o.ctaCopyId, hrefSingle);
      if (migrated) out.push(migrated);
      continue;
    }

    if (typeof o.templateId === 'string') {
      const pair = LEGACY_TEMPLATE_TO_PAIR[o.templateId];
      if (pair) {
        const migrated = migrateLegacyTripleToRow(pair.buttonId, pair.ctaCopyId, hrefSingle);
        if (migrated) out.push(migrated);
      }
    }
  }
  return out.slice(0, 6);
}
