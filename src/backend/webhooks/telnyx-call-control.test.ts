import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import {
  buildCallControlClientState,
  decodeCallControlClientState,
  handleTelnyxCallControlPhase1,
  isTelnyxCallControlDryRunEnv,
} from '@/src/backend/webhooks/telnyx-call-control';

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
  }
});
