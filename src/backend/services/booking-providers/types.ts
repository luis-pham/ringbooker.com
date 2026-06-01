import type { AvailabilityCheckResult, BookingInput, BookingResult, Shop } from '@/src/backend/domain/types';

export interface BookingProvider {
  shop: Shop;
  prefetchAvailability?(params: { date: string; timezone: string }): Promise<void>;
  checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    teamMemberId?: string;
    timezone: string;
    matchedServiceId?: string | null;
  }): Promise<AvailabilityCheckResult>;
  getTeamMembers?(): Promise<Array<{ id: string; displayName: string; givenName?: string; familyName?: string }>>;
  findTeamMemberByName?(name: string): Promise<string | null>;
  createBooking(input: BookingInput): Promise<BookingResult>;
  cancelBooking(params: {
    bookingId: string;
    reason?: string;
    idempotencyKey: string;
  }): Promise<void>;
  rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult>;
}
