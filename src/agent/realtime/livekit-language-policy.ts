import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import type { RealtimeSessionMetadata } from '@/src/agent/realtime/types';
import type { ShopPlan } from '@/src/backend/domain/types';

export function resolveShopPlanFromDispatchMetadata(
  metadata: Partial<RealtimeSessionMetadata> | Record<string, unknown> | undefined,
): ShopPlan | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const dispatchPayload = (metadata as RealtimeSessionMetadata).dispatchPayload;
  const plan = dispatchPayload?.context?.shopPlan;
  if (plan === 'starter' || plan === 'professional' || plan === 'enterprise') return plan;
  return undefined;
}

export function resolveShopLanguagesFromDispatchMetadata(
  metadata: Partial<RealtimeSessionMetadata> | Record<string, unknown> | undefined,
): string[] | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const dispatchPayload = (metadata as RealtimeSessionMetadata).dispatchPayload;
  const languages = dispatchPayload?.context?.shopLanguages;
  if (!Array.isArray(languages)) return undefined;
  return languages.filter((language): language is string => typeof language === 'string' && language.trim().length > 0);
}

export function isDemoRealtimeMetadata(metadata: Partial<RealtimeSessionMetadata> | Record<string, unknown> | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const dispatchPayload = (metadata as RealtimeSessionMetadata).dispatchPayload;
  return Boolean(dispatchPayload?.demo?.isolated);
}

export type TranscriptionVietnameseDefaultParams = {
  callerPhone: string;
  destinationPhone: string;
  shopPlan: ShopPlan | undefined;
  shopLanguages?: string[];
  demoIsolated: boolean;
  /** Production live path without shopPlan — English-safe default + optional log */
  onMissingShopPlanProduction?: () => void;
};

/**
 * LiveKit input transcription language default.
 * - Starter: never Vietnamese-by-default.
 * - Missing shopPlan on non-demo dispatch: English-safe (false), warn callback.
 * - Demo isolated (+ legacy): allow +84 Vietnamese heuristic.
 */
export function shouldDefaultTranscriptionToVietnamese(params: TranscriptionVietnameseDefaultParams): boolean {
  const callerPhone = params.callerPhone.trim();
  const destinationPhone = params.destinationPhone.trim();
  const plus84 = callerPhone.startsWith('+84') || destinationPhone.startsWith('+84');

  if (params.shopPlan === 'starter') return false;

  if (params.shopPlan === undefined) {
    if (!params.demoIsolated) {
      params.onMissingShopPlanProduction?.();
      return false;
    }
    return plus84;
  }

  return plus84;
}

export function transcriptionPolicyFromDispatchInput(
  input: RealtimeDispatchInput,
  onMissingShopPlanProduction?: () => void,
): TranscriptionVietnameseDefaultParams {
  const metadata = input.realtime.metadata as Partial<RealtimeSessionMetadata> | undefined;
  return {
    callerPhone: input.callerPhone,
    destinationPhone: input.destinationPhone,
    shopPlan: resolveShopPlanFromDispatchMetadata(metadata),
    shopLanguages: resolveShopLanguagesFromDispatchMetadata(metadata),
    demoIsolated: isDemoRealtimeMetadata(metadata),
    onMissingShopPlanProduction,
  };
}

/** Fallback greeting language when env/heuristic applies — Starter / unknown production ignores explicit VI env. */
export function shouldUseVietnameseFallbackGreeting(params: {
  shopPlan: ShopPlan | undefined;
  demoIsolated: boolean;
  greetingLanguageEnv: string | undefined;
  transcriptionDefaultsVietnamese: boolean;
}): boolean {
  const language = params.greetingLanguageEnv?.trim().toLowerCase();
  const envRequestsVi = language === 'vi' || language === 'vietnamese';
  const starterOrUnknownProduction =
    params.shopPlan === 'starter' || (params.shopPlan === undefined && !params.demoIsolated);

  if (starterOrUnknownProduction && envRequestsVi) {
    return false;
  }

  return envRequestsVi || (!language && params.transcriptionDefaultsVietnamese);
}
