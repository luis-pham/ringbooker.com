import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryForwardingTestSessionsRepository } from '@/src/backend/adapters/memory/forwarding-test-sessions-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
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
