import { randomUUID } from 'node:crypto';

import type { ContactRequest, ContactRequestStatus } from '@/src/backend/domain/types';
import type { ContactRequestsRepository } from '@/src/backend/ports/repositories';

function normalizeLimit(limit?: number): number {
  if (!limit || limit <= 0) return 100;
  return Math.min(limit, 500);
}

function normalizeQuery(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesQuery(record: ContactRequest, query?: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;
  return [
    record.requestId,
    record.fullName,
    record.businessName,
    record.email,
    record.phoneNumber,
    record.businessType,
    record.currentSetup,
    record.helpNeed,
    record.bestTime,
    record.status,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function sortByCreatedAtDesc(records: ContactRequest[]): ContactRequest[] {
  return [...records].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export class InMemoryContactRequestsRepository implements ContactRequestsRepository {
  private readonly records = new Map<string, ContactRequest>();

  async create(params: {
    requestId: string;
    fullName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    businessType: string;
    currentSetup: string;
    helpNeed: string;
    bestTime: string;
    source?: string;
    ip?: string | null;
  }): Promise<ContactRequest> {
    const now = new Date().toISOString();
    const created: ContactRequest = {
      id: randomUUID(),
      requestId: params.requestId,
      fullName: params.fullName,
      businessName: params.businessName,
      email: params.email,
      phoneNumber: params.phoneNumber,
      businessType: params.businessType,
      currentSetup: params.currentSetup,
      helpNeed: params.helpNeed,
      bestTime: params.bestTime,
      status: 'new',
      source: params.source ?? 'marketing_contact_form',
      ip: params.ip ?? null,
      notes: null,
      handledBy: null,
      handledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(created.id, created);
    return created;
  }

  async listForAdmin(params?: {
    limit?: number;
    status?: ContactRequestStatus | 'all';
    query?: string;
  }): Promise<ContactRequest[]> {
    const limit = normalizeLimit(params?.limit);
    const status = params?.status ?? 'all';
    return sortByCreatedAtDesc(
      [...this.records.values()].filter((record) => {
        if (status !== 'all' && record.status !== status) return false;
        return matchesQuery(record, params?.query);
      }),
    ).slice(0, limit);
  }

  async updateStatus(
    id: string,
    params: {
      status: ContactRequestStatus;
      notes?: string | null;
      handledBy?: string | null;
    },
  ): Promise<ContactRequest | null> {
    const current = this.records.get(id);
    if (!current) return null;
    const now = new Date().toISOString();
    const touchedStatus = current.status !== params.status;
    const next: ContactRequest = {
      ...current,
      status: params.status,
      notes: params.notes !== undefined ? params.notes : current.notes ?? null,
      handledBy: params.handledBy !== undefined ? params.handledBy : current.handledBy ?? null,
      handledAt: touchedStatus ? now : current.handledAt ?? null,
      updatedAt: now,
    };
    this.records.set(id, next);
    return next;
  }
}
