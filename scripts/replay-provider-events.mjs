#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const appBaseUrl = process.env.APP_BASE_URL;
const provider = String(process.env.REPLAY_PROVIDER || 'paddle').toLowerCase();
const lookbackDays = Number(process.env.REPLAY_LOOKBACK_DAYS || 14);
const maxRows = Number(process.env.REPLAY_MAX_ROWS || 200);
const apply = String(process.env.REPLAY_APPLY || '').toLowerCase() === 'true';
const eventIdFilter = String(process.env.REPLAY_PROVIDER_EVENT_ID || '').trim();
const onlyFailed = String(process.env.REPLAY_ONLY_FAILED || 'true').toLowerCase() !== 'false';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

if (!appBaseUrl) {
  console.error('APP_BASE_URL is required');
  process.exit(1);
}

if (provider !== 'paddle') {
  console.error(
    "REPLAY_PROVIDER must be 'paddle' for automated replay. Telnyx replay is intentionally manual-only to avoid unsafe side-effects.",
  );
  process.exit(1);
}

if (!process.env.PADDLE_WEBHOOK_SECRET) {
  console.error('PADDLE_WEBHOOK_SECRET is required for replay signing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeReplayEventId(originalEventId, index) {
  return `${originalEventId}::replay::${Date.now()}::${index}`;
}

function signPaddleBody(rawBody) {
  const ts = Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}:${rawBody}`;
  const digest = createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET).update(signedPayload).digest('hex');
  return `ts=${ts};h1=${digest}`;
}

async function updateOriginalEventStatus(params) {
  const patch = {
    processed_at: new Date().toISOString(),
    processing_error: params.processingError,
  };
  const { error } = await supabase
    .from('provider_events')
    .update(patch)
    .eq('provider', 'paddle')
    .eq('provider_event_id', params.providerEventId);
  if (error) {
    throw new Error(`provider_event_status_update_failed:${params.providerEventId}:${error.message}`);
  }
}

async function replayOne(row, index) {
  const originalPayload = row.payload_raw;
  if (!originalPayload || typeof originalPayload !== 'object') {
    return { ok: false, reason: 'invalid_payload_raw' };
  }
  const originalEventId = row.provider_event_id;
  const replayEventId = makeReplayEventId(originalEventId, index);
  const replayPayload = {
    ...originalPayload,
    event_id: replayEventId,
    meta: {
      ...(originalPayload.meta && typeof originalPayload.meta === 'object' ? originalPayload.meta : {}),
      replay_of_event_id: originalEventId,
      replayed_at: new Date().toISOString(),
    },
  };

  const body = JSON.stringify(replayPayload);
  const signature = signPaddleBody(body);
  const endpoint = `${appBaseUrl}/api/backend/webhooks/paddle`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signature,
    },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    return {
      ok: false,
      reason: `replay_webhook_failed:${response.status}`,
      payload,
      replayEventId,
    };
  }

  return {
    ok: true,
    replayEventId,
  };
}

async function run() {
  const sinceIso = daysAgoIso(lookbackDays);
  let query = supabase
    .from('provider_events')
    .select('provider,provider_event_id,event_type,payload_raw,received_at,processed_at,processing_error')
    .eq('provider', provider)
    .gte('received_at', sinceIso)
    .order('received_at', { ascending: true })
    .limit(maxRows);

  if (eventIdFilter) {
    query = query.eq('provider_event_id', eventIdFilter);
  } else if (onlyFailed) {
    query = query.not('processing_error', 'is', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('provider_events replay query failed', error.message);
    process.exit(1);
  }

  const candidates = data ?? [];
  const summary = {
    ok: true,
    mode: apply ? 'apply' : 'dry_run',
    provider,
    lookedBackDays: lookbackDays,
    maxRows,
    filteredByEventId: eventIdFilter || null,
    onlyFailed,
    scannedCandidates: candidates.length,
    replayed: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  if (!apply) {
    summary.details = candidates.slice(0, 50).map((row) => ({
      providerEventId: row.provider_event_id,
      eventType: row.event_type,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
      processingError: row.processing_error,
    }));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const row = candidates[index];
    try {
      const result = await replayOne(row, index);
      if (!result.ok) {
        summary.failed += 1;
        summary.details.push({
          providerEventId: row.provider_event_id,
          status: 'failed',
          reason: result.reason,
          replayEventId: result.replayEventId ?? null,
        });
        await updateOriginalEventStatus({
          providerEventId: row.provider_event_id,
          processingError: `replay_failed:${result.reason}`,
        });
        continue;
      }

      summary.replayed += 1;
      summary.details.push({
        providerEventId: row.provider_event_id,
        status: 'replayed',
        replayEventId: result.replayEventId,
      });
      await updateOriginalEventStatus({
        providerEventId: row.provider_event_id,
        processingError: null,
      });
    } catch (replayError) {
      summary.failed += 1;
      summary.details.push({
        providerEventId: row.provider_event_id,
        status: 'failed',
        reason: replayError instanceof Error ? replayError.message : 'unknown_replay_error',
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(2);
}

run().catch((error) => {
  console.error('replay-provider-events failed', error);
  process.exit(1);
});

