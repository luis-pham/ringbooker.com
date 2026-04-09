#!/usr/bin/env node

const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const apiBase = `${baseUrl.replace(/\/$/, '')}/api/backend`;
const internalKey = process.env.BACKEND_INTERNAL_API_KEY || '';

function withHeaders(extra = {}) {
  return {
    ...(internalKey ? { 'x-backend-key': internalKey } : {}),
    ...extra,
  };
}

async function requestJson(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: withHeaders(),
  });
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

async function run() {
  const [health, readiness, runtime] = await Promise.all([
    requestJson('/health'),
    requestJson('/readiness'),
    requestJson('/runtime'),
  ]);

  if (!health.response.ok || !health.body?.ok) fail('health failed', health.body);
  if (!readiness.response.ok || !readiness.body?.ok) fail('readiness failed', readiness.body);
  if (!runtime.response.ok || !runtime.body?.ok) fail('runtime failed', runtime.body);

  if (runtime.body.agentTransportMode !== 'livekit') {
    fail('agent transport is not livekit', runtime.body);
  }
  if (runtime.body.agentVoiceProviderMode !== 'openai_realtime') {
    fail('agent voice provider is not openai_realtime', runtime.body);
  }

  const openAiKeyCheck = Array.isArray(readiness.body?.checks)
    ? readiness.body.checks.find((item) => item.key === 'openai_api_key')
    : null;
  if (!openAiKeyCheck?.ok) {
    fail('openai_api_key readiness check is not passing', readiness.body);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint: apiBase,
        runtime: runtime.body,
        readiness: {
          status: readiness.response.status,
          openAiKeyCheck,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('check-openai-realtime-readiness failed', error);
  process.exit(1);
});
