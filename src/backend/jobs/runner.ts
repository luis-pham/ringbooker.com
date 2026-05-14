import { dispatchRealtimeSession, RealtimeDispatchError } from '@/src/agent/realtime/dispatch-session';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { getEnv } from '@/src/backend/config/env';
import type { BillingNotificationType, JobType, Shop } from '@/src/backend/domain/types';
import { canUseReminderSms, canUseReviewRequestSms } from '@/src/backend/domain/shop-plan-capabilities';
import { JobExecutionError, JobWorker } from '@/src/backend/jobs/worker';
import { logger } from '@/src/backend/observability/logger';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';
import { z } from 'zod';
import { extractCallSummary } from '@/src/backend/services/calls/extract-call-summary';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import {
  buildAddPaymentMethodGoLiveEmailPayload,
  buildFinishOnboardingReminderEmailPayload,
  buildForwardingNotVerifiedReminderEmailPayload,
  buildForwardingNumberReadyEmailPayload,
  buildForwardingProvisionFailedEmailPayload,
  buildForwardingVerifiedEmailPayload,
  buildInternalAlertEmailPayload,
  buildLiveAnsweringBillingPausedEmailPayload,
  buildLiveAnsweringBillingRestoredEmailPayload,
  buildLiveAnsweringEnabledEmailPayload,
  buildPaymentMethodAddedEmailPayload,
  buildTrialEndedEmailPayload,
  buildTrialReminderEmailPayload,
} from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import type { BaseEmailInput } from '@/src/backend/services/email/base-email-types';
import { emailDefaultFrom, emailFounderFrom, emailReplyTo, emailSupportAddress } from '@/src/backend/services/email/config';
import type { EmailCategory } from '@/src/backend/services/email/types';
import { SMS_MISSED_CALL, SMS_REMINDER_24H, SMS_REMINDER_2H } from '@/src/backend/services/sms/types';
import { formatShopDate, formatShopTime } from '@/src/shared/timezone';

type WorkerControls = {
  stop: () => void;
};

const lifecycleEmailPayloadSchema = z.object({
  kind: z.enum([
    'finish_onboarding_reminder_1',
    'finish_onboarding_reminder_2',
    'add_payment_method_go_live',
    'payment_method_added',
    'forwarding_number_ready',
    'forwarding_number_failed_user',
    'forwarding_number_failed_internal',
    'forwarding_not_verified_24h',
    'forwarding_not_verified_72h',
    'forwarding_verified',
    'live_answering_enabled',
    'live_answering_billing_paused',
    'live_answering_billing_restored',
    'internal_paddle_alert',
    'internal_telnyx_alert',
    'internal_live_billing_blocked_alert',
  ]),
  subscriptionId: z.string().optional().nullable(),
  forwardingNumber: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

type LifecycleEmailKind = z.infer<typeof lifecycleEmailPayloadSchema>['kind'];

const lifecycleNotificationTypeByKind: Record<LifecycleEmailKind, BillingNotificationType> = {
  finish_onboarding_reminder_1: 'finish_onboarding_reminder_1',
  finish_onboarding_reminder_2: 'finish_onboarding_reminder_2',
  add_payment_method_go_live: 'add_payment_method_go_live',
  payment_method_added: 'payment_method_added',
  forwarding_number_ready: 'forwarding_number_ready',
  forwarding_number_failed_user: 'forwarding_number_failed_user',
  forwarding_number_failed_internal: 'forwarding_number_failed_internal',
  forwarding_not_verified_24h: 'forwarding_not_verified_24h',
  forwarding_not_verified_72h: 'forwarding_not_verified_72h',
  forwarding_verified: 'forwarding_verified',
  live_answering_enabled: 'live_answering_enabled',
  live_answering_billing_paused: 'live_answering_billing_paused',
  live_answering_billing_restored: 'live_answering_billing_restored',
  internal_paddle_alert: 'internal_paddle_alert',
  internal_telnyx_alert: 'internal_telnyx_alert',
  internal_live_billing_blocked_alert: 'internal_live_billing_blocked_alert',
};

function lifecycleNotificationTypeFor(kind: LifecycleEmailKind, status?: string | null): BillingNotificationType {
  if (kind !== 'live_answering_billing_paused') return lifecycleNotificationTypeByKind[kind];
  if (status === 'canceled') return 'live_answering_billing_paused_canceled';
  if (status === 'paused') return 'live_answering_billing_paused_paused';
  if (status === 'past_due' || status === 'unpaid') return 'live_answering_billing_paused_past_due';
  return 'live_answering_billing_paused_payment_failed';
}

function isDeliverableLifecycleEmail(email: string | null | undefined): email is string {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  if (value.endsWith('@ringbooker.local')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveRingbookerSystemOutboundCallerId(): string | null {
  const env = getEnv();
  const primary = env.RINGBOOKER_OUTBOUND_CALLER_ID?.trim();
  if (primary) return primary;
  const fallback = env.TELNYX_OUTBOUND_CALLER_ID?.trim();
  return fallback || null;
}

export function startJobsWorker(): WorkerControls {
  const runtime = getBackendRuntime();
  const workerId = `jobs-worker-${process.pid}`;
  const workerConfig = getWorkerRuntimeConfig();

  const handlers = createJobHandlers(runtime);

  const worker = new JobWorker(runtime.jobsRepository, handlers, workerId, workerConfig.jobLeaseSeconds);

  const interval = setInterval(async () => {
    try {
      await worker.tick();
    } catch (error) {
      logger.error({ err: error, workerId }, 'jobs_worker_tick_error');
    }
  }, workerConfig.jobPollIntervalMs);

  logger.info(
    {
      mode: runtime.mode,
      workerId,
      pollIntervalMs: workerConfig.jobPollIntervalMs,
    },
    'jobs_worker_started',
  );

  return {
    stop: () => {
      clearInterval(interval);
      logger.info({ workerId }, 'jobs_worker_stopped');
    },
  };
}

export async function executeSingleJobsWorkerTick(): Promise<{ processed: boolean }> {
  return executeSingleJobsWorkerTickWithRuntime(getBackendRuntime());
}

export async function executeSingleJobsWorkerTickWithRuntime(
  runtime: ReturnType<typeof getBackendRuntime>,
): Promise<{ processed: boolean }> {
  const workerConfig = getWorkerRuntimeConfig();
  const workerId = `jobs-tick-${process.pid}-${Date.now()}`;
  const handlers = createJobHandlers(runtime);
  const worker = new JobWorker(runtime.jobsRepository, handlers, workerId, workerConfig.jobLeaseSeconds);
  const processed = await worker.tick();
  return { processed };
}

export async function scheduleTrialLifecycleJobsWithRuntime(
  runtime: ReturnType<typeof getBackendRuntime>,
  now: Date = new Date(),
): Promise<{ expiryChecksEnqueued: number; reminderEmailsEnqueued: number; accessStatesRepaired: number }> {
  if (!runtime.billingSubscriptionsRepository || !runtime.jobsRepository) {
    throw new Error('trial_lifecycle_scheduler_dependencies_unavailable');
  }
  const subscriptions = await runtime.billingSubscriptionsRepository.list({ limit: 5000 });
  let expiryChecksEnqueued = 0;
  let reminderEmailsEnqueued = 0;
  let accessStatesRepaired = 0;

  for (const subscription of subscriptions) {
    if (subscription.status === 'trial_expired') {
      const alreadySent = runtime.billingNotificationsRepository
        ? await runtime.billingNotificationsRepository.hasSent({
            shopId: subscription.shopId,
            subscriptionId: subscription.id,
            type: 'trial_ended',
            channel: 'email',
          })
        : false;
      if (!alreadySent) {
        await runtime.jobsRepository.enqueue({
          shopId: subscription.shopId,
          type: 'trial_expiry_check',
          payload: {},
          runAt: now,
          idempotencyKey: `trial_expiry_check:${subscription.id}:trial_ended_retry`,
        });
        expiryChecksEnqueued += 1;
      }
      continue;
    }
    if (subscription.status !== 'trialing' || subscription.paymentMethodStatus === 'valid' || !subscription.trialEndsAt) {
      continue;
    }

    const trialEndsAt = new Date(subscription.trialEndsAt);
    if (!Number.isFinite(trialEndsAt.getTime())) continue;
    const msRemaining = trialEndsAt.getTime() - now.getTime();

    if (msRemaining <= 0) {
      await runtime.jobsRepository.enqueue({
        shopId: subscription.shopId,
        type: 'trial_expiry_check',
        payload: {},
        runAt: now,
        idempotencyKey: `trial_expiry_check:${subscription.id}:${subscription.trialEndsAt}`,
      });
      expiryChecksEnqueued += 1;
      continue;
    }

    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
      const type =
        daysRemaining === 1
          ? 'trial_ends_1_day'
          : daysRemaining === 3
            ? 'trial_ends_3_days'
            : 'trial_ends_7_days';
      const alreadySent = runtime.billingNotificationsRepository
        ? await runtime.billingNotificationsRepository.hasSent({
            shopId: subscription.shopId,
            subscriptionId: subscription.id,
            type,
            channel: 'email',
          })
        : false;
      if (!alreadySent) {
        await runtime.jobsRepository.enqueue({
          shopId: subscription.shopId,
          type: 'trial_reminder_email',
          payload: { daysRemaining },
          runAt: now,
          idempotencyKey: `trial_reminder_email:${subscription.id}:${type}`,
        });
        reminderEmailsEnqueued += 1;
      }
    }

    if (runtime.shopAccessStatesRepository) {
      const state = await runtime.shopAccessStatesRepository.findByShopId(subscription.shopId);
      if (!state) {
        await runtime.shopAccessStatesRepository.upsert({
          shopId: subscription.shopId,
          liveCallsEnabled: false,
          liveCallsPausedReason: 'payment_method_required_before_go_live',
        });
        accessStatesRepaired += 1;
      }
    }
  }

  if (runtime.shopsRepository && runtime.billingNotificationsRepository) {
    const shops = await runtime.shopsRepository.list({ limit: 5000 });
    for (const shop of shops) {
      const subscription = await runtime.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      const accessState = runtime.shopAccessStatesRepository ? await runtime.shopAccessStatesRepository.findByShopId(shop.id) : null;
      const subscriptionId = subscription?.id ?? null;
      const trialStartedAt = subscription?.trialStartedAt ? new Date(subscription.trialStartedAt) : null;
      const hoursSinceSignup =
        trialStartedAt && Number.isFinite(trialStartedAt.getTime())
          ? (now.getTime() - trialStartedAt.getTime()) / (60 * 60 * 1000)
          : 0;

      if (!isShopSetupWizardComplete(shop) && subscriptionId && subscription?.status !== 'canceled' && subscription?.status !== 'trial_expired') {
        const reminderKind = hoursSinceSignup >= 72 ? 'finish_onboarding_reminder_2' : hoursSinceSignup >= 24 ? 'finish_onboarding_reminder_1' : null;
        if (reminderKind) {
          const type = lifecycleNotificationTypeByKind[reminderKind];
          const alreadySent = await runtime.billingNotificationsRepository.hasSent({
            shopId: shop.id,
            subscriptionId,
            type,
            channel: 'email',
          });
          if (!alreadySent) {
            await runtime.jobsRepository.enqueue({
              shopId: shop.id,
              type: 'lifecycle_email',
              payload: { kind: reminderKind, subscriptionId },
              runAt: now,
              idempotencyKey: `lifecycle_email:${shop.id}:${subscriptionId}:${reminderKind}`,
            });
            reminderEmailsEnqueued += 1;
          }
        }
      }

      if (
        isShopSetupWizardComplete(shop) &&
        subscription &&
        subscription.status === 'trialing' &&
        subscription.paymentMethodStatus !== 'valid' &&
        !accessState?.liveCallsEnabled
      ) {
        const type = lifecycleNotificationTypeByKind.add_payment_method_go_live;
        const alreadySent = await runtime.billingNotificationsRepository.hasSent({
          shopId: shop.id,
          subscriptionId: subscription.id,
          type,
          channel: 'email',
        });
        if (!alreadySent) {
          await runtime.jobsRepository.enqueue({
            shopId: shop.id,
            type: 'lifecycle_email',
            payload: { kind: 'add_payment_method_go_live', subscriptionId: subscription.id },
            runAt: now,
            idempotencyKey: `lifecycle_email:${shop.id}:${subscription.id}:add_payment_method_go_live`,
          });
          reminderEmailsEnqueued += 1;
        }
      }

      if (shop.telnyx_number?.trim() && !accessState?.forwardingSetupVerifiedAt && !accessState?.liveCallsEnabled && subscriptionId) {
        const provisionedAt = shop.forwarding_number_provisioning_started_at
          ? new Date(shop.forwarding_number_provisioning_started_at)
          : trialStartedAt;
        const hoursSinceForwarding =
          provisionedAt && Number.isFinite(provisionedAt.getTime())
            ? (now.getTime() - provisionedAt.getTime()) / (60 * 60 * 1000)
            : 0;
        const reminderKind = hoursSinceForwarding >= 72 ? 'forwarding_not_verified_72h' : hoursSinceForwarding >= 24 ? 'forwarding_not_verified_24h' : null;
        if (reminderKind) {
          const type = lifecycleNotificationTypeByKind[reminderKind];
          const alreadySent = await runtime.billingNotificationsRepository.hasSent({
            shopId: shop.id,
            subscriptionId,
            type,
            channel: 'email',
          });
          if (!alreadySent) {
            await runtime.jobsRepository.enqueue({
              shopId: shop.id,
              type: 'lifecycle_email',
              payload: { kind: reminderKind, subscriptionId, forwardingNumber: shop.telnyx_number.trim() },
              runAt: now,
              idempotencyKey: `lifecycle_email:${shop.id}:${subscriptionId}:${reminderKind}`,
            });
            reminderEmailsEnqueued += 1;
          }
        }
      }
    }
  }

  return { expiryChecksEnqueued, reminderEmailsEnqueued, accessStatesRepaired };
}

export function createJobHandlers(runtime: ReturnType<typeof getBackendRuntime>) {
  const livekitSipOutboundTrunkId = process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID?.trim();
  const shouldUseSipRealtime = Boolean(
    livekitSipOutboundTrunkId && runtime.agentTransportMode === 'livekit' && runtime.commProvider === 'telnyx',
  );

  async function prepareRealtimeCallbackCall(params: {
    shop: Shop;
    customerPhone: string;
    customerName?: string | null;
    reason: string;
    idempotencySeed: string;
  }): Promise<{ roomName?: string; requestId: string }> {
    if (!shouldUseSipRealtime) {
      return { requestId: params.idempotencySeed };
    }

    const requestId = `outbound-callback-${params.idempotencySeed}`;
    const roomName = `rb-callback-${params.idempotencySeed.slice(0, 30)}`;
    const systemPrompt = [
      buildSystemPrompt({
        shop: params.shop,
        customer: null,
        mode: 'callback',
      }),
      `CALLBACK_CONTEXT: Customer phone ${params.customerPhone}.`,
      params.customerName ? `CALLBACK_CUSTOMER_NAME: ${params.customerName}.` : '',
      `CALLBACK_REASON: ${params.reason}.`,
    ]
      .filter(Boolean)
      .join('\n');

    const realtime = await runtime.realtimeAgentRuntime.startInboundSession({
      requestId,
      roomName,
      shopId: params.shop.id,
      destinationPhone: params.shop.phone_number,
      callerPhone: params.customerPhone,
      systemPrompt,
      shopPlan: params.shop.plan,
    });

    await runtime.jobsRepository.enqueue({
      shopId: params.shop.id,
      type: 'realtime_session_dispatch',
      payload: {
        requestId,
        roomName,
        destinationPhone: params.shop.phone_number,
        callerPhone: params.customerPhone,
        systemPrompt,
        realtime,
      },
      runAt: new Date(),
      idempotencyKey: `realtime_dispatch:${requestId}`,
    });

    return { roomName, requestId };
  }

  const reminderPayloadSchema = z.object({
    bookingId: z.string().uuid().or(z.string().min(1)),
  });
  const realtimeDispatchPayloadSchema = z.object({
    requestId: z.string().min(1),
    roomName: z.string().min(1),
    destinationPhone: z.string().min(1),
    callerPhone: z.string().min(1),
    systemPrompt: z.string().min(1),
    realtime: z.object({
      mode: z.enum(['mock', 'livekit_realtime']),
      sessionId: z.string().min(1),
      roomName: z.string().min(1),
      status: z.enum(['started', 'simulated']),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  });
  const missedCallPayloadSchema = z.object({
    customerPhone: z.string().min(1),
  });
  const bookingConfirmationSmsPayloadSchema = z.object({
    shopId: z.string().min(1),
    toPhone: z.string().min(1),
    bookingId: z.string().min(1),
    serviceName: z.string().min(1).optional(),
    appointmentDate: z.string().min(1).optional(),
    appointmentTime: z.string().min(1).optional(),
    techName: z.string().min(1).optional(),
    shopName: z.string().min(1),
  });
  const bookingLinkSmsPayloadSchema = z.object({
    shopId: z.string().min(1),
    toPhone: z.string().min(1),
    message: z.string().min(1),
    bookingUrl: z.string().min(1),
  });
  const cancellationRequestAlertPayloadSchema = z.object({
    shopId: z.string().min(1),
    callerName: z.string().min(1).optional(),
    callerPhone: z.string().min(1).optional(),
    appointmentDate: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    providerName: z.string().min(1).optional(),
  });
  const callbackPayloadSchema = z.union([
    z.object({
      callbackId: z.string().uuid().or(z.string().min(1)),
    }),
    z.object({
      customerPhone: z.string().min(1),
      customerName: z.string().min(1).optional(),
      reason: z.string().min(1).optional(),
    }),
  ]);
  const postCallSummaryPayloadSchema = z.object({
    requestId: z.string().min(1),
    status: z.enum(['completed', 'failed']).optional(),
    error: z.string().nullable().optional(),
    occurredAt: z.string().nullable().optional(),
  });
  const handoffFailedOwnerSmsPayloadSchema = z.object({
    rbCallId: z.string().min(1),
    summary: z.string().min(1),
    reason: z.string().min(1),
    urgency: z.string().min(1),
    callerPhone: z.string().min(1).optional(),
    failureCode: z.string().min(1).optional(),
    handoffId: z.string().min(1).optional(),
  });

  const handlers: Partial<Record<JobType, (params: { jobId: string; shopId: string; payload: Record<string, unknown>; attemptCount: number }) => Promise<void>>> = {
    realtime_session_dispatch: async (params) => {
      const payload = realtimeDispatchPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:realtime_session_dispatch', { retryable: false });
      }

      try {
        await dispatchRealtimeSession(payload.data);
      } catch (error) {
        if (error instanceof RealtimeDispatchError) {
          throw new JobExecutionError(error.message, { retryable: error.retryable });
        }
        throw error;
      }
    },
    booking_confirmation_sms: async (params) => {
      const payload = bookingConfirmationSmsPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'booking_confirmation_sms_invalid_payload');
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'booking_confirmation_sms_shop_not_found');
        return;
      }

      const body =
        `${payload.data.shopName}: Your appointment is confirmed!` +
        (payload.data.serviceName ? `\nService: ${payload.data.serviceName}` : '') +
        (payload.data.appointmentDate ? `\nDate: ${payload.data.appointmentDate}` : '') +
        (payload.data.appointmentTime ? `\nTime: ${payload.data.appointmentTime}` : '') +
        (payload.data.techName ? `\nWith: ${payload.data.techName}` : '') +
        '\nSee you soon!';
      const idempotencyKey = `job:${params.jobId}:booking-confirmation`;

      try {
        const sms = await runtime.smsService.sendSms({
          to: payload.data.toPhone,
          from: shop.phone_number,
          body,
          shopId: shop.id,
          category: 'booking_confirmation',
          bookingId: payload.data.bookingId,
          idempotencyKey,
        });

        await runtime.outboundMessagesRepository.create({
          shopId: shop.id,
          bookingId: payload.data.bookingId,
          customerPhone: payload.data.toPhone,
          category: 'booking_confirmation',
          body,
          idempotencyKey,
          status: 'sent',
          providerMessageId: sms.providerMessageId,
        });
      } catch (error) {
        logger.warn(
          {
            err: error,
            jobId: params.jobId,
            shopId: shop.id,
            bookingId: payload.data.bookingId,
          },
          'booking_confirmation_sms_failed',
        );
      }
    },
    appointment_reminder_24h: async (params) => {
      const payload = reminderPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:appointment_reminder_24h', { retryable: false });
      }

      const booking = await runtime.bookingsRepository.findById(payload.data.bookingId);
      if (!booking) {
        throw new JobExecutionError('booking_not_found', { retryable: false });
      }

      const shop = await runtime.shopsRepository.findById(booking.shopId);
      if (!shop) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }
      if (!shop.send_reminder_sms) {
        await runtime.bookingsRepository.markReminderSent(booking.id, '24h');
        return;
      }
      if (!canUseReminderSms(shop.plan)) {
        logger.warn(
          { jobId: params.jobId, shopId: shop.id, plan: shop.plan, feature: 'reminder_sms' },
          'plan_feature_locked',
        );
        await runtime.bookingsRepository.markReminderSent(booking.id, '24h');
        return;
      }

      const local = toLocalLabels(booking.datetimeUtc, booking.timezone);
      const smsBody = SMS_REMINDER_24H(shop, {
        service: booking.service,
        localDateLabel: local.dateLabel,
        localTimeLabel: local.timeLabel,
        customerPhone: booking.customerPhone,
      });
      const idempotencyKey = `job:${params.jobId}:reminder24h`;

      const sms = await runtime.smsService.sendSms({
        to: booking.customerPhone,
        from: shop.phone_number,
        body: smsBody,
        shopId: booking.shopId,
        category: 'reminder_24h',
        bookingId: booking.id,
        idempotencyKey,
      });

      await runtime.outboundMessagesRepository.create({
        shopId: booking.shopId,
        bookingId: booking.id,
        customerPhone: booking.customerPhone,
        category: 'reminder_24h',
        body: smsBody,
        idempotencyKey,
        status: 'sent',
        providerMessageId: sms.providerMessageId,
      });

      await runtime.bookingsRepository.markReminderSent(booking.id, '24h');
    },
    appointment_reminder_2h: async (params) => {
      const payload = reminderPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:appointment_reminder_2h', { retryable: false });
      }

      const booking = await runtime.bookingsRepository.findById(payload.data.bookingId);
      if (!booking) {
        throw new JobExecutionError('booking_not_found', { retryable: false });
      }

      const shop = await runtime.shopsRepository.findById(booking.shopId);
      if (!shop) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }
      if (!shop.send_reminder_sms) {
        await runtime.bookingsRepository.markReminderSent(booking.id, '2h');
        return;
      }
      if (!canUseReminderSms(shop.plan)) {
        logger.warn(
          { jobId: params.jobId, shopId: shop.id, plan: shop.plan, feature: 'reminder_sms' },
          'plan_feature_locked',
        );
        await runtime.bookingsRepository.markReminderSent(booking.id, '2h');
        return;
      }

      const local = toLocalLabels(booking.datetimeUtc, booking.timezone);
      const smsBody = SMS_REMINDER_2H(shop, {
        service: booking.service,
        localDateLabel: local.dateLabel,
        localTimeLabel: local.timeLabel,
        customerPhone: booking.customerPhone,
      });
      const idempotencyKey = `job:${params.jobId}:reminder2h`;

      const sms = await runtime.smsService.sendSms({
        to: booking.customerPhone,
        from: shop.phone_number,
        body: smsBody,
        shopId: booking.shopId,
        category: 'reminder_2h',
        bookingId: booking.id,
        idempotencyKey,
      });

      await runtime.outboundMessagesRepository.create({
        shopId: booking.shopId,
        bookingId: booking.id,
        customerPhone: booking.customerPhone,
        category: 'reminder_2h',
        body: smsBody,
        idempotencyKey,
        status: 'sent',
        providerMessageId: sms.providerMessageId,
      });

      await runtime.bookingsRepository.markReminderSent(booking.id, '2h');
    },
    handoff_failed_owner_sms: async (params) => {
      const payload = handoffFailedOwnerSmsPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'handoff_failed_owner_sms_invalid_payload');
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'handoff_failed_owner_sms_shop_not_found');
        return;
      }
      if (!shop.sms_owner_opted_in) {
        return;
      }
      if (!shop.user_phone?.trim()) {
        return;
      }

      const callerPart = payload.data.callerPhone ? `Caller: ${payload.data.callerPhone}.` : '';
      const body = [
        `RingBooker: A caller requested live help but we couldn't connect the call. ${callerPart}`,
        `Reason: ${payload.data.summary.slice(0, 400)}`,
        `Shop: ${shop.name}.`,
        'Please follow up.',
        'Reply STOP to opt out.',
      ]
        .filter(Boolean)
        .join(' ');
      const idempotencyKey = `job:${params.jobId}:handoff-failed-owner`;

      try {
        const sms = await runtime.smsService.sendSms({
          to: shop.user_phone,
          from: shop.phone_number,
          body,
          shopId: shop.id,
          category: 'user_alert',
          idempotencyKey,
        });
        await runtime.outboundMessagesRepository.create({
          shopId: shop.id,
          customerPhone: shop.user_phone,
          category: 'user_alert',
          body,
          idempotencyKey,
          status: 'sent',
          providerMessageId: sms.providerMessageId,
        });
      } catch (error) {
        logger.error({ err: error, jobId: params.jobId, shopId: shop.id }, 'handoff_failed_owner_sms_failed');
      }
    },
    missed_call_followup_sms: async (params) => {
      const payload = missedCallPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:missed_call_followup_sms', { retryable: false });
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }
      if (!shop.send_missed_call_followup_sms) {
        return;
      }
      const access = await getShopBillingAccess(runtime, {
        shopId: shop.id,
      });
      if (!access.canReceiveLiveCalls) {
        logger.warn(
          { jobId: params.jobId, shopId: shop.id, blockReason: access.blockReason },
          'missed_call_followup_sms_billing_blocked',
        );
        return;
      }

      const smsBody = SMS_MISSED_CALL(shop);
      const idempotencyKey = `job:${params.jobId}:missed-call`;

      const sms = await runtime.smsService.sendSms({
        to: payload.data.customerPhone,
        from: shop.phone_number,
        body: smsBody,
        shopId: shop.id,
        category: 'missed_call',
        idempotencyKey,
      });

      await runtime.outboundMessagesRepository.create({
        shopId: shop.id,
        customerPhone: payload.data.customerPhone,
        category: 'missed_call',
        body: smsBody,
        idempotencyKey,
        status: 'sent',
        providerMessageId: sms.providerMessageId,
      });
    },
    booking_link_sms: async (params) => {
      const payload = bookingLinkSmsPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'booking_link_sms_invalid_payload');
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'booking_link_sms_shop_not_found');
        return;
      }

      const idempotencyKey = `job:${params.jobId}:booking-link`;

      try {
        const sms = await runtime.smsService.sendSms({
          to: payload.data.toPhone,
          from: shop.phone_number,
          body: payload.data.message,
          shopId: shop.id,
          category: 'booking_link',
          idempotencyKey,
        });

        await runtime.outboundMessagesRepository.create({
          shopId: shop.id,
          customerPhone: payload.data.toPhone,
          category: 'booking_link',
          body: payload.data.message,
          idempotencyKey,
          status: 'sent',
          providerMessageId: sms.providerMessageId,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            jobId: params.jobId,
            shopId: shop.id,
            bookingUrl: payload.data.bookingUrl,
          },
          'booking_link_sms_failed',
        );
      }
    },
    cancellation_request_alert: async (params) => {
      const payload = cancellationRequestAlertPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'cancellation_request_alert_invalid_payload');
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        logger.warn({ jobId: params.jobId, shopId: params.shopId }, 'cancellation_request_alert_shop_not_found');
        return;
      }
      if (!shop.sms_owner_opted_in) {
        return;
      }

      const body = [
        `[${shop.name}] CANCEL REQUEST${payload.data.callerName ? ` from ${payload.data.callerName}` : ''}`,
        payload.data.appointmentDate ? `Appointment: ${payload.data.appointmentDate}` : null,
        payload.data.reason ? `Reason: ${payload.data.reason}` : null,
        `Caller phone: ${payload.data.callerPhone || 'not provided'}`,
        'Please confirm cancellation with client.',
      ]
        .filter(Boolean)
        .join('\n');
      const idempotencyKey = `job:${params.jobId}:cancellation-alert`;

      try {
        const sms = await runtime.smsService.sendSms({
          to: shop.user_phone,
          from: shop.phone_number,
          body,
          shopId: shop.id,
          category: 'cancellation_alert',
          idempotencyKey,
        });

        await runtime.outboundMessagesRepository.create({
          shopId: shop.id,
          customerPhone: shop.user_phone,
          category: 'cancellation_alert',
          body,
          idempotencyKey,
          status: 'sent',
          providerMessageId: sms.providerMessageId,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            jobId: params.jobId,
            shopId: shop.id,
            providerName: payload.data.providerName,
          },
          'cancellation_request_alert_failed',
        );
      }
    },
    callback_outbound_call: async (params) => {
      const payload = callbackPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:callback_outbound_call', { retryable: false });
      }

      if ('callbackId' in payload.data) {
        const callback = await runtime.callbacksRepository.findById(payload.data.callbackId);
        if (!callback) {
          throw new JobExecutionError('callback_not_found', { retryable: false });
        }

        const shop = await runtime.shopsRepository.findById(callback.shopId);
        if (!shop) {
          throw new JobExecutionError('shop_not_found', { retryable: false });
        }

        const nextAttemptNumber = callback.attemptCount + 1;
        if (nextAttemptNumber > 3) {
          await runtime.callbacksRepository.markFailed(callback.id);
          throw new JobExecutionError('callback_max_attempts_exceeded', { retryable: false });
        }

        const systemFrom = resolveRingbookerSystemOutboundCallerId();
        if (!systemFrom) {
          logger.warn(
            { shopId: shop.id, jobId: params.jobId, callbackId: callback.id },
            'outbound_caller_id_not_configured',
          );
          await runtime.callbacksRepository.markFailed(callback.id);
          throw new JobExecutionError('outbound_caller_id_not_configured', { retryable: false });
        }

        await runtime.callbacksRepository.markAttempt(callback.id, {});
        try {
          const realtime = await prepareRealtimeCallbackCall({
            shop,
            customerPhone: callback.customerPhone,
            customerName: callback.customerName ?? null,
            reason: callback.reason,
            idempotencySeed: `${params.jobId}-${nextAttemptNumber}`,
          });
          await runtime.telephonyService.createOutboundCall({
            shopId: shop.id,
            to: callback.customerPhone,
            from: systemFrom,
            purpose: 'callback',
            requestId: realtime.requestId,
            idempotencyKey: `job:${params.jobId}:callback-call:${nextAttemptNumber}`,
            roomName: realtime.roomName,
          });
          await runtime.callbacksRepository.markCompleted(callback.id);
        } catch (error) {
          if (nextAttemptNumber >= 3) {
            await runtime.callbacksRepository.markFailed(callback.id);
            throw new JobExecutionError(
              `callback_outbound_call_failed:${error instanceof Error ? error.message : 'unknown'}`,
              { retryable: false },
            );
          }

          const backoffMinutes = getCallbackBackoffMinutes(nextAttemptNumber);
          const nextRunAt = new Date(Date.now() + backoffMinutes * 60_000);
          await runtime.callbacksRepository.markQueued(callback.id, { nextAttemptAt: nextRunAt });
          throw new JobExecutionError(
            `callback_outbound_call_retry_scheduled:${error instanceof Error ? error.message : 'unknown'}`,
            { retryable: true, nextRunAt },
          );
        }
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }

      const systemFrom = resolveRingbookerSystemOutboundCallerId();
      if (!systemFrom) {
        logger.warn({ shopId: shop.id, jobId: params.jobId }, 'outbound_caller_id_not_configured');
        throw new JobExecutionError('outbound_caller_id_not_configured', { retryable: false });
      }

      const realtime = await prepareRealtimeCallbackCall({
        shop,
        customerPhone: payload.data.customerPhone,
        customerName: payload.data.customerName ?? null,
        reason: payload.data.reason ?? 'Customer requested callback',
        idempotencySeed: `${params.jobId}-direct`,
      });

      await runtime.telephonyService.createOutboundCall({
        shopId: shop.id,
        to: payload.data.customerPhone,
        from: systemFrom,
        purpose: 'callback',
        requestId: realtime.requestId,
        idempotencyKey: `job:${params.jobId}:callback-call:direct`,
        roomName: realtime.roomName,
      });
    },
    review_request_sms: async (params) => {
      const payload = reminderPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:review_request_sms', { retryable: false });
      }

      const booking = await runtime.bookingsRepository.findById(payload.data.bookingId);
      if (!booking) {
        throw new JobExecutionError('booking_not_found', { retryable: false });
      }

      const shop = await runtime.shopsRepository.findById(booking.shopId);
      if (!shop) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }
      if (!shop.send_review_request_sms) {
        await runtime.bookingsRepository.markReviewRequestSent(booking.id);
        return;
      }
      if (!canUseReviewRequestSms(shop.plan)) {
        logger.warn(
          { jobId: params.jobId, shopId: shop.id, plan: shop.plan, feature: 'review_request_sms' },
          'plan_feature_locked',
        );
        await runtime.bookingsRepository.markReviewRequestSent(booking.id);
        return;
      }

      const body = `${shop.name}: Thanks for visiting us! We'd love your feedback!`;
      const idempotencyKey = `job:${params.jobId}:review-request`;

      const sms = await runtime.smsService.sendSms({
        to: booking.customerPhone,
        from: shop.phone_number,
        body,
        shopId: shop.id,
        category: 'review_request',
        bookingId: booking.id,
        idempotencyKey,
      });

      await runtime.outboundMessagesRepository.create({
        shopId: shop.id,
        bookingId: booking.id,
        customerPhone: booking.customerPhone,
        category: 'review_request',
        body,
        idempotencyKey,
        status: 'sent',
        providerMessageId: sms.providerMessageId,
      });
      await runtime.bookingsRepository.markReviewRequestSent(booking.id);
    },
    post_call_summary: async (params) => {
      const payload = postCallSummaryPayloadSchema.safeParse(params.payload);
      if (!payload.success) {
        throw new JobExecutionError('invalid_payload:post_call_summary', { retryable: false });
      }
      const callLogsRepository = runtime.callLogsRepository;
      if (!callLogsRepository) {
        throw new JobExecutionError('call_logs_repository_unavailable', { retryable: false });
      }
      const logs = await callLogsRepository.listByShop(params.shopId, { limit: 300 });
      const call = logs.find((item) => item.requestId === payload.data.requestId);
      if (!call) {
        throw new JobExecutionError('call_log_not_found_for_summary', {
          retryable: true,
          nextRunAt: new Date(Date.now() + 15_000),
        });
      }
      const existingTranscript = call.transcriptText?.trim() ?? '';
      if (existingTranscript.includes('[POST_CALL_SUMMARY]')) {
        return;
      }
      const status = payload.data.status ?? 'completed';
      const transcriptLines = existingTranscript
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const callerTurns = transcriptLines.filter((line) => line.includes('CALLER:'));
      const assistantTurns = transcriptLines.filter((line) => line.includes('ASSISTANT:'));
      const firstCaller = callerTurns[0]?.replace(/^.*CALLER:\s*/i, '') ?? '';
      const lastAssistant = assistantTurns.at(-1)?.replace(/^.*ASSISTANT:\s*/i, '') ?? '';
      const summaryParts = [
        `[POST_CALL_SUMMARY] status=${status}`,
        `outcome=${call.outcome ?? 'unknown'}`,
        `agentJoined=${call.agentJoined ? 'yes' : 'no'}`,
        `humanAnswered=${call.humanAnswered ? 'yes' : 'no'}`,
      ];
      if (payload.data.error) {
        summaryParts.push(`error=${payload.data.error}`);
      }
      if (firstCaller) {
        summaryParts.push(`firstCaller="${firstCaller.slice(0, 180)}"`);
      }
      if (lastAssistant) {
        summaryParts.push(`lastAssistant="${lastAssistant.slice(0, 180)}"`);
      }
      await callLogsRepository.appendTranscriptByRequestId({
        shopId: params.shopId,
        requestId: payload.data.requestId,
        speaker: 'system',
        text: summaryParts.join(' | '),
      });

      try {
        const extracted = await extractCallSummary(existingTranscript);
        await callLogsRepository.updateStructuredSummary(params.shopId, payload.data.requestId, {
          summaryServiceRequest: extracted.serviceRequest,
          summaryUrgency: extracted.urgency,
          summaryNextAction: extracted.nextAction,
          summaryCallerQuestion: extracted.callerQuestion,
          summaryCallerName: extracted.callerName,
          summaryPreferredTech: extracted.preferredTech,
          summaryPreferredDatetime: extracted.preferredDatetime,
          summaryFollowUpRequired: extracted.followUpRequired,
        });
      } catch (summaryErr) {
        console.warn('[post_call_summary] Structured extraction failed:', summaryErr);
      }
    },
    lifecycle_email: async (params) => {
      const payload = lifecycleEmailPayloadSchema.safeParse(params.payload);
      if (!payload.success) throw new JobExecutionError('invalid_lifecycle_email_payload', { retryable: false });
      if (!runtime.emailService || !runtime.billingNotificationsRepository || !runtime.shopsRepository) {
        throw new JobExecutionError('lifecycle_email_dependencies_unavailable', { retryable: true });
      }

      const kind = payload.data.kind;
      const notificationType = lifecycleNotificationTypeFor(kind, payload.data.status);
      const subscriptionId = payload.data.subscriptionId ?? null;
      if (
        await runtime.billingNotificationsRepository.hasSent({
          shopId: params.shopId,
          subscriptionId,
          type: notificationType,
          channel: 'email',
        })
      ) {
        return;
      }

      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (!shop && !kind.startsWith('internal_')) {
        throw new JobExecutionError('shop_not_found', { retryable: false });
      }
      const subscription = runtime.billingSubscriptionsRepository
        ? await runtime.billingSubscriptionsRepository.findCurrentByShopId(params.shopId)
        : null;
      const accessState = runtime.shopAccessStatesRepository
        ? await runtime.shopAccessStatesRepository.findByShopId(params.shopId)
        : null;

      const isInternal = kind === 'forwarding_number_failed_internal' || kind.startsWith('internal_');
      const customer = runtime.billingCustomersRepository
        ? await runtime.billingCustomersRepository.findByShopId(params.shopId).catch(() => null)
        : null;
      const to = isInternal ? emailSupportAddress() : customer?.email?.trim();
      if (!isInternal && !isDeliverableLifecycleEmail(to)) {
        logger.warn({ shopId: params.shopId, kind, to }, 'lifecycle_email_skipped_no_deliverable_customer_email');
        await runtime.billingNotificationsRepository.markSent({
          shopId: params.shopId,
          subscriptionId,
          type: notificationType,
          channel: 'email',
          metadata: { skipped: true, reason: 'no_deliverable_customer_email' },
        });
        return;
      }

      const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
      const currentShopName = shop?.name ?? payload.data.fields?.shop_id?.toString() ?? params.shopId;
      const forwardingNumber = payload.data.forwardingNumber ?? shop?.telnyx_number ?? '';
      let from = emailDefaultFrom();
      let replyTo = emailSupportAddress();
      let category: EmailCategory = 'internal_alert';
      let built: { input: BaseEmailInput; text: string };

      switch (kind) {
        case 'finish_onboarding_reminder_1':
        case 'finish_onboarding_reminder_2':
          if (!shop || isShopSetupWizardComplete(shop)) return;
          from = emailFounderFrom();
          replyTo = emailReplyTo();
          category = 'finish_onboarding_reminder';
          built = buildFinishOnboardingReminderEmailPayload({ email: to!, shopName: shop.name, appBaseUrl });
          break;
        case 'add_payment_method_go_live':
          if (!shop || !subscription || !isShopSetupWizardComplete(shop) || subscription.paymentMethodStatus === 'valid' || accessState?.liveCallsEnabled) return;
          from = emailFounderFrom();
          replyTo = emailReplyTo();
          category = 'add_payment_method_go_live';
          built = buildAddPaymentMethodGoLiveEmailPayload({
            email: to!,
            shopName: shop.name,
            appBaseUrl,
            paddleTrialConfigVerified: process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true',
          });
          break;
        case 'payment_method_added':
          if (!shop || !subscription || subscription.paymentMethodStatus !== 'valid' || !['trialing', 'active'].includes(subscription.status)) return;
          category = 'billing_payment_method_added';
          built = buildPaymentMethodAddedEmailPayload({ shopName: shop.name, appBaseUrl });
          break;
        case 'forwarding_number_ready':
          if (!shop || !forwardingNumber.trim()) return;
          category = 'forwarding_number_ready';
          built = buildForwardingNumberReadyEmailPayload({ shopName: shop.name, forwardingNumber: forwardingNumber.trim(), appBaseUrl });
          break;
        case 'forwarding_number_failed_user':
          if (!shop) return;
          category = 'forwarding_number_failed';
          built = buildForwardingProvisionFailedEmailPayload({ shopName: shop.name, appBaseUrl });
          break;
        case 'forwarding_not_verified_24h':
        case 'forwarding_not_verified_72h':
          if (!shop || !forwardingNumber.trim() || accessState?.forwardingSetupVerifiedAt || accessState?.liveCallsEnabled) return;
          from = emailFounderFrom();
          replyTo = emailReplyTo();
          category = 'forwarding_not_verified_reminder';
          built = buildForwardingNotVerifiedReminderEmailPayload({
            email: to!,
            shopName: shop.name,
            forwardingNumber: forwardingNumber.trim(),
            appBaseUrl,
          });
          break;
        case 'forwarding_verified':
          if (!shop || !accessState?.forwardingSetupVerifiedAt) return;
          category = 'forwarding_verified';
          built = buildForwardingVerifiedEmailPayload({ shopName: shop.name, appBaseUrl });
          break;
        case 'live_answering_enabled':
          if (!shop || !accessState?.liveCallsEnabled) return;
          category = 'live_answering_enabled';
          built = buildLiveAnsweringEnabledEmailPayload({ shopName: shop.name, appBaseUrl });
          break;
        case 'live_answering_billing_paused':
          if (
            !shop ||
            !subscription ||
            (!['canceled', 'paused', 'past_due', 'unpaid'].includes(subscription.status) && subscription.paymentMethodStatus !== 'failed')
          ) return;
          category = 'live_answering_billing_paused';
          built = buildLiveAnsweringBillingPausedEmailPayload({
            shopName: shop.name,
            status: payload.data.status ?? subscription.status,
            appBaseUrl,
          });
          break;
        case 'live_answering_billing_restored':
          if (!shop || !subscription || !['active', 'trialing'].includes(subscription.status)) return;
          category = 'live_answering_billing_restored';
          built = buildLiveAnsweringBillingRestoredEmailPayload({ shopName: shop.name, appBaseUrl });
          break;
        case 'forwarding_number_failed_internal':
        case 'internal_paddle_alert':
        case 'internal_telnyx_alert':
        case 'internal_live_billing_blocked_alert':
          category = 'internal_alert';
          built = buildInternalAlertEmailPayload({
            title: payload.data.title ?? 'RingBooker internal lifecycle alert',
            summary: payload.data.summary ?? kind,
            fields: {
              shop_id: params.shopId,
              kind,
              ...(payload.data.fields ?? {}),
            },
          });
          break;
        default:
          throw new JobExecutionError('unknown_lifecycle_email_kind', { retryable: false });
      }

      await runtime.emailService.sendEmail({
        to: to!,
        subject: built.input.title,
        text: built.text,
        html: await renderBaseEmailHtml(built.input),
        category,
        idempotencyKey: `lifecycle:${params.shopId}:${subscriptionId ?? 'none'}:${kind}`,
        shopId: params.shopId,
        from,
        replyTo,
      });
      await runtime.billingNotificationsRepository.markSent({
        shopId: params.shopId,
        subscriptionId,
        type: notificationType,
        channel: 'email',
      });
    },
    trial_reminder_email: async (params) => {
      const payload = z.object({ daysRemaining: z.union([z.literal(7), z.literal(3), z.literal(1)]) }).safeParse(params.payload);
      if (!payload.success) throw new JobExecutionError('invalid_trial_reminder_payload', { retryable: false });
      if (!runtime.billingSubscriptionsRepository || !runtime.billingNotificationsRepository || !runtime.shopsRepository || !runtime.billingCustomersRepository || !runtime.emailService) {
        throw new JobExecutionError('trial_reminder_dependencies_unavailable', { retryable: true });
      }
      const shop = await runtime.shopsRepository.findById(params.shopId);
      const subscription = await runtime.billingSubscriptionsRepository.findCurrentByShopId(params.shopId);
      if (!shop || !subscription?.trialEndsAt || subscription.status !== 'trialing') return;
      const type =
        payload.data.daysRemaining === 1
          ? 'trial_ends_1_day'
          : payload.data.daysRemaining === 3
            ? 'trial_ends_3_days'
            : 'trial_ends_7_days';
      if (await runtime.billingNotificationsRepository.hasSent({ shopId: params.shopId, subscriptionId: subscription.id, type, channel: 'email' })) return;
      const customer = await runtime.billingCustomersRepository.findByShopId(params.shopId);
      const email = customer?.email?.trim();
      if (!isDeliverableLifecycleEmail(email)) {
        logger.warn({ shopId: params.shopId, type, email }, 'trial_reminder_email_skipped_no_deliverable_customer_email');
        await runtime.billingNotificationsRepository.markSent({
          shopId: params.shopId,
          subscriptionId: subscription.id,
          type,
          channel: 'email',
          metadata: { skipped: true, reason: 'no_deliverable_customer_email' },
        });
        return;
      }
      const { input, text } = buildTrialReminderEmailPayload({
        email,
        shopName: shop.name,
        daysRemaining: payload.data.daysRemaining,
        trialEndsAt: subscription.trialEndsAt,
        shopTimezone: shop.timezone,
        appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
        paddleTrialConfigVerified: process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true',
      });
      await runtime.emailService.sendEmail({
        to: email,
        subject: input.title,
        text,
        html: await renderBaseEmailHtml(input),
        category: 'billing_trial_reminder',
        idempotencyKey: `billing:${params.shopId}:${type}:${subscription.id}`,
        shopId: params.shopId,
        from: emailFounderFrom(),
        replyTo: emailReplyTo(),
      });
      await runtime.billingNotificationsRepository.markSent({ shopId: params.shopId, subscriptionId: subscription.id, type, channel: 'email' });
    },
    trial_expiry_check: async (params) => {
      if (!runtime.billingSubscriptionsRepository || !runtime.shopAccessStatesRepository || !runtime.billingNotificationsRepository || !runtime.shopsRepository || !runtime.billingCustomersRepository) {
        throw new JobExecutionError('trial_expiry_dependencies_unavailable', { retryable: true });
      }
      const now = new Date();
      const subscription = await runtime.billingSubscriptionsRepository.findCurrentByShopId(params.shopId);
      if (!subscription || subscription.paymentMethodStatus === 'valid') return;
      if (subscription.status === 'trial_expired') {
        const shop = await runtime.shopsRepository.findById(params.shopId);
        if (!shop) return;
        if (await runtime.billingNotificationsRepository.hasSent({ shopId: params.shopId, subscriptionId: subscription.id, type: 'trial_ended', channel: 'email' })) return;
        if (runtime.emailService) {
          const customer = await runtime.billingCustomersRepository.findByShopId(params.shopId);
          const email = customer?.email?.trim();
          if (!isDeliverableLifecycleEmail(email)) {
            logger.warn({ shopId: params.shopId, email }, 'trial_ended_email_skipped_no_deliverable_customer_email');
            await runtime.billingNotificationsRepository.markSent({
              shopId: params.shopId,
              subscriptionId: subscription.id,
              type: 'trial_ended',
              channel: 'email',
              metadata: { skipped: true, reason: 'no_deliverable_customer_email' },
            });
            return;
          }
          const { input, text } = buildTrialEndedEmailPayload({
            email,
            shopName: shop.name,
            trialEndsAt: subscription.trialEndsAt,
            shopTimezone: shop.timezone,
            appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
          });
          await runtime.emailService.sendEmail({
            to: email,
            subject: input.title,
            text,
            html: await renderBaseEmailHtml(input),
            category: 'billing_trial_ended',
            idempotencyKey: `billing:${params.shopId}:trial_ended:${subscription.id}`,
            shopId: params.shopId,
            from: emailFounderFrom(),
            replyTo: emailReplyTo(),
          });
          await runtime.billingNotificationsRepository.markSent({ shopId: params.shopId, subscriptionId: subscription.id, type: 'trial_ended', channel: 'email' });
        }
        return;
      }
      if (subscription.status !== 'trialing') return;
      if (!subscription.trialEndsAt || new Date(subscription.trialEndsAt).getTime() > now.getTime()) return;
      const expired = await runtime.billingSubscriptionsRepository.upsert({
        shopId: params.shopId,
        provider: subscription.provider,
        providerSubscriptionId: subscription.providerSubscriptionId ?? null,
        providerCustomerId: subscription.providerCustomerId ?? null,
        plan: subscription.plan,
        status: 'trial_expired',
        interval: subscription.interval,
        currency: subscription.currency,
        amount: subscription.amount,
        amountCents: subscription.amountCents ?? Math.round(subscription.amount * 100),
        currentPeriodStart: subscription.currentPeriodStart ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd ?? subscription.trialEndsAt,
        trialStartedAt: subscription.trialStartedAt ?? null,
        trialEndsAt: subscription.trialEndsAt,
        trialExpiredAt: now.toISOString(),
        paymentMethodStatus: subscription.paymentMethodStatus ?? 'none',
        metadata: { ...(subscription.metadata ?? {}), expired_by: 'trial_expiry_check' },
      });
      await runtime.shopAccessStatesRepository.upsert({
        shopId: params.shopId,
        liveCallsEnabled: false,
        liveCallsPausedReason: 'trial_expired',
        liveCallsPausedAt: now.toISOString(),
      });
      const shop = await runtime.shopsRepository.findById(params.shopId);
      if (shop && runtime.emailService && !(await runtime.billingNotificationsRepository.hasSent({ shopId: params.shopId, subscriptionId: expired.id, type: 'trial_ended', channel: 'email' }))) {
        const customer = await runtime.billingCustomersRepository.findByShopId(params.shopId);
        const email = customer?.email?.trim();
        if (!isDeliverableLifecycleEmail(email)) {
          logger.warn({ shopId: params.shopId, email }, 'trial_ended_email_skipped_no_deliverable_customer_email');
          await runtime.billingNotificationsRepository.markSent({
            shopId: params.shopId,
            subscriptionId: expired.id,
            type: 'trial_ended',
            channel: 'email',
            metadata: { skipped: true, reason: 'no_deliverable_customer_email' },
          });
          return;
        }
        const { input, text } = buildTrialEndedEmailPayload({
          email,
          shopName: shop.name,
          trialEndsAt: expired.trialEndsAt,
          shopTimezone: shop.timezone,
          appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
        });
        await runtime.emailService.sendEmail({
          to: email,
          subject: input.title,
          text,
          html: await renderBaseEmailHtml(input),
          category: 'billing_trial_ended',
          idempotencyKey: `billing:${params.shopId}:trial_ended:${expired.id}`,
          shopId: params.shopId,
          from: emailFounderFrom(),
          replyTo: emailReplyTo(),
        });
        await runtime.billingNotificationsRepository.markSent({ shopId: params.shopId, subscriptionId: expired.id, type: 'trial_ended', channel: 'email' });
      }
    },
  };
  return handlers;
}

function getWorkerRuntimeConfig(): { jobPollIntervalMs: number; jobLeaseSeconds: number } {
  const jobPollIntervalMsRaw = Number(process.env.JOB_POLL_INTERVAL_MS ?? 5000);
  const jobLeaseSecondsRaw = Number(process.env.JOB_LEASE_SECONDS ?? 60);

  return {
    jobPollIntervalMs: Number.isFinite(jobPollIntervalMsRaw) && jobPollIntervalMsRaw > 0 ? jobPollIntervalMsRaw : 5000,
    jobLeaseSeconds: Number.isFinite(jobLeaseSecondsRaw) && jobLeaseSecondsRaw > 0 ? jobLeaseSecondsRaw : 60,
  };
}

function getCallbackBackoffMinutes(attemptNumber: number): number {
  if (attemptNumber <= 1) return 5;
  if (attemptNumber === 2) return 15;
  return 30;
}

function toLocalLabels(datetimeUtcIso: string, timezone: string): { dateLabel: string; timeLabel: string } {
  return {
    dateLabel: formatShopDate(datetimeUtcIso, timezone),
    timeLabel: formatShopTime(datetimeUtcIso, timezone),
  };
}
