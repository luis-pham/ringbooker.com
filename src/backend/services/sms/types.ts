import type { BookingView, Shop } from '@/src/backend/domain/types';

export type SmsCategory =
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'missed_call'
  | 'booking_link'
  | 'callback_ack'
  | 'user_alert'
  | 'review_request';

export interface SmsSendResult {
  providerMessageId?: string;
}

export interface SmsService {
  sendSms(params: {
    to: string;
    from: string;
    body: string;
    shopId: string;
    category: SmsCategory;
    bookingId?: string;
    idempotencyKey: string;
  }): Promise<SmsSendResult>;
}

export const SMS_BOOKING_CONFIRMED = (shop: Shop, booking: BookingView) =>
  `Confirmed at ${shop.name}: ${booking.service} on ${booking.localDateLabel}. ` +
  `Address: ${shop.address ?? 'not provided'}. Questions? Call or text this number.`;

export const SMS_REMINDER_24H = (shop: Shop, booking: BookingView) =>
  `Reminder: You have ${booking.service} tomorrow at ${booking.localTimeLabel} ` +
  `at ${shop.name}. Reply C to confirm or call/text us to reschedule.`;

export const SMS_REMINDER_2H = (shop: Shop, booking: BookingView) =>
  `Reminder: Your appointment at ${shop.name} is in 2 hours at ${booking.localTimeLabel}.`;

export const SMS_MISSED_CALL = (shop: Shop) =>
  `Hi! We missed your call at ${shop.name}. Reply YES and we will call you back, ` +
  `or visit ${shop.booking_url ?? 'our booking page'} to book.`;

export const SMS_CALLBACK_ACK = (shop: Shop) => `Thanks! Someone from ${shop.name} will call you back shortly.`;

export const SMS_USER_NEW_BOOKING = (booking: BookingView) =>
  `New booking: ${booking.service} on ${booking.localDateLabel} at ${booking.localTimeLabel} - ${booking.customerPhone ?? 'unknown'}`;
