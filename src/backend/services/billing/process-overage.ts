import type { BillingSubscription, Shop } from '@/src/backend/domain/types';
import { getPlanUsageLimits } from '@/src/backend/domain/plan-usage-limits';
import { logger } from '@/src/backend/observability/logger';
import type {
  AuthUsersRepository,
  BillingSubscriptionsRepository,
  CallLogsRepository,
  ShopActiveCallSessionsRepository,
  ShopOverageChargesRepository,
  ShopUsageAlertsRepository,
} from '@/src/backend/ports/repositories';
import { buildInternalAlertEmailPayload } from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import { emailDefaultFrom, emailSupportAddress } from '@/src/backend/services/email/config';
import type { EmailService } from '@/src/backend/services/email/types';
import { maybeSendOverageChargeReceipt } from '@/src/backend/services/usage/usage-alerts';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

export const OVERAGE_RATE_PER_CALL = 0.75;
const CAPTURED_CALL_OVERAGE_RATE_CENTS = Math.round(OVERAGE_RATE_PER_CALL * 100);

type OverageBillingProvider = BillingProviderAdapter & {
  chargeOverage(params: {
    providerSubscriptionId: string;
    amountCents: number;
    description: string;
  }): Promise<{ providerTransactionId: string }>;
};

export async function processOverageForPeriod(
  shop: Shop,
  periodStart: Date,
  periodEnd: Date,
  deps: {
    overageRepository: ShopOverageChargesRepository;
    billingSubscriptionsRepository: BillingSubscriptionsRepository;
    callLogsRepository: CallLogsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    billingProvider: OverageBillingProvider;
    usageAlertsRepository?: ShopUsageAlertsRepository | null;
    authUsersRepository?: AuthUsersRepository | null;
    emailService?: EmailService | null;
  },
): Promise<void> {
  const idempotencyKey = `overage:${shop.id}:${periodStart.toISOString()}`;

  const existing = await deps.overageRepository.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    logger.info({ shopId: shop.id, idempotencyKey, status: existing.status }, 'captured_caller_overage_already_processed');
    return;
  }

  const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
  if (!isChargeableSubscription(subscription)) {
    logger.info({ shopId: shop.id, idempotencyKey, status: subscription?.status ?? null }, 'captured_caller_overage_skipped_subscription');
    return;
  }

  const includedCallers = getPlanUsageLimits(shop.plan).capturedCallersMonthlyLimit;
  if (!includedCallers) {
    logger.info({ shopId: shop.id, idempotencyKey, plan: shop.plan }, 'captured_caller_overage_skipped_no_limit');
    return;
  }

  const usage = await getShopUsageForPeriod(
    {
      callLogsRepository: deps.callLogsRepository,
      shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    },
    { shop, period: { start: periodStart, end: periodEnd } },
  );
  const capturedCallers = usage.capturedCallersUsed;
  const overageCallers = Math.max(0, capturedCallers - includedCallers);
  const amountCents = overageCallers * CAPTURED_CALL_OVERAGE_RATE_CENTS;

  await deps.overageRepository.create({
    shopId: shop.id,
    billingSubscriptionId: subscription.id,
    periodStart,
    periodEnd,
    includedCallers,
    capturedCallers,
    overageCallers,
    rateCents: CAPTURED_CALL_OVERAGE_RATE_CENTS,
    amountCents,
    paddleSubscriptionId: subscription.providerSubscriptionId,
    status: overageCallers === 0 ? 'skipped' : 'pending',
    idempotencyKey,
  });

  logger.info({ shopId: shop.id, idempotencyKey, capturedCallers, overageCallers, amountCents }, 'captured_caller_overage_recorded');

  if (overageCallers === 0) return;

  try {
    const description = `Captured call overage - ${overageCallers} calls x $${OVERAGE_RATE_PER_CALL.toFixed(2)}`;
    const { providerTransactionId } = await deps.billingProvider.chargeOverage({
      providerSubscriptionId: subscription.providerSubscriptionId,
      amountCents,
      description,
    });

    await deps.overageRepository.updateStatus(idempotencyKey, 'charged', providerTransactionId);
    await maybeSendOverageChargeReceipt(
      shop,
      {
        periodStart,
        periodEnd,
        includedCallers,
        capturedCallers,
        overageCallers,
        amountCents,
      },
      {
        usageAlertsRepository: deps.usageAlertsRepository,
        authUsersRepository: deps.authUsersRepository,
        emailService: deps.emailService,
        callLogsRepository: deps.callLogsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
      },
    ).catch((emailErr) => {
      logger.error({ err: emailErr, shopId: shop.id, idempotencyKey }, 'captured_caller_overage_receipt_email_failed');
    });
    logger.info({ shopId: shop.id, idempotencyKey, providerTransactionId, amountCents }, 'captured_caller_overage_charged');
  } catch (err) {
    await deps.overageRepository.updateStatus(idempotencyKey, 'failed');
    logger.error({ err, shopId: shop.id, idempotencyKey, amountCents }, 'captured_caller_overage_charge_failed');
    // Failed overage rows have no automatic retry, so alert support instead of
    // letting unbilled revenue sit silently in the table.
    if (deps.emailService) {
      const { input, text } = buildInternalAlertEmailPayload({
        title: 'Paddle overage charge failed',
        summary: 'A captured-call overage charge failed and needs manual follow-up (no automatic retry).',
        fields: {
          shop_id: shop.id,
          shop_name: shop.name ?? null,
          idempotency_key: idempotencyKey,
          paddle_subscription_id: subscription.providerSubscriptionId,
          amount_cents: String(amountCents),
          overage_callers: String(overageCallers),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      await deps.emailService
        .sendEmail({
          to: emailSupportAddress(),
          subject: input.title,
          text,
          html: await renderBaseEmailHtml(input),
          category: 'internal_alert',
          idempotencyKey: `internal:overage_charge_failed:${idempotencyKey}`,
          from: emailDefaultFrom(),
          replyTo: emailSupportAddress(),
        })
        .catch((emailErr) => {
          logger.error({ err: emailErr, shopId: shop.id, idempotencyKey }, 'captured_caller_overage_failed_alert_email_failed');
        });
    }
  }
}

function isChargeableSubscription(
  subscription: BillingSubscription | null,
): subscription is BillingSubscription & { providerSubscriptionId: string } {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (subscription.provider !== 'paddle') return false;
  return Boolean(subscription.providerSubscriptionId?.trim());
}
