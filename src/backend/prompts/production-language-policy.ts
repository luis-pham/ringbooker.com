import { canUseBilingualWorkflow } from '@/src/backend/domain/shop-plan-capabilities';
import type { ShopPlan } from '@/src/backend/domain/types';

/** ISO-ish codes saved on shops.languages — extend as product adds presets */
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
  es: 'Spanish',
  ko: 'Korean',
  zh: 'Chinese',
  tl: 'Tagalog',
  fr: 'French',
};

export function languageCodesToLabels(codes: string[]): string[] {
  return codes.map((c) => {
    const key = c.trim().toLowerCase().slice(0, 8);
    const short = key.slice(0, 2);
    return LANGUAGE_LABELS[short] ?? LANGUAGE_LABELS[key] ?? c.trim();
  });
}

/** True when setup implies more than English-only live dialogue (per pricing policy). */
export function hasMultilingualLanguageConfiguration(languages: string[] | undefined): boolean {
  const raw = languages?.length ? languages : ['en'];
  const normalized = raw.map((c) => c.trim().toLowerCase().slice(0, 2));
  const distinct = new Set(normalized.filter(Boolean));
  if (distinct.size >= 2) return true;
  const only = [...distinct][0];
  return Boolean(only && only !== 'en');
}

export type ProductionLanguageRuntimeFields = {
  /** Passed through to RUNTIME BUSINESS CONFIG when bilingual workflow applies */
  languageOptions?: string[];
  /** Always set for production builds — appended in runtime layer */
  productionLanguageDirective: string;
};

export function buildProductionLanguageRuntimeFields(
  plan: ShopPlan,
  languages: string[] | undefined,
): ProductionLanguageRuntimeFields {
  const codesRaw = languages?.length ? languages : ['en'];
  const codes = codesRaw.map((c) => c.trim().toLowerCase());
  const labels = languageCodesToLabels(codes);
  const labelsJoined = labels.join(', ');

  if (!canUseBilingualWorkflow(plan)) {
    const metadataLine =
      hasMultilingualLanguageConfiguration(languages) || (codes.length === 1 && codes[0] !== 'en')
        ? `LANGUAGES NOTED FOR SETUP (internal metadata for your team only — do not change spoken assistant language based on this): ${labelsJoined}.`
        : null;
    const starterPolicy =
      'LANGUAGE POLICY (STARTER PLAN): Keep all spoken assistant dialogue in English. Do not switch to another language for the live conversation based on setup notes or caller language. If a caller primarily speaks another language, stay in English, acknowledge politely, and offer human callback or written follow-up. Ignore any higher-layer vertical examples that suggest bilingual spoken replies; this policy overrides them for Starter.';
    return {
      productionLanguageDirective: [starterPolicy, metadataLine].filter(Boolean).join('\n'),
    };
  }

  if (!hasMultilingualLanguageConfiguration(languages)) {
    return {
      productionLanguageDirective:
        'LANGUAGE POLICY (PAID PLAN): Keep spoken dialogue in English unless CUSTOM INSTRUCTIONS specify otherwise.',
    };
  }

  const bilingual =
    'BILINGUAL WORKFLOW: You may respond naturally in the caller\'s language when it matches a language listed in LANGUAGE OPTIONS below. Keep team summaries, owner-facing recap notes, and SMS confirmation content in English unless CUSTOM INSTRUCTIONS explicitly say otherwise.';

  const enterpriseHook =
    plan === 'enterprise'
      ? 'CUSTOM MULTILINGUAL ROUTING (ENTERPRISE): When CUSTOM INSTRUCTIONS include multilingual, routing, or escalation rules, follow those rules first. If none are present, follow BILINGUAL WORKFLOW above.'
      : '';

  return {
    languageOptions: labels,
    productionLanguageDirective: [bilingual, enterpriseHook].filter(Boolean).join('\n'),
  };
}
