import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryOutboundMessagesRepository } from '@/src/backend/adapters/memory/outbound-messages-repository';
import type { Shop } from '@/src/backend/domain/types';
import { sendGuardedSms } from '@/src/backend/services/sms/guarded-sms';
import type { SmsService } from '@/src/backend/services/sms/types';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({ TELNYX_SMS_SENDER_NUMBER: '+15555550999' });

function smsShop(overrides?: Partial<Shop>): Shop {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Demo Shop',
    timezone: 'America/Los_Angeles',
    country_code: 'US',
    plan: 'professional',
    telnyx_number: '+15555550123',
    sms_quiet_hours_start: '00:00',
    sms_quiet_hours_end: '23:59',
    sms_owner_opted_in: true,
    ...overrides,
  } as Shop;
}

test('sendGuardedSms creates queued outbound record before provider send and marks submitted', async () => {
  const sent: Array<{ from: string; to: string; body: string }> = [];
  const smsService: SmsService = {
    async sendSms(params) {
      sent.push({ from: params.from, to: params.to, body: params.body });
      return {
        providerMessageId: 'msg-submitted-1',
        fromNumber: params.from,
        toNumber: params.to,
        status: 'queued',
        raw: { data: { id: 'msg-submitted-1', status: 'queued' } },
      };
    },
  };
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();

  const result = await sendGuardedSms({
    smsService,
    outboundMessagesRepository,
    shop: smsShop(),
    to: '+15555550110',
    body: 'Your appointment is confirmed',
    category: 'booking_confirmation',
    bookingId: '22222222-2222-4222-8222-222222222222',
    jobId: '33333333-3333-4333-8333-333333333333',
    idempotencyKey: 'sms:idempotent:submitted',
    audience: 'customer',
  });

  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.from, '+15555550123');

  const list = await outboundMessagesRepository.listAdminOutboundMessages({});
  assert.equal(list.total, 1);
  const record = list.items[0];
  assert.equal(record?.status, 'submitted');
  assert.equal(record?.attempts, 1);
  assert.equal(record?.fromNumber, '+15555550123');
  assert.equal(record?.toNumber, '+15555550110');
  assert.equal(record?.telnyxMessageId, 'msg-submitted-1');
  assert.deepEqual(record?.providerResponse, { data: { id: 'msg-submitted-1', status: 'queued' } });

  const duplicate = await sendGuardedSms({
    smsService,
    outboundMessagesRepository,
    shop: smsShop(),
    to: '+15555550110',
    body: 'Your appointment is confirmed',
    category: 'booking_confirmation',
    idempotencyKey: 'sms:idempotent:submitted',
    audience: 'customer',
  });

  assert.equal(duplicate.sent, true);
  assert.equal(sent.length, 1);
  assert.equal((await outboundMessagesRepository.listAdminOutboundMessages({})).total, 1);
});

test('sendGuardedSms marks outbound record send_failed when provider throws', async () => {
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const smsService: SmsService = {
    async sendSms() {
      throw new Error('telnyx_sms_send_failed:500');
    },
  };

  await assert.rejects(
    () =>
      sendGuardedSms({
        smsService,
        outboundMessagesRepository,
        shop: smsShop(),
        to: '+15555550111',
        body: 'Reminder',
        category: 'reminder_24h',
        idempotencyKey: 'sms:idempotent:failed',
        audience: 'customer',
      }),
    /telnyx_sms_send_failed:500/,
  );

  const record = (await outboundMessagesRepository.listAdminOutboundMessages({})).items[0];
  assert.equal(record?.status, 'send_failed');
  assert.equal(record?.attempts, 1);
  assert.equal(record?.errorCode, 'telnyx_sms_send_failed:500');
});

test('sendGuardedSms records missing from number without calling provider', async () => {
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  let providerCalls = 0;
  const smsService: SmsService = {
    async sendSms() {
      providerCalls += 1;
      return {};
    },
  };

  const result = await sendGuardedSms({
    smsService,
    outboundMessagesRepository,
    shop: smsShop({ telnyx_number: null }),
    to: '+15555550112',
    body: 'Reminder',
    category: 'reminder_2h',
    idempotencyKey: 'sms:idempotent:missing-from',
    audience: 'customer',
    allowGlobalFromFallback: false,
  });

  assert.equal(result.sent, false);
  assert.equal(result.reason, 'missing_from_number');
  assert.equal(providerCalls, 0);
  const record = (await outboundMessagesRepository.listAdminOutboundMessages({})).items[0];
  assert.equal(record?.status, 'send_failed');
  assert.equal(record?.errorCode, 'missing_from_number');
});
