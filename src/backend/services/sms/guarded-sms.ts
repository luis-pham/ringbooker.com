import type { Shop } from '@/src/backend/domain/types';
import { canUseReminderSms, canUseReviewRequestSms } from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import type { CustomersRepository, OutboundMessagesRepository } from '@/src/backend/ports/repositories';
import { resolveSmsFromNumber, sendSms } from '@/src/backend/services/sms/sms-sender';
import type { SmsCategory, SmsSendResult, SmsService } from '@/src/backend/services/sms/types';

const PHONE_FREQUENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
const PHONE_FREQUENCY_LIMIT = 5;

export type SmsAudience = 'customer' | 'owner';

export async function sendGuardedSms(params: {
  smsService: SmsService;
  customersRepository?: CustomersRepository;
  outboundMessagesRepository?: OutboundMessagesRepository;
  shop: Shop;
  to: string;
  body: string;
  category: SmsCategory;
  bookingId?: string;
  locationId?: string | null;
  customerId?: string | null;
  callId?: string | null;
  jobId?: string | null;
  messageType?: string;
  fromNumber?: string | null;
  locationTelnyxNumber?: string | null;
  allowGlobalFromFallback?: boolean;
  idempotencyKey: string;
  audience: SmsAudience;
  requiresCustomerOptIn?: boolean;
}): Promise<{ sent: true; sms: SmsSendResult } | { sent: false; reason: string }> {
  const { shop, category, to } = params;

  if (params.audience === 'owner' && !shop.sms_owner_opted_in) {
    return logBlocked({ shopId: shop.id, category, reason: 'owner_sms_not_opted_in' });
  }
  if (params.audience === 'customer' && params.customersRepository) {
    const optedOut = await params.customersRepository.isSmsOptedOut(shop.id, to);
    if (optedOut) return logBlocked({ shopId: shop.id, category, reason: 'customer_sms_opted_out' });
  }
  if (params.audience === 'customer' && params.requiresCustomerOptIn) {
    return logBlocked({ shopId: shop.id, category, reason: 'customer_sms_opt_in_required' });
  }
  if ((category === 'reminder_24h' || category === 'reminder_2h') && !canUseReminderSms(shop.plan)) {
    return logBlocked({ shopId: shop.id, category, reason: 'plan_reminder_sms_disabled' });
  }
  if (category === 'review_request' && !canUseReviewRequestSms(shop.plan)) {
    return logBlocked({ shopId: shop.id, category, reason: 'plan_review_request_sms_disabled' });
  }
  if (params.outboundMessagesRepository?.countRecentByPhone) {
    const since = new Date(Date.now() - PHONE_FREQUENCY_WINDOW_MS);
    const recentPhone = await params.outboundMessagesRepository.countRecentByPhone({ shopId: shop.id, customerPhone: to, since });
    if (recentPhone >= PHONE_FREQUENCY_LIMIT) {
      return logBlocked({ shopId: shop.id, category, reason: 'phone_frequency_cap' });
    }
  }

  const lifecycleRepository = params.outboundMessagesRepository;
  const messageType = params.messageType ?? category;
  const fromNumber = resolveSmsFromNumber({
    shop,
    countryCode: shop.country_code,
    fromNumber: params.fromNumber,
    locationTelnyxNumber: params.locationTelnyxNumber,
    allowGlobalFromFallback: params.allowGlobalFromFallback,
  });

  let outboundMessageId: string | null = null;
  if (
    lifecycleRepository?.createQueued &&
    lifecycleRepository.markSending &&
    lifecycleRepository.markSubmitted &&
    lifecycleRepository.markSendFailed
  ) {
    const record = await lifecycleRepository.createQueued({
      shopId: shop.id,
      locationId: params.locationId ?? null,
      customerId: params.customerId ?? null,
      bookingId: params.bookingId ?? null,
      callId: params.callId ?? null,
      jobId: params.jobId ?? null,
      messageType,
      fromNumber,
      toNumber: to,
      customerPhone: to,
      body: params.body,
      mediaUrls: [],
      idempotencyKey: params.idempotencyKey,
      provider: 'telnyx',
      providerRequest: {
        to,
        from: fromNumber,
        text: params.body,
      },
    });
    if ((record.status === 'submitted' || record.status === 'sent') && (record.telnyxMessageId || record.providerMessageId)) {
      return {
        sent: true,
        sms: {
          providerMessageId: record.telnyxMessageId ?? record.providerMessageId ?? undefined,
          fromNumber: record.fromNumber ?? undefined,
          toNumber: record.toNumber ?? record.customerPhone,
          raw: record.providerResponse ?? undefined,
        },
      };
    }
    outboundMessageId = record.id;
    await lifecycleRepository.markSending(record.id);
  }

  const result = await sendSms(params.smsService, {
    to,
    body: params.body,
    shop,
    fromNumber,
    allowGlobalFromFallback: params.allowGlobalFromFallback,
    category,
    bookingId: params.bookingId,
    idempotencyKey: params.idempotencyKey,
  }).catch(async (error: unknown) => {
    if (outboundMessageId && lifecycleRepository?.markSendFailed) {
      await lifecycleRepository.markSendFailed(outboundMessageId, {
        errorCode: errorCodeFromUnknown(error),
        errorMessage: error instanceof Error ? error.message : 'unknown_error',
      }).catch((markError: unknown) => {
        logger.warn({ err: markError, shop_id: shop.id, outbound_message_id: outboundMessageId }, 'sms_outbound_mark_failed_failed');
      });
    }
    throw error;
  });
  if (!result.sent) {
    if (outboundMessageId && lifecycleRepository?.markSendFailed) {
      await lifecycleRepository.markSendFailed(outboundMessageId, {
        errorCode: result.reason ?? 'blocked_by_guard',
        errorMessage: result.reason ?? 'sms_guard_blocked',
      }).catch((error: unknown) => {
        logger.warn({ err: error, shop_id: shop.id, outbound_message_id: outboundMessageId }, 'sms_outbound_mark_blocked_failed');
      });
    }
    return logBlocked({ shopId: shop.id, category, reason: result.reason ?? 'sms_guard_blocked' });
  }

  if (outboundMessageId && lifecycleRepository?.markSubmitted) {
    await lifecycleRepository.markSubmitted(outboundMessageId, {
      telnyxMessageId: result.sms.providerMessageId ?? null,
      providerResponse: result.sms.raw ?? null,
    });
  }

  logger.info(
    {
      shop_id: shop.id,
      category,
      audience: params.audience,
      outbound_message_id: outboundMessageId,
      telnyx_message_id: result.sms.providerMessageId,
    },
    'sms_guard_sent',
  );
  return { sent: true, sms: result.sms };
}

function errorCodeFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.startsWith('telnyx_sms_send_failed:')) return message;
    if (message === 'Missing SMS from number') return 'missing_from_number';
    return message.slice(0, 80) || 'sms_send_failed';
  }
  return 'sms_send_failed';
}

function logBlocked(params: { shopId: string; category: SmsCategory; reason: string }): { sent: false; reason: string } {
  logger.info(
    { shop_id: params.shopId, category: params.category, reason: params.reason },
    'sms_guard_blocked',
  );
  return { sent: false, reason: params.reason };
}
