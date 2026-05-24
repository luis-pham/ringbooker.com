import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryForwardingTestSessionsRepository } from '@/src/backend/adapters/memory/forwarding-test-sessions-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

import { buildTelnyxTexmlDialOpenAiXml } from '@/src/backend/webhooks/telnyx-texml-openai-inbound';

const keyPair = generateKeyPairSync('ed25519');
const publicPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signTelnyxPayload(params: { body: string; timestamp: string }): string {
  const message = Buffer.from(`${params.timestamp}|${params.body}`, 'utf8');
  return sign(null, message, keyPair.privateKey).toString('base64');
}

test('TeXML unit: buildTelnyxTexmlDialOpenAiXml escapes XML in SIP URI', () => {
  const xml = buildTelnyxTexmlDialOpenAiXml('sip:proj_x&y@sip.api.openai.com;transport=tls');
  assert.ok(xml.includes('&amp;'));
  assert.ok(xml.includes('<Sip>'));
  assert.ok(xml.includes('</Sip>'));
});

test('TeXML inbound returns Dial XML for a signed request when OPENAI_SIP_URI set', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
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
  const ts = String(Math.floor(Date.now() / 1000));

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type')?.toLowerCase().split(';')[0], 'text/xml');
  const text = await res.text();
  assert.ok(text.includes('<Response>'));
  assert.ok(text.includes('<Dial'));
  assert.ok(text.includes('sip:proj_texml_test@sip.api.openai.com;transport=tls'));
  assert.ok(text.includes('</Dial>'));
});

test('TeXML inbound allows configured demo DID when real shops are routed through Call Control', async () => {
  const previous = {
    shopMode: process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE,
    demoMode: process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE,
    demoPhone: process.env.DEMO_PHONE_NAIL_SALON,
  };
  try {
    applyRequiredTestEnv({
      OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
      TELNYX_SHOP_INBOUND_ROUTING_MODE: 'call_control_to_openai_sip',
      TELNYX_DEMO_INBOUND_ROUTING_MODE: 'texml_to_openai_sip',
      DEMO_PHONE_NAIL_SALON: '+15550001001',
    });
    resetEnvCacheForTests();

    const demoSessionsRepository = new InMemoryDemoSessionsRepository();
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      demoSessionsRepository,
    });

    const body = new URLSearchParams({
      From: '+15551234001',
      To: '+15550001001',
      CallSid: 'CA_texml_demo_split',
    }).toString();
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.request('/telnyx/texml/inbound', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'telnyx-timestamp': ts,
        'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
      },
      body,
    });

    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('<Dial'));
    assert.ok(text.includes('sip:proj_texml_test@sip.api.openai.com;transport=tls'));
    const context = await demoSessionsRepository.findLatestSipDemoContext({ callerPhone: '+15551234001' });
    assert.equal(context?.verticalSlug, 'nail-salon');
    assert.equal(context?.shopName, 'ABC Nails Studio');
  } finally {
    if (previous.shopMode === undefined) delete process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE;
    else process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE = previous.shopMode;
    if (previous.demoMode === undefined) delete process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE;
    else process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE = previous.demoMode;
    if (previous.demoPhone === undefined) delete process.env.DEMO_PHONE_NAIL_SALON;
    else process.env.DEMO_PHONE_NAIL_SALON = previous.demoPhone;
    resetEnvCacheForTests();
  }
});

test('TeXML inbound rejects non-demo DID when real shops are routed through Call Control', async () => {
  const previous = {
    shopMode: process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE,
    demoMode: process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE,
    demoPhone: process.env.DEMO_PHONE_NAIL_SALON,
  };
  try {
    applyRequiredTestEnv({
      OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
      TELNYX_SHOP_INBOUND_ROUTING_MODE: 'call_control_to_openai_sip',
      TELNYX_DEMO_INBOUND_ROUTING_MODE: 'texml_to_openai_sip',
      DEMO_PHONE_NAIL_SALON: '+15550001001',
    });
    resetEnvCacheForTests();

    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
    });

    const body = new URLSearchParams({
      From: '+15551234001',
      To: '+15552223333',
      CallSid: 'CA_texml_shop_split',
    }).toString();
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.request('/telnyx/texml/inbound', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'telnyx-timestamp': ts,
        'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
      },
      body,
    });

    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('<Reject'));
    assert.ok(!text.includes('<Dial'));
  } finally {
    if (previous.shopMode === undefined) delete process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE;
    else process.env.TELNYX_SHOP_INBOUND_ROUTING_MODE = previous.shopMode;
    if (previous.demoMode === undefined) delete process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE;
    else process.env.TELNYX_DEMO_INBOUND_ROUTING_MODE = previous.demoMode;
    if (previous.demoPhone === undefined) delete process.env.DEMO_PHONE_NAIL_SALON;
    else process.env.DEMO_PHONE_NAIL_SALON = previous.demoPhone;
    resetEnvCacheForTests();
  }
});

test('TeXML inbound rejects a POST with an invalid signature', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
  });
  resetEnvCacheForTests();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const body = new URLSearchParams({
    From: '+15551234001',
    To: '+16265013960',
    CallSid: 'CA_texml_bad_sig',
  }).toString();
  const ts = String(Math.floor(Date.now() / 1000));

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': 'AAAAinvalidsignatureAAAA',
    },
    body,
  });

  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('<Reject'));
  assert.ok(!text.includes('<Dial'));
});

test('TeXML inbound GET never invokes mutable handler', async () => {
  applyRequiredTestEnv({});
  delete process.env.OPENAI_SIP_URI;
  resetEnvCacheForTests();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'GET',
  });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
});

test('unsigned TeXML POST does not mark forwarding test passed', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
  });
  resetEnvCacheForTests();

  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const forwardingTestSessionsRepository = new InMemoryForwardingTestSessionsRepository();

  const shop = await shopsRepository.create({
    name: 'TeXML Security Salon',
    phone_number: '+15551110001',
    user_phone: '+15551110002',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 30, price: 30 }],
    current_onboarding_step: 4,
    telnyx_number: '+15551119999',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethodStatus: 'valid',
  });
  await forwardingTestSessionsRepository.createSession({
    shopId: shop.id,
    forwardingNumber: '+15551119999',
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    forwardingTestSessionsRepository,
  });

  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      From: '+15550000000',
      To: '+15551119999',
      CallSid: 'CA_unsigned_spoof',
    }).toString(),
  });
  assert.equal(res.status, 200);

  const latest = await forwardingTestSessionsRepository.findLatestByShopId(shop.id);
  assert.equal(latest?.status, 'pending');
  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.equal(access?.forwardingSetupVerifiedAt ?? null, null);
});

test('TeXML production shop Dial always includes usage duration cap', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
  });
  resetEnvCacheForTests();

  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const shop = await shopsRepository.create({
    name: 'TeXML Live Salon',
    phone_number: '+15551110001',
    user_phone: '+15551110002',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 30, price: 30 }],
    current_onboarding_step: 4,
    telnyx_number: '+15552223333',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'professional',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    paymentMethodStatus: 'valid',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    goLiveAt: new Date().toISOString(),
    forwardingSetupVerifiedAt: new Date().toISOString(),
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    callLogsRepository,
  });

  const body = new URLSearchParams({
    From: '+15551234001',
    To: '+15552223333',
    CallSid: 'CA_texml_live_cap',
  }).toString();
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  const text = await res.text();
  assert.ok(text.includes('<Dial timeLimit="720">'));
});

test('TeXML production shop rejects when usage limits cannot be loaded', async () => {
  applyRequiredTestEnv({
    OPENAI_SIP_URI: 'sip:proj_texml_test@sip.api.openai.com;transport=tls',
    TELNYX_WEBHOOK_PUBLIC_KEY: publicPem,
  });
  resetEnvCacheForTests();

  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shop = await shopsRepository.create({
    name: 'TeXML Fail Closed Salon',
    phone_number: '+15551110001',
    user_phone: '+15551110002',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 30, price: 30 }],
    current_onboarding_step: 4,
    telnyx_number: '+15552224444',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'professional',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    paymentMethodStatus: 'valid',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    goLiveAt: new Date().toISOString(),
    forwardingSetupVerifiedAt: new Date().toISOString(),
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });

  const body = new URLSearchParams({
    From: '+15551234001',
    To: '+15552224444',
    CallSid: 'CA_texml_no_usage',
  }).toString();
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await app.request('/telnyx/texml/inbound', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': signTelnyxPayload({ body, timestamp: ts }),
    },
    body,
  });

  const text = await res.text();
  assert.ok(text.includes('<Reject'));
  assert.ok(!text.includes('<Dial'));
});
