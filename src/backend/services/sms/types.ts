import type { BookingView, Shop } from '@/src/backend/domain/types';

export type SmsCategory =
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'missed_call'
  | 'booking_link'
  | 'cancellation_alert'
  | 'user_alert'
  | 'review_request'
  | 'booking_request_alert';

export interface SmsSendResult {
  providerMessageId?: string;
}

export interface SmsService {
  sendSms(params: {
    to: string;
    from: string;
    body: string;
    shopId: string;
    countryCode?: string;
    category: SmsCategory;
    bookingId?: string;
    idempotencyKey: string;
  }): Promise<SmsSendResult>;
}

export const SMS_REMINDER_24H = (shop: Shop, booking: BookingView) =>
  `${shop.name}: Reminder: You have ${booking.service} tomorrow at ${booking.localTimeLabel}. ` +
  'Reply C to confirm or call/text us to reschedule.' +
  '\nReply STOP to opt out.';

export const SMS_REMINDER_2H = (shop: Shop, booking: BookingView) =>
  `${shop.name}: Reminder: Your appointment is in 2 hours at ${booking.localTimeLabel}.` +
  '\nReply STOP to opt out.';

export const SMS_MISSED_CALL = (shop: Shop) =>
  `${shop.name}: We missed your call. Reply YES and we will call you back, ` +
  `or visit ${shop.booking_url ?? 'our booking page'} to book. ` +
  'Reply STOP to opt out of automated texts.';

