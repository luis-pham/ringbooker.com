import { randomUUID } from 'node:crypto';

import type { VoiceCallLegPurpose, VoiceCallLegRecord } from '@/src/backend/domain/voice-call-leg';
import type { VoiceCallLegsRepository } from '@/src/backend/ports/repositories';

function keyShopRbPurpose(shopId: string, rbCallId: string, purpose: VoiceCallLegPurpose): string {
  return `${shopId}:${rbCallId}:${purpose}`;
}

function isOpenAiLegActive(status: string): boolean {
  return status !== 'openai_leg_ended' && Boolean(status);
}

export class InMemoryVoiceCallLegsRepository implements VoiceCallLegsRepository {
  private readonly byId = new Map<string, VoiceCallLegRecord>();
  private readonly byShopRbPurpose = new Map<string, string>();
  private readonly byCallControlId = new Map<string, string>();

  private rememberCallControl(cc: string | null | undefined, id: string): void {
    if (!cc) return;
    this.byCallControlId.set(cc, id);
  }

  private forgetCallControlIfMatches(cc: string | null | undefined, id: string): void {
    if (!cc) return;
    if (this.byCallControlId.get(cc) === id) this.byCallControlId.delete(cc);
  }

  async createOrUpdateCallLeg(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    callControlId?: string | null;
    callSessionId?: string | null;
    callLegId?: string | null;
    parentCallControlId?: string | null;
    parentCallSessionId?: string | null;
    status: string;
    clientState?: unknown | null;
    metadata?: unknown | null;
  }): Promise<VoiceCallLegRecord> {
    const k = keyShopRbPurpose(params.shopId, params.rbCallId, params.purpose);
    const existingId = this.byShopRbPurpose.get(k);
    const now = new Date();
    if (existingId) {
      const prev = this.byId.get(existingId);
      if (prev) {
        this.forgetCallControlIfMatches(prev.callControlId, existingId);
        const next: VoiceCallLegRecord = {
          ...prev,
          callControlId: params.callControlId !== undefined ? params.callControlId : prev.callControlId,
          callSessionId: params.callSessionId !== undefined ? params.callSessionId : prev.callSessionId,
          callLegId: params.callLegId !== undefined ? params.callLegId : prev.callLegId,
          parentCallControlId:
            params.parentCallControlId !== undefined ? params.parentCallControlId : prev.parentCallControlId,
          parentCallSessionId:
            params.parentCallSessionId !== undefined ? params.parentCallSessionId : prev.parentCallSessionId,
          status: params.status,
          clientState: params.clientState !== undefined ? params.clientState : prev.clientState,
          metadata: params.metadata !== undefined ? params.metadata : prev.metadata,
          updatedAt: now,
        };
        this.byId.set(existingId, next);
        this.rememberCallControl(next.callControlId, existingId);
        return next;
      }
    }

    const id = randomUUID();
    const row: VoiceCallLegRecord = {
      id,
      rbCallId: params.rbCallId,
      shopId: params.shopId,
      purpose: params.purpose,
      callControlId: params.callControlId ?? null,
      callSessionId: params.callSessionId ?? null,
      callLegId: params.callLegId ?? null,
      parentCallControlId: params.parentCallControlId ?? null,
      parentCallSessionId: params.parentCallSessionId ?? null,
      status: params.status,
      provider: 'telnyx_call_control',
      clientState: params.clientState ?? null,
      metadata: params.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(id, row);
    this.byShopRbPurpose.set(k, id);
    this.rememberCallControl(row.callControlId, id);
    return row;
  }

  async findCallLegByCallControlId(callControlId: string): Promise<VoiceCallLegRecord | null> {
    const id = this.byCallControlId.get(callControlId);
    if (!id) return null;
    const r = this.byId.get(id);
    return r ?? null;
  }

  async findOpenAiLegByRbCallId(shopId: string, rbCallId: string): Promise<VoiceCallLegRecord | null> {
    const id = this.byShopRbPurpose.get(keyShopRbPurpose(shopId, rbCallId, 'openai_sip_leg'));
    const r = id ? this.byId.get(id) : null;
    return r ?? null;
  }

  async findOpenAiLegByParentCallControlId(parentCallControlId: string): Promise<VoiceCallLegRecord | null> {
    let best: VoiceCallLegRecord | null = null;
    for (const r of this.byId.values()) {
      if (r.purpose !== 'openai_sip_leg' || r.parentCallControlId !== parentCallControlId) continue;
      if (!best || r.updatedAt.getTime() > best.updatedAt.getTime()) best = r;
    }
    return best;
  }

  async findActiveOpenAiLegCallControlIdByRbCallId(shopId: string, rbCallId: string): Promise<string | null> {
    const r = await this.findOpenAiLegByRbCallId(shopId, rbCallId);
    if (!r?.callControlId || !isOpenAiLegActive(r.status)) return null;
    return r.callControlId;
  }

  async findActiveOpenAiLegCallControlIdByParent(parentCallControlId: string): Promise<string | null> {
    const r = await this.findOpenAiLegByParentCallControlId(parentCallControlId);
    if (!r?.callControlId || !isOpenAiLegActive(r.status)) return null;
    return r.callControlId;
  }

  async markCallLegStatus(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    status: string;
    callControlId?: string | null;
    callSessionId?: string | null;
  }): Promise<void> {
    const id = this.byShopRbPurpose.get(keyShopRbPurpose(params.shopId, params.rbCallId, params.purpose));
    if (!id) return;
    const prev = this.byId.get(id);
    if (!prev) return;
    this.forgetCallControlIfMatches(prev.callControlId, id);
    const next: VoiceCallLegRecord = {
      ...prev,
      status: params.status,
      callControlId: params.callControlId !== undefined ? params.callControlId : prev.callControlId,
      callSessionId: params.callSessionId !== undefined ? params.callSessionId : prev.callSessionId,
      updatedAt: new Date(),
    };
    this.byId.set(id, next);
    this.rememberCallControl(next.callControlId, id);
  }

  async markCallLegEnded(callControlId: string, purpose?: VoiceCallLegPurpose): Promise<void> {
    const id = this.byCallControlId.get(callControlId);
    if (!id) return;
    const prev = this.byId.get(id);
    if (!prev) return;
    if (purpose && prev.purpose !== purpose) return;
    this.forgetCallControlIfMatches(prev.callControlId, id);
    const terminal =
      prev.purpose === 'openai_sip_leg'
        ? 'openai_leg_ended'
        : prev.purpose === 'parent_caller_leg'
          ? 'parent_leg_ended'
          : 'owner_leg_ended';
    const next: VoiceCallLegRecord = {
      ...prev,
      status: terminal,
      updatedAt: new Date(),
    };
    this.byId.set(id, next);
  }
}
