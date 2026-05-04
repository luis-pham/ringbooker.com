import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { isShopCallable } from '@/src/backend/services/calls/callable-check';
import {
  buildCallControlClientState,
  decodeCallControlClientState,
  evaluateTelnyxCallControlInboundInitiated,
  handleTelnyxCallControlPhase1,
  isTelnyxCallControlDryRunEnv,
} from '@/src/backend/webhooks/telnyx-call-control';

function applyCallControlInboundStackEnv() {
  applyRequiredTestEnv({
    TELNYX_INBOUND_ROUTING_MODE: 'call_control_to_openai_sip',
    TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP: 'true',
    OPENAI_SIP_URI: 'sip:proj_test@sip.api.openai.com;transport=tls',
    VOICE_TRANSPORT: 'openai_sip_direct',
    HANDOFF_TRANSPORT: 'telnyx_call_control',
  });
}

function clearVerticalDemoPhoneEnv() {
  for (const k of [
    'DEMO_PHONE_NAIL_SALON',
    'DEMO_PHONE_HAIR_SALON',
    'DEMO_PHONE_DAY_SPA',
    'DEMO_PHONE_MED_SPA',
    'DEMO_PHONE_BEAUTY_CLINIC',
    'OPENAI_SIP_DEMO_DID_MAP_JSON',
  ]) {
    delete process.env[k];
  }
}

test('buildCallControlClientState produces stable base64 JSON', () => {
  const s = buildCallControlClientState({
    shopId: 's1',
    requestId: 'req',
    callerPhone: '+15551234567',
    ts: '2026-01-01T00:00:00.000Z',
  });
  const decoded = JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
  assert.deepEqual(decoded, {
    shopId: 's1',
    requestId: 'req',
    callerPhone: '+15551234567',
    ts: '2026-01-01T00:00:00.000Z',
  });
});

test('decodeCallControlClientState round-trips buildCallControlClientState', () => {
  const payload = {
    shopId: 'shop-x',
    requestId: 'rid',
    callerPhone: '+1',
    ts: '2026-05-01T12:00:00.000Z',
    routeKind: 'demo' as const,
    demoVertical: 'hair-salon',
    purpose: 'vertical_demo_inbound',
  };
  const encoded = buildCallControlClientState(payload);
  assert.deepEqual(decodeCallControlClientState(encoded), payload);
});

test('decodeCallControlClientState returns null on garbage', () => {
  assert.equal(decodeCallControlClientState('not-base64!!!'), null);
  assert.equal(decodeCallControlClientState(null), null);
});

test('handleTelnyxCallControlPhase1 returns dry_run for callable inbound call.initiated', async () => {
  const prev = process.env.TELNYX_CALL_CONTROL_DRY_RUN;
  resetEnvCacheForTests();
  applyCallControlInboundStackEnv();
  process.env.TELNYX_CALL_CONTROL_DRY_RUN = 'true';
  try {
    assert.equal(isTelnyxCallControlDryRunEnv(), true);

    const repo = new InMemoryShopsRepository();
    await repo.updateUserSettings('demo-shop', {
      telnyx_number: '+15551110002',
      phone_number: '+15552220002',
    });

    const raw = JSON.stringify({
      data: {
        event_type: 'call.initiated',
        id: 'evt_1',
        payload: {
          call_control_id: 'cc_test',
          to: '+15551110002',
          from: '+15559876543',
          direction: 'incoming',
        },
      },
    });

    const result = await handleTelnyxCallControlPhase1(raw, { shopsRepository: repo });
    assert.deepEqual(result.handled, true);
    if (!result.handled) assert.fail();
    assert.equal(result.decision, 'dry_run');
    assert.equal(result.shopId, 'demo-shop');
    assert.ok(result.clientState && result.clientState.length > 8);
    assert.equal(result.callControlId, 'cc_test');
  } finally {
    if (prev === undefined) delete process.env.TELNYX_CALL_CONTROL_DRY_RUN;
    else process.env.TELNYX_CALL_CONTROL_DRY_RUN = prev;
    resetEnvCacheForTests();
  }
});

test('handleTelnyxCallControlPhase1 rejects unknown DID', async () => {
  const repo = new InMemoryShopsRepository();
  const raw = JSON.stringify({
    data: {
      event_type: 'call.initiated',
      id: 'evt_2',
      payload: {
        call_control_id: 'cc_x',
        to: '+19999999999',
        from: '+15551111111',
        direction: 'inbound',
      },
    },
  });

  const result = await handleTelnyxCallControlPhase1(raw, { shopsRepository: repo });
  assert.deepEqual(result.handled, true);
  if (!result.handled) assert.fail();
  assert.equal(result.decision, 'reject');
  assert.equal(result.reason, 'unknown_did');
  assert.equal(result.reject_reason, 'shop_not_found');
  assert.equal(result.reject_cause_telnyx, 'CALL_REJECTED');
});

test('handleTelnyxCallControlPhase1 ignores non-initiated events', async () => {
  const repo = new InMemoryShopsRepository();
  const raw = JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt_3',
      payload: { call_control_id: 'cc_x' },
    },
  });

  const result = await handleTelnyxCallControlPhase1(raw, { shopsRepository: repo });
  assert.deepEqual(result, { handled: false, reason: 'unsupported_event' });
});

test('handleTelnyxCallControlPhase1 labels answer when dry run disabled', async () => {
  const prev = process.env.TELNYX_CALL_CONTROL_DRY_RUN;
  resetEnvCacheForTests();
  applyCallControlInboundStackEnv();
  process.env.TELNYX_CALL_CONTROL_DRY_RUN = 'false';
  try {
    const repo = new InMemoryShopsRepository();
    await repo.updateUserSettings('demo-shop', {
      telnyx_number: '+15551110003',
      phone_number: '+15552220002',
    });

    const raw = JSON.stringify({
      data: {
        event_type: 'call.initiated',
        id: 'evt_4',
        payload: {
          call_control_id: 'cc_live',
          to: '+15551110003',
          from: '+15550001111',
          call_direction: 'inbound',
        },
      },
    });

    const result = await handleTelnyxCallControlPhase1(raw, { shopsRepository: repo });
    assert.deepEqual(result.handled, true);
    if (!result.handled) assert.fail();
    assert.equal(result.decision, 'answer');
  } finally {
    if (prev === undefined) delete process.env.TELNYX_CALL_CONTROL_DRY_RUN;
    else process.env.TELNYX_CALL_CONTROL_DRY_RUN = prev;
    resetEnvCacheForTests();
  }
});

const demoVerticalCases: ReadonlyArray<{
  envKey: string;
  phone: string;
  vertical: string;
}> = [
  { envKey: 'DEMO_PHONE_NAIL_SALON', phone: '+15550001001', vertical: 'nail-salon' },
  { envKey: 'DEMO_PHONE_HAIR_SALON', phone: '+15550001002', vertical: 'hair-salon' },
  { envKey: 'DEMO_PHONE_DAY_SPA', phone: '+15550001003', vertical: 'day-spa' },
  { envKey: 'DEMO_PHONE_MED_SPA', phone: '+15550001004', vertical: 'med-spa' },
  { envKey: 'DEMO_PHONE_BEAUTY_CLINIC', phone: '+15550001005', vertical: 'beauty-clinic' },
];

for (const row of demoVerticalCases) {
  test(`evaluateTelnyxCallControlInboundInitiated demo vertical ${row.vertical}`, async () => {
    resetEnvCacheForTests();
    clearVerticalDemoPhoneEnv();
    applyCallControlInboundStackEnv();
    applyRequiredTestEnv({ PUBLIC_DEMO_SHOP_ID: 'demo-shop', [row.envKey]: row.phone });
    process.env.TELNYX_CALL_CONTROL_DRY_RUN = 'false';
    const repo = new InMemoryShopsRepository();
    const result = await evaluateTelnyxCallControlInboundInitiated(
      {
        call_control_id: `cc_demo_${row.vertical}`,
        direction: 'inbound',
        to: row.phone,
        from: '+15550009999',
      },
      { shopsRepository: repo },
    );
    assert.equal(result.handled, true);
    if (!result.handled) assert.fail();
    assert.equal(result.decision, 'answer');
    assert.equal(result.routeKind, 'demo');
    assert.equal(result.demoVertical, row.vertical);
    assert.equal(result.reason, 'vertical_demo_did_matched');
    assert.equal(result.resolver?.matchedBy, 'demo_number');
    assert.equal(result.resolver?.demoNumberMatched, true);
    assert.equal(result.resolver?.shopLookupSkippedForDemo, true);
    const decoded = decodeCallControlClientState(result.clientState ?? '');
    assert.equal(decoded?.routeKind, 'demo');
    assert.equal(decoded?.demoVertical, row.vertical);
    assert.equal(decoded?.purpose, 'vertical_demo_inbound');
    resetEnvCacheForTests();
    clearVerticalDemoPhoneEnv();
    delete process.env.TELNYX_CALL_CONTROL_DRY_RUN;
  });
}

test('evaluateTelnyxCallControlInboundInitiated demo DID wins over shop with same phone_number', async () => {
  resetEnvCacheForTests();
  clearVerticalDemoPhoneEnv();
  applyCallControlInboundStackEnv();
  const demoPhone = '+15558887701';
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    DEMO_PHONE_NAIL_SALON: demoPhone,
  });
  process.env.TELNYX_CALL_CONTROL_DRY_RUN = 'false';
  const repo = new InMemoryShopsRepository();
  const conflict = await repo.create({
    name: 'Conflict Shop',
    phone_number: demoPhone,
    user_phone: '+15550004000',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
  });
  await repo.updateUserSettings(conflict.id, {
    services: [{ name: 'Solo', duration_min: 15, price: 10 }],
  });
  const conflictShop = await repo.findById(conflict.id);
  assert.ok(conflictShop);
  const callable = isShopCallable(conflictShop);
  assert.equal(callable.ok, false);
  if (callable.ok) assert.fail();
  assert.equal(callable.reason, 'plan_requires_ai_config');

  const result = await evaluateTelnyxCallControlInboundInitiated(
    { call_control_id: 'cc_col', direction: 'inbound', to: demoPhone, from: '+15551111111' },
    { shopsRepository: repo },
  );
  assert.equal(result.handled, true);
  if (!result.handled) assert.fail();
  assert.equal(result.decision, 'answer');
  assert.equal(result.routeKind, 'demo');
  assert.equal(result.reason, 'vertical_demo_did_matched');
  assert.notEqual(result.reason, 'plan_requires_ai_config');

  resetEnvCacheForTests();
  clearVerticalDemoPhoneEnv();
  delete process.env.TELNYX_CALL_CONTROL_DRY_RUN;
});

test('evaluateTelnyxCallControlInboundInitiated production shop keeps routeKind shop', async () => {
  resetEnvCacheForTests();
  clearVerticalDemoPhoneEnv();
  applyCallControlInboundStackEnv();
  applyRequiredTestEnv({ PUBLIC_DEMO_SHOP_ID: 'demo-shop' });
  process.env.TELNYX_CALL_CONTROL_DRY_RUN = 'true';
  const repo = new InMemoryShopsRepository();
  await repo.updateUserSettings('demo-shop', {
    telnyx_number: '+15551110020',
    phone_number: '+15552220020',
  });

  const result = await evaluateTelnyxCallControlInboundInitiated(
    { call_control_id: 'cc_shop_route', direction: 'inbound', to: '+15551110020', from: '+15550001111' },
    { shopsRepository: repo },
  );
  assert.equal(result.handled, true);
  if (!result.handled) assert.fail();
  assert.equal(result.routeKind, 'shop');
  assert.equal(result.shopId, 'demo-shop');
  assert.equal(result.resolver?.matchedBy, 'telnyx_number');

  resetEnvCacheForTests();
  clearVerticalDemoPhoneEnv();
  delete process.env.TELNYX_CALL_CONTROL_DRY_RUN;
});
