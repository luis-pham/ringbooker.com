import test from 'node:test';
import assert from 'node:assert/strict';

import { createSipAgentToolContext, executeSipShopToolCall } from '@/src/agent/sip/sip-tool-executor';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import type { TelephonyService } from '@/src/backend/services/telephony/types';

function memoryDeps() {
  return {
    shopsRepository: new InMemoryShopsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    telephonyService: new NoopTelephonyService(),
  };
}

function transferOkTelephony(): TelephonyService {
  return {
    async requestHumanHandoffViaCallControl() {
      return { started: false, failureCode: 'test_stub' };
    },
    async transferLiveCallToUser() {
      return { initiated: true, target: 'user', providerCallId: 'sip-transfer-test' };
    },
    async createOutboundCall() {
      return {};
    },
  };
}

test('get_shop_info returns shop data', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-1',
    roomName: 'sip-room-exec-1',
    deps,
  });
  const json = await executeSipShopToolCall(ctx, 'get_shop_info', { query: 'hours' });
  assert.ok(json.includes(shop.name));
  assert.ok(json.includes('services'));
});

test('check_availability returns availability JSON', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-2',
    roomName: 'sip-room-exec-2',
    deps,
  });
  const validation = await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2026-06-01',
    time: '14:00',
  });
  assert.equal((JSON.parse(validation) as { valid?: boolean }).valid, true);
  const json = await executeSipShopToolCall(ctx, 'check_availability', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
  });
  assert.ok(json.includes('"available"'));
});

test('create_booking returns success for manual calendar shop', async () => {
  const deps = memoryDeps();
  await deps.shopsRepository.updateUserSettings('demo-shop', { booking_url: null });
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-3',
    roomName: 'sip-room-exec-3',
    deps,
  });
  const validation = await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2026-06-01',
    time: '14:00',
  });
  assert.equal((JSON.parse(validation) as { valid?: boolean }).valid, true);
  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Jane',
  });
  assert.ok(json.includes('"success":true'));
});

test('SIP booking-link flow enqueues SMS when caller wants to book and booking URL is configured', async () => {
  const deps = memoryDeps();
  await deps.shopsRepository.updateUserSettings('demo-shop', {
    booking_method: 'app',
    booking_url: 'https://booking.example/test-salon',
  });
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-booking-link-sms',
    roomName: 'sip-room-booking-link-sms',
    deps,
  });

  const json = await executeSipShopToolCall(ctx, 'send_booking_link', {
    callerName: 'Maya',
    serviceInterest: 'haircut',
  });
  const parsed = JSON.parse(json) as { success?: boolean; message?: string };
  assert.equal(parsed.success, true);
  assert.match(parsed.message ?? '', /\+15550001111/);

  const job = await deps.jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'sip-booking-link-test-worker',
  });
  assert.ok(job);
  assert.equal(job.type, 'booking_link_sms');
  assert.equal(job.shopId, shop.id);
  assert.equal(job.payload.toPhone, '+15550001111');
  assert.equal(job.payload.bookingUrl, 'https://booking.example/test-salon');
  assert.match(String(job.payload.message), /Maya/);
  assert.match(String(job.payload.message), /haircut/);
  assert.match(String(job.payload.message), /https:\/\/booking\.example\/test-salon/);
});

test('SIP booking decisions require validation for the exact appointment time', async () => {
  const deps = memoryDeps();
  const baseShop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(baseShop);
  const shop: Shop = {
    ...baseShop,
    hours: { monday: { open: '09:00', close: '17:00' } },
  };
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-validated-time',
    roomName: 'sip-room-validated-time',
    deps,
  });

  const beforeValidation = JSON.parse(await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2099-01-05',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Jane',
  })) as { code?: string };
  assert.equal(beforeValidation.code, 'APPOINTMENT_TIME_NOT_VALIDATED');

  const outsideHours = JSON.parse(await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2099-01-05',
    time: '20:00',
  })) as { valid?: boolean; messageForAi?: string };
  assert.equal(outsideHours.valid, false);
  assert.doesNotMatch(outsideHours.messageForAi ?? '', /\bcheck(?:ing)?\b/i);

  const accepted = JSON.parse(await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2099-01-05',
    time: '14:00',
  })) as { valid?: boolean };
  assert.equal(accepted.valid, true);

  const changedTime = JSON.parse(await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2099-01-05',
    time: '15:00',
    service: 'Manicure',
    customerName: 'Jane',
  })) as { code?: string };
  assert.equal(changedTime.code, 'APPOINTMENT_TIME_NOT_VALIDATED');
});

test('unknown tool returns error JSON', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-4',
    roomName: 'sip-room-exec-4',
    deps,
  });
  const json = await executeSipShopToolCall(ctx, 'unknown_tool_x', {});
  assert.ok(json.includes('Unknown tool'));
});

test('invalid create_booking input returns error JSON without throwing', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-5',
    roomName: 'sip-room-exec-5',
    deps,
  });
  const json = await executeSipShopToolCall(ctx, 'create_booking', { date: 'not-a-date' });
  const parsed = JSON.parse(json) as { error?: string };
  assert.ok(parsed.error);
});

test('request_human_handoff returns false when no parent Telnyx call_control_id (SIP direct)', async () => {
  const prevVt = process.env.VOICE_TRANSPORT;
  const prevH = process.env.HANDOFF_TRANSPORT;
  process.env.VOICE_TRANSPORT = 'openai_sip_direct';
  process.env.HANDOFF_TRANSPORT = 'telnyx_call_control';
  try {
    const deps = memoryDeps();
    const shop = await deps.shopsRepository.findById('demo-shop');
    assert.ok(shop);
    const ctx = createSipAgentToolContext({
      shop,
      callerPhone: '+15550001111',
      requestId: 'sip-handoff-1',
      roomName: 'sip-room-handoff-1',
      deps,
    });
    const json = await executeSipShopToolCall(ctx, 'request_human_handoff', {
      reason: 'caller_requested_human',
      urgency: 'normal',
      summary: 'Customer wants the owner',
    });
    const parsed = JSON.parse(json) as { handoff_possible?: boolean; success?: boolean };
    assert.equal(parsed.success, false);
    assert.equal(parsed.handoff_possible, false);
  } finally {
    if (prevVt === undefined) delete process.env.VOICE_TRANSPORT;
    else process.env.VOICE_TRANSPORT = prevVt;
    if (prevH === undefined) delete process.env.HANDOFF_TRANSPORT;
    else process.env.HANDOFF_TRANSPORT = prevH;
  }
});

test('transfer_to_user delegates to telephony when transfers allowed', async () => {
  const prevVt = process.env.VOICE_TRANSPORT;
  process.env.VOICE_TRANSPORT = 'livekit_media';
  try {
    const shopsRepo = new InMemoryShopsRepository();
    const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
    const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
    await shopsRepo.updateUserSettings('demo-shop', {
      sms_owner_opted_in: true,
      current_onboarding_step: 4,
      telnyx_number: '+15551239999',
    });
    await billingSubscriptionsRepository.upsert({
      shopId: 'demo-shop',
      provider: 'internal',
      plan: 'professional',
      status: 'active',
      interval: 'month',
      currency: 'USD',
      amount: 149,
      paymentMethodStatus: 'valid',
    });
    await shopAccessStatesRepository.upsert({
      shopId: 'demo-shop',
      liveCallsEnabled: true,
      forwardingSetupVerifiedAt: new Date().toISOString(),
      forwardingSetupVerifiedVia: 'forwarding_test',
    });
    const shop = await shopsRepo.findById('demo-shop');
    assert.ok(shop);
    const ctx = createSipAgentToolContext({
      shop,
      callerPhone: '+15550001111',
      requestId: 'sip-transfer-req',
      roomName: 'sip-room-transfer',
      deps: {
        shopsRepository: shopsRepo,
        jobsRepository: new InMemoryJobsRepository(),
        bookingsRepository: new InMemoryBookingsRepository(),
        callbacksRepository: new InMemoryCallbacksRepository(),
        telephonyService: transferOkTelephony(),
        billingSubscriptionsRepository,
        shopAccessStatesRepository,
      },
    });
    const json = await executeSipShopToolCall(ctx, 'transfer_to_user', { reason: 'Caller asks for the owner' });
    assert.ok(json.includes('"success":true'));
    assert.ok(json.includes('"target":"user"'));
  } finally {
    if (prevVt === undefined) delete process.env.VOICE_TRANSPORT;
    else process.env.VOICE_TRANSPORT = prevVt;
  }
});

test('unexpected calendar throw maps to JSON tool error via check_availability', async () => {
  const shop: Shop = {
    id: 'throw-shop',
    name: 'Throw Shop',
    phone_number: '+17145550123',
    user_phone: '+17145550199',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Manicure', duration_min: 30, price: 20 }],
    hours: { mon: { open: '09:00', close: '17:00' } },
    cancel_policy: '24h',
    allow_transfers: false,
    allow_callbacks: false,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: false,
    plan: 'starter',
    active: true,
    google_cal_credentials_encrypted: null,
  };

  const throwingCheck: AgentToolContext['calendarProvider'] = {
    shop,
    checkAvailability: async () => {
      throw new Error('forced_calendar_throw');
    },
    createBooking: async () => ({ bookingId: 'x', confirmed: true }),
    cancelBooking: async () => {},
    rescheduleBooking: async () => ({ bookingId: 'x', confirmed: true }),
  };

  const ctx: AgentToolContext = {
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-throw',
    roomName: 'sip-room-throw',
    calendarProvider: throwingCheck,
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
  };

  const json = await executeSipShopToolCall(ctx, 'check_availability', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
  });
  const parsed = JSON.parse(json) as { error?: string };
  assert.ok(typeof parsed.error === 'string' && parsed.error.length > 0);
});
