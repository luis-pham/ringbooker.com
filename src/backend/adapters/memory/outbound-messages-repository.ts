import { randomUUID } from 'node:crypto';

import type {
  AdminOutboundMessagesFilters,
  AdminOutboundMessagesListResult,
  OutboundDeliveryStatusUpdateInput,
  OutboundDeliveryStatusUpdateResult,
  OutboundMessageCreateQueuedInput,
  OutboundMessageRecord,
  OutboundMessagesRepository,
} from '@/src/backend/ports/repositories';
import { buildOutboundDeliveryStatusMutation } from '@/src/backend/services/sms/outbound-delivery-status';

function nowIso(): string {
  return new Date().toISOString();
}

function clone(record: OutboundMessageRecord): OutboundMessageRecord {
  return {
    ...record,
    mediaUrls: [...(record.mediaUrls ?? [])],
  };
}

function matchesSearch(record: OutboundMessageRecord, q: string): boolean {
  const haystack = [
    record.fromNumber,
    record.toNumber,
    record.customerPhone,
    record.body,
    record.providerMessageId,
    record.telnyxMessageId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

export class InMemoryOutboundMessagesRepository implements OutboundMessagesRepository {
  private readonly idempotencyKeys = new Set<string>();
  private readonly messages: OutboundMessageRecord[] = [];

  async create(params: {
    shopId: string;
    bookingId?: string;
    customerPhone: string;
    category: string;
    body: string;
    idempotencyKey: string;
    status: 'queued' | 'sent' | 'failed';
    providerMessageId?: string;
  }): Promise<void> {
    if (this.idempotencyKeys.has(params.idempotencyKey)) return;
    this.idempotencyKeys.add(params.idempotencyKey);
    const now = nowIso();
    this.messages.push({
      id: randomUUID(),
      shopId: params.shopId,
      bookingId: params.bookingId ?? null,
      customerPhone: params.customerPhone,
      category: params.category,
      messageType: params.category,
      toNumber: params.customerPhone,
      mediaUrls: [],
      body: params.body,
      status: params.status,
      provider: 'telnyx',
      providerMessageId: params.providerMessageId ?? null,
      telnyxMessageId: params.providerMessageId ?? null,
      attempts: 0,
      idempotencyKey: params.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  }

  async createQueued(input: OutboundMessageCreateQueuedInput): Promise<OutboundMessageRecord> {
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = this.messages.find((message) => message.idempotencyKey === idempotencyKey);
      if (existing) return clone(existing);
      this.idempotencyKeys.add(idempotencyKey);
    }

    const now = nowIso();
    const record: OutboundMessageRecord = {
      id: randomUUID(),
      shopId: input.shopId,
      locationId: input.locationId ?? null,
      customerId: input.customerId ?? null,
      bookingId: input.bookingId ?? null,
      callId: input.callId ?? null,
      jobId: input.jobId ?? null,
      customerPhone: input.customerPhone ?? input.toNumber,
      category: input.messageType,
      messageType: input.messageType,
      fromNumber: input.fromNumber ?? null,
      toNumber: input.toNumber,
      mediaUrls: input.mediaUrls ?? [],
      body: input.body,
      status: 'queued',
      provider: input.provider ?? 'telnyx',
      providerRequest: input.providerRequest ?? null,
      attempts: 0,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.messages.push(record);
    return clone(record);
  }

  async markSending(id: string): Promise<OutboundMessageRecord | null> {
    const message = this.messages.find((record) => record.id === id);
    if (!message) return null;
    const now = nowIso();
    message.status = 'sending';
    message.attempts = (message.attempts ?? 0) + 1;
    message.lastAttemptAt = now;
    message.updatedAt = now;
    return clone(message);
  }

  async markSubmitted(
    id: string,
    input: {
      telnyxMessageId?: string | null;
      providerResponse?: unknown | null;
      submittedAt?: Date;
    },
  ): Promise<OutboundMessageRecord | null> {
    const message = this.messages.find((record) => record.id === id);
    if (!message) return null;
    const now = nowIso();
    message.status = 'submitted';
    message.providerMessageId = input.telnyxMessageId ?? null;
    message.telnyxMessageId = input.telnyxMessageId ?? null;
    message.providerResponse = input.providerResponse ?? null;
    message.submittedAt = (input.submittedAt ?? new Date()).toISOString();
    message.errorCode = null;
    message.errorMessage = null;
    message.failedAt = null;
    message.updatedAt = now;
    return clone(message);
  }

  async markSendFailed(
    id: string,
    input: {
      errorCode: string;
      errorMessage?: string | null;
      providerResponse?: unknown | null;
      failedAt?: Date;
    },
  ): Promise<OutboundMessageRecord | null> {
    const message = this.messages.find((record) => record.id === id);
    if (!message) return null;
    const now = nowIso();
    message.status = 'send_failed';
    message.errorCode = input.errorCode;
    message.errorMessage = input.errorMessage ?? null;
    message.providerResponse = input.providerResponse ?? null;
    message.failedAt = (input.failedAt ?? new Date()).toISOString();
    message.updatedAt = now;
    return clone(message);
  }

  async markDeliveryStatus(input: OutboundDeliveryStatusUpdateInput): Promise<OutboundDeliveryStatusUpdateResult> {
    const message = this.messages.find((record) => record.telnyxMessageId === input.telnyxMessageId);
    if (!message) return { result: 'not_found' };

    const mutation = buildOutboundDeliveryStatusMutation({
      currentStatus: message.status,
      eventType: input.eventType,
      telnyxStatus: input.telnyxStatus,
      occurredAt: input.occurredAt,
      completedAt: input.completedAt,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    });
    message.telnyxEventId = input.telnyxEventId;
    message.providerStatusPayload = input.providerStatusPayload ?? null;
    message.updatedAt = nowIso();

    if (mutation.kind === 'status') {
      message.status = mutation.status;
      if (mutation.submittedAt && !message.submittedAt) message.submittedAt = mutation.submittedAt.toISOString();
      if (mutation.deliveredAt !== undefined) message.deliveredAt = mutation.deliveredAt ? mutation.deliveredAt.toISOString() : null;
      if (mutation.failedAt !== undefined) message.failedAt = mutation.failedAt ? mutation.failedAt.toISOString() : null;
      if (mutation.errorCode !== undefined) message.errorCode = mutation.errorCode;
      if (mutation.errorMessage !== undefined) message.errorMessage = mutation.errorMessage;
    }

    return {
      result: mutation.kind === 'ignored_downgrade' ? 'ignored_downgrade' : 'updated',
      message: clone(message),
    };
  }

  async listAdminOutboundMessages(filters: AdminOutboundMessagesFilters): Promise<AdminOutboundMessagesListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    let items = [...this.messages];
    if (filters.shopId) items = items.filter((message) => message.shopId === filters.shopId);
    if (filters.fromNumber) items = items.filter((message) => message.fromNumber === filters.fromNumber);
    if (filters.toNumber) items = items.filter((message) => message.toNumber === filters.toNumber);
    if (filters.status) items = items.filter((message) => message.status === filters.status);
    if (filters.messageType) items = items.filter((message) => message.messageType === filters.messageType);
    if (filters.dateFrom) items = items.filter((message) => new Date(message.createdAt ?? 0) >= filters.dateFrom!);
    if (filters.dateTo) items = items.filter((message) => new Date(message.createdAt ?? 0) <= filters.dateTo!);
    if (filters.q?.trim()) items = items.filter((message) => matchesSearch(message, filters.q!.trim()));
    items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const total = items.length;
    const offset = (page - 1) * limit;
    return {
      items: items.slice(offset, offset + limit).map(clone),
      total,
    };
  }

  async getAdminOutboundMessageById(id: string): Promise<OutboundMessageRecord | null> {
    const message = this.messages.find((record) => record.id === id);
    return message ? clone(message) : null;
  }

  async listMissedCallSmsSentPhones(shopId: string, phones: string[]): Promise<Set<string>> {
    const phoneSet = new Set(phones);
    const sent = this.messages
      .filter((m) => m.shopId === shopId && m.category === 'missed_call' && phoneSet.has(m.customerPhone))
      .map((m) => m.customerPhone);
    return new Set(sent);
  }

  async listByBookingId(bookingId: string): Promise<OutboundMessageRecord[]> {
    return this.messages
      .filter((message) => message.bookingId === bookingId)
      .sort((a, b) => ((a.createdAt ?? '') > (b.createdAt ?? '') ? 1 : -1))
      .map(clone);
  }

  async countRecentByPhone(params: { shopId: string; customerPhone: string; since: Date }): Promise<number> {
    return this.messages.filter(
      (m) => m.shopId === params.shopId && m.customerPhone === params.customerPhone && (m.createdAt ?? '') >= params.since.toISOString(),
    ).length;
  }
}
