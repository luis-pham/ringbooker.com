import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryVoiceCallLegsRepository } from '@/src/backend/adapters/memory/voice-call-legs-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { buildCallControlClientState } from '@/src/backend/webhooks/telnyx-call-control';
import {
  resolveOpenAiSipShopRoomContext,
  resolveSipCallerPhoneForShopContext,
  resolveSipCallerPhoneForTools,
} from '@/src/backend/webhooks/openai-realtime-sip';

function whsecSecret(): { secret: string; raw: Buffer } {
  const raw = randomBytes(32);
  return { secret: `whsec_${raw.toString('base64')}`, raw };
}

function signV1(params: { raw: Buffer; webhookId: string; webhookTimestamp: string; rawBody: string }): string {
  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const mac = createHmac('sha256', params.raw).update(signedContent, 'utf8').digest('base64');
  return `v1,${mac}`;
}

class CalendarIntegratedShopsRepository extends InMemoryShopsRepository {
  override async findByDestinationPhone(destinationPhone: string) {
    const shop = await super.findByDestinationPhone(destinationPhone);
    return shop ? { ...shop, google_cal_id: 'primary-calendar' } : shop;
  }

  override async findByTelnyxNumber(e164: string) {
    const shop = await super.findByTelnyxNumber(e164);
    return shop ? { ...shop, google_cal_id: 'primary-calendar' } : shop;
  }

  override async findById(shopId: string) {
    const shop = await super.findById(shopId);
    return shop ? { ...shop, google_cal_id: 'primary-calendar' } : shop;
  }
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_integration_1/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('"type":"realtime"'));
  assert.ok(acceptCalls[0].body.includes('Pilot Nails'));
  const acceptJson = JSON.parse(acceptCalls[0].body) as { audio?: { output?: { voice?: string } } };
  assert.equal(acceptJson.audio?.output?.voice, 'coral', 'nail-salon DID map -> vertical voice');
});

test('openai SIP webhook routes TeXML demo by latest caller demo session when DID header is missing', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  resetEnvCacheForTests();

  const demoSessionsRepository = new InMemoryDemoSessionsRepository();
  await demoSessionsRepository.createSession({
    publicSessionId: 'texml:CA_route_by_caller',
    verticalSlug: 'hair-salon',
    mode: 'free-form',
    source: 'telnyx_texml:inbound',
    callbackPhone: '+15559876543',
    businessName: 'Willow Hair Lounge',
    services: [],
  });

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository,
    testingOpenAiFetch: fetchImpl,
  });

  const webhookId = 'wh_evt_texml_demo_caller_route';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_texml_demo_caller_route',
      sip_headers: [
        { name: 'To', value: 'sip:proj_texml_test@sip.api.openai.com;transport=tls' },
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_texml_demo_caller_route/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('Willow Hair Lounge'));
  const acceptJson = JSON.parse(acceptCalls[0].body) as { audio?: { output?: { voice?: string } } };
  assert.equal(acceptJson.audio?.output?.voice, 'marin', 'hair-salon caller demo session -> vertical voice');
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_shop_db_1/accept'));
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_shop_aux_1/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('RingBooker Demo Salon'));
});

test('openai SIP webhook routes Call Control shop leg by client_state before demo DID fallback', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
    OPENAI_REALTIME_PROJECT_ID: 'proj_dummy',
    DEMO_PHONE_NAIL_SALON: '+15550001001',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  resetEnvCacheForTests();

  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Willow Hair Lounge',
    phone_number: '+13203903579',
    user_phone: '+15550009999',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
  });
  await shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+16187771064',
    services: [{ name: 'Haircut', duration_min: 45, price: 65 }],
  });

  const clientState = buildCallControlClientState({
    shopId: shop.id,
    requestId: 'req_shop_cs_hair',
    callerPhone: '+15559871234',
    ts: new Date().toISOString(),
    rbCallId: 'rb_shop_cs_hair',
    telnyxCallControlId: 'cc_parent_hair',
    inboundDid: '+16187771064',
    routeKind: 'shop',
    purpose: 'openai_sip_leg',
  });

  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('{}', { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    shopsRepository,
    testingOpenAiFetch: fetchImpl,
  });

  const webhookId = 'wh_evt_client_state_shop';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_client_state_shop_1',
      sip_headers: [
        { name: 'To', value: '<sip:proj_dummy@sip.api.openai.com;transport=tls>;tag=x' },
        { name: 'From', value: 'sip:+15559871234@sip.example.com' },
        { name: 'X-Telnyx-Client-State', value: clientState },
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_client_state_shop_1/accept'));
  assert.equal(acceptCalls.length, 1);
  assert.ok(acceptCalls[0].body.includes('Willow Hair Lounge'));
  assert.ok(!acceptCalls[0].body.includes('ABC Nails Studio'));
});

test('shop SIP tools use original Call Control caller instead of the outbound OpenAI leg From number', () => {
  assert.equal(
    resolveSipCallerPhoneForTools({
      routeKind: 'shop',
      normalizedFrom: '+16187771064',
      callControlState: { routeKind: 'shop', callerPhone: '+15559871234' },
    }),
    '+15559871234',
  );
  assert.equal(
    resolveSipCallerPhoneForTools({
      routeKind: 'shop',
      normalizedFrom: '+16187771064',
      callControlState: null,
    }),
    '',
  );
});

test('shop SIP caller phone recovers from call log when client state is missing', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'cc-parent-leg-1',
    shopId: 'demo-shop',
    callerPhone: '+84978613802',
    destinationPhone: '+16187771064',
    requestId: 'rb-production-call-1',
  });

  const callerPhone = await resolveSipCallerPhoneForShopContext({
    routeKind: 'shop',
    normalizedFrom: '+16187771064',
    callControlState: null,
    shopId: 'demo-shop',
    rbCallId: 'rb-production-call-1',
    requestId: 'rb-production-call-1',
    callLogsRepository,
  });

  assert.equal(callerPhone, '+84978613802');
});

test('shop SIP caller phone stays empty when client state and call log are missing', async () => {
  const callerPhone = await resolveSipCallerPhoneForShopContext({
    routeKind: 'shop',
    normalizedFrom: '+16187771064',
    callControlState: null,
    shopId: 'demo-shop',
    rbCallId: 'rb-production-call-1',
    requestId: 'rb-production-call-1',
    callLogsRepository: new InMemoryCallLogsRepository(),
  });

  assert.equal(callerPhone, '');
});

test('openai SIP shop context recovers request id from stored OpenAI leg when client_state header is missing', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const voiceCallLegsRepository = new InMemoryVoiceCallLegsRepository();
  await voiceCallLegsRepository.createOrUpdateCallLeg({
    shopId: shop.id,
    rbCallId: 'rb-production-call-1',
    purpose: 'openai_sip_leg',
    callControlId: 'cc-openai-leg-1',
    parentCallControlId: 'cc-parent-leg-1',
    status: 'openai_leg_created',
  });

  const result = await resolveOpenAiSipShopRoomContext({
    shop,
    callId: 'rtc_fallback_should_not_be_used',
    sipHeaders: [{ name: 'X-Telnyx-Call-Control-Id', value: 'cc-openai-leg-1' }],
    voiceCallLegsRepository,
  });

  assert.equal(result.requestId, 'rb-production-call-1');
  assert.equal(result.rbCallId, 'rb-production-call-1');
  assert.equal(result.parentTelnyxCallControlId, 'cc-parent-leg-1');
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_demo_tools/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as { tools?: { name: string }[] };
  assert.ok(acceptJson.tools?.some((t) => t.name === 'demo_noop'));
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_shop_tools_1/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as {
    tools?: { name: string }[];
    tool_choice?: string;
  };
  assert.ok(acceptJson.tools?.some((t) => t.name === 'validate_appointment_time'));
  assert.ok(!acceptJson.tools?.some((t) => t.name === 'check_availability'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'create_booking'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'request_human_handoff'));
  assert.ok(!acceptJson.tools?.some((t) => t.name === 'transfer_to_user'));
  assert.equal(acceptJson.tool_choice, 'auto');
});

test('openai SIP calendar-integrated shop route includes check_availability when sideband enabled', async () => {
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
    shopsRepository: new CalendarIntegratedShopsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    telephonyService: new NoopTelephonyService(),
    testingOpenAiFetch: fetchImpl,
  });

  const did = '+17145550123';
  const webhookId = 'wh_evt_shop_calendar_tools';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_shop_calendar_tools_1',
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_shop_calendar_tools_1/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as {
    tools?: { name: string }[];
    tool_choice?: string;
  };
  assert.ok(acceptJson.tools?.some((t) => t.name === 'validate_appointment_time'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'check_availability'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'create_booking'));
  assert.ok(acceptJson.tools?.some((t) => t.name === 'request_human_handoff'));
  assert.ok(!acceptJson.tools?.some((t) => t.name === 'transfer_to_user'));
  assert.equal(acceptJson.tool_choice, 'auto');
});

test('openai SIP client_state routeKind demo uses public demo prompt and skips shop handoff tools', async () => {
  const { secret, raw } = whsecSecret();
  applyRequiredTestEnv({
    OPENAI_SIP_WEBHOOK_ENABLED: 'true',
    OPENAI_WEBHOOK_SECRET: secret,
    OPENAI_SIP_ACCEPT_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_SIP_SIDEBAND_ENABLED: 'false',
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
  });
  delete process.env.OPENAI_SIP_DEMO_DID_MAP_JSON;
  delete process.env.DEMO_PHONE_NAIL_SALON;
  delete process.env.DEMO_PHONE_HAIR_SALON;
  delete process.env.DEMO_PHONE_DAY_SPA;
  delete process.env.DEMO_PHONE_MED_SPA;
  delete process.env.DEMO_PHONE_BEAUTY_CLINIC;
  resetEnvCacheForTests();

  const shopDid = '+17145550123';
  const clientState = buildCallControlClientState({
    shopId: 'demo-shop',
    requestId: 'req_demo_cs_med',
    callerPhone: '+15559871234',
    ts: new Date().toISOString(),
    rbCallId: 'rb_demo_cs',
    telnyxCallControlId: 'cc_parent_demo',
    inboundDid: shopDid,
    routeKind: 'demo',
    demoVertical: 'med-spa',
    purpose: 'openai_sip_leg',
  });

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

  const webhookId = 'wh_evt_client_state_demo';
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const rawBody = JSON.stringify({
    type: 'realtime.call.incoming',
    data: {
      call_id: 'call_client_state_demo_1',
      sip_headers: [
        { name: 'To', value: `sip:${shopDid.replace('+', '')}@pstn.twilio.com` },
        { name: 'From', value: 'sip:+15559871234@sip.example.com' },
        { name: 'X-Telnyx-Client-State', value: clientState },
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

  const acceptCalls = calls.filter((c) => c.url.includes('/realtime/calls/call_client_state_demo_1/accept'));
  assert.equal(acceptCalls.length, 1);
  const acceptJson = JSON.parse(acceptCalls[0].body) as {
    instructions?: string;
    tools?: { name: string }[];
  };
  assert.ok(
    typeof acceptJson.instructions === 'string' && acceptJson.instructions.includes('Astra Med Spa'),
    'med-spa public demo default shop name',
  );
  assert.ok(
    typeof acceptJson.instructions === 'string' && !acceptJson.instructions.includes('RingBooker Demo Salon'),
    'must not use in-memory demo shop system prompt',
  );
  assert.ok(!acceptJson.tools?.some((t) => t.name === 'request_human_handoff'));
});
