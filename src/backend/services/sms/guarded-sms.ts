import type { Shop } from '@/src/backend/domain/types';
import { canUseReminderSms, canUseReviewRequestSms } from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import type { CustomersRepository, OutboundMessagesRepository } from '@/src/backend/ports/repositories';
import { sendSms } from '@/src/backend/services/sms/sms-sender';
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

  const result = await sendSms(params.smsService, {
    to,
    body: params.body,
    shop,
    category,
    bookingId: params.bookingId,
    idempotencyKey: params.idempotencyKey,
  });
  if (!result.sent) return logBlocked({ shopId: shop.id, category, reason: result.reason ?? 'sms_guard_blocked' });

  logger.info({ shop_id: shop.id, category, audience: params.audience }, 'sms_guard_sent');
  return { sent: true, sms: result.sms };
}

function logBlocked(params: { shopId: string; category: SmsCategory; reason: string }): { sent: false; reason: string } {
  logger.info(
    { shop_id: params.shopId, category: params.category, reason: params.reason },
    'sms_guard_blocked',
  );
  return { sent: false, reason: params.reason };
}
