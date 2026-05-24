import type { CommercialAccount, Shop } from '@/src/backend/domain/types';
import { getPlanUsageLimits, type PlanUsageLimits } from '@/src/backend/domain/plan-usage-limits';
import type {
  BillingSubscriptionsRepository,
  CallLogsRepository,
  ShopActiveCallSessionsRepository,
} from '@/src/backend/ports/repositories';
import { getBillingPeriodForShop } from '@/src/backend/services/usage/period';

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
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  },
  params: {
    shop: Shop;
    commercialAccount?: CommercialAccount | null;
    now?: Date;
    period?: { start: Date; end: Date };
    periodStart?: Date;
    periodEnd?: Date;
  },
): Promise<ShopUsageForPeriod> {
  const now = params.now ?? new Date();
  let period: { start: Date; end: Date };
  if (params.period) {
    period = params.period;
  } else if (params.periodStart && params.periodEnd) {
    period = { start: params.periodStart, end: params.periodEnd };
  } else {
    period = await getBillingPeriodForShop(params.shop.id, deps, { now, shopTimezone: params.shop.timezone });
  }
  const limits = getPlanUsageLimits(params.shop.plan, params.commercialAccount);
  const [capturedCallersUsed, voiceSecondsUsed, activeLiveCalls] = await Promise.all([
    deps.callLogsRepository.countByShop(params.shop.id, {
      startedAfter: period.start,
      startedBefore: period.end,
      isCapturedCaller: true,
    }),
    deps.callLogsRepository.sumDurationSecsByShop(params.shop.id, {
      startedAfter: period.start,
      startedBefore: period.end,
    }),
    deps.shopActiveCallSessionsRepository
      ? deps.shopActiveCallSessionsRepository.countActiveByShop({ shopId: params.shop.id, now })
      : Promise.resolve(0),
  ]);

  const capturedLimit = limits.capturedCallersMonthlyLimit;
  const capturedPercent = capturedLimit ? Math.round((capturedCallersUsed / capturedLimit) * 100) : null;
  const voiceMinutesUsed = Math.round((voiceSecondsUsed / 60) * 10) / 10;

  return {
    limits,
    capturedCallersUsed,
    capturedCallersLimit: capturedLimit,
    capturedCallersRemaining: capturedLimit == null ? null : Math.max(0, capturedLimit - capturedCallersUsed),
    capturedCallerUsagePercent: capturedPercent,
    voiceSecondsUsed,
    voiceMinutesUsed,
    voiceMinutesSoftLimit: null,
    nearCapturedCallerLimit: capturedLimit != null && capturedCallersUsed >= Math.floor(capturedLimit * 0.8) && capturedCallersUsed < capturedLimit,
    overCapturedCallerLimit: capturedLimit != null && capturedCallersUsed >= capturedLimit,
    nearVoiceMinuteLimit: false,
    overVoiceMinuteSoftLimit: false,
    activeLiveCalls,
    maxConcurrentLiveCalls: limits.maxConcurrentLiveCalls,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  };
}

export function isUsageLimitReached(usage: ShopUsageForPeriod): boolean {
  return usage.overCapturedCallerLimit;
}
