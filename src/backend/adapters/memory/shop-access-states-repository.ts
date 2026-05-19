import { randomUUID } from 'node:crypto';

import type { ShopAccessState } from '@/src/backend/domain/types';
import type { ShopAccessStatesRepository } from '@/src/backend/ports/repositories';

export class InMemoryShopAccessStatesRepository implements ShopAccessStatesRepository {
  private readonly records = new Map<string, ShopAccessState>();

  async findByShopId(shopId: string): Promise<ShopAccessState | null> {
    return [...this.records.values()].find((record) => record.shopId === shopId) ?? null;
  }

  async findByShopIds(shopIds: string[]): Promise<Map<string, ShopAccessState | null>> {
    const map = new Map<string, ShopAccessState | null>();
    for (const id of shopIds) map.set(id, null);
    for (const record of this.records.values()) {
      if (shopIds.includes(record.shopId)) {
        map.set(record.shopId, record);
      }
    }
    return map;
  }

  async upsert(params: {
    shopId: string;
    liveCallsEnabled?: boolean;
    goLiveAt?: string | null;
    liveCallsPausedReason?: string | null;
    liveCallsPausedAt?: string | null;
    lastAccessCheckAt?: string | null;
    forwardingClaimedAt?: string | null;
    forwardingVerifiedAt?: string | null;
    forwardingVerifiedSource?: ShopAccessState['forwardingVerifiedSource'];
    forwardingSetupVerifiedAt?: string | null;
    forwardingSetupVerifiedVia?: ShopAccessState['forwardingSetupVerifiedVia'];
    commercialGoLiveApprovedAt?: string | null;
    commercialGoLiveApprovedBy?: string | null;
    commercialGoLiveApprovalNote?: string | null;
  }): Promise<ShopAccessState> {
    const existing = await this.findByShopId(params.shopId);
    const now = new Date().toISOString();
    const next: ShopAccessState = {
      id: existing?.id ?? `sas_${randomUUID()}`,
      shopId: params.shopId,
      liveCallsEnabled: params.liveCallsEnabled ?? existing?.liveCallsEnabled ?? false,
      goLiveAt: params.goLiveAt ?? existing?.goLiveAt ?? null,
      liveCallsPausedReason: params.liveCallsPausedReason ?? existing?.liveCallsPausedReason ?? null,
      liveCallsPausedAt: params.liveCallsPausedAt ?? existing?.liveCallsPausedAt ?? null,
      lastAccessCheckAt: params.lastAccessCheckAt ?? existing?.lastAccessCheckAt ?? null,
      forwardingClaimedAt:
        params.forwardingClaimedAt !== undefined
          ? params.forwardingClaimedAt
          : (existing?.forwardingClaimedAt ?? null),
      forwardingVerifiedAt:
        params.forwardingVerifiedAt !== undefined
          ? params.forwardingVerifiedAt
          : (params.forwardingSetupVerifiedAt !== undefined
            ? params.forwardingSetupVerifiedAt
            : (existing?.forwardingVerifiedAt ?? existing?.forwardingSetupVerifiedAt ?? null)),
      forwardingVerifiedSource:
        params.forwardingVerifiedSource !== undefined
          ? params.forwardingVerifiedSource
          : (params.forwardingSetupVerifiedVia === 'inbound_test_call' || params.forwardingSetupVerifiedVia === 'forwarding_test'
            ? 'inbound_test'
            : (existing?.forwardingVerifiedSource ?? null)),
      forwardingSetupVerifiedAt:
        params.forwardingSetupVerifiedAt !== undefined
          ? params.forwardingSetupVerifiedAt
          : (params.forwardingVerifiedAt !== undefined
            ? params.forwardingVerifiedAt
            : (existing?.forwardingSetupVerifiedAt ?? existing?.forwardingVerifiedAt ?? null)),
      forwardingSetupVerifiedVia:
        params.forwardingSetupVerifiedVia !== undefined
          ? params.forwardingSetupVerifiedVia
          : (params.forwardingVerifiedSource === 'inbound_test'
            ? 'inbound_test_call'
            : params.forwardingVerifiedSource === 'admin_override'
              ? 'manual_confirmation'
              : (existing?.forwardingSetupVerifiedVia ?? null)),
      commercialGoLiveApprovedAt:
        params.commercialGoLiveApprovedAt !== undefined
          ? params.commercialGoLiveApprovedAt
          : (existing?.commercialGoLiveApprovedAt ?? null),
      commercialGoLiveApprovedBy:
        params.commercialGoLiveApprovedBy !== undefined
          ? params.commercialGoLiveApprovedBy
          : (existing?.commercialGoLiveApprovedBy ?? null),
      commercialGoLiveApprovalNote:
        params.commercialGoLiveApprovalNote !== undefined
          ? params.commercialGoLiveApprovalNote
          : (existing?.commercialGoLiveApprovalNote ?? null),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(next.id, next);
    return next;
  }
}
