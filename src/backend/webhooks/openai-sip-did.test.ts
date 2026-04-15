import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseOpenAiProjectUserFromSipTo,
  parseOpenAiSipDidMapJson,
  resolveOpenAiSipDidContext,
} from '@/src/backend/webhooks/openai-sip-did';

test('parseOpenAiProjectUserFromSipTo reads proj user from OpenAI SIP To', () => {
  assert.equal(
    parseOpenAiProjectUserFromSipTo('<sip:proj_abc@sip.api.openai.com;transport=tls>;tag=x'),
    'proj_abc',
  );
  assert.equal(parseOpenAiProjectUserFromSipTo('sip:+15551234001@x'), null);
});

test('resolveOpenAiSipDidContext matches PSTN DID in To', () => {
  const map = parseOpenAiSipDidMapJson(
    JSON.stringify([{ did: '+15551234001', vertical: 'nail-salon', defaultShopName: 'N' }]),
  );
  const ctx = resolveOpenAiSipDidContext({
    map,
    sipToValue: 'sip:+15551234001@pstn.twilio.com',
    openAiRealtimeProjectId: 'proj_other',
  });
  assert.equal(ctx?.defaultShopName, 'N');
});

test('resolveOpenAiSipDidContext matches TeXML OpenAI SIP To using first map entry', () => {
  const map = parseOpenAiSipDidMapJson(
    JSON.stringify([{ did: '+16265013960', vertical: 'hair-salon', defaultShopName: 'Pilot' }]),
  );
  const ctx = resolveOpenAiSipDidContext({
    map,
    sipToValue: '<sip:proj_texml_test@sip.api.openai.com;transport=tls>;tag=a',
    openAiRealtimeProjectId: 'proj_texml_test',
  });
  assert.ok(ctx);
  assert.equal(ctx?.vertical, 'hair-salon');
  assert.equal(ctx?.defaultShopName, 'Pilot');
});
