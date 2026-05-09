import test from 'node:test';
import assert from 'node:assert/strict';

import { requestHumanHandoffTool } from '@/src/agent/tools/request-human-handoff';
import { transferToUserTool } from '@/src/agent/tools/transfer-to-user';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';

function createShop(overrides?: Partial<Shop>): Shop {
  return {
    id: 'shop-live-handoff-test',
    name: 'Live Handoff Test Salon',
    phone_number: '+17145550000',
    user_phone: '+17145550001',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '24 hours',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    ...overrides,
  };
}

function createContext() {
  let transferCalls = 0;
  let handoffCalls = 0;

  const telephonyService: TelephonyService = {
    async transferLiveCallToUser() {
      transferCalls += 1;
      return { initiated: true, target: 'user' };
    },
    async createOutboundCall() {
      return { providerCallId: 'call-test' };
    },
    async requestHumanHandoffViaCallControl() {
      handoffCalls += 1;
      return { started: true, handoffId: 'handoff-test' };
    },
  };

  const ctx: AgentToolContext = {
    shop: createShop(),
    callerPhone: '+15550000000',
    requestId: 'req-live-handoff-billing-test',
    roomName: 'room-live-handoff-billing-test',
    calendarProvider: {} as AgentToolContext['calendarProvider'],
    jobsRepository: {} as AgentToolContext['jobsRepository'],
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService,
    parentTelnyxCallControlId: 'cc-parent-test',
    rbCallId: 'rb-call-test',
  };

  return {
    ctx,
    getTransferCalls: () => transferCalls,
    getHandoffCalls: () => handoffCalls,
  };
}

test('transfer_to_user fails closed when billing repositories are unavailable', async () => {
  const { ctx, getTransferCalls } = createContext();

  const result = await transferToUserTool(ctx, { reason: 'caller_requested_human' });

  if (!('error' in result)) {
    assert.fail('Expected transfer_to_user to fail closed.');
  }
  assert.equal(result.code, 'TRANSFER_FAILED');
  assert.equal(getTransferCalls(), 0);
});

test('request_human_handoff fails closed when billing repositories are unavailable', async () => {
  const { ctx, getHandoffCalls } = createContext();

  const result = await requestHumanHandoffTool(ctx, {
    reason: 'caller_requested_human',
    urgency: 'normal',
    summary: 'Caller wants to speak to the team.',
  });

  assert.equal(result.success, false);
  assert.equal(result.handoff_possible, false);
  assert.equal(result.fallback, 'send_summary');
  assert.equal(getHandoffCalls(), 0);
});
