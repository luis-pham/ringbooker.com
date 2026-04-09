#!/usr/bin/env node

import { createHmac, randomUUID } from 'node:crypto';

const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const apiBase = `${baseUrl.replace(/\/$/, '')}/api/backend`;
const internalKey = process.env.BACKEND_INTERNAL_API_KEY || '';

const destinationPhone = process.env.SMOKE_DESTINATION_PHONE || '+17145550123';
const callerPhone = process.env.SMOKE_CALLER_PHONE || '+14155550199';
const serviceName = process.env.STAGING_E2E_SERVICE_NAME || 'Manicure';

const userEmail = process.env.STAGING_E2E_USER_EMAIL || process.env.USER_AUTH_EMAIL || '';
const userPassword = process.env.STAGING_E2E_USER_PASSWORD || process.env.USER_AUTH_PASSWORD || '';

function jsonHeaders(extra = {}) {
  return {
    'content-type': 'application/json',
    ...(internalKey ? { 'x-backend-key': internalKey } : {}),
    ...extra,
  };
}

function assertOk(condition, message, payload) {
  if (condition) return;
  console.error(`[FAIL] ${message}`);
  if (payload !== undefined) {
    console.error(JSON.stringify(payload, null, 2));
  }
  process.exit(1);
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  return { res, body };
}

function nextLocalDate(daysAhead = 2) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function runReadinessChecks() {
  console.log('\n[STEP] Readiness + runtime');
  const [health, readiness, runtime] = await Promise.all([
    requestJson(`${apiBase}/health`, { headers: jsonHeaders() }),
    requestJson(`${apiBase}/readiness`, { headers: jsonHeaders() }),
    requestJson(`${apiBase}/runtime`, { headers: jsonHeaders() }),
  ]);

  assertOk(health.res.ok && health.body?.ok, 'health failed', health.body);
  assertOk(readiness.res.ok && readiness.body?.ok, 'readiness failed', readiness.body);
  assertOk(runtime.res.ok && runtime.body?.ok, 'runtime failed', runtime.body);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: runtime.body.mode,
        commProvider: runtime.body.commProvider,
        agentRuntimeMode: runtime.body.agentRuntimeMode,
      },
      null,
      2,
    ),
  );
}

async function runInboundAndToolcalls() {
  console.log('\n[STEP] Inbound session + toolcalls');

  const startInbound = await requestJson(`${apiBase}/agent/start-inbound`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
    }),
  });
  assertOk(startInbound.res.ok && startInbound.body?.ok, 'agent/start-inbound failed', startInbound.body);

  const checkAvailability = await requestJson(`${apiBase}/agent/simulate-inbound`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
      tool: 'check_availability',
      params: {
        date: nextLocalDate(2),
        time: '10:00',
        service: serviceName,
      },
    }),
  });
  assertOk(
    checkAvailability.res.ok && checkAvailability.body?.ok,
    'simulate check_availability failed',
    checkAvailability.body,
  );

  const createBooking = await requestJson(`${apiBase}/agent/simulate-inbound`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
      tool: 'create_booking',
      params: {
        date: nextLocalDate(3),
        time: '11:00',
        service: serviceName,
        customerName: 'Staging E2E',
      },
    }),
  });
  assertOk(createBooking.res.ok && createBooking.body?.ok, 'simulate create_booking failed', createBooking.body);
  assertOk(
    createBooking.body?.result?.success === true && typeof createBooking.body?.result?.bookingId === 'string',
    'create_booking did not return bookingId',
    createBooking.body,
  );

  const scheduleCallback = await requestJson(`${apiBase}/agent/simulate-inbound`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      destinationPhone,
      callerPhone,
      tool: 'schedule_callback',
      params: {
        customerName: 'Staging E2E',
        reason: 'Staging callback verification',
      },
    }),
  });
  assertOk(
    scheduleCallback.res.ok && scheduleCallback.body?.ok,
    'simulate schedule_callback failed',
    scheduleCallback.body,
  );
  assertOk(
    scheduleCallback.body?.result?.success === true,
    'schedule_callback did not return success',
    scheduleCallback.body,
  );

  console.log(
    JSON.stringify(
      {
        inboundRequestId: startInbound.body.requestId,
        bookingId: createBooking.body.result.bookingId,
        callbackJobId: scheduleCallback.body.result.callbackJobId,
      },
      null,
      2,
    ),
  );
}

async function runJobsTickLoop() {
  console.log('\n[STEP] Worker tick loop');
  const runs = Number(process.env.STAGING_E2E_JOB_TICKS || 3);
  const summary = [];
  for (let i = 0; i < runs; i += 1) {
    const tick = await requestJson(`${apiBase}/jobs/tick`, {
      method: 'POST',
      headers: jsonHeaders(),
    });
    assertOk(tick.res.ok && tick.body?.ok, `jobs/tick failed at iteration ${i + 1}`, tick.body);
    summary.push(tick.body);
  }
  console.log(JSON.stringify({ runs, summary }, null, 2));
}

async function verifyUserBookingsIfConfigured() {
  if (!userEmail || !userPassword) {
    console.log('\n[STEP] User verification skipped (missing STAGING_E2E_USER_EMAIL/STAGING_E2E_USER_PASSWORD)');
    return { shopId: null };
  }

  console.log('\n[STEP] User auth + bookings verify');
  const login = await requestJson(`${apiBase}/auth/user/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: userEmail,
      password: userPassword,
    }),
  });
  assertOk(login.res.ok && login.body?.ok, 'user login failed', login.body);

  const setCookie = login.res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  assertOk(cookie.length > 0, 'user session cookie missing');

  const bookings = await requestJson(`${apiBase}/user/bookings`, {
    headers: {
      cookie,
    },
  });
  assertOk(bookings.res.ok && bookings.body?.ok, 'user/bookings failed', bookings.body);
  const bookingCount = Array.isArray(bookings.body.bookings) ? bookings.body.bookings.length : 0;
  assertOk(bookingCount > 0, 'user/bookings returned empty list', bookings.body);

  console.log(JSON.stringify({ bookingCount, shopId: login.body.shopId || null }, null, 2));
  return { shopId: login.body.shopId || null };
}

function buildPaddleSignature(rawBody, secret) {
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function runPaddleSyncCheck(shopId) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET || '';
  if (!secret || !shopId) {
    console.log('\n[STEP] Paddle sync check skipped (missing PADDLE_WEBHOOK_SECRET or shopId)');
    return;
  }

  console.log('\n[STEP] Paddle webhook plan sync check');
  const event = {
    event_id: `evt_${randomUUID()}`,
    event_type: 'transaction.paid',
    data: {
      custom_data: {
        shop_id: shopId,
      },
      items: [
        {
          price: {
            id: process.env.PADDLE_PRICE_PROFESSIONAL || 'price_professional_staging',
          },
        },
      ],
    },
  };
  const rawBody = JSON.stringify(event);
  const paddleSignature = buildPaddleSignature(rawBody, secret);

  const webhookRes = await requestJson(`${apiBase}/webhooks/paddle`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paddle-signature': paddleSignature,
      ...(internalKey ? { 'x-backend-key': internalKey } : {}),
    },
    body: rawBody,
  });
  assertOk(webhookRes.res.ok && webhookRes.body?.ok, 'paddle webhook failed', webhookRes.body);
  console.log(JSON.stringify({ paddleWebhookOk: true, eventId: event.event_id }, null, 2));
}

async function run() {
  console.log(`[PLAYBOOK] Staging E2E at ${apiBase}`);
  await runReadinessChecks();
  await runInboundAndToolcalls();
  await runJobsTickLoop();
  const { shopId } = await verifyUserBookingsIfConfigured();
  await runPaddleSyncCheck(shopId);
  console.log('\n[PASS] Staging E2E playbook completed');
}

run().catch((error) => {
  console.error('[FATAL] staging playbook failed');
  console.error(error);
  process.exit(1);
});
