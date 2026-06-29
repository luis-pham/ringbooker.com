import { findCarrier, getForwardingCode, type ForwardingType } from '@/lib/call-forwarding/carrier-data';
import type { BillingNotificationType, BillingSubscription, Shop } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type {
  BillingCustomersRepository,
  BillingNotificationsRepository,
  BillingSubscriptionsRepository,
  OutboundMessagesRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import { escapeHtmlText } from '@/src/backend/services/email/base-email-escape';
import type { BaseEmailInput } from '@/src/backend/services/email/base-email-types';
import { emailFounderFrom, emailReplyTo } from '@/src/backend/services/email/config';
import type { EmailService } from '@/src/backend/services/email/types';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { sendGuardedSms } from '@/src/backend/services/sms/guarded-sms';
import type { SmsService } from '@/src/backend/services/sms/types';

const HOUR_MS = 60 * 60 * 1000;
const RELEASE_REASON = 'billing_timeout_72h';

export type ReleaseAbandonedForwardingNumbersRuntime = {
  shopsRepository: ShopsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
  phoneProvisioningService?: PhoneProvisioningService;
  emailService?: EmailService;
  smsService?: SmsService;
  outboundMessagesRepository?: OutboundMessagesRepository;
};

export type ReleaseAbandonedForwardingNumbersResult = {
  checked: number;
  reminders24hSent: number;
  reminders48hSent: number;
  released: number;
  skipped: number;
  errors: number;
};

type AbandonedForwardingMilestone = '24h' | '48h' | '72h';

function isActiveOrTrialing(subscription: BillingSubscription | null | undefined): boolean {
  return subscription?.status === 'active' || subscription?.status === 'trialing';
}

function hasValidPaymentMethod(subscription: BillingSubscription | null | undefined): boolean {
  return subscription?.paymentMethodStatus === 'valid';
}

function isDeliverableEmail(email: string | null | undefined): email is string {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  if (value.endsWith('@ringbooker.local')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveAppBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? 'https://ringbooker.com').replace(/\/+$/, '');
}

function resolveSmsFrom(shop: Shop): string | null {
  return (
    shop.telnyx_number?.trim() ||
    process.env.TELNYX_SMS_SENDER_NUMBER?.trim() ||
    process.env.RINGBOOKER_OUTBOUND_CALLER_ID?.trim() ||
    process.env.TELNYX_OUTBOUND_CALLER_ID?.trim() ||
    null
  );
}

function resolveCancelInstructions(shop: Shop): { cancelCode: string | null; text: string } {
  const carrier = findCarrier(shop.forwarding_country ?? 'us', shop.forwarding_carrier ?? undefined);
  const forwardingType = (shop.forwarding_type ?? carrier?.defaultType ?? 'no_answer') as ForwardingType;
  const code = getForwardingCode(carrier, forwardingType);
  if (code?.cancelCode) {
    return {
      cancelCode: code.cancelCode,
      text: `Dial ${code.cancelCode} from your business phone and press call to turn off forwarding.`,
    };
  }
  if (carrier?.appSteps?.length) {
    return {
      cancelCode: null,
      text: `Open ${carrier.name} settings and remove forwarding to your RingBooker number.`,
    };
  }
  return {
    cancelCode: null,
    text: 'Contact your phone provider and ask them to remove call forwarding to RingBooker.',
  };
}

function notificationTypeFor(milestone: AbandonedForwardingMilestone): BillingNotificationType {
  if (milestone === '24h') return 'forwarding_number_abandoned_24h';
  if (milestone === '48h') return 'forwarding_number_abandoned_48h';
  return 'forwarding_number_released_72h';
}

function buildReminderEmail(params: {
  shop: Shop;
  milestone: AbandonedForwardingMilestone;
  cancelInstructions: string;
  released: boolean;
}): { input: BaseEmailInput; text: string; subject: string } {
  const goLiveUrl = `${resolveAppBaseUrl()}/user/go-live`;
  const title = params.released
    ? 'Your RingBooker forwarding number was released'
    : params.milestone === '48h'
      ? 'Your RingBooker forwarding number expires soon'
      : 'Finish call forwarding setup';
  const body = params.released
    ? [
        `Your temporary RingBooker forwarding number for ${params.shop.name} was released because billing was not completed within 72 hours.`,
        params.cancelInstructions,
        'You can return to Go Live anytime to provision a new forwarding number and finish setup.',
      ]
    : [
        `Your RingBooker forwarding number for ${params.shop.name} is waiting for billing setup before live answering can be enabled.`,
        params.milestone === '48h'
          ? 'If billing is not completed by 72 hours after provisioning, RingBooker will release the temporary forwarding number.'
          : 'Complete billing and verification to keep this forwarding setup active.',
        params.cancelInstructions,
      ];

  const input: BaseEmailInput = {
    title,
    previewText: params.released
      ? 'The temporary forwarding number was released after 72 hours without billing.'
      : 'Finish billing to keep your RingBooker forwarding setup active.',
    heroTitle: title,
    bodyHtml: body.map((line) => `<p style="margin:0 0 12px 0">${escapeHtmlText(line)}</p>`).join(''),
    ctaLabel: params.released ? 'Open Go Live' : 'Finish setup',
    ctaUrl: goLiveUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />RingBooker</p>',
  };
  return {
    input,
    subject: title,
    text: [...body, '', `${params.released ? 'Open Go Live' : 'Finish setup'}: ${goLiveUrl}`].join('\n'),
  };
}

async function sendEmailOnce(params: {
  runtime: ReleaseAbandonedForwardingNumbersRuntime;
  shop: Shop;
  subscriptionId: string | null;
  type: BillingNotificationType;
  milestone: AbandonedForwardingMilestone;
  cancelInstructions: string;
  released: boolean;
}): Promise<boolean> {
  const notifications = params.runtime.billingNotificationsRepository;
  if (!notifications) return false;
  const alreadySent = await notifications.hasSent({
    shopId: params.shop.id,
    subscriptionId: params.subscriptionId,
    type: params.type,
    channel: 'email',
  });
  if (alreadySent) return false;

  const customer = params.runtime.billingCustomersRepository
    ? await params.runtime.billingCustomersRepository.findByShopId(params.shop.id)
    : null;
  const email = customer?.email?.trim();
  if (!params.runtime.emailService || !isDeliverableEmail(email)) {
    await notifications.markSent({
      shopId: params.shop.id,
      subscriptionId: params.subscriptionId,
      type: params.type,
      channel: 'email',
      metadata: { skipped: true, reason: 'no_deliverable_customer_email' },
    });
    return false;
  }

  const { input, text, subject } = buildReminderEmail({
    shop: params.shop,
    milestone: params.milestone,
    cancelInstructions: params.cancelInstructions,
    released: params.released,
  });
  await params.runtime.emailService.sendEmail({
    to: email,
    subject,
    text,
    html: await renderBaseEmailHtml(input),
    category: 'forwarding_not_verified_reminder',
    idempotencyKey: `forwarding-abandoned:${params.shop.id}:${params.type}:email`,
    shopId: params.shop.id,
    from: emailFounderFrom(),
    replyTo: emailReplyTo(),
  });
  await notifications.markSent({
    shopId: params.shop.id,
    subscriptionId: params.subscriptionId,
    type: params.type,
    channel: 'email',
  });
  return true;
}

async function sendSmsOnce(params: {
  runtime: ReleaseAbandonedForwardingNumbersRuntime;
  shop: Shop;
  subscriptionId: string | null;
  type: BillingNotificationType;
  cancelInstructions: string;
  released: boolean;
}): Promise<boolean> {
  if (!params.shop.sms_owner_opted_in || !params.runtime.smsService || !params.runtime.billingNotificationsRepository) {
    return false;
  }
  const to = params.shop.user_phone?.trim();
  const from = resolveSmsFrom(params.shop);
  if (!to || !from) return false;

  const alreadySent = await params.runtime.billingNotificationsRepository.hasSent({
    shopId: params.shop.id,
    subscriptionId: params.subscriptionId,
    type: params.type,
    channel: 'sms',
  });
  if (alreadySent) return false;

  const body = params.released
    ? `RingBooker: Your temporary forwarding number was released. ${params.cancelInstructions} Reply STOP to opt out.`
    : `RingBooker: Your forwarding setup expires soon unless billing is completed. ${params.cancelInstructions} Reply STOP to opt out.`;
  const sms = await sendGuardedSms({
    smsService: params.runtime.smsService,
    outboundMessagesRepository: params.runtime.outboundMessagesRepository,
    shop: params.shop,
    to,
    body,
    category: 'user_alert',
    idempotencyKey: `forwarding-abandoned:${params.shop.id}:${params.type}:sms`,
    audience: 'owner',
  });
  if (!sms.sent) return false;
  await params.runtime.billingNotificationsRepository.markSent({
    shopId: params.shop.id,
    subscriptionId: params.subscriptionId,
    type: params.type,
    channel: 'sms',
  });
  return true;
}

export async function runReleaseAbandonedForwardingNumbersJob(
  runtime: ReleaseAbandonedForwardingNumbersRuntime,
  now: Date = new Date(),
): Promise<ReleaseAbandonedForwardingNumbersResult> {
  const result: ReleaseAbandonedForwardingNumbersResult = {
    checked: 0,
    reminders24hSent: 0,
    reminders48hSent: 0,
    released: 0,
    skipped: 0,
    errors: 0,
  };

  if (!runtime.billingSubscriptionsRepository || !runtime.shopAccessStatesRepository) {
    logger.warn('release_abandoned_forwarding_numbers_dependencies_unavailable');
    return result;
  }

  const shops = await runtime.shopsRepository.list({ limit: 5000 });
  for (const shop of shops) {
    result.checked += 1;
    try {
      const forwardingNumber = shop.telnyx_number?.trim();
      const provisionedAtIso = shop.forwarding_number_provisioned_at ?? shop.forwarding_number_provisioning_started_at;
      if (!forwardingNumber || !provisionedAtIso) {
        result.skipped += 1;
        continue;
      }

      const provisionedAt = new Date(provisionedAtIso);
      if (!Number.isFinite(provisionedAt.getTime())) {
        result.skipped += 1;
        continue;
      }

      const access = await runtime.shopAccessStatesRepository.findByShopId(shop.id);
      const subscription = await runtime.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      if (access?.liveCallsEnabled || isActiveOrTrialing(subscription) || hasValidPaymentMethod(subscription)) {
        result.skipped += 1;
        continue;
      }

      const ageHours = (now.getTime() - provisionedAt.getTime()) / HOUR_MS;
      const subscriptionId = subscription?.id ?? null;
      const cancelInfo = resolveCancelInstructions(shop);
      if (ageHours >= 72) {
        const type = notificationTypeFor('72h');
        if (!runtime.phoneProvisioningService?.releaseNumber) {
          throw new Error('phone_provisioning_release_unavailable');
        }
        try {
          await runtime.phoneProvisioningService.releaseNumber({
            phoneNumber: forwardingNumber,
            orderId: shop.forwarding_number_provider_order_id ?? undefined,
            reason: RELEASE_REASON,
          });
        } catch (releaseError) {
          // A 404 means the number is already gone at Telnyx (released by a previous
          // run that failed before clearing shop state). Proceed to cleanup instead of
          // retrying the release forever while the shop keeps a stale telnyx_number.
          const message = releaseError instanceof Error ? releaseError.message : '';
          if (!message.endsWith(':404')) throw releaseError;
          logger.warn({ shopId: shop.id }, 'release_abandoned_forwarding_number_already_released_at_provider');
        }
        // Clear shop state immediately after the provider release: a stale telnyx_number
        // would keep matching inbound DID resolution for a number we no longer own.
        await runtime.shopAccessStatesRepository.upsert({
          shopId: shop.id,
          forwardingClaimedAt: null,
          forwardingVerifiedAt: null,
          forwardingVerifiedSource: null,
        });
        await runtime.shopsRepository.updateUserSettings(shop.id, {
          telnyx_number: null,
          forwarding_number_status: 'none',
          forwarding_carrier: null,
          forwarding_type: 'no_answer',
          forwarding_number_released_at: now.toISOString(),
          forwarding_number_release_reason: RELEASE_REASON,
        });
        result.released += 1;
        logger.info({ shopId: shop.id }, 'release_abandoned_forwarding_number_released');
        // Notifications are best-effort: a failed email/SMS must not leave released
        // provider state out of sync with the shop record.
        await sendEmailOnce({
          runtime,
          shop,
          subscriptionId,
          type,
          milestone: '72h',
          cancelInstructions: cancelInfo.text,
          released: true,
        }).catch((err) => logger.error({ err, shopId: shop.id }, 'release_abandoned_forwarding_number_email_failed'));
        await sendSmsOnce({
          runtime,
          shop,
          subscriptionId,
          type,
          cancelInstructions: cancelInfo.text,
          released: true,
        }).catch((err) => logger.error({ err, shopId: shop.id }, 'release_abandoned_forwarding_number_sms_failed'));
        continue;
      }

      if (ageHours >= 48) {
        const type = notificationTypeFor('48h');
        const emailSent = await sendEmailOnce({
          runtime,
          shop,
          subscriptionId,
          type,
          milestone: '48h',
          cancelInstructions: cancelInfo.text,
          released: false,
        });
        const smsSent = await sendSmsOnce({
          runtime,
          shop,
          subscriptionId,
          type,
          cancelInstructions: cancelInfo.text,
          released: false,
        });
        if (emailSent || smsSent) result.reminders48hSent += 1;
        continue;
      }

      if (ageHours >= 24) {
        const emailSent = await sendEmailOnce({
          runtime,
          shop,
          subscriptionId,
          type: notificationTypeFor('24h'),
          milestone: '24h',
          cancelInstructions: cancelInfo.text,
          released: false,
        });
        if (emailSent) result.reminders24hSent += 1;
        continue;
      }

      result.skipped += 1;
    } catch (error) {
      result.errors += 1;
      logger.error({ err: error, shopId: shop.id }, 'release_abandoned_forwarding_number_error');
    }
  }

  return result;
}
