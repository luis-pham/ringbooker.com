import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

import { buildTelnyxTexmlDialOpenAiXml } from '@/src/backend/webhooks/telnyx-texml-openai-inbound';

test('TeXML unit: buildTelnyxTexmlDialOpenAiXml escapes XML in SIP URI', () => {
  const xml = buildTelnyxTexmlDialOpenAiXml('sip:proj_x&y@sip.api.openai.com;transport=tls');
  assert.ok(xml.includes('&amp;'));
  assert.ok(xml.includes('<Sip>'));
  assert.ok(xml.includes('</Sip>'));
});

test('TeXML inbound returns Dial XML when OPENAI_SIP_URI set', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
  });
  resetEnvCacheForTests();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const body = new URLSearchParams({
    From: '+15551234001',
    To: '+16265013960',
    CallSid: 'CA_texml_integration',
  }).toString();

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type')?.toLowerCase().split(';')[0], 'text/xml');
  const text = await res.text();
  assert.ok(text.includes('<Response>'));
  assert.ok(text.includes('<Dial>'));
  assert.ok(text.includes('sip:proj_texml_test@sip.api.openai.com;transport=tls'));
  assert.ok(text.includes('</Dial>'));
});

test('TeXML inbound returns Reject XML when OPENAI_SIP_URI unset', async () => {
  applyRequiredTestEnv({});
  delete process.env.OPENAI_SIP_URI;
  resetEnvCacheForTests();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'GET',
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('<Reject'));
});
