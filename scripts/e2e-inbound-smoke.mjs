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

async function run() {
  const startInbound = await fetch(`${apiBase}/agent/start-inbound`, {
    method: 'POST',
    headers: withHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
    }),
  });
  const inboundBody = await startInbound.json().catch(() => null);
  if (!startInbound.ok || !inboundBody?.ok) {
    console.error('start-inbound failed', startInbound.status, inboundBody);
    process.exit(1);
  }

  const tick = await fetch(`${apiBase}/jobs/tick`, {
    method: 'POST',
    headers: withHeaders(),
  });
  const tickBody = await tick.json().catch(() => null);
  if (!tick.ok || !tickBody?.ok) {
    console.error('jobs tick failed', tick.status, tickBody);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint: apiBase,
        requestId: inboundBody.requestId,
        roomName: inboundBody.roomName,
        realtime: inboundBody.realtime,
        tick: tickBody,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('e2e-inbound-smoke failed', error);
  process.exit(1);
});
