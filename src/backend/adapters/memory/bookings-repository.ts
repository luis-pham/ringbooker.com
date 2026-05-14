import type { BookingRecord, BookingsRepository } from '@/src/backend/ports/repositories';
import { randomUUID } from 'node:crypto';

export class InMemoryBookingsRepository implements BookingsRepository {
  private readonly bookings = new Map<string, BookingRecord>();

  async findById(bookingId: string): Promise<BookingRecord | null> {
    return this.bookings.get(bookingId) ?? null;
  }

  private matches(
    booking: BookingRecord,
    shopId: string,
    params?: { createdAfter?: Date; createdBefore?: Date; statuses?: string[]; callLogId?: string },
  ): boolean {
    if (booking.shopId !== shopId) return false;
    if (params?.statuses?.length && !params.statuses.includes(normalizeBookingStatus(booking.status))) return false;
    if (params?.callLogId && booking.callLogId !== params.callLogId) return false;
    const created = booking.createdAt ? new Date(booking.createdAt) : null;
    if (params?.createdAfter && (!created || created < params.createdAfter)) return false;
    if (params?.createdBefore && (!created || created > params.createdBefore)) return false;
    return true;
  }

  async countByShop(
    shopId: string,
    params?: { createdAfter?: Date; createdBefore?: Date; statuses?: string[]; callLogId?: string },
  ): Promise<number> {
    return [...this.bookings.values()].filter((booking) => this.matches(booking, shopId, params)).length;
  }

  async listByShop(
    shopId: string,
    params?: { limit?: number; offset?: number; createdAfter?: Date; createdBefore?: Date; statuses?: string[]; callLogId?: string },
  ): Promise<BookingRecord[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    return [...this.bookings.values()]
      .filter((booking) => this.matches(booking, shopId, params))
      .sort((a, b) => ((b.createdAt ?? b.datetimeUtc) > (a.createdAt ?? a.datetimeUtc) ? 1 : -1))
      .slice(offset, offset + limit);
  }

  async create(params: {
    id?: string;
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    service: string;
    matchedServiceId?: string | null;
    matchedServiceConfidence?: number | null;
    datetimeUtc: string;
    timezone: string;
    status: string;
    calendarEventId?: string;
    provider?: string | null;
    providerStatus?: string | null;
    providerErrorReason?: string | null;
    callLogId?: string | null;
    techName?: string | null;
    durationMinutes?: number | null;
  }): Promise<BookingRecord> {
    const id = params.id ?? randomUUID();
    const now = new Date().toISOString();
    const booking: BookingRecord = {
      id,
      shopId: params.shopId,
      customerPhone: params.customerPhone,
      customerName: params.customerName ?? null,
      service: params.service,
      techName: params.techName ?? null,
      matchedServiceId: params.matchedServiceId ?? null,
      matchedServiceConfidence: params.matchedServiceConfidence ?? null,
      datetimeUtc: params.datetimeUtc,
      timezone: params.timezone,
      durationMinutes: params.durationMinutes ?? null,
      status: params.status,
      confirmed: normalizeBookingStatus(params.status) === 'confirmed',
      calendarEventId: params.calendarEventId ?? null,
      provider: params.provider ?? null,
      providerStatus: params.providerStatus ?? null,
      providerErrorReason: params.providerErrorReason ?? null,
      callLogId: params.callLogId ?? null,
      reminder24hSent: false,
      reminder2hSent: false,
      reviewRequestSent: false,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async updateStatusByShop(shopId: string, bookingId: string, status: string): Promise<BookingRecord | null> {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.shopId !== shopId) return null;
    booking.status = status;
    booking.confirmed = normalizeBookingStatus(status) === 'confirmed';
    booking.updatedAt = new Date().toISOString();
    return booking;
  }

  async updateDatetime(bookingId: string, newDatetimeUtc: Date): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) return;
    booking.datetimeUtc = newDatetimeUtc.toISOString();
    booking.updatedAt = new Date().toISOString();
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

function normalizeBookingStatus(status: string): string {
  if (status === 'pending') return 'captured';
  if (status === 'no_show') return 'cancelled';
  return status;
}
