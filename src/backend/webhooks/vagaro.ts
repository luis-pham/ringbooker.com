import type { Context } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import type { ProviderEventsRepository } from '@/src/backend/ports/repositories';
import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getClientIp } from '@/src/backend/security/rate-limit';

const vagaroAppointmentPayloadSchema = z.object({
  appointmentId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  bookingStatus: z.string().optional(),
  serviceTitle: z.string().optional(),
  serviceId: z.string().optional(),
  calendarEventId: z.string().nullable().optional(),
  amount: z.number().optional(),
  eventType: z.string().optional(),
  onlineVsInhouse: z.string().optional(),
  appointmentTypeCode: z.string().optional(),
  appointmentTypeName: z.string().optional(),
  customerId: z.string().optional(),
  bookingSource: z.string().optional(),
  serviceProviderId: z.string().optional(),
  businessId: z.string().optional(),
  businessAlias: z.string().optional(),
  businessGroupId: z.string().optional(),
  serviceCategory: z.string().optional(),
  createdDate: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  modifiedDate: z.string().nullable().optional(),
  modifiedBy: z.string().nullable().optional(),
  formResponseIds: z.array(z.string()).optional(),
});

const vagaroCustomerPayloadSchema = z.object({
  customerId: z.string().optional(),
  businessIds: z.array(z.string()).optional(),
  customerFirstName: z.string().optional(),
  customerLastName: z.string().optional(),
  businessGroupId: z.string().optional(),
  email: z.string().optional(),
  mobilePhone: z.string().optional(),
  dayPhone: z.string().optional(),
  nightPhone: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  regionCode: z.string().optional(),
  regionName: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  postalCode: z.string().optional(),
  createdDate: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  modifiedDate: z.string().nullable().optional(),
  modifiedBy: z.string().nullable().optional(),
});

const vagaroWebhookSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    createdDate: z.string(),
    type: z.literal('appointment'),
    action: z.enum(['created', 'updated', 'deleted']),
    payload: vagaroAppointmentPayloadSchema,
  }),
  z.object({
    id: z.string(),
    createdDate: z.string(),
    type: z.literal('customer'),
    action: z.enum(['created', 'updated']),
    payload: vagaroCustomerPayloadSchema,
  }),
]);

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function verifyVagaroSignature(params: { expectedToken?: string; signature?: string | null }): boolean {
  const expected = params.expectedToken?.trim();
  const signature = params.signature?.trim();
  if (!expected || !signature) return false;
  return timingSafeEqualString(signature, expected);
}

export function verifyVagaroWebhookHmac(params: {
  rawBody: string;
  secret: string;
  signature?: string | null;
}): boolean {
  const signature = params.signature?.trim();
  const secret = params.secret.trim();
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(params.rawBody).digest('hex');
  const normalizedCandidates = [
    signature,
    signature.replace(/^sha256=/i, ''),
    signature.replace(/^hmac-sha256=/i, ''),
  ].map((value) => value.trim().toLowerCase());
  return normalizedCandidates.some((candidate) => /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqualString(candidate, expected));
}

export async function handleVagaroWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
  },
) {
  const signature = c.req.header('x-vagaro-signature') ?? c.req.header('X-Vagaro-Signature') ?? null;
  const expectedToken = process.env.VAGARO_WEBHOOK_VERIFICATION_TOKEN;

  if (!verifyVagaroSignature({ expectedToken, signature })) {
    incrementMetric('webhook_requests_total', {
      provider: 'vagaro',
      outcome: 'invalid_signature',
    });
    securityAudit({
      action: 'webhook_signature_invalid',
      actorType: 'provider',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      provider: 'vagaro',
    });
    return c.json({ ok: false }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = vagaroWebhookSchema.safeParse(body);
  if (!parsed.success) {
    incrementMetric('webhook_requests_total', {
      provider: 'vagaro',
      outcome: 'failed',
    });
    return c.json({ ok: false }, 400);
  }

  const event = parsed.data;
  const log = withLogContext({
    requestId: c.req.header('x-request-id') ?? undefined,
    provider: 'vagaro',
  });

  try {
    const processing = await deps.providerEventsRepository.tryMarkProcessing({
      provider: 'vagaro',
      providerEventId: event.id,
      eventType: `${event.type}.${event.action}`,
      payload: event,
    });
    if (!processing.acquired) {
      incrementMetric('webhook_requests_total', {
        provider: 'vagaro',
        outcome: 'duplicate',
      });
      log.info({ eventId: event.id }, 'vagaro_webhook_duplicate');
      return c.json({ ok: true }, 200);
    }

    await deps.providerEventsRepository.markProcessed({
      provider: 'vagaro',
      providerEventId: event.id,
      eventType: `${event.type}.${event.action}`,
      payload: event,
    });

    // Vagaro webhook payloads are persisted as provider events for now.
    // Local appointment/customer sync needs a dedicated mapping layer before mutating RingBooker records.
    incrementMetric('webhook_requests_total', {
      provider: 'vagaro',
      outcome: 'processed',
    });
    log.info({ eventId: event.id, eventType: `${event.type}.${event.action}` }, 'vagaro_webhook_processed');
    return c.json({ ok: true }, 200);
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      'vagaro',
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'vagaro',
      outcome: 'failed',
    });
    log.error({ err: error, eventId: event.id, eventType: `${event.type}.${event.action}` }, 'vagaro_webhook_failed');
    return c.json({ ok: false }, 500);
  }
}
