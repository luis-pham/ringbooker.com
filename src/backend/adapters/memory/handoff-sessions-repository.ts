import { randomUUID } from 'node:crypto';

import { HANDOFF_TERMINAL_STATUSES, type HandoffSessionRecord, type HandoffSessionStatus } from '@/src/backend/domain/handoff';
import type { HandoffSessionsRepository } from '@/src/backend/ports/repositories';

function toRecord(row: HandoffSessionRecord): HandoffSessionRecord {
  return { ...row };
}

export class InMemoryHandoffSessionsRepository implements HandoffSessionsRepository {
  private readonly byId = new Map<string, HandoffSessionRecord>();
  private readonly byIdempotency = new Map<string, string>();
  private readonly byOwnerCc = new Map<string, string>();
  private readonly byParentCc = new Map<string, string>();

  async create(params: {
    shopId: string;
    rbCallId: string;
    idempotencyKey: string;
    parentCallControlId: string;
    parentCallSessionId?: string | null;
    ownerPhone: string;
    callerPhone?: string | null;
    callerName?: string | null;
    reason: string;
    urgency: string;
    summary: string;
    serviceRequested?: string | null;
    preferredTime?: string | null;
    status: HandoffSessionStatus;
  }): Promise<HandoffSessionRecord> {
    const idemKey = `${params.shopId}:${params.idempotencyKey}`;
    const existingId = this.byIdempotency.get(idemKey);
    if (existingId) {
      const ex = this.byId.get(existingId);
      if (ex) return toRecord(ex);
    }

    const id = randomUUID();
    const now = new Date();
    const row: HandoffSessionRecord = {
      id,
      shopId: params.shopId,
      rbCallId: params.rbCallId,
      idempotencyKey: params.idempotencyKey,
      parentCallControlId: params.parentCallControlId,
      parentCallSessionId: params.parentCallSessionId ?? null,
      ownerCallControlId: null,
      openaiCallId: null,
      ownerPhone: params.ownerPhone,
      callerPhone: params.callerPhone ?? null,
      callerName: params.callerName ?? null,
      reason: params.reason,
      urgency: params.urgency,
      summary: params.summary,
      serviceRequested: params.serviceRequested ?? null,
      preferredTime: params.preferredTime ?? null,
      status: params.status,
      failedReason: null,
      errorMessage: null,
      dtmfRetryCount: 0,
      fallbackSmsSent: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.byId.set(id, row);
    this.byIdempotency.set(idemKey, id);
    this.byParentCc.set(params.parentCallControlId, id);
    return toRecord(row);
  }

  async findById(id: string): Promise<HandoffSessionRecord | null> {
    const r = this.byId.get(id);
    return r ? toRecord(r) : null;
  }

  async findActiveByRbCallId(shopId: string, rbCallId: string): Promise<HandoffSessionRecord | null> {
    for (const r of this.byId.values()) {
      if (r.shopId !== shopId || r.rbCallId !== rbCallId) continue;
      if (!HANDOFF_TERMINAL_STATUSES.has(r.status)) {
        return toRecord(r);
      }
    }
    return null;
  }

  async findByOwnerCallControlId(callControlId: string): Promise<HandoffSessionRecord | null> {
    const id = this.byOwnerCc.get(callControlId);
    if (!id) return null;
    const r = this.byId.get(id);
    return r ? toRecord(r) : null;
  }

  async findByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null> {
    const id = this.byParentCc.get(parentCallControlId);
    if (!id) return null;
    const r = this.byId.get(id);
    return r ? toRecord(r) : null;
  }

  async findActiveByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null> {
    let best: HandoffSessionRecord | null = null;
    for (const r of this.byId.values()) {
      if (r.parentCallControlId !== parentCallControlId) continue;
      if (HANDOFF_TERMINAL_STATUSES.has(r.status)) continue;
      if (!best || r.createdAt.getTime() > best.createdAt.getTime()) {
        best = toRecord(r);
      }
    }
    return best;
  }

  async update(
    id: string,
    patch: Partial<{
      status: HandoffSessionStatus;
      ownerCallControlId: string | null;
      openaiCallId: string | null;
      parentCallSessionId: string | null;
      failedReason: string | null;
      errorMessage: string | null;
      dtmfRetryCount: number;
      fallbackSmsSent: boolean;
      completedAt: Date | null;
    }>,
  ): Promise<void> {
    const r = this.byId.get(id);
    if (!r) return;
    const prevOwner = r.ownerCallControlId;
    if (prevOwner) this.byOwnerCc.delete(prevOwner);
    Object.assign(r, patch, { updatedAt: new Date() });
    if (patch.ownerCallControlId) this.byOwnerCc.set(patch.ownerCallControlId, id);
  }
}
