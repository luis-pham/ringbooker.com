#!/usr/bin/env node

const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const apiBase = `${baseUrl.replace(/\/$/, '')}/api/backend`;
const internalKey = process.env.BACKEND_INTERNAL_API_KEY || '';
const destinationPhone = process.env.SMOKE_DESTINATION_PHONE || '+17145550123';
const callerPhone = process.env.SMOKE_CALLER_PHONE || '+14155550199';

function withHeaders(extra = {}) {
  return {
    ...(internalKey ? { 'x-backend-key': internalKey } : {}),
    ...extra,
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function fail(message, payload) {
  console.error(`[FAIL] ${message}`);
  if (payload !== undefined) {
    console.error(JSON.stringify(payload, null, 2));
  }
  process.exit(1);
}

function pickMetrics(metrics, name, labels = {}) {
  return (metrics || []).filter((item) => {
    if (item.name !== name) return false;
    for (const [key, value] of Object.entries(labels)) {
      if (item.labels?.[key] !== value) return false;
    }
    return true;
  });
}

async function run() {
  const runtime = await requestJson('/runtime', {
    headers: withHeaders(),
  });
  if (!runtime.response.ok || !runtime.body?.ok) fail('runtime failed', runtime.body);
  if (runtime.body.agentTransportMode !== 'livekit') fail('agent transport is not livekit', runtime.body);
  if (runtime.body.agentVoiceProviderMode !== 'openai_realtime') fail('agent voice provider is not openai_realtime', runtime.body);

  const startInbound = await requestJson('/agent/start-inbound', {
    method: 'POST',
    headers: withHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
    }),
  });
  if (!startInbound.response.ok || !startInbound.body?.ok) fail('start-inbound failed', startInbound.body);

  const tick = await requestJson('/jobs/tick', {
    method: 'POST',
    headers: withHeaders(),
  });
  if (!tick.response.ok || !tick.body?.ok) fail('jobs tick failed', tick.body);

  const metrics = await requestJson('/metrics', {
    headers: withHeaders(),
  });
  if (!metrics.response.ok || !metrics.body?.ok) fail('metrics failed', metrics.body);

  const providerMetrics = pickMetrics(metrics.body.metrics, 'toolcall_queue_failed_total', { provider: 'openai_realtime' });
  const responseLatencyMetrics = pickMetrics(metrics.body.metrics, 'realtime_response_latency_ms', {
    voiceProvider: 'openai_realtime',
  });
  const queueLatencyMetrics = pickMetrics(metrics.body.metrics, 'realtime_audio_queue_latency_ms', {
    voiceProvider: 'openai_realtime',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runtime: runtime.body,
        requestId: startInbound.body.requestId,
        roomName: startInbound.body.roomName,
        realtime: startInbound.body.realtime,
        tick: tick.body,
        metrics: {
          responseLatencyMetrics,
          queueLatencyMetrics,
          providerMetrics,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('smoke-openai-realtime failed', error);
  process.exit(1);
});
