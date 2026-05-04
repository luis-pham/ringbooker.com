import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectOpenAiSipDidCandidates,
  parseOpenAiProjectUserFromSipTo,
  parseOpenAiSipDidMapJson,
  resolveOpenAiSipDemoDidFromHeaders,
  resolveOpenAiSipDidContext,
} from '@/src/backend/webhooks/openai-sip-did';

test('collectOpenAiSipDidCandidates preserves order and dedupes', () => {
  const headers = [
    { name: 'To', value: 'sip:first@x' },
    { name: 'to', value: 'sip:first@x' },
    { name: 'X-Telnyx-Called-Number', value: 'sip:+15551234001@telnyx.com' },
  ];
  assert.deepEqual(collectOpenAiSipDidCandidates(headers), ['sip:first@x', 'sip:+15551234001@telnyx.com']);
});

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

test('resolveOpenAiSipDidContext TeXML match when project id only comes from OPENAI_SIP_URI-style string', () => {
  const map = parseOpenAiSipDidMapJson(
    JSON.stringify([{ did: '+10000000000', vertical: 'day-spa', defaultShopName: 'Spa' }]),
  );
  const sipUri = 'sip:proj_from_uri_only@sip.api.openai.com;transport=tls';
  const ctx = resolveOpenAiSipDidContext({
    map,
    sipToValue: `<sip:proj_from_uri_only@sip.api.openai.com;transport=tls>;tag=x`,
    openAiRealtimeProjectId: parseOpenAiProjectUserFromSipTo(sipUri),
  });
  assert.ok(ctx);
  assert.equal(ctx?.vertical, 'day-spa');
});

test('resolveOpenAiSipDemoDidFromHeaders prefers X-Telnyx-Called-Number over TeXML OpenAI To', () => {
  const map = parseOpenAiSipDidMapJson(
    JSON.stringify([
      { did: '+11111111111', vertical: 'nail-salon', defaultShopName: 'A' },
      { did: '+12222222222', vertical: 'med-spa', defaultShopName: 'B' },
    ]),
  );
  const ctx = resolveOpenAiSipDemoDidFromHeaders({
    sipHeaders: [
      { name: 'To', value: '<sip:proj_texml_test@sip.api.openai.com;transport=tls>;tag=a' },
      { name: 'X-Telnyx-Called-Number', value: 'sip:+12222222222@telnyx.com' },
    ],
    map,
    sipToValue: '<sip:proj_texml_test@sip.api.openai.com;transport=tls>;tag=a',
    openAiRealtimeProjectId: 'proj_texml_test',
  });
  assert.ok(ctx);
  assert.equal(ctx?.vertical, 'med-spa');
  assert.equal(ctx?.defaultShopName, 'B');
});
