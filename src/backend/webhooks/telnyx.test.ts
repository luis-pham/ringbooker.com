import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractTelnyxError,
  extractTelnyxOutboundMessageStatusEvent,
} from '@/src/backend/webhooks/telnyx';
import {
  buildOutboundDeliveryStatusMutation,
  isFinalOutboundSmsStatus,
} from '@/src/backend/services/sms/outbound-delivery-status';

test('extractTelnyxOutboundMessageStatusEvent parses outbound message.sent safely', () => {
  const event = extractTelnyxOutboundMessageStatusEvent({
    data: {
      event_type: 'message.sent',
      id: 'evt-out-sent-1',
      occurred_at: '2026-03-05T18:29:00.000Z',
      payload: {
        id: 'msg-out-sent-1',
        direction: 'outbound',
        from: { phone_number: '+15551234567' },
        to: [{ phone_number: '+15559876543', status: 'sent' }],
        text: 'Do not log this body',
      },
    },
  });

  assert.ok(event);
  assert.equal(event.eventId, 'evt-out-sent-1');
  assert.equal(event.eventType, 'message.sent');
  assert.equal(event.telnyxMessageId, 'msg-out-sent-1');
  assert.equal(event.fromNumber, '+15551234567');
  assert.equal(event.toNumber, '+15559876543');
  assert.equal(event.telnyxStatus, 'sent');
  assert.equal(event.occurredAt?.toISOString(), '2026-03-05T18:29:00.000Z');
});

test('extractTelnyxOutboundMessageStatusEvent parses finalized without optional fields', () => {
  const event = extractTelnyxOutboundMessageStatusEvent({
    data: {
      event_type: 'message.finalized',
      id: 'evt-out-finalized-1',
      payload: {
        id: 'msg-out-finalized-1',
        direction: 'outbound',
        from: { phone_number: '+15551234567' },
      },
    },
  });

  assert.ok(event);
  assert.equal(event.toNumber, null);
  assert.equal(event.telnyxStatus, null);
  assert.deepEqual(event.errors, []);
  assert.equal(event.completedAt, null);
});

test('extractTelnyxOutboundMessageStatusEvent ignores non-outbound and missing message id', () => {
  assert.equal(
    extractTelnyxOutboundMessageStatusEvent({
      data: {
        event_type: 'message.finalized',
        id: 'evt-inbound-status',
        payload: { id: 'msg-inbound', direction: 'inbound' },
      },
    }),
    null,
  );
  assert.equal(
    extractTelnyxOutboundMessageStatusEvent({
      data: {
        event_type: 'message.finalized',
        id: 'evt-missing-message-id',
        payload: { direction: 'outbound' },
      },
    }),
    null,
  );
});

test('extractTelnyxError handles known and unusual error shapes', () => {
  assert.deepEqual(
    extractTelnyxError([{ code: '40310', title: 'Message delivery failed', detail: 'Carrier rejected message' }]),
    { errorCode: '40310', errorMessage: 'Carrier rejected message' },
  );
  assert.deepEqual(extractTelnyxError(['raw carrier error']), {
    errorCode: null,
    errorMessage: 'raw carrier error',
  });
  assert.deepEqual(extractTelnyxError({ code: 'bad_shape' }), {
    errorCode: null,
    errorMessage: null,
  });
});

test('buildOutboundDeliveryStatusMutation maps delivery statuses and ignores final downgrades', () => {
  assert.equal(isFinalOutboundSmsStatus('delivered'), true);
  assert.deepEqual(
    buildOutboundDeliveryStatusMutation({
      currentStatus: 'submitted',
      eventType: 'message.finalized',
      telnyxStatus: 'delivered',
      occurredAt: new Date('2026-03-05T18:29:00.000Z'),
      completedAt: new Date('2026-03-05T18:30:00.000Z'),
    }),
    {
      kind: 'status',
      status: 'delivered',
      deliveredAt: new Date('2026-03-05T18:30:00.000Z'),
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  );
  assert.deepEqual(
    buildOutboundDeliveryStatusMutation({
      currentStatus: 'submitted',
      eventType: 'message.finalized',
      telnyxStatus: 'sending_failed',
      occurredAt: null,
      completedAt: new Date('2026-03-05T18:30:00.000Z'),
      errorCode: '40310',
      errorMessage: 'Carrier rejected message',
    }),
    {
      kind: 'status',
      status: 'send_failed',
      failedAt: new Date('2026-03-05T18:30:00.000Z'),
      errorCode: '40310',
      errorMessage: 'Carrier rejected message',
    },
  );
  assert.deepEqual(
    buildOutboundDeliveryStatusMutation({
      currentStatus: 'delivered',
      eventType: 'message.sent',
      telnyxStatus: 'sent',
      occurredAt: new Date('2026-03-05T18:29:00.000Z'),
      completedAt: null,
    }),
    { kind: 'ignored_downgrade' },
  );
});
