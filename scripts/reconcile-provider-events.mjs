#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const lookbackDays = Number(process.env.RECON_LOOKBACK_DAYS || 7);
const maxRows = Number(process.env.RECON_MAX_ROWS || 2000);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function toIsoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function run() {
  const sinceIso = toIsoDaysAgo(lookbackDays);
  const { data, error } = await supabase
    .from('provider_events')
    .select('provider,provider_event_id,event_type,received_at,processed_at,processing_error')
    .gte('received_at', sinceIso)
    .order('received_at', { ascending: false })
    .limit(maxRows);

  if (error) {
    console.error('provider_events query failed', error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  let unprocessed = 0;
  let failed = 0;
  const byProvider = new Map();

  for (const row of rows) {
    const provider = row.provider || 'unknown';
    const current = byProvider.get(provider) || { total: 0, unprocessed: 0, failed: 0 };
    current.total += 1;
    if (!row.processed_at) {
      unprocessed += 1;
      current.unprocessed += 1;
    }
    if (row.processing_error) {
      failed += 1;
      current.failed += 1;
    }
    byProvider.set(provider, current);
  }

  const summary = {
    ok: true,
    lookedBackDays: lookbackDays,
    sinceIso,
    scannedRows: rows.length,
    unprocessed,
    failed,
    byProvider: Object.fromEntries(byProvider.entries()),
    sampleUnprocessed: rows.filter((r) => !r.processed_at).slice(0, 20),
    sampleFailed: rows.filter((r) => Boolean(r.processing_error)).slice(0, 20),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (unprocessed > 0 || failed > 0) {
    process.exit(2);
  }
}

run().catch((error) => {
  console.error('reconcile-provider-events failed', error);
  process.exit(1);
});
