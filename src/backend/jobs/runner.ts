import { dispatchRealtimeSession, RealtimeDispatchError } from '@/src/agent/realtime/dispatch-session';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import type { JobType, Shop } from '@/src/backend/domain/types';
import { JobExecutionError, JobWorker } from '@/src/backend/jobs/worker';
import { logger } from '@/src/backend/observability/logger';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';
import { z } from 'zod';
import { extractCallSummary } from '@/src/backend/services/calls/extract-call-summary';
import { SMS_MISSED_CALL, SMS_REMINDER_24H, SMS_REMINDER_2H } from '@/src/backend/services/sms/types';

type WorkerControls = {
  stop: () => void;
};

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

function createJobHandlers(runtime: ReturnType<typeof getBackendRuntime>) {
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
            from: shop.phone_number,
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
        from: shop.phone_number,
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
  const date = new Date(datetimeUtcIso);
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return { dateLabel, timeLabel };
}
