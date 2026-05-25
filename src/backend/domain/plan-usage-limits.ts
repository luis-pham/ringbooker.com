import type { CommercialAccount, ShopPlan } from '@/src/backend/domain/types';

export type PlanUsageLimits = {
  capturedCallersMonthlyLimit: number | null;
  softVoiceMinutesMonthlyLimit: number | null;
  maxConcurrentLiveCalls: number;
  maxCallDurationSeconds: number;
  softWarningAfterSeconds: number;
  isCustom: boolean;
};

export const DEFAULT_ENTERPRISE_USAGE_LIMITS: PlanUsageLimits = {
  capturedCallersMonthlyLimit: null,
  softVoiceMinutesMonthlyLimit: null,
  maxConcurrentLiveCalls: 3,
  maxCallDurationSeconds: 720,
  softWarningAfterSeconds: 420,
  isCustom: true,
};

export const PLAN_USAGE_LIMITS: Record<Exclude<ShopPlan, 'enterprise'>, PlanUsageLimits> = {
  starter: {
    capturedCallersMonthlyLimit: 100,
    softVoiceMinutesMonthlyLimit: null,
    maxConcurrentLiveCalls: 1,
    maxCallDurationSeconds: 360,
    softWarningAfterSeconds: 300,
    isCustom: false,
  },
  professional: {
    capturedCallersMonthlyLimit: 200,
    softVoiceMinutesMonthlyLimit: null,
    maxConcurrentLiveCalls: 2,
    maxCallDurationSeconds: 480,
    softWarningAfterSeconds: 420,
    isCustom: false,
  },
};

function positiveInt(value: number | null | undefined): number | null {
  if (!Number.isFinite(value ?? NaN)) return null;
  const n = Math.floor(Number(value));
  return n > 0 ? n : null;
}

export function getPlanUsageLimits(
  plan: ShopPlan,
  commercialAccount?: CommercialAccount | null,
): PlanUsageLimits {
  if (plan !== 'enterprise') return PLAN_USAGE_LIMITS[plan];

  const captured = positiveInt(commercialAccount?.includedCapturedCallers);
  const concurrent = positiveInt(commercialAccount?.maxConcurrentLiveCalls);
  const duration = positiveInt(commercialAccount?.maxCallDurationSeconds);

  return {
    ...DEFAULT_ENTERPRISE_USAGE_LIMITS,
    capturedCallersMonthlyLimit: captured,
    softVoiceMinutesMonthlyLimit: null,
    maxConcurrentLiveCalls: concurrent ?? DEFAULT_ENTERPRISE_USAGE_LIMITS.maxConcurrentLiveCalls,
    maxCallDurationSeconds: duration ?? DEFAULT_ENTERPRISE_USAGE_LIMITS.maxCallDurationSeconds,
    softWarningAfterSeconds: Math.min(
      Math.max(60, Math.floor((duration ?? DEFAULT_ENTERPRISE_USAGE_LIMITS.maxCallDurationSeconds) * 0.6)),
      duration ?? DEFAULT_ENTERPRISE_USAGE_LIMITS.maxCallDurationSeconds,
    ),
  };
}
