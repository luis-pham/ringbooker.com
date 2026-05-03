import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryHandoffSessionsRepository } from '@/src/backend/adapters/memory/handoff-sessions-repository';
import { InMemoryVoiceCallLegsRepository } from '@/src/backend/adapters/memory/voice-call-legs-repository';
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

test('telnyx call-control call.answered invokes POST /v2/calls when bridge flag set', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    ...TELNYX_INBOUND_CALL_CONTROL_STACK,
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
    TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP: 'true',
    OPENAI_SIP_URI: 'sip:proj_test@sip.api.openai.com',
  });

  const urls: string[] = [];
  const testingTelnyxFetch: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ data: { call_control_id: 'cc_openai_leg' } }), { status: 200 });
  };

  const voiceCallLegsRepository = new InMemoryVoiceCallLegsRepository();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    voiceCallLegsRepository,
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
        client_state: buildCallControlClientState({
          shopId: 'demo-shop',
          requestId: 'req_parent_answered',
          rbCallId: 'req_parent_answered',
          callerPhone: '+14155550000',
          ts: new Date().toISOString(),
          telnyxCallControlId: 'cc_bridge_leg',
          inboundDid: '+15551110004',
          transport: 'openai_sip_direct',
          handoffTransport: 'telnyx_call_control',
        }),
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
  assert.equal(json.bridged, false);
  assert.equal(json.bridge_reason, 'openai_leg_created_waiting_answered');
  assert.ok(urls.some((u) => /\/v2\/calls$/.test(u)));
  const openaiLeg = await voiceCallLegsRepository.findOpenAiLegByRbCallId('demo-shop', 'req_parent_answered');
  assert.ok(openaiLeg);
  assert.equal(openaiLeg?.callControlId, 'cc_openai_leg');
});

test('telnyx call-control openai leg call.answered bridges to parent', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
    TELNYX_OPENAI_CONNECT_MODE: 'create_and_bridge',
  });
  const clientState = Buffer.from(
    JSON.stringify({
      shopId: 'demo-shop',
      requestId: 'req_openai_1',
      rbCallId: 'req_openai_1',
      callerPhone: '+14155550000',
      ts: new Date().toISOString(),
      telnyxCallControlId: 'cc_parent',
      parentCallControlId: 'cc_parent',
      purpose: 'openai_sip_leg',
      transport: 'openai_sip_direct',
      handoffTransport: 'telnyx_call_control',
    }),
    'utf8',
  ).toString('base64');

  let bridgeUrl = '';
  const testingTelnyxFetch: typeof fetch = async (input) => {
    bridgeUrl = String(input);
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
      id: 'evt-cc-openai-answered',
      payload: {
        call_control_id: 'cc_openai_leg',
        call_direction: 'outbound',
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
  assert.equal(json.phase, 'answered');
  assert.equal(json.bridged, true);
  assert.match(bridgeUrl, /\/v2\/calls\/cc_parent\/actions\/bridge$/);
});

test('telnyx call-control duplicate openai leg call.answered does not double bridge', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    ...TELNYX_INBOUND_CALL_CONTROL_STACK,
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
    TELNYX_OPENAI_CONNECT_MODE: 'create_and_bridge',
  });

  const clientState = Buffer.from(
    JSON.stringify({
      shopId: 'demo-shop',
      requestId: 'req_openai_dup',
      rbCallId: 'req_openai_dup',
      callerPhone: '+14155550000',
      ts: new Date().toISOString(),
      telnyxCallControlId: 'cc_parent_dup',
      parentCallControlId: 'cc_parent_dup',
      purpose: 'openai_sip_leg',
      transport: 'openai_sip_direct',
      handoffTransport: 'telnyx_call_control',
    }),
    'utf8',
  ).toString('base64');

  let bridgeCount = 0;
  const testingTelnyxFetch: typeof fetch = async (input) => {
    if (String(input).includes('/actions/bridge')) bridgeCount += 1;
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  const providerEventsRepository = new InMemoryProviderEventsRepository();
  const app = createBackendApp({
    providerEventsRepository,
    shopsRepository: new InMemoryShopsRepository(),
    testingTelnyxFetch,
  });

  async function postAnswered(eventId: string) {
    const body = JSON.stringify({
      data: {
        event_type: 'call.answered',
        id: eventId,
        payload: {
          call_control_id: 'cc_openai_dup',
          call_direction: 'outbound',
          client_state: clientState,
        },
      },
    });
    const ts = `${Date.now()}`;
    await new Promise((r) => setTimeout(r, 2));
    return app.request('/webhooks/telnyx/call-control', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'telnyx-timestamp': ts,
        'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
      },
      body,
    });
  }

  assert.equal((await postAnswered('evt-openai-dup-a')).status, 200);
  assert.equal((await postAnswered('evt-openai-dup-b')).status, 200);
  assert.equal(bridgeCount, 1);
});

test('telnyx call-control call.bridged with openai_sip_leg client_state returns bridged phase', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
  });

  const clientState = Buffer.from(
    JSON.stringify({
      shopId: 'demo-shop',
      requestId: 'req_bridged_evt',
      rbCallId: 'req_bridged_evt',
      callerPhone: '+14155550000',
      ts: new Date().toISOString(),
      telnyxCallControlId: 'cc_parent_br',
      parentCallControlId: 'cc_parent_br',
      purpose: 'openai_sip_leg',
      transport: 'openai_sip_direct',
      handoffTransport: 'telnyx_call_control',
    }),
    'utf8',
  ).toString('base64');

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.bridged',
      id: 'evt-cc-bridged-openai',
      payload: {
        call_control_id: 'cc_openai_br',
        peer_call_control_id: 'cc_parent_br',
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
  assert.equal(json.phase, 'bridged');
});

test('telnyx call-control owner DTMF 1 hangs up OpenAI leg before bridging to parent', async () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    ...TELNYX_INBOUND_CALL_CONTROL_STACK,
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
    TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: 'true',
    TELNYX_CALL_CONTROL_DRY_RUN: 'false',
  });

  const handoffSessionsRepository = new InMemoryHandoffSessionsRepository();
  const session = await handoffSessionsRepository.create({
    shopId: 'demo-shop',
    rbCallId: 'rb_handoff_order',
    idempotencyKey: 'idem_handoff_order',
    parentCallControlId: 'cc_parent_h',
    ownerPhone: '+15551234567',
    reason: 'caller_requested_human',
    urgency: 'normal',
    summary: 'Caller wants the owner',
    status: 'owner_screening_playing',
    callerPhone: '+14155550000',
  });
  await handoffSessionsRepository.update(session.id, {
    ownerCallControlId: 'cc_owner_h',
    openaiCallId: 'cc_openai_h',
  });

  const gatherClientState = Buffer.from(
    JSON.stringify({
      purpose: 'handoff_gather',
      handoffId: session.id,
      rbCallId: session.rbCallId,
      shopId: session.shopId,
      phase: 'gather_v1',
    }),
    'utf8',
  ).toString('base64');

  const telnyxUrls: string[] = [];
  const testingTelnyxFetch: typeof fetch = async (input) => {
    telnyxUrls.push(String(input));
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    handoffSessionsRepository,
    testingTelnyxFetch,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.gather.ended',
      id: 'evt-gather-owner-accept',
      payload: {
        call_control_id: 'cc_owner_h',
        client_state: gatherClientState,
        status: 'valid',
        digits: '1',
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

  const hangIdx = telnyxUrls.findIndex((u) => u.includes('/calls/cc_openai_h/actions/hangup'));
  const bridgeIdx = telnyxUrls.findIndex((u) => u.includes('/calls/cc_parent_h/actions/bridge'));
  assert.ok(hangIdx >= 0, 'expected hangup OpenAI leg');
  assert.ok(bridgeIdx >= 0, 'expected bridge parent to owner');
  assert.ok(hangIdx < bridgeIdx, 'hangup must precede bridge');

  const updated = await handoffSessionsRepository.findById(session.id);
  assert.equal(updated?.status, 'handoff_completed');
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
