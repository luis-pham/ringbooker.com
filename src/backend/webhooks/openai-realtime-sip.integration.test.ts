import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

function whsecSecret(): { secret: string; raw: Buffer } {
  const raw = randomBytes(32);
  return { secret: `whsec_${raw.toString('base64')}`, raw };
}

function signV1(params: { raw: Buffer; webhookId: string; webhookTimestamp: string; rawBody: string }): string {
  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const mac = createHmac('sha256', params.raw).update(signedContent, 'utf8').digest('base64');
  return `v1,${mac}`;
}

test('openai SIP webhook rejects invalid signature', async () => {
  const { secret } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_API_KEY: 'sk-test-openai',
  });
  resetEnvCacheForTests();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
  });

  const rawBody = '{"type":"realtime.call.incoming","data":{"call_id":"x1","sip_headers":[]}}';
  const res = await app.request('/webhooks/openai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': 'wh_bad_sig',
      'webhook-timestamp': `${Math.floor(Date.now() / 1000)}`,
      'webhook-signature': 'v1,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    },
    body: rawBody,
  });
  assert.equal(res.status, 401);
});

test('openai SIP webhook dedupes webhook-id and mocks accept', async () => {
  const { secret, raw } = whsecSecret();
  const did = '+15551234001';
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
    OPENAI_SIP_DEMO_DID_MAP_JSON: JSON.stringify([
      { did, vertical: 'nail-salon', defaultShopName: 'Pilot Nails' },
    ]),
  });
  resetEnvCacheForTests();

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    testingOpenAiFetch: fetchImpl,
  });

  const webhookId = 'wh_evt_dup_test';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_integration_1',
      sip_headers: [
        { name: 'To', value: `sip:${did.replace('+', '')}@pstn.twilio.com` },
        { name: 'From', value: 'sip:+15559876543@sip.example.com' },
      ],
    },
  });
  const sig = signV1({ raw, webhookId, webhookTimestamp: ts, rawBody });

  const headers = {
    'content-type': 'application/json',
    'webhook-id': webhookId,
    'webhook-timestamp': ts,
    'webhook-signature': sig,
  };

  const first = await app.request('/webhooks/openai', {
    method: 'POST',
    headers,
    body: rawBody,
  });
  assert.equal(first.status, 200);

  const second = await app.request('/webhooks/openai', {
    method: 'POST',
    headers,
    body: rawBody,
  });
  assert.equal(second.status, 200);

  const acceptCalls = calls.filter((c) => c.url.includes('/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('"type":"realtime"'));
  assert.ok(acceptCalls[0].body.includes('Pilot Nails'));
  const acceptJson = JSON.parse(acceptCalls[0].body) as { audio?: { output?: { voice?: string } } };
  assert.equal(acceptJson.audio?.output?.voice, 'shimmer', 'nail-salon DID map → vertical voice');
});

test('openai SIP webhook uses shop DB when DID map empty and To is routable E.164', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  resetEnvCacheForTests();

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    testingOpenAiFetch: fetchImpl,
  });

  const did = '+17145550123';
  const webhookId = 'wh_evt_shop_db_1';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_shop_db_1',
      sip_headers: [
        { name: 'To', value: `sip:${did.replace('+', '')}@pstn.twilio.com` },
        { name: 'From', value: 'sip:+15559876543@sip.example.com' },
      ],
    },
  });
  const sig = signV1({ raw, webhookId, webhookTimestamp: ts, rawBody });

  const res = await app.request('/webhooks/openai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const acceptCalls = calls.filter((c) => c.url.includes('/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('RingBooker Demo Salon'));
});

test('openai SIP webhook resolves shop DB via X-Telnyx-Called-Number when To is OpenAI SIP URI', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  resetEnvCacheForTests();

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    testingOpenAiFetch: fetchImpl,
  });

  const did = '+17145550123';
  const webhookId = 'wh_evt_shop_aux_hdr';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_shop_aux_1',
      sip_headers: [
        { name: 'To', value: '<sip:proj_dummy@sip.api.openai.com;transport=tls>;tag=x' },
        { name: 'X-Telnyx-Called-Number', value: `sip:${did}@sip.telnyx.com` },
        { name: 'From', value: 'sip:+15559876543@sip.example.com' },
      ],
    },
  });
  const sig = signV1({ raw, webhookId, webhookTimestamp: ts, rawBody });

  const res = await app.request('/webhooks/openai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const acceptCalls = calls.filter((c) => c.url.includes('/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('RingBooker Demo Salon'));
});

test('openai SIP demo route registers demo_noop when sideband enabled', async () => {
  const { secret, raw } = whsecSecret();
  const did = '+15551234999';
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'true',
    OPENAI_SIP_DEMO_DID_MAP_JSON: JSON.stringify([
      { did, vertical: 'nail-salon', defaultShopName: 'Pilot Nails 2' },
    ]),
  });
  resetEnvCacheForTests();

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    testingOpenAiFetch: fetchImpl,
  });

  const webhookId = 'wh_evt_demo_noop_tools';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_demo_tools',
      sip_headers: [
        { name: 'To', value: `sip:${did.replace('+', '')}@pstn.twilio.com` },
        { name: 'From', value: 'sip:+15559876543@sip.example.com' },
      ],
    },
  });
  const sig = signV1({ raw, webhookId, webhookTimestamp: ts, rawBody });

  const res = await app.request('/webhooks/openai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const acceptCalls = calls.filter((c) => c.url.includes('/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as { tools?: { name: string }[] };
  assert.equal(acceptJson.tools?.length, 1);
  assert.equal(acceptJson.tools?.[0]?.name, 'demo_noop');
});

test('openai SIP shop route registers business tools when sideband enabled and repositories wired', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'true',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  resetEnvCacheForTests();

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    telephonyService: new NoopTelephonyService(),
    testingOpenAiFetch: fetchImpl,
  });

  const did = '+17145550123';
  const webhookId = 'wh_evt_shop_tools';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_shop_tools_1',
      sip_headers: [
        { name: 'To', value: `sip:${did.replace('+', '')}@pstn.twilio.com` },
        { name: 'From', value: 'sip:+15559876543@sip.example.com' },
      ],
    },
  });
  const sig = signV1({ raw, webhookId, webhookTimestamp: ts, rawBody });

  const res = await app.request('/webhooks/openai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const acceptCalls = calls.filter((c) => c.url.includes('/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as {
    tools?: { name: string }[];
    tool_choice?: string;
  };
  assert.ok(acceptJson.tools?.some((t) => t.name === 'check_availability'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'create_booking'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'request_human_handoff'));
  assert.ok(!acceptJson.tools?.some((t) => t.name === 'transfer_to_user'));
  assert.equal(acceptJson.tool_choice, 'auto');
});
