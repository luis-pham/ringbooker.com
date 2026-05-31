import type { Shop } from '@/src/backend/domain/types';
import { SquareSyncAdapter } from '@/src/backend/services/platform-sync/adapters/square';
import type { PlatformSyncAdapter, PlatformSyncDeps, SyncResult } from '@/src/backend/services/platform-sync/types';

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

export async function runPlatformSync(shop: Shop, deps: PlatformSyncDeps): Promise<SyncResult | null> {
  const adapter = getPlatformSyncAdapter(shop, deps);
  if (!adapter) return null;
  return adapter.syncAll(shop);
}

export async function triggerPlatformSync(shop: Shop, deps: PlatformSyncDeps): Promise<void> {
  const adapter = getPlatformSyncAdapter(shop, deps);
  if (!adapter) return;

  const start = Date.now();
  try {
    const result = await adapter.syncAll(shop);
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
