import type { Shop } from '@/src/backend/domain/types';
import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import { SquareSyncAdapter } from '@/src/backend/services/platform-sync/adapters/square';
import type { PlatformSyncAdapter, PlatformSyncDeps, SyncResult } from '@/src/backend/services/platform-sync/types';

const BILLING_BLOCKED_SUBSCRIPTION_STATUSES = new Set(['past_due', 'unpaid', 'paused', 'canceled', 'trial_expired']);

export function getPlatformSyncAdapter(
  shop: Shop,
  deps: PlatformSyncDeps,
): PlatformSyncAdapter | null {
  switch (shop.selected_integration) {
    case 'square_appointments':
      return new SquareSyncAdapter(deps);
    default:
      return null;
  }
}

function skippedSyncResult(
  adapter: PlatformSyncAdapter,
  shop: Shop,
  reason: string,
  start = Date.now(),
): SyncResult {
  const error = `sync_skipped:${reason}`;
  return {
    platform: adapter.platform,
    shopId: shop.id,
    triggeredAt: new Date(),
    location: {
      status: 'skipped',
      locationId: null,
      locationName: null,
      error,
    },
    services: {
      status: 'skipped',
      total: 0,
      matched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      items: [],
      error,
    },
    staff: {
      status: 'skipped',
      total: 0,
      matched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      items: [],
      error,
    },
    mapping: {
      status: 'skipped',
      totalMappings: 0,
      created: 0,
      skipped: 0,
      error,
    },
    durationMs: Date.now() - start,
  };
}

async function resolvePlatformSyncSkipReason(shop: Shop, deps: PlatformSyncDeps): Promise<string | null> {
  if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
    return 'plan_locked';
  }

  if (!deps.billingSubscriptionsRepository) return null;

  try {
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (subscription && BILLING_BLOCKED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return `billing_${subscription.status}`;
    }
  } catch (error) {
    deps.logger.warn(
      {
        err: error,
        shopId: shop.id,
        platform: shop.selected_integration ?? null,
      },
      'platform_sync_billing_status_check_failed',
    );
    return 'billing_status_unavailable';
  }

  return null;
}

export async function runPlatformSync(shop: Shop, deps: PlatformSyncDeps): Promise<SyncResult | null> {
  const adapter = getPlatformSyncAdapter(shop, deps);
  if (!adapter) return null;
  const start = Date.now();
  const skipReason = await resolvePlatformSyncSkipReason(shop, deps);
  if (skipReason) {
    deps.logger.info(
      {
        shopId: shop.id,
        platform: adapter.platform,
        reason: skipReason,
      },
      'platform_sync_skipped',
    );
    return skippedSyncResult(adapter, shop, skipReason, start);
  }
  return adapter.syncAll(shop);
}

export async function triggerPlatformSync(shop: Shop, deps: PlatformSyncDeps): Promise<void> {
  const adapter = getPlatformSyncAdapter(shop, deps);
  if (!adapter) return;

  const start = Date.now();
  try {
    const skipReason = await resolvePlatformSyncSkipReason(shop, deps);
    if (skipReason) {
      deps.logger.info(
        {
          shopId: shop.id,
          platform: adapter.platform,
          reason: skipReason,
        },
        'platform_sync_skipped',
      );
    }
    const result = skipReason
      ? skippedSyncResult(adapter, shop, skipReason, start)
      : await adapter.syncAll(shop);
    deps.logger.info(
      {
        shopId: shop.id,
        platform: result.platform,
        durationMs: result.durationMs,
        services: {
          status: result.services.status,
          matched: result.services.matched,
          created: result.services.created,
          updated: result.services.updated,
          skipped: result.services.skipped,
          failed: result.services.failed,
          error: result.services.error ?? null,
        },
        staff: {
          status: result.staff.status,
          matched: result.staff.matched,
          created: result.staff.created,
          updated: result.staff.updated,
          skipped: result.staff.skipped,
          failed: result.staff.failed,
          error: result.staff.error ?? null,
        },
        mapping: {
          status: result.mapping.status,
          created: result.mapping.created,
          skipped: result.mapping.skipped,
          error: result.mapping.error ?? null,
        },
      },
      'platform_sync_completed',
    );
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    deps.logger.warn(
      {
        shopId: shop.id,
        platform: shop.selected_integration ?? null,
        durationMs: Date.now() - start,
        error: raw.split(':').slice(0, 2).join(':').slice(0, 120) || 'unknown_error',
      },
      'platform_sync_failed',
    );
  }
}

export type { PlatformSyncAdapter, PlatformSyncDeps, SyncResult };
