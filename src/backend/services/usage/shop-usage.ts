import type { CommercialAccount, Shop } from '@/src/backend/domain/types';
import { getPlanUsageLimits, type PlanUsageLimits } from '@/src/backend/domain/plan-usage-limits';
import type { CallLogsRepository, ShopActiveCallSessionsRepository } from '@/src/backend/ports/repositories';
import { calendarMonthPeriod } from '@/src/backend/services/usage/period';

export type ShopUsageForPeriod = {
  limits: PlanUsageLimits;
  capturedCallersUsed: number;
  capturedCallersLimit: number | null;
  capturedCallersRemaining: number | null;
  capturedCallerUsagePercent: number | null;
  voiceSecondsUsed: number;
  voiceMinutesUsed: number;
  voiceMinutesSoftLimit: number | null;
  nearCapturedCallerLimit: boolean;
  overCapturedCallerLimit: boolean;
  nearVoiceMinuteLimit: boolean;
  overVoiceMinuteSoftLimit: boolean;
  activeLiveCalls: number;
  maxConcurrentLiveCalls: number;
  periodStart: string;
  periodEnd: string;
};

export async function getShopUsageForPeriod(
  deps: {
    callLogsRepository: CallLogsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  },
  params: {
    shop: Shop;
    commercialAccount?: CommercialAccount | null;
    now?: Date;
    periodStart?: Date;
    periodEnd?: Date;
  },
): Promise<ShopUsageForPeriod> {
  const now = params.now ?? new Date();
  const period = params.periodStart && params.periodEnd ? { periodStart: params.periodStart, periodEnd: params.periodEnd } : calendarMonthPeriod(now);
  const limits = getPlanUsageLimits(params.shop.plan, params.commercialAccount);
  const [capturedCallersUsed, voiceSecondsUsed, activeLiveCalls] = await Promise.all([
    deps.callLogsRepository.countByShop(params.shop.id, {
      startedAfter: period.periodStart,
      startedBefore: period.periodEnd,
      isCapturedCaller: true,
    }),
    deps.callLogsRepository.sumDurationSecsByShop(params.shop.id, {
      startedAfter: period.periodStart,
      startedBefore: period.periodEnd,
    }),
    deps.shopActiveCallSessionsRepository
      ? deps.shopActiveCallSessionsRepository.countActiveByShop({ shopId: params.shop.id, now })
      : Promise.resolve(0),
  ]);

  const capturedLimit = limits.capturedCallersMonthlyLimit;
  const voiceLimit = limits.softVoiceMinutesMonthlyLimit;
  const capturedPercent = capturedLimit ? Math.round((capturedCallersUsed / capturedLimit) * 100) : null;
  const voiceMinutesUsed = Math.round((voiceSecondsUsed / 60) * 10) / 10;
  const voicePercent = voiceLimit ? voiceMinutesUsed / voiceLimit : 0;

  return {
    limits,
    capturedCallersUsed,
    capturedCallersLimit: capturedLimit,
    capturedCallersRemaining: capturedLimit == null ? null : Math.max(0, capturedLimit - capturedCallersUsed),
    capturedCallerUsagePercent: capturedPercent,
    voiceSecondsUsed,
    voiceMinutesUsed,
    voiceMinutesSoftLimit: voiceLimit,
    nearCapturedCallerLimit: capturedLimit != null && capturedCallersUsed >= Math.floor(capturedLimit * 0.8) && capturedCallersUsed < capturedLimit,
    overCapturedCallerLimit: capturedLimit != null && capturedCallersUsed >= capturedLimit,
    nearVoiceMinuteLimit: voiceLimit != null && voicePercent >= 0.8 && voicePercent < 1,
    overVoiceMinuteSoftLimit: voiceLimit != null && voiceMinutesUsed >= voiceLimit,
    activeLiveCalls,
    maxConcurrentLiveCalls: limits.maxConcurrentLiveCalls,
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
  };
}

export function isUsageLimitReached(usage: ShopUsageForPeriod): boolean {
  return usage.overCapturedCallerLimit;
}
