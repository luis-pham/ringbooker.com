import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';

afterEach(() => {
  delete process.env.RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE;
});

test('billing access blocks go-live and live calls until payment method is verified', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Access Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const configured = await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  });
  assert.ok(configured);
  shop = configured;

  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'none',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: false,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const withoutPayment = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(withoutPayment.canGoLive, false);
  assert.equal(withoutPayment.canReceiveLiveCalls, false);
  assert.equal(withoutPayment.blockReason, 'payment_method_required');

  await billingSubscriptionsRepository.updateById(subscription.id, {
    provider: 'paddle',
    providerSubscriptionId: 'sub_verified',
    paymentMethodStatus: 'valid',
    paymentMethodAddedAt: '2026-05-04T00:00:00Z',
  });
  const paymentVerifiedButNotEnabled = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(paymentVerifiedButNotEnabled.canGoLive, true);
  assert.equal(paymentVerifiedButNotEnabled.canReceiveLiveCalls, false);
  assert.equal(paymentVerifiedButNotEnabled.blockReason, 'live_not_enabled');

  await shopAccessStatesRepository.upsert({ shopId: shop.id, liveCallsEnabled: true });
  const live = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(live.canGoLive, true);
  assert.equal(live.canReceiveLiveCalls, true);
});

test('backfilled forwarding_setup_verified_at (legacy_live) allows live calls when live enabled', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Legacy Backfill Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-04T12:00:00Z',
    forwardingSetupVerifiedVia: 'legacy_live',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.forwardingSetupVerified, true);
  assert.equal(access.canReceiveLiveCalls, true);
});

test('live enabled without forwarding verification blocks receive until backfill or grandfather', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Unverified Live Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    goLiveAt: '2026-05-02T00:00:00Z',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.forwardingSetupVerified, false);
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'forwarding_verification_required');
});

test('RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE restores receive for legacy go_live_at', async () => {
  process.env.RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE = '2026-06-01T00:00:00.000Z';

  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Grandfather Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    goLiveAt: '2026-05-02T00:00:00Z',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.forwardingSetupVerified, true);
  assert.equal(access.canReceiveLiveCalls, true);
});

test('grandfather does not apply when go_live_at is on or after cutoff', async () => {
  process.env.RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE = '2026-06-01T00:00:00.000Z';

  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Post Cutoff Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-12-31T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    goLiveAt: '2026-06-15T00:00:00Z',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-06-20T00:00:00Z') },
  );
  assert.equal(access.forwardingSetupVerified, false);
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'forwarding_verification_required');
});

test('live not enabled with forwarding verified yields live_not_enabled block reason', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Not Live Verified Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: false,
    goLiveAt: null,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'manual_confirmation',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.liveCallsEnabled, false);
  assert.equal(access.forwardingSetupVerified, true);
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'live_not_enabled');
});

test('live not enabled without forwarding verification cannot receive live calls', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Not Live Unverified Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: false,
    goLiveAt: null,
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.liveCallsEnabled, false);
  assert.equal(access.forwardingSetupVerified, false);
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'forwarding_verification_required');
});



test('enterprise without commercial approval cannot go live even with payment and forwarding ready', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Enterprise Salon Group',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'enterprise',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'enterprise',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 0,
    amountCents: 0,
    paymentMethodStatus: 'valid',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: false,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.canGoLive, false);
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'commercial_approval_required');
});

test('enterprise with commercial approval can go live when normal prerequisites are met', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  let shop = await shopsRepository.create({
    name: 'Approved Enterprise Salon Group',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    plan: 'enterprise',
    active: true,
  });
  shop = (await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '18:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+15559990001',
  }))!;

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'enterprise',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 0,
    amountCents: 0,
    paymentMethodStatus: 'valid',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
    commercialGoLiveApprovedAt: '2026-05-03T00:00:00Z',
    commercialGoLiveApprovedBy: 'admin@example.com',
    commercialGoLiveApprovalNote: 'Contract signed.',
  });

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z') },
  );
  assert.equal(access.canGoLive, true);
  assert.equal(access.canReceiveLiveCalls, true);
  assert.equal(access.blockReason, 'none');
});
