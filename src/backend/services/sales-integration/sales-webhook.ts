/**
 * Outbound webhooks to sales.ringbooker.com. Best-effort and fire-and-forget —
 * a sales-side outage must never break a demo session or a Paddle webhook.
 *
 * Auth: x-ringbooker-webhook-secret (shared secret == sales RINGBOOKER_WEBHOOK_SECRET).
 * Config: SALES_WEBHOOK_BASE_URL (e.g. https://sales.ringbooker.com) + SALES_WEBHOOK_SECRET.
 */
import { logger } from '@/src/backend/observability/logger';

type DemoEvent = 'play' | 'progress' | 'complete';
type LifecycleEvent = 'signedup' | 'trial' | 'converted' | 'churned';

function salesConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = process.env.SALES_WEBHOOK_BASE_URL?.replace(/\/+$/, '');
  const secret = process.env.SALES_WEBHOOK_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function postToSales(path: string, body: Record<string, unknown>): Promise<void> {
  const config = salesConfig();
  if (!config) return; // integration not configured — no-op
  try {
    await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ringbooker-webhook-secret': config.secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    logger.warn({ err, path }, 'sales_webhook_post_failed');
  }
}

/**
 * Demo tracking. `slug` must match the sales-side demo_slug, which is the URL
 * pathname without the leading slash, i.e. "try/<slug>".
 */
export async function notifySalesDemoEvent(params: {
  slug: string;
  event: DemoEvent;
  pct: number;
  durationSeconds?: number | null;
}): Promise<void> {
  await postToSales('/api/webhooks/demo', {
    slug: `try/${params.slug}`,
    event: params.event,
    pct: params.pct,
    timestamp: new Date().toISOString(),
    duration_seconds: params.durationSeconds ?? undefined,
  });
}

/** Bottom-of-funnel lifecycle, keyed by the originating sales lead id. */
export async function notifySalesLifecycle(params: {
  salesLeadId: string;
  event: LifecycleEvent;
}): Promise<void> {
  await postToSales('/api/webhooks/lifecycle', {
    salesLeadId: params.salesLeadId,
    event: params.event,
    timestamp: new Date().toISOString(),
  });
}
