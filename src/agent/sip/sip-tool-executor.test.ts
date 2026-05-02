import test from 'node:test';
import assert from 'node:assert/strict';

import { createSipAgentToolContext, executeSipShopToolCall } from '@/src/agent/sip/sip-tool-executor';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
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
  const json = await executeSipShopToolCall(ctx, 'check_availability', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
  });
  assert.ok(json.includes('"available"'));
});

test('create_booking returns success for manual calendar shop', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-exec-3',
    roomName: 'sip-room-exec-3',
    deps,
  });
  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Jane',
  });
  assert.ok(json.includes('"success":true'));
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

test('transfer_to_user delegates to telephony when transfers allowed', async () => {
  const shopsRepo = new InMemoryShopsRepository();
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
    },
  });
  const json = await executeSipShopToolCall(ctx, 'transfer_to_user', { reason: 'Caller asks for the owner' });
  assert.ok(json.includes('"success":true'));
  assert.ok(json.includes('"target":"user"'));
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
