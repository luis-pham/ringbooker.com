import type { Context } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { getEnv } from '@/src/backend/config/env';
import type { ProviderEventsRepository } from '@/src/backend/ports/repositories';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getClientIp } from '@/src/backend/security/rate-limit';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';

const paddleEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
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

export async function handlePaddleWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    billingProvider?: BillingProviderAdapter;
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
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed('paddle', dedupeKey);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', {
        provider: 'paddle',
        outcome: 'duplicate',
      });
      return c.json({ ok: true }, 200);
    }

    await deps.providerEventsRepository.markProcessed({
      provider: 'paddle',
      providerEventId: dedupeKey,
      eventType: event.event_type,
      payload: event,
    });

    if (deps.billingProvider?.provider === 'paddle' && event.data) {
      await deps.billingProvider.syncWebhookEvent({
        eventType: event.event_type,
        payload: event.data,
      });
    }

    await deps.providerEventsRepository.clearProcessingError('paddle', dedupeKey);
    incrementMetric('webhook_requests_total', {
      provider: 'paddle',
      outcome: 'processed',
    });
    return c.json({ ok: true }, 200);
  } catch (error) {
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
