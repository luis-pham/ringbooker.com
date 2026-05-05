import { randomUUID } from 'node:crypto';

import type { ForwardingTestSession } from '@/src/backend/domain/types';
import type { ForwardingTestSessionsRepository } from '@/src/backend/ports/repositories';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';

function normDid(raw: string): string | null {
  return normalizeInboundE164(raw);
}

export class InMemoryForwardingTestSessionsRepository implements ForwardingTestSessionsRepository {
  private readonly records = new Map<string, ForwardingTestSession>();

  async findPendingUnexpiredByShopId(params: { shopId: string; now: Date }): Promise<ForwardingTestSession | null> {
    const nowMs = params.now.getTime();
    const candidates = [...this.records.values()].filter((row) => {
      if (row.shopId !== params.shopId) return false;
      if (row.status !== 'pending') return false;
      return new Date(row.expiresAt).getTime() > nowMs;
    });
    candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return candidates[0] ?? null;
  }

  async createSession(params: {
    shopId: string;
    forwardingNumber: string;
    expectedBusinessPhone?: string | null;
    startedAt: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ForwardingTestSession> {
    const now = new Date().toISOString();
    const session: ForwardingTestSession = {
      id: `fts_${randomUUID()}`,
      shopId: params.shopId,
      status: 'pending',
      forwardingNumber: params.forwardingNumber,
      expectedBusinessPhone: params.expectedBusinessPhone ?? null,
      startedAt: params.startedAt.toISOString(),
      expiresAt: params.expiresAt.toISOString(),
      passedAt: null,
      inboundCallSessionId: null,
      inboundCallControlId: null,
      callerPhone: null,
      metadata: params.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(session.id, session);
    return session;
  }

  async markPassedIfEligible(params: {
    shopId: string;
    forwardingNumberE164: string;
    inboundCallSessionId: string | null;
    inboundCallControlId: string | null;
    callerPhone: string | null;
    now: Date;
  }): Promise<boolean> {
    const want = normDid(params.forwardingNumberE164);
    if (!want) return false;
    const nowMs = params.now.getTime();
    const nowIso = params.now.toISOString();
    for (const row of this.records.values()) {
      if (row.shopId !== params.shopId) continue;
      if (row.status !== 'pending') continue;
      if (new Date(row.expiresAt).getTime() <= nowMs) continue;
      const rowDid = normDid(row.forwardingNumber);
      if (rowDid !== want) continue;
      const next: ForwardingTestSession = {
        ...row,
        status: 'passed',
        passedAt: nowIso,
        inboundCallSessionId: params.inboundCallSessionId,
        inboundCallControlId: params.inboundCallControlId,
        callerPhone: params.callerPhone,
        updatedAt: nowIso,
      };
      this.records.set(row.id, next);
      return true;
    }
    return false;
  }

  async findLatestByShopId(shopId: string): Promise<ForwardingTestSession | null> {
    const rows = [...this.records.values()].filter((r) => r.shopId === shopId);
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows[0] ?? null;
  }
}
