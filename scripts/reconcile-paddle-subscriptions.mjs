#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const lookbackDays = Number(process.env.RECON_LOOKBACK_DAYS || 30);
const apply = String(process.env.RECON_APPLY || '').toLowerCase() === 'true';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const PRICE_TO_PLAN = new Map(
  [
    [process.env.PADDLE_PRICE_STARTER, 'starter'],
    [process.env.PADDLE_PRICE_PROFESSIONAL, 'professional'],
    [process.env.PADDLE_PRICE_ENTERPRISE, 'enterprise'],
  ].filter(([k]) => Boolean(k)),
);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function extractShopId(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data?.custom_data?.shop_id ||
    data?.customData?.shop_id ||
    data?.metadata?.shop_id ||
    data?.business?.external_id ||
    null
  );
}

function mapPlan(data) {
  if (!data || typeof data !== 'object') return null;
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const id = item?.price?.id;
    if (typeof id === 'string' && PRICE_TO_PLAN.has(id)) {
      return PRICE_TO_PLAN.get(id);
    }
  }
  if (typeof data.price_id === 'string' && PRICE_TO_PLAN.has(data.price_id)) {
    return PRICE_TO_PLAN.get(data.price_id);
  }
  return null;
}

function eventToActive(eventType) {
  const t = String(eventType || '').toLowerCase();
  if (t.includes('subscription.canceled') || t.includes('subscription_cancelled')) return false;
  if (t.includes('subscription.created') || t.includes('subscription.updated') || t.includes('transaction.paid') || t.includes('payment.succeeded')) {
    return true;
  }
  return null;
}

async function run() {
  const sinceIso = daysAgoIso(lookbackDays);
  const { data: events, error: eventsError } = await supabase
    .from('provider_events')
    .select('event_type,received_at,payload_raw')
    .eq('provider', 'paddle')
    .gte('received_at', sinceIso)
    .order('received_at', { ascending: true })
    .limit(5000);

  if (eventsError) {
    console.error('provider_events paddle query failed', eventsError.message);
    process.exit(1);
  }

  const latestByShop = new Map();
  for (const row of events ?? []) {
    const payload = row.payload_raw;
    const shopId = extractShopId(payload?.data);
    if (!shopId) continue;
    const plan = mapPlan(payload?.data);
    const active = eventToActive(payload?.event_type);
    if (plan === null && active === null) continue;
    latestByShop.set(shopId, {
      shopId,
      plan,
      active,
      eventType: payload?.event_type,
      receivedAt: row.received_at,
    });
  }

  const shopIds = [...latestByShop.keys()];
  if (shopIds.length === 0) {
    console.log(JSON.stringify({ ok: true, message: 'no_shop_events_found', lookbackDays }, null, 2));
    return;
  }

  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id,plan,active')
    .in('id', shopIds);

  if (shopsError) {
    console.error('shops query failed', shopsError.message);
    process.exit(1);
  }

  const shopById = new Map((shops ?? []).map((shop) => [shop.id, shop]));
  const diffs = [];
  for (const [shopId, patch] of latestByShop.entries()) {
    const current = shopById.get(shopId);
    if (!current) continue;
    const nextPlan = patch.plan ?? current.plan;
    const nextActive = typeof patch.active === 'boolean' ? patch.active : current.active;
    if (nextPlan !== current.plan || nextActive !== current.active) {
      diffs.push({
        shopId,
        currentPlan: current.plan,
        nextPlan,
        currentActive: current.active,
        nextActive,
        sourceEventType: patch.eventType,
        sourceReceivedAt: patch.receivedAt,
      });
    }
  }

  let applied = 0;
  if (apply && diffs.length > 0) {
    for (const diff of diffs) {
      const { error } = await supabase
        .from('shops')
        .update({
          plan: diff.nextPlan,
          active: diff.nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', diff.shopId);
      if (error) {
        console.error(`failed to update shop ${diff.shopId}`, error.message);
        process.exit(1);
      }
      applied += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        lookbackDays,
        mode: apply ? 'apply' : 'dry_run',
        totalEvents: (events ?? []).length,
        shopsFromEvents: shopIds.length,
        diffs: diffs.length,
        applied,
        sampleDiffs: diffs.slice(0, 50),
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('reconcile-paddle-subscriptions failed', error);
  process.exit(1);
});
