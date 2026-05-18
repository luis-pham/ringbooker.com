import type { Shop } from '@/src/backend/domain/types';
import { canUseReminderSms, canUseReviewRequestSms } from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import type { BookingRecord, JobsRepository } from '@/src/backend/ports/repositories';

export type BookingReminderSource = 'ai' | 'full_sync' | 'booking_link' | string;

export function canScheduleReminder(booking: {
  status: string;
  bookingAt: Date | null | undefined;
  source: BookingReminderSource;
}): boolean {
  if (booking.status !== 'confirmed') return false;
  if (!booking.bookingAt) return false;
  if (booking.source === 'booking_link') return false;
  const bookingTime = booking.bookingAt.getTime();
  if (!Number.isFinite(bookingTime)) return false;
  if (bookingTime <= Date.now()) return false;
  return true;
}

export function bookingDateFromRecord(booking: Pick<BookingRecord, 'datetimeUtc'>): Date | null {
  const bookingAt = new Date(booking.datetimeUtc);
  return Number.isFinite(bookingAt.getTime()) ? bookingAt : null;
}

export function reminderSourceFromBooking(booking: Pick<BookingRecord, 'provider' | 'status'>): BookingReminderSource {
  if (booking.provider === 'booking_link' || booking.status === 'link_sent') return 'booking_link';
  return 'full_sync';
}

export async function scheduleBookingFollowupJobs(params: {
  jobsRepository: JobsRepository;
  shop: Shop;
  booking: BookingRecord;
  source: BookingReminderSource;
}): Promise<void> {
  const bookingAt = bookingDateFromRecord(params.booking);
  if (!canScheduleReminder({ status: params.booking.status, bookingAt, source: params.source })) {
    logger.info(
      {
        booking_id: params.booking.id,
        shop_id: params.shop.id,
        status: params.booking.status,
        source: params.source,
        hasBookingAt: Boolean(bookingAt),
      },
      'booking_reminder_scheduling_skipped_not_eligible',
    );
    return;
  }
  if (!bookingAt) return;

  const canEnqueueReminderSms = canUseReminderSms(params.shop.plan);
  const canEnqueueReviewRequestSms = canUseReviewRequestSms(params.shop.plan);
  const bookingTime = bookingAt.getTime();
  const reminder24hAt = new Date(bookingTime - 24 * 60 * 60 * 1000);
  const reminder2hAt = new Date(bookingTime - 2 * 60 * 60 * 1000);
  const reviewAt = new Date(bookingTime + 4 * 60 * 60 * 1000);

  if (params.shop.send_reminder_sms && !canEnqueueReminderSms) {
    logger.warn(
      { shopId: params.shop.id, plan: params.shop.plan, feature: 'reminder_sms' },
      'plan_feature_locked_booking_job_enqueue_skipped',
    );
  }

  if (params.shop.send_reminder_sms && canEnqueueReminderSms && reminder24hAt.getTime() > Date.now()) {
    await params.jobsRepository.enqueue({
      shopId: params.shop.id,
      type: 'appointment_reminder_24h',
      payload: { bookingId: params.booking.id },
      runAt: reminder24hAt,
      idempotencyKey: `booking:${params.booking.id}:reminder24h`,
    });
  }

  if (params.shop.send_reminder_sms && canEnqueueReminderSms && reminder2hAt.getTime() > Date.now()) {
    await params.jobsRepository.enqueue({
      shopId: params.shop.id,
      type: 'appointment_reminder_2h',
      payload: { bookingId: params.booking.id },
      runAt: reminder2hAt,
      idempotencyKey: `booking:${params.booking.id}:reminder2h`,
    });
  }

  if (params.shop.send_review_request_sms && !canEnqueueReviewRequestSms) {
    logger.warn(
      { shopId: params.shop.id, plan: params.shop.plan, feature: 'review_request_sms' },
      'plan_feature_locked_booking_job_enqueue_skipped',
    );
  }

  if (params.shop.send_review_request_sms && canEnqueueReviewRequestSms) {
    await params.jobsRepository.enqueue({
      shopId: params.shop.id,
      type: 'review_request_sms',
      payload: { bookingId: params.booking.id },
      runAt: reviewAt,
      idempotencyKey: `booking:${params.booking.id}:review`,
    });
  }
}
