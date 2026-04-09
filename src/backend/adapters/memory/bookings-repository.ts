import type { BookingRecord, BookingsRepository } from '@/src/backend/ports/repositories';
import { randomUUID } from 'node:crypto';

export class InMemoryBookingsRepository implements BookingsRepository {
  private readonly bookings = new Map<string, BookingRecord>();

  async findById(bookingId: string): Promise<BookingRecord | null> {
    return this.bookings.get(bookingId) ?? null;
  }

  async listByShop(shopId: string, params?: { limit?: number }): Promise<BookingRecord[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    return [...this.bookings.values()]
      .filter((booking) => booking.shopId === shopId)
      .sort((a, b) => (b.datetimeUtc > a.datetimeUtc ? 1 : -1))
      .slice(0, limit);
  }

  async create(params: {
    id?: string;
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    service: string;
    datetimeUtc: string;
    timezone: string;
    status: string;
    calendarEventId?: string;
  }): Promise<BookingRecord> {
    const id = params.id ?? randomUUID();
    const now = new Date().toISOString();
    const booking: BookingRecord = {
      id,
      shopId: params.shopId,
      customerPhone: params.customerPhone,
      customerName: params.customerName ?? null,
      service: params.service,
      datetimeUtc: params.datetimeUtc,
      timezone: params.timezone,
      status: params.status,
      reminder24hSent: false,
      reminder2hSent: false,
      reviewRequestSent: false,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async markReminderSent(bookingId: string, kind: '24h' | '2h'): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) return;
    if (kind === '24h') booking.reminder24hSent = true;
    if (kind === '2h') booking.reminder2hSent = true;
    booking.updatedAt = new Date().toISOString();
  }

  async markReviewRequestSent(bookingId: string): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) return;
    booking.reviewRequestSent = true;
    booking.updatedAt = new Date().toISOString();
  }
}
