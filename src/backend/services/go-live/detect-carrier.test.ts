import test from 'node:test';
import assert from 'node:assert/strict';

import { detectCarrierFromTelnyx } from '@/src/backend/services/go-live/detect-carrier';

test('detectCarrierFromTelnyx prefers portability carrier and maps to RingBooker carrier id', async () => {
  const calls: string[] = [];
  const result = await detectCarrierFromTelnyx({
    apiKey: 'test-key',
    phoneNumber: '(714) 555-1234',
    fetchImpl: async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({
        data: {
          portability: {
            spid_carrier_name: 'T-Mobile USA, Inc.',
            line_type: 'mobile',
            ported_status: 'Y',
          },
          carrier: { name: 'Fallback Carrier' },
        },
      }), { status: 200 });
    },
  });

  assert.equal(result.detected, true);
  assert.equal(result.carrier, 'tmobile');
  assert.equal(result.line_type, 'mobile');
  assert.equal(result.raw_carrier_name, 'T-Mobile USA, Inc.');
  assert.match(calls[0] ?? '', /number_lookup\/%2B17145551234\?carrier$/);
});

test('detectCarrierFromTelnyx falls back to carrier.name and unknown carriers map to other', async () => {
  const result = await detectCarrierFromTelnyx({
    apiKey: 'test-key',
    phoneNumber: '+17145551234',
    fetchImpl: async () => new Response(JSON.stringify({
      data: {
        portability: null,
        carrier: { name: 'Small Local Carrier' },
      },
    }), { status: 200 }),
  });

  assert.equal(result.detected, true);
  assert.equal(result.carrier, 'other');
  assert.equal(result.line_type, null);
  assert.equal(result.raw_carrier_name, 'Small Local Carrier');
});

test('detectCarrierFromTelnyx returns not detected on API failure', async () => {
  const result = await detectCarrierFromTelnyx({
    apiKey: 'test-key',
    phoneNumber: '+17145551234',
    fetchImpl: async () => new Response('nope', { status: 500 }),
  });

  assert.deepEqual(result, {
    detected: false,
    carrier: null,
    line_type: null,
    raw_carrier_name: null,
  });
});
