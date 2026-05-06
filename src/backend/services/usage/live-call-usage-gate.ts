import type { CommercialAccount, Shop } from '@/src/backend/domain/types';
import type { CallLogsRepository, ShopActiveCallSessionsRepository } from '@/src/backend/ports/repositories';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

export type LiveCallUsageGateResult =
  | { ok: true; usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> }
  | { ok: false; reason: 'usage_limit_reached' | 'concurrency_limit_reached'; usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> };

export async function checkLiveCallUsageGate(
  deps: {
    callLogsRepository: CallLogsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  },
  params: {
    shop: Shop;
    commercialAccount?: CommercialAccount | null;
    now?: Date;
  },
): Promise<LiveCallUsageGateResult> {
  const usage = await getShopUsageForPeriod(deps, params);
  if (usage.overCapturedCallerLimit) return { ok: false, reason: 'usage_limit_reached', usage };
  if (usage.activeLiveCalls >= usage.maxConcurrentLiveCalls) {
    return { ok: false, reason: 'concurrency_limit_reached', usage };
  }
  return { ok: true, usage };
}
