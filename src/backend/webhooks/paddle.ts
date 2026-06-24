import type { Context } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { getEnv } from '@/src/backend/config/env';
import { logger } from '@/src/backend/observability/logger';
import type { JobsRepository, ProviderEventsRepository, ShopsRepository } from '@/src/backend/ports/repositories';
import { notifySalesLifecycle } from '@/src/backend/services/sales-integration/sales-webhook';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getClientIp } from '@/src/backend/security/rate-limit';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { buildInternalAlertEmailPayload } from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import { emailDefaultFrom, emailSupportAddress } from '@/src/backend/services/email/config';
import type { EmailService } from '@/src/backend/services/email/types';

const paddleEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  occurred_at: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

function parsePaddleSignatureHeader(header: string): { ts: string; h1: string } | null {
  const entries = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  let ts: string | null = null;
  let h1: string | null = null;
  for (const entry of entries) {
    const [key, value] = entry.split('=');
    if (!key || !value) continue;
    if (key === 'ts') ts = value;
    if (key === 'h1') h1 = value;
  }
  if (!ts || !h1) return null;
  return { ts, h1 };
}

function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, maxSkewSeconds: number): boolean {
  if (!signatureHeader) return false;
  const parsed = parsePaddleSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const tsSec = Number(parsed.ts);
  if (!Number.isFinite(tsSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > maxSkewSeconds) return false;
  const payload = `${parsed.ts}:${rawBody}`;
  const digest = createHmac('sha256', getEnv().PADDLE_WEBHOOK_SECRET).update(payload).digest('hex');
  const expected = Buffer.from(digest, 'hex');
  const actual = Buffer.from(parsed.h1, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function shouldEmailUnmappedPaddleWebhook(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  // Paddle customer events can arrive before any checkout/subscription context
  // and often do not include RingBooker shop metadata. They are not actionable
  // enough for an email alert and must never become customer-facing noise.
  if (normalized.startsWith('customer.')) return false;
  return true;
}

type SelfServePaddlePlan = 'starter' | 'professional';

function firstTrimmedString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSelfServePaddlePlan(value: unknown): SelfServePaddlePlan | null {
  if (value === 'starter' || value === 'professional') return value;
  return null;
}

function extractPaddlePayloadShopId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const customData = asRecord(data.custom_data) ?? asRecord(data.customData) ?? asRecord(data.metadata);
  return firstTrimmedString(
    customData?.shop_id,
    customData?.shopId,
    data.shop_id,
    data.shopId,
  );
}

function extractPaddlePayloadPriceId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const direct = firstTrimmedString(data.price_id);
  if (direct) return direct;
  const items = Array.isArray(data.items) ? data.items : [];
  for (const itemValue of items) {
    const item = asRecord(itemValue);
    if (!item) continue;
    const nestedPrice = asRecord(item.price);
    const candidate = firstTrimmedString(item.price_id, nestedPrice?.id);
    if (candidate) return candidate;
  }
  return null;
}

function mapPaddlePayloadPlan(data: Record<string, unknown> | undefined): SelfServePaddlePlan | null {
  const priceId = extractPaddlePayloadPriceId(data);
  if (!priceId) return null;
  const env = getEnv();
  const matches: Array<[string | undefined, SelfServePaddlePlan]> = [
    [env.PADDLE_PRICE_STARTER_MONTHLY, 'starter'],
    [env.PADDLE_PRICE_STARTER_ANNUAL, 'starter'],
    [env.PADDLE_PRICE_STARTER, 'starter'],
    [env.PADDLE_PRICE_PROFESSIONAL_MONTHLY, 'professional'],
    [env.PADDLE_PRICE_PROFESSIONAL_ANNUAL, 'professional'],
    [env.PADDLE_PRICE_PROFESSIONAL, 'professional'],
  ];
  for (const [candidate, plan] of matches) {
    if (candidate?.trim() && candidate.trim() === priceId) return plan;
  }
  return null;
}

function inferPendingPlanChangeTarget(subscriptionMetadata: Record<string, unknown> | null | undefined): SelfServePaddlePlan | null {
  const pending = asRecord(subscriptionMetadata?.pending_plan_upgrade);
  return asSelfServePaddlePlan(pending?.targetPlan);
}

export async function handlePaddleWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    billingProvider?: BillingProviderAdapter;
    jobsRepository?: JobsRepository;
    emailService?: EmailService;
    shopsRepository?: ShopsRepository;
  },
) {
  const rawBody = await c.req.text();
  const signature = c.req.header('paddle-signature') ?? null;

  if (!verifyPaddleSignature(rawBody, signature, getEnv().PADDLE_WEBHOOK_MAX_SKEW_SECONDS)) {
    incrementMetric('webhook_requests_total', {
      provider: 'paddle',
      outcome: 'invalid_signature',
    });
    securityAudit({
      action: 'webhook_signature_invalid',
      actorType: 'provider',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      provider: 'paddle',
    });
    return c.json({ ok: false }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return c.json({ ok: false }, 400);
  }

  const parsed = paddleEventSchema.safeParse(parsedBody);
  if (!parsed.success) {
    incrementMetric('webhook_requests_total', {
      provider: 'paddle',
      outcome: 'failed',
    });
    return c.json({ ok: false }, 400);
  }

  const event = parsed.data;
  const dedupeKey = event.event_id;
  try {
    // reacquireFailed: a previous attempt that errored (returned 500) must be re-runnable
    // when Paddle retries — without it the retry insert dedupes as duplicate and the event
    // is lost until a manual replay. Paddle sync is idempotent, so re-running is safe.
    const processing = await deps.providerEventsRepository.tryMarkProcessing(
      {
        provider: 'paddle',
        providerEventId: dedupeKey,
        eventType: event.event_type,
        payload: event,
      },
      { reacquireFailed: true },
    );
    if (!processing.acquired) {
      incrementMetric('webhook_requests_total', {
        provider: 'paddle',
        outcome: 'duplicate',
      });
      return c.json({ ok: true }, 200);
    }

    let syncResult: Awaited<ReturnType<BillingProviderAdapter['syncWebhookEvent']>> | null = null;
    const eventType = event.event_type.toLowerCase();
    const mappedPlanFromPayload = mapPaddlePayloadPlan(event.data);
    const preSyncShopId = eventType === 'subscription.updated'
      ? extractPaddlePayloadShopId(event.data)
      : null;
    const preSyncShop = preSyncShopId && deps.shopsRepository
      ? await deps.shopsRepository.findById(preSyncShopId).catch((error) => {
          logger.warn({ err: error, shopId: preSyncShopId }, 'paddle_plan_change_pre_sync_shop_lookup_failed');
          return null;
        })
      : null;
    if (deps.billingProvider?.provider === 'paddle' && event.data) {
      syncResult = await deps.billingProvider.syncWebhookEvent({
        eventType: event.event_type,
        payload: {
          ...event.data,
          __paddle_event_id: event.event_id,
          __paddle_event_occurred_at: event.occurred_at,
        },
      });
      if (syncResult?.shopId && syncResult.subscription && deps.jobsRepository) {
        const syncedStatus = syncResult.subscription.status;
        const subscriptionId = syncResult.subscription.id;
        if (eventType === 'subscription.updated' && syncResult.shopPlanChanged) {
          const currentPlan = asSelfServePaddlePlan(syncResult.subscription.plan) ?? mappedPlanFromPayload;
          const pendingTargetPlan = inferPendingPlanChangeTarget(syncResult.subscription.metadata);
          const previousPlan = asSelfServePaddlePlan(preSyncShop?.plan) ??
            (pendingTargetPlan && pendingTargetPlan === currentPlan
              ? currentPlan === 'professional'
                ? 'starter'
                : 'professional'
              : null);
          const squareDisconnected = currentPlan === 'starter' && preSyncShop?.selected_integration === 'square_appointments';
          if (currentPlan === 'professional' && previousPlan !== null && previousPlan !== 'professional') {
            await deps.jobsRepository.enqueue({
              shopId: syncResult.shopId,
              type: 'lifecycle_email',
              payload: {
                kind: 'plan_upgraded',
                shopId: syncResult.shopId,
                subscriptionId,
                planName: currentPlan,
              },
              runAt: new Date(),
              idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:plan_upgraded:${currentPlan}`,
            });
          } else if (currentPlan === 'starter' && previousPlan === 'professional') {
            await deps.jobsRepository.enqueue({
              shopId: syncResult.shopId,
              type: 'lifecycle_email',
              payload: {
                kind: 'plan_downgraded',
                shopId: syncResult.shopId,
                subscriptionId,
                planName: currentPlan,
                squareDisconnected,
              },
              runAt: new Date(),
              idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:plan_downgraded:${currentPlan}`,
            });
          }
        }
        if (eventType === 'subscription.created' && syncedStatus === 'trialing') {
          await deps.jobsRepository.enqueue({
            shopId: syncResult.shopId,
            type: 'lifecycle_email',
            payload: {
              kind: 'trial_started',
              shopId: syncResult.shopId,
              subscriptionId,
            },
            runAt: new Date(),
            idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:trial_started`,
          });
        }
        if (
          eventType.includes('payment_method.saved') &&
          syncResult.subscription.paymentMethodStatus === 'valid' &&
          ['trialing', 'active'].includes(syncedStatus)
        ) {
          await deps.jobsRepository.enqueue({
            shopId: syncResult.shopId,
            type: 'lifecycle_email',
            payload: { kind: 'payment_method_added', subscriptionId },
            runAt: new Date(),
            idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:payment_method_added`,
          });
        }
        if (
          eventType.includes('payment_method.deleted') ||
          eventType.includes('transaction.payment_failed') ||
          ['subscription.canceled', 'subscription.paused', 'subscription.past_due'].some((name) => eventType.includes(name))
        ) {
          if (eventType.includes('transaction.payment_failed')) {
            await deps.jobsRepository.enqueue({
              shopId: syncResult.shopId,
              type: 'lifecycle_email',
              payload: {
                kind: 'payment_failed',
                subscriptionId,
                status: syncResult.subscription.status,
              },
              runAt: new Date(),
              idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:payment_failed`,
            });
          }
          if (eventType.includes('subscription.canceled') && syncResult.subscription.status === 'canceled') {
            await deps.jobsRepository.enqueue({
              shopId: syncResult.shopId,
              type: 'lifecycle_email',
              payload: {
                kind: 'subscription_canceled',
                subscriptionId,
                status: syncResult.subscription.status,
              },
              runAt: new Date(),
              idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:subscription_canceled`,
            });
          }
          await deps.jobsRepository.enqueue({
            shopId: syncResult.shopId,
            type: 'lifecycle_email',
            payload: {
              kind: 'live_answering_billing_paused',
              subscriptionId,
              status: syncResult.subscription.status,
            },
            runAt: new Date(),
            idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:live_answering_billing_paused:${syncResult.subscription.status}:${syncResult.subscription.paymentMethodStatus ?? 'unknown'}`,
          });
        }
        if ((eventType === 'transaction.completed' || eventType === 'transaction.paid') && syncedStatus === 'active') {
          const transactionId =
            typeof event.data.id === 'string'
              ? event.data.id
              : typeof (event.data as { transaction_id?: unknown }).transaction_id === 'string'
                ? (event.data as { transaction_id: string }).transaction_id
                : event.event_id;
          await deps.jobsRepository.enqueue({
            shopId: syncResult.shopId,
            type: 'lifecycle_email',
            payload: {
              kind: 'subscription_active',
              shopId: syncResult.shopId,
              subscriptionId,
              status: syncedStatus,
            },
            runAt: new Date(),
            idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:first_charge:${transactionId}`,
          });
        }
        if (
          ['subscription.activated', 'subscription.resumed'].some((name) => eventType.includes(name)) &&
          ['active', 'trialing'].includes(syncedStatus)
        ) {
          if (syncedStatus === 'active') {
            await deps.jobsRepository.enqueue({
              shopId: syncResult.shopId,
              type: 'lifecycle_email',
              payload: {
                kind: 'subscription_active',
                subscriptionId,
                status: syncedStatus,
              },
              runAt: new Date(),
              idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:subscription_active`,
            });
          }
          await deps.jobsRepository.enqueue({
            shopId: syncResult.shopId,
            type: 'lifecycle_email',
            payload: {
              kind: 'live_answering_billing_restored',
              subscriptionId,
              status: syncedStatus,
            },
            runAt: new Date(),
            idempotencyKey: `lifecycle_email:${syncResult.shopId}:${subscriptionId}:live_answering_billing_restored:${syncedStatus}`,
          });
        }
      } else if (!syncResult && shouldEmailUnmappedPaddleWebhook(event.event_type)) {
        // Subscription event with no matching shop — log and alert; mark as error
        // so it surfaces in monitoring rather than being silently swallowed.
        logger.warn(
          {
            event: 'paddle_webhook_unmapped_subscription',
            event_id: event.event_id,
            event_type: event.event_type,
          },
          'paddle_webhook_unmapped_subscription',
        );
        await deps.providerEventsRepository.markProcessingError(
          'paddle',
          dedupeKey,
          `unmapped_subscription_event:${event.event_type}`,
        );
        if (deps.emailService) {
          const { input, text } = buildInternalAlertEmailPayload({
            title: 'Paddle webhook mapping failure',
            summary: 'A verified Paddle webhook could not be mapped to a RingBooker shop.',
            fields: {
              event_id: event.event_id,
              event_type: event.event_type,
              provider_customer_id: typeof event.data?.provider_customer_id === 'string' ? event.data.provider_customer_id : typeof event.data?.customer_id === 'string' ? event.data.customer_id : null,
              provider_subscription_id: typeof event.data?.provider_subscription_id === 'string' ? event.data.provider_subscription_id : typeof event.data?.subscription_id === 'string' ? event.data.subscription_id : null,
            },
          });
          await deps.emailService.sendEmail({
            to: emailSupportAddress(),
            subject: input.title,
            text,
            html: await renderBaseEmailHtml(input),
            category: 'internal_alert',
            idempotencyKey: `internal:paddle_mapping_failure:${event.event_id}`,
            from: emailDefaultFrom(),
            replyTo: emailSupportAddress(),
          }).catch((error) => logger.error({ err: error, eventId: event.event_id }, 'paddle_internal_alert_email_failed'));
        }
        incrementMetric('webhook_requests_total', {
          provider: 'paddle',
          outcome: 'failed',
        });
        // Return 200 so Paddle stops retrying — the error is recorded in provider_events.
        return c.json({ ok: false }, 200);
      }

      // Report bottom-of-funnel lifecycle to sales.ringbooker.com for attributed shops.
      if (syncResult?.shopId && syncResult.subscription && deps.shopsRepository) {
        const status = syncResult.subscription.status;
        let lifecycleEvent: 'trial' | 'converted' | 'churned' | null = null;
        if (['subscription.canceled', 'subscription.paused', 'subscription.past_due'].some((n) => eventType.includes(n))) {
          lifecycleEvent = 'churned';
        } else if (status === 'active') {
          lifecycleEvent = 'converted';
        } else if (status === 'trialing') {
          lifecycleEvent = 'trial';
        }
        if (lifecycleEvent) {
          const salesLeadId = await deps.shopsRepository.findSalesLeadId(syncResult.shopId);
          if (salesLeadId) void notifySalesLifecycle({ salesLeadId, event: lifecycleEvent });
        }
      }
    }

    await deps.providerEventsRepository.markProcessed({
      provider: 'paddle',
      providerEventId: dedupeKey,
      eventType: event.event_type,
      payload: event,
    });

    await deps.providerEventsRepository.clearProcessingError('paddle', dedupeKey);
    incrementMetric('webhook_requests_total', {
      provider: 'paddle',
      outcome: 'processed',
    });
    return c.json({ ok: true }, 200);
  } catch (error) {
    logger.error({ err: error, eventId: dedupeKey, eventType: event.event_type }, 'paddle_webhook_sync_failed');
    await deps.providerEventsRepository.markProcessingError(
      'paddle',
      dedupeKey,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'paddle',
      outcome: 'failed',
    });
    return c.json({ ok: false }, 500);
  }
}
