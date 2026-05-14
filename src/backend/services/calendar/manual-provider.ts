import type { BookingInput, BookingResult, Shop } from '@/src/backend/domain/types';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

export class ManualCalendarProvider implements CalendarProvider {
  readonly shop: Shop;

  constructor(shop: Shop) {
    this.shop = shop;
  }

  async prefetchAvailability(): Promise<void> {}

  async checkAvailability(): Promise<{ available: boolean }> {
    return { available: true };
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    return {
      bookingId: `manual-${input.idempotencyKey}`,
      // No calendar integration — request is captured in RingBooker only.
      // The owner must confirm via notification. Do NOT set confirmed: true here.
      confirmed: false,
    };
  }

  async cancelBooking(_params: {
    bookingId: string;
    reason?: string;
    idempotencyKey: string;
  }): Promise<void> {}

  async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    return {
      bookingId: params.bookingId,
      confirmed: true,
    };
  }
}
