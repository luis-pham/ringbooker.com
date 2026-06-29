import { randomUUID } from 'node:crypto';

import type {
  SmsMessageListItem,
  SmsMessageRecord,
  SmsMessagesListFilters,
  SmsMessagesRepository,
} from '@/src/backend/ports/repositories';

function toIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function toPreview(body: string | null | undefined): string | null {
  const text = body?.trim() ?? '';
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function toListItem(record: SmsMessageRecord): SmsMessageListItem {
  const { body, rawPayload: _rawPayload, ...rest } = record;
  return {
    ...rest,
    bodyPreview: toPreview(body),
  };
}

export class InMemorySmsMessagesRepository implements SmsMessagesRepository {
  private readonly messages: SmsMessageRecord[] = [];

  async saveInboundFromTelnyxEvent(params: {
    shopId?: string | null;
    locationId?: string | null;
    telnyxMessageId?: string | null;
    telnyxEventId: string;
    fromNumber: string;
    toNumber: string;
    body?: string | null;
    mediaUrls?: string[];
    eventType: string;
    rawPayload: unknown;
    receivedAt?: Date | string | null;
  }): Promise<{ record: SmsMessageRecord; created: boolean }> {
    const existing = this.messages.find(
      (message) =>
        message.telnyxEventId === params.telnyxEventId ||
        (params.telnyxMessageId ? message.telnyxMessageId === params.telnyxMessageId : false),
    );
    if (existing) return { record: existing, created: false };

    const now = new Date().toISOString();
    const record: SmsMessageRecord = {
      id: randomUUID(),
      shopId: params.shopId ?? null,
      locationId: params.locationId ?? null,
      telnyxMessageId: params.telnyxMessageId ?? null,
      telnyxEventId: params.telnyxEventId,
      direction: 'inbound',
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      body: params.body ?? null,
      mediaUrls: params.mediaUrls ?? [],
      provider: 'telnyx',
      eventType: params.eventType,
      rawPayload: params.rawPayload,
      receivedAt: toIso(params.receivedAt),
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.messages.push(record);
    return { record, created: true };
  }

  async listAdminSmsMessages(filters: SmsMessagesListFilters): Promise<{ items: SmsMessageListItem[]; total: number }> {
    if (filters.allowedToNumbers.length === 0) return { items: [], total: 0 };
    const allowed = new Set(filters.allowedToNumbers);
    const toNumber = filters.toNumber?.trim() || null;
    const q = filters.q?.trim().toLowerCase() || null;
    const dateFrom = filters.dateFrom?.toISOString() ?? null;
    const dateTo = filters.dateTo?.toISOString() ?? null;
    const read = filters.read ?? 'all';

    const rows = this.messages
      .filter((message) => allowed.has(message.toNumber))
      .filter((message) => (!toNumber ? true : message.toNumber === toNumber))
      .filter((message) => {
        if (read === 'read') return Boolean(message.readAt);
        if (read === 'unread') return !message.readAt;
        return true;
      })
      .filter((message) => (!dateFrom ? true : message.receivedAt >= dateFrom))
      .filter((message) => (!dateTo ? true : message.receivedAt <= dateTo))
      .filter((message) => {
        if (!q) return true;
        return [message.fromNumber, message.toNumber, message.body ?? ''].some((value) =>
          value.toLowerCase().includes(q),
        );
      })
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    const offset = (filters.page - 1) * filters.limit;
    return {
      items: rows.slice(offset, offset + filters.limit).map(toListItem),
      total: rows.length,
    };
  }

  async getAdminSmsMessageById(id: string, allowedToNumbers: string[]): Promise<SmsMessageRecord | null> {
    if (allowedToNumbers.length === 0) return null;
    const allowed = new Set(allowedToNumbers);
    return this.messages.find((message) => message.id === id && allowed.has(message.toNumber)) ?? null;
  }

  async markSmsMessageRead(id: string, allowedToNumbers: string[]): Promise<SmsMessageRecord | null> {
    const message = await this.getAdminSmsMessageById(id, allowedToNumbers);
    if (!message) return null;
    if (!message.readAt) {
      const now = new Date().toISOString();
      message.readAt = now;
      message.updatedAt = now;
    }
    return message;
  }
}
