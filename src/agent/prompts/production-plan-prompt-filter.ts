import { hasMultilingualLanguageConfiguration } from '@/src/backend/prompts/production-language-policy';
import type { ShopPlan } from '@/src/backend/domain/types';
import type { VoicePromptMode } from '@/src/agent/prompts/types';

/** Core layer: language policy block (Starter production and English-only demos replace this). */
const CORE_LANGUAGE_POLICY_BLOCK =
  /\n(?:Detect and match the caller[\u2019']s language automatically\.[\s\S]*?Never ask the caller to repeat themselves in a different language\.|Speak English by default\.[\s\S]*?Do not mix languages in the same response\.)/;

const CORE_STARTER_LANGUAGE_REPLACEMENT =
  '\nKeep spoken dialogue in English unless RUNTIME BUSINESS CONFIG LANGUAGE DIRECTIVE explicitly allows otherwise. Treat accented English, slow speech, and noisy ASR fragments as English. Do not switch languages based only on pronunciation, accent, or a few unclear words on Starter.';

const CORE_DEMO_NAIL_LANGUAGE_REPLACEMENT =
  '\nNAIL DEMO LANGUAGE POLICY: Keep spoken dialogue in English only. Do not switch to another language during the nail salon demo, even if the caller speaks another language.';

/**
 * Starter production: replace core multilingual switching block with English-first alignment.
 */
export function filterCoreVoicePromptForProductionPlan(coreContent: string, plan: ShopPlan, mode: VoicePromptMode): string {
  if (mode !== 'production' || plan !== 'starter') return coreContent;
  if (!CORE_LANGUAGE_POLICY_BLOCK.test(coreContent)) return coreContent;
  return coreContent.replace(CORE_LANGUAGE_POLICY_BLOCK, CORE_STARTER_LANGUAGE_REPLACEMENT);
}

export function filterCoreVoicePromptForNailDemo(coreContent: string, mode: VoicePromptMode, vertical: string): string {
  if (mode !== 'demo' || vertical !== 'nail-salon') return coreContent;
  if (!CORE_LANGUAGE_POLICY_BLOCK.test(coreContent)) return coreContent;
  return coreContent.replace(CORE_LANGUAGE_POLICY_BLOCK, CORE_DEMO_NAIL_LANGUAGE_REPLACEMENT);
}

function shouldStripVerticalLanguageLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (!line.trim()) return false;
  if (/\bvietnamese\b/.test(lower)) return true;
  if (/\bbilingual\b/.test(lower)) return true;
  if (/english\s*\/\s*vietnamese/.test(lower)) return true;
  if (/respond.*\bvietnamese\b/.test(lower)) return true;
  if (/speaks\s+vietnamese/.test(lower)) return true;
  if (/switch.*language/.test(lower)) return true;
  // Nail samples with Vietnamese orthography
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(line) && /sample wording/i.test(lower)) return true;
  return false;
}

/**
 * Removes bilingual / Vietnamese-specific vertical lines for Starter, or for paid plans without
 * multilingual language configuration. Demo mode leaves packs untouched.
 */
export function filterVerticalPackForProductionPlan(
  verticalContent: string,
  params: { plan: ShopPlan; mode: VoicePromptMode; languages?: string[] },
): string {
  if (params.mode !== 'production') return verticalContent;

  const stripVerticalLanguage =
    params.plan === 'starter' ||
    ((params.plan === 'professional' || params.plan === 'enterprise') &&
      !hasMultilingualLanguageConfiguration(params.languages));

  if (!stripVerticalLanguage) return verticalContent;

  const lines = verticalContent.split('\n');
  const kept = lines.filter((line) => !shouldStripVerticalLanguageLine(line));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function filterVerticalPackForNailDemo(verticalContent: string, mode: VoicePromptMode, vertical: string): string {
  if (mode !== 'demo' || vertical !== 'nail-salon') return verticalContent;
  const lines = verticalContent.split('\n');
  const kept = lines.filter((line) => !shouldStripVerticalLanguageLine(line));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
