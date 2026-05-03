import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryMissedCallsRepository } from '@/src/backend/adapters/memory/missed-calls-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { buildCallControlClientState } from '@/src/backend/webhooks/telnyx-call-control';

const keyPair = generateKeyPairSync('ed25519');
const publicPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signTelnyxPayload(params: { body: string; timestamp: string }): string {
  const message = Buffer.from(`${params.timestamp}|${params.body}`, 'utf8');
  return sign(null, message, keyPair.privateKey).toString('base64');
}

/** Env required for `evaluateTelnyxCallControlInboundInitiated` to reach answer/dry_run (voice stack gates). */
const TELNYX_INBOUND_CALL_CONTROL_STACK: Record<string, string> = {
  TELNYX_INBOUND_ROUTING_MODE: 'call_control_to_openai_sip',
  TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP: 'true',
  OPENAI_SIP_URI: 'sip:proj_test@sip.api.openai.com;transport=tls',
  VOICE_TRANSPORT: 'openai_sip_direct',
  HANDOFF_TRANSPORT: 'telnyx_call_control',
};

function callInitiatedBody(params: { id: string; to: string; from: string; callControlId: string }) {
  return JSON.stringify({
    data: {
      event_type: 'call.initiated',
      id: params.id,
      payload: {
        call_control_id: params.callControlId,
        to: params.to,
        from: params.from,
        direction: 'incoming',
      },
    },
  });
}

test('telnyx call-control webhook returns 404 when TELNYX_CALL_CONTROL_WEBHOOK_ENABLED is off', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'false',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
  });

  const body = callInitiatedBody({
    id: 'evt-cc-disabled',
    to: '+17145550123',
    from: '+14155550000',
    callControlId: 'cc_1',
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 404);
});

test('telnyx call-control webhook dry-run does not call Telnyx REST', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    ...TELNYX_INBOUND_CALL_CONTROL_STACK,
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'true',
  });

  let fetchCalls = 0;
  const testingTelnyxFetch: typeof fetch = async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15551110002',
    phone_number: '+15552220002',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    testingTelnyxFetch,
  });

  const body = callInitiatedBody({
    id: 'evt-cc-dry',
    to: '+15551110002',
    from: '+14155550000',
    callControlId: 'cc_dry',
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.ok, true);
  assert.equal(json.phase, 'initiated');
  assert.equal(json.decision, 'dry_run');
  assert.equal(fetchCalls, 0);
});

test('telnyx call-control webhook invokes answer when dry-run off', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    ...TELNYX_INBOUND_CALL_CONTROL_STACK,
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
  });

  let answerUrl = '';
  const testingTelnyxFetch: typeof fetch = async (input, init) => {
    answerUrl = String(input);
    assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15551110004',
    phone_number: '+15552220002',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    testingTelnyxFetch,
  });

  const body = callInitiatedBody({
    id: 'evt-cc-answer',
    to: '+15551110004',
    from: '+14155550000',
    callControlId: 'cc_answer',
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.ok, true);
  assert.equal(json.phase, 'initiated');
  assert.equal(json.decision, 'answer');
  assert.match(answerUrl, /\/v2\/calls\/cc_answer\/actions\/answer$/);
});

test('telnyx call-control webhook invokes reject for unknown DID when dry-run off', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
  });

  let rejectUrl = '';
  let rejectBody = '';
  const testingTelnyxFetch: typeof fetch = async (input, init) => {
    rejectUrl = String(input);
    rejectBody = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    testingTelnyxFetch,
  });

  const body = callInitiatedBody({
    id: 'evt-cc-reject',
    to: '+19999999999',
    from: '+14155550000',
    callControlId: 'cc_reject',
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.handled, true);
  assert.equal(json.phase, 'initiated');
  assert.equal(json.decision, 'reject');
  assert.equal(json.reject_reason, 'shop_not_found');
  assert.equal(json.reject_cause_telnyx, 'CALL_REJECTED');
  assert.deepEqual(JSON.parse(rejectBody), { cause: 'CALL_REJECTED' });
  assert.match(rejectUrl, /\/v2\/calls\/cc_reject\/actions\/reject$/);
});

test('telnyx call-control call.answered invokes dial when bridge flag set', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
    TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP: 'true',
    OPENAI_SIP_URI: 'sip:proj_test@sip.api.openai.com',
  });

  let dialUrl = '';
  const testingTelnyxFetch: typeof fetch = async (input) => {
    dialUrl = String(input);
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    testingTelnyxFetch,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.answered',
      id: 'evt-cc-answered-bridge',
      payload: {
        call_control_id: 'cc_bridge_leg',
        to: '+15551110004',
        call_direction: 'inbound',
      },
    },
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.phase, 'answered');
  assert.equal(json.bridged, true);
  assert.match(dialUrl, /\/v2\/calls\/cc_bridge_leg\/actions\/dial$/);
});

test('telnyx call-control call.hangup missed enqueues follow-up SMS job', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
  });

  const jobsRepository = new InMemoryJobsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15551110005',
    phone_number: '+15552220002',
  });

  const clientState = buildCallControlClientState({
    shopId: 'demo-shop',
    requestId: 'req-hangup-test',
    callerPhone: '+14155550111',
    ts: new Date().toISOString(),
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    jobsRepository,
    missedCallsRepository: new InMemoryMissedCallsRepository(),
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt-cc-hangup-missed',
      payload: {
        call_control_id: 'cc_hang',
        call_direction: 'inbound',
        hangup_cause: 'no_answer',
        to: '+15551110005',
        from: '+14155550111',
        client_state: clientState,
      },
    },
  });
  const ts = `${Date.now()}`;
  const res = await app.request('/webhooks/telnyx/call-control', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.phase, 'hangup');
  assert.equal(json.missed, true);

  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.ok(leased);
  assert.equal(leased.type, 'missed_call_followup_sms');
});
